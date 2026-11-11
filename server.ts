import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = process.cwd();

app.use(express.json({ limit: '15mb' }));

// In-memory store for OAuth token obtained during current session
let oauthAccessToken: string | null = null;

function getActiveGitHubToken(): { token: string | null; mode: 'oauth' | 'env_token' | 'none' } {
  if (oauthAccessToken) {
    return { token: oauthAccessToken, mode: 'oauth' };
  }
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0) {
    return { token: process.env.GITHUB_TOKEN.trim(), mode: 'env_token' };
  }
  return { token: null, mode: 'none' };
}

function getRedirectUri(req: express.Request): string {
  const baseUrl =
    process.env.APP_URL?.replace(/\/+$/, '') ||
    `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/auth/github/callback`;
}

// 1. Check GitHub Connection Status
app.get('/api/github/status', async (_req, res) => {
  const { token, mode } = getActiveGitHubToken();
  const oauthConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );

  if (!token) {
    res.json({
      connected: false,
      mode: 'none',
      oauthConfigured,
    });
    return;
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'KnowledgeGarden-App',
      },
    });

    if (!userRes.ok) {
      res.json({
        connected: false,
        mode: 'none',
        oauthConfigured,
      });
      return;
    }

    const user = (await userRes.json()) as { login: string; avatar_url?: string; html_url?: string };
    res.json({
      connected: true,
      username: user.login,
      avatarUrl: user.avatar_url,
      profileUrl: user.html_url,
      mode,
      oauthConfigured,
    });
  } catch {
    res.json({
      connected: false,
      mode: 'none',
      oauthConfigured,
    });
  }
});

// 2. Construct GitHub OAuth Provider URL (Popup Flow)
app.get('/api/github/auth/url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    res.status(400).json({
      error:
        'يرجى إضافة GITHUB_TOKEN أو (GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET) في لوحة الأسرار (Secrets) في AI Studio أولاً.',
    });
    return;
  }

  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo workflow',
  });

  res.json({
    url: `https://github.com/login/oauth/authorize?${params.toString()}`,
  });
});

// 3. GitHub OAuth Callback Handler (sends postMessage to opener and closes popup)
const githubCallbackHandler: express.RequestHandler = async (req, res) => {
  const code = String(req.query.code || '');
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!code || !clientId || !clientSecret) {
    res.status(400).send('Missing OAuth code or GitHub client credentials.');
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getRedirectUri(req),
      }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (tokenData.access_token) {
      oauthAccessToken = tokenData.access_token;
      res.setHeader(
        'Set-Cookie',
        'gh_connected=1; Path=/; Secure; SameSite=None; HttpOnly'
      );
    }
  } catch (err) {
    console.error('GitHub OAuth token exchange failed:', err);
  }

  res.send(`<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><title>تم ربط GitHub</title></head>
  <body style="background:#0B0F1A;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'github' }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
    <p>تم ربط حساب GitHub بنجاح! ستُغلق هذه النافذة تلقائياً...</p>
  </body>
</html>`);
};

app.get(['/auth/github/callback', '/auth/github/callback/'], githubCallbackHandler);

// Helper to collect project files for GitHub repository upload
function collectProjectFilesForGitHub(): Array<{ relPath: string; contentBase64: string }> {
  const excludeDirs = new Set([
    'node_modules',
    'dist',
    '.git',
    '.playwright-cli',
    '.aistudio',
    'release',
  ]);
  const excludeFiles = new Set([
    'KnowledgeGarden-Full-Project.zip',
    'image_8096d0aa.png',
    '.env',
  ]);

  const collected: Array<{ relPath: string; contentBase64: string }> = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        if (excludeFiles.has(entry.name)) continue;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        const buf = fs.readFileSync(fullPath);
        collected.push({
          relPath,
          contentBase64: buf.toString('base64'),
        });
      }
    }
  }

  walk(rootDir);
  return collected;
}

// 4. Publish Entire Project to User's GitHub Account & Enable GitHub Pages + Actions
app.post('/api/github/publish', async (req, res) => {
  const { token } = getActiveGitHubToken();
  if (!token) {
    res.status(401).json({
      error:
        'حساب GitHub غير متصل بعد. يرجى إضافة GITHUB_TOKEN في لوحة Secrets في AI Studio أو الربط عبر زر GitHub OAuth أولاً.',
    });
    return;
  }

  const rawRepoName = String(req.body?.repoName || 'knowledge-garden').trim();
  const repoName = rawRepoName.replace(/[^a-zA-Z0-9._-]/g, '-') || 'knowledge-garden';
  const isPrivate = Boolean(req.body?.isPrivate);

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'KnowledgeGarden-App',
  };

  try {
    // A. Get authenticated user
    const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
    if (!userRes.ok) {
      res.status(401).json({ error: 'تعذر التحقق من صلاحية حساب GitHub. تأكد من صلاحية التوكن.' });
      return;
    }
    const user = (await userRes.json()) as { login: string };
    const owner = user.login;

    // B. Check if repo exists; if not, create it with auto_init: true so main branch exists
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: ghHeaders,
    });

    if (checkRes.status === 404) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          name: repoName,
          description:
            'بستان المعرفة (Knowledge Garden) — تطبيق سطح مكتب (.EXE) وصفحة كروم مستقلة وتطبيق أندرويد مع شجرة المعرفة الحية',
          private: isPrivate,
          auto_init: true,
        }),
      });
      if (!createRes.ok) {
        const errBody = await createRes.text();
        res.status(400).json({ error: `تعذر إنشاء المستودع على GitHub: ${errBody}` });
        return;
      }
      // Wait briefly for GitHub to initialize main branch
      await new Promise((r) => setTimeout(r, 1500));
    }

    // C. Get latest commit SHA on main
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
      { headers: ghHeaders }
    );
    if (!refRes.ok) {
      res.status(400).json({ error: 'تعذر قراءة الفرع الرئيسي (main) في المستودع.' });
      return;
    }
    const refData = (await refRes.json()) as { object: { sha: string } };
    const latestCommitSha = refData.object.sha;

    // D. Create blobs for all project files
    const files = collectProjectFilesForGitHub();
    const treeItems: Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string;
    }> = [];

    for (const file of files) {
      const blobRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
        {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            content: file.contentBase64,
            encoding: 'base64',
          }),
        }
      );
      if (!blobRes.ok) {
        throw new Error(`تعذر رفع الملف ${file.relPath} إلى GitHub.`);
      }
      const blobData = (await blobRes.json()) as { sha: string };
      treeItems.push({
        path: file.relPath,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha,
      });
    }

    // E. Create tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          base_tree: latestCommitSha,
          tree: treeItems,
        }),
      }
    );
    if (!treeRes.ok) {
      throw new Error('تعذر إنشاء شجرة الملفات (Git Tree) على GitHub.');
    }
    const treeData = (await treeRes.json()) as { sha: string };

    // F. Create commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          message:
            'بستان المعرفة — رفع كامل للمشروع (PC .EXE + Chrome Standalone HTML + Android + Sync Code)',
          tree: treeData.sha,
          parents: [latestCommitSha],
        }),
      }
    );
    if (!commitRes.ok) {
      throw new Error('تعذر إنشاء Commit على GitHub.');
    }
    const commitData = (await commitRes.json()) as { sha: string };

    // G. Update main branch ref
    await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: ghHeaders,
        body: JSON.stringify({
          sha: commitData.sha,
          force: true,
        }),
      }
    );

    // H. Enable GitHub Pages (workflow mode) if public
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        build_type: 'workflow',
      }),
    }).catch(() => {});

    res.json({
      ok: true,
      owner,
      repoName,
      filesCount: files.length,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      actionsUrl: `https://github.com/${owner}/${repoName}/actions`,
      pagesUrl: `https://${owner}.github.io/${repoName}/`,
      standaloneDownloadUrl: `https://raw.githubusercontent.com/${owner}/${repoName}/main/public/KnowledgeGarden-Standalone.html`,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الرفع على GitHub',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Knowledge Garden Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
