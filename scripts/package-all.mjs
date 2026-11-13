import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(distDir)) {
  console.error('dist/ directory not found. Run vite build first.');
  process.exit(1);
}

// 1. Build 100% self-contained single-file HTML (KnowledgeGarden-Standalone.html)
const indexHtmlPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

const assetsDir = path.join(distDir, 'assets');
const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

const cssContents = assetFiles
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n');

const jsContents = assetFiles
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
  .join('\n');

// Remove external script/stylesheet asset tags and PWA registration that require external files
html = html.replace(/<script[^>]*src="[^"]*\/assets\/[^"]*"[^>]*><\/script>/g, '');
html = html.replace(/<link[^>]*href="[^"]*\/assets\/[^"]*"[^>]*>/g, '');
html = html.replace(/<link[^>]*rel="manifest"[^>]*>/g, '');
html = html.replace(/<script[^>]*src="[^"]*registerSW\.js"[^>]*><\/script>/g, '');

// Escape closing script tags inside JS bundle without $-pattern corruption
const safeJs = jsContents.replace(/<\/script>/gi, () => '<\\/script>');

// IMPORTANT: Use function replacement callbacks so $& and $' inside minified JS are never expanded!
const standaloneHtml = html
  .replace('</head>', () => `<style>\n${cssContents}\n</style>\n</head>`)
  .replace('</body>', () => `<script type="module">\n${safeJs}\n</script>\n</body>`);

const publicStandalonePath = path.join(publicDir, 'KnowledgeGarden-Standalone.html');
const distStandalonePath = path.join(distDir, 'KnowledgeGarden-Standalone.html');

fs.writeFileSync(publicStandalonePath, standaloneHtml, 'utf8');
fs.writeFileSync(distStandalonePath, standaloneHtml, 'utf8');
console.log(`Built standalone HTML: ${(standaloneHtml.length / (1024 * 1024)).toFixed(2)} MB`);

// 2. Build Full Project ZIP Archive using Python zipfile
const pyScript = `
import os, zipfile

root = os.getcwd()
zip_path = os.path.join(root, 'public', 'KnowledgeGarden-Full-Project.zip')
exclude_dirs = {'node_modules', 'dist', '.git', '.playwright-cli', '.aistudio'}
exclude_files = {'KnowledgeGarden-Full-Project.zip', 'image_8096d0aa.png'}

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        for fname in filenames:
            if fname in exclude_files:
                continue
            full_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(full_path, root)
            zf.write(full_path, rel_path)
    standalone_src = os.path.join(root, 'public', 'KnowledgeGarden-Standalone.html')
    if os.path.exists(standalone_src):
        zf.write(standalone_src, 'KnowledgeGarden-Standalone.html')
print("Created ZIP bytes:", os.path.getsize(zip_path))
`;

const res = spawnSync('python3', ['-c', pyScript], { stdio: 'inherit' });
if (res.status !== 0) {
  process.exit(res.status || 1);
}
fs.copyFileSync(
  path.join(publicDir, 'KnowledgeGarden-Full-Project.zip'),
  path.join(distDir, 'KnowledgeGarden-Full-Project.zip')
);
