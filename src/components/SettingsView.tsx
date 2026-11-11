import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  FileText,
  Gauge,
  Trash2,
  Database,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Smartphone,
  Monitor,
  Globe,
  FolderArchive,
} from 'lucide-react';
import { AnimationIntensity, AppSettings } from '../types';
import {
  exportFullBackupJSON,
  exportToMarkdown,
  generateOfflineTransferCode,
  importFullBackupJSON,
  restoreFromOfflineTransferCode,
  triggerFileDownload,
} from '../utils/backup';
import {
  clearStressTestEntries,
  generateStressTestEntries,
} from '../db/seedData';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsViewProps {
  settings: AppSettings;
  totalEntriesCount: number;
  stressEntriesCount: number;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onLoadSampleData: () => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  totalEntriesCount,
  stressEntriesCount,
  onUpdateSettings,
  onLoadSampleData,
  onRefreshData,
}) => {
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [stressProgress, setStressProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [generatedCode, setGeneratedCode] = useState('');
  const [inputTransferCode, setInputTransferCode] = useState('');
  const [isSyncBusy, setIsSyncBusy] = useState(false);

  // GitHub Direct Publisher state
  const [ghStatus, setGhStatus] = useState<{
    connected: boolean;
    username?: string;
    mode?: string;
    oauthConfigured?: boolean;
  }>({ connected: false });
  const [repoName, setRepoName] = useState('knowledge-garden');
  const [isPublishingGh, setIsPublishingGh] = useState(false);
  const [publishedResult, setPublishedResult] = useState<{
    repoUrl: string;
    actionsUrl: string;
    pagesUrl: string;
    standaloneDownloadUrl: string;
    filesCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const fetchGitHubStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setGhStatus(data);
      }
    } catch {
      // Offline or standalone HTML mode
    }
  }, []);

  React.useEffect(() => {
    void fetchGitHubStatus();
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        void fetchGitHubStatus();
        setStatusMsg({
          type: 'ok',
          text: 'تم ربط حسابك في GitHub بنجاح! يمكنك الآن ضغط «ابدأ الرفع على GitHub الآن» ✓',
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchGitHubStatus]);

  const handleConnectGitHubOAuth = async () => {
    try {
      const res = await fetch('/api/github/auth/url');
      const data = await res.json();
      if (!res.ok || !data.url) {
        setStatusMsg({
          type: 'err',
          text:
            data.error ||
            'لربط GitHub تلقائياً، أضف GITHUB_TOKEN أو (GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET) في لوحة Secrets في AI Studio، أو حمّل أداة Push-To-My-GitHub.bat بالأسفل.',
        });
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=600,height=720');
    } catch {
      setStatusMsg({
        type: 'err',
        text: 'تعذر فتح نافذة مصادقة GitHub.',
      });
    }
  };

  const handlePublishToGitHub = async () => {
    setIsPublishingGh(true);
    setPublishedResult(null);
    try {
      const res = await fetch('/api/github/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoName: repoName.trim() || 'knowledge-garden', isPrivate: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatusMsg({
          type: 'err',
          text:
            data.error ||
            'تعذر الرفع المباشر. تأكد من إضافة GITHUB_TOKEN في لوحة Secrets أو استخدم ملف Push-To-My-GitHub.bat المرفق.',
        });
        return;
      }
      setPublishedResult({
        repoUrl: data.repoUrl,
        actionsUrl: data.actionsUrl,
        pagesUrl: data.pagesUrl,
        standaloneDownloadUrl: data.standaloneDownloadUrl,
        filesCount: data.filesCount,
      });
      setStatusMsg({
        type: 'ok',
        text: `تم رفع ${data.filesCount} ملفاً إلى مستودعك (${data.repoUrl}) وتفعيل بناء ملف .EXE و GitHub Pages تلقائياً ✓`,
      });
    } catch {
      setStatusMsg({
        type: 'err',
        text: 'حدث خطأ أثناء الاتصال بخادم الرفع على GitHub.',
      });
    } finally {
      setIsPublishingGh(false);
    }
  };

  const handleGenerateTransferCode = async () => {
    setIsSyncBusy(true);
    try {
      const code = await generateOfflineTransferCode();
      setGeneratedCode(code);
      await onRefreshData();
      setStatusMsg({
        type: 'ok',
        text: 'تم توليد كود نقل البيانات المضغوط بنجاح! انسخ الكود وأدخله على جهازك الآخر (كمبيوتر أو أندرويد) لنقل جميع فوائدك فوراً ✓',
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذر توليد كود النقل',
      });
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleCopyTransferCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setStatusMsg({
        type: 'ok',
        text: 'تم نسخ كود النقل إلى الحافظة بنجاح ✓',
      });
    } catch {
      setStatusMsg({
        type: 'ok',
        text: 'تم تحديد الكود، يمكنك نسخه بـ Ctrl+C ✓',
      });
    }
  };

  const handleRestoreFromCode = async () => {
    if (!inputTransferCode.trim()) {
      setStatusMsg({
        type: 'err',
        text: 'يرجى لصق كود النقل (الذي يبدأ بـ KG1-) أولاً قبل الاستعادة.',
      });
      return;
    }
    setIsSyncBusy(true);
    try {
      const res = await restoreFromOfflineTransferCode(inputTransferCode);
      await onRefreshData();
      setInputTransferCode('');
      setStatusMsg({
        type: 'ok',
        text: `تم نقل ودمج البيانات بالكود بنجاح: ${res.groupsCount} مجموعات و ${res.entriesCount} فائدة بكامل التظليلات والإحداثيات ✓`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'كود النقل غير صالح أو غير مكتمل',
      });
    } finally {
      setIsSyncBusy(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      const json = await exportFullBackupJSON();
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerFileDownload(
        `knowledge-garden-backup-${dateStr}.json`,
        json,
        'application/json'
      );
      setStatusMsg({ type: 'ok', text: 'تم تصدير النسخة الاحتياطية (JSON) بنجاح ✓' });
      await onRefreshData();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء التصدير',
      });
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const md = await exportToMarkdown();
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerFileDownload(
        `knowledge-garden-${dateStr}.md`,
        md,
        'text/markdown;charset=utf-8'
      );
      setStatusMsg({ type: 'ok', text: 'تم تصدير جميع الفوائد بصيغة Markdown بنجاح ✓' });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء تصدير Markdown',
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importFullBackupJSON(text);
      await onRefreshData();
      setStatusMsg({
        type: 'ok',
        text: `تم استيراد ${res.groupsCount} مجموعات و ${res.entriesCount} فائدة بنجاح ✓`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleRunStressTest = async (count: number) => {
    setStressLoading(true);
    setStressProgress({ done: 0, total: count });
    try {
      await generateStressTestEntries(count, (done, total) => {
        setStressProgress({ done, total });
      });
      await onRefreshData();
      setStatusMsg({
        type: 'ok',
        text: `تم توليد ${count.toLocaleString('en-US')} فائدة تجريبية لاختبار الأداء العالي بنجاح! افتح شاشة «عقلي» لتجربة السلاسة.`,
      });
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء توليد بيانات الضغط',
      });
    } finally {
      setStressLoading(false);
      setStressProgress(null);
    }
  };

  const handleClearStressTest = async () => {
    setStressLoading(true);
    try {
      const removed = await clearStressTestEntries();
      await onRefreshData();
      setStatusMsg({
        type: 'ok',
        text: `تم حذف ${removed.toLocaleString('en-US')} فائدة من بيانات اختبار الضغط بنجاح.`,
      });
    } finally {
      setStressLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto px-4 md:px-8 py-6 pb-24 lg:pb-8 max-w-4xl mx-auto space-y-6">
      {statusMsg && (
        <div
          role="status"
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-medium ${
            statusMsg.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
          }`}
        >
          {statusMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 0. Direct GitHub Auto-Publisher (Server API + OAuth + Local Push Script) */}
      <section className="p-6 rounded-2xl bg-gradient-to-l from-emerald-950/70 via-slate-900/95 to-indigo-950/70 border border-emerald-500/40 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-kufi text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>الرفع المباشر على GitHub (إنشاء المستودع + بناء .EXE + تفعيل GitHub Pages)</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              يرفع جميع ملفات المشروع والنسخة المستقلة وإعدادات الأندرويد وملف بناء <span className="font-mono text-emerald-300">.EXE</span> مباشرة إلى حسابك في GitHub بضغطة زر.
            </p>
          </div>
          {ghStatus.connected ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold whitespace-nowrap">
              متصل بحساب GitHub: @{ghStatus.username} ✓
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConnectGitHubOAuth}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-semibold whitespace-nowrap transition-colors"
            >
              ربط حساب GitHub (OAuth)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label htmlFor="github-repo-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
              اسم المستودع على GitHub (Repository Name)
            </label>
            <input
              id="github-repo-name-input"
              type="text"
              dir="ltr"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="knowledge-garden"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
            />
          </div>
          <button
            type="button"
            disabled={isPublishingGh}
            onClick={handlePublishToGitHub}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
          >
            {isPublishingGh ? 'جارٍ رفع الملفات إلى GitHub...' : 'ابدأ الرفع على GitHub الآن'}
          </button>
        </div>

        {publishedResult && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-2 text-xs text-emerald-200">
            <div className="font-bold text-white">
              🎉 تم رفع المشروع بالكامل ({publishedResult.filesCount} ملفاً) إلى حسابك في GitHub!
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={publishedResult.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
              >
                فتح المستودع على GitHub ↗
              </a>
              <a
                href={publishedResult.actionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-semibold"
              >
                تحميل ملف .EXE من GitHub Actions ↗
              </a>
              <a
                href={publishedResult.pagesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
              >
                فتح رابط التطبيق الدائم (للبي سي والأندرويد) ↗
              </a>
            </div>
          </div>
        )}
      </section>

      {/* 1. Data Transfer Code between PC and Android Phone */}
      <section className="p-6 rounded-2xl bg-gradient-to-l from-violet-950/60 via-slate-900/90 to-emerald-950/50 border border-violet-500/35 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-kufi text-base font-bold text-white">
                كود نقل ومزامنة البيانات الفوري (بين الكمبيوتر والأندرويد)
              </h3>
              <p className="text-xs text-slate-300">
                انقل جميع مجموعاتك وفوائدك وتظليلاتك وشجرتك المعرفية بين جهاز الكمبيوتر وهاتفك الأندرويد بكود مشفر واحد بدون أي خادم خارجي
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 self-start sm:self-auto">
            تشفير وضغط GZIP محلي
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Generate Code Box */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-violet-300">
              ١. تصدير بيانات هذا الجهاز إلى كود نقل
            </div>
            <button
              type="button"
              disabled={isSyncBusy}
              onClick={handleGenerateTransferCode}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>توليد كود نقل بياناتي ({totalEntriesCount} فائدة)</span>
            </button>

            {generatedCode && (
              <div className="space-y-2 pt-1">
                <label htmlFor="generated-transfer-code" className="block text-[11px] text-slate-400">
                  كود النقل الجاهز (انسخه وأرسله لجهازك الآخر):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="generated-transfer-code"
                    type="text"
                    readOnly
                    dir="ltr"
                    value={generatedCode}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-mono text-emerald-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyTransferCode}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الكود</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Restore from Code Box */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <label
              htmlFor="restore-transfer-code-input"
              className="block text-xs font-semibold text-emerald-300"
            >
              ٢. استقبال ودمج البيانات من جهاز آخر بالكود
            </label>
            <input
              id="restore-transfer-code-input"
              type="text"
              dir="ltr"
              value={inputTransferCode}
              onChange={(e) => setInputTransferCode(e.target.value)}
              placeholder="KG1-H4sIAAAAAAAAA..."
              aria-label="أدخل كود النقل هنا"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
            <button
              type="button"
              disabled={isSyncBusy}
              onClick={handleRestoreFromCode}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>استعادة ودمج البيانات بالكود</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Multi-Platform Downloads Hub (Chrome Standalone HTML + PC .EXE + Android + GitHub ZIP) */}
      <section className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-violet-500" />
            <Smartphone className="w-5 h-5 text-emerald-500" />
            <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
              تحميل التطبيق لجميع أجهزتك (كمبيوتر .EXE + صفحة كروم مستقلة + أندرويد + GitHub)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            لحل مشكلة خطأ <span className="font-mono text-rose-400">Google 403</span> الذي يظهر عند فتح رابط المعاينة المؤقت خارج الجلسة، وفّرنا لك نسختين قابلتين للتحميل المباشر تعملان مدى الحياة بدون إنترنت وبدون أي خطأ 403 على الكمبيوتر والأندرويد:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Standalone Single-File Chrome HTML App */}
          <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-950/90 border border-violet-500/30 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-violet-400 font-bold text-xs">
                <Globe className="w-4 h-4 shrink-0" />
                <span>١. صفحة كروم المستقلة (للبي سي والأندرويد فوراً)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ملف واحد مستقل بالكامل (<span className="font-mono">.HTML</span>) يحتوي على التطبيق كاملاً بداخله. افتحه مباشرة في متصفح Google Chrome على الكمبيوتر أو أرسله لهاتفك الأندرويد ليفتح معك فوراً بضغطة واحدة بدون إنترنت وبدون خطأ 403.
              </p>
            </div>
            <a
              href="/KnowledgeGarden-Standalone.html"
              download="بستان-المعرفة-صفحة-كروم-مستقلة.html"
              onClick={() =>
                setStatusMsg({
                  type: 'ok',
                  text: 'بدأ تحميل ملف (بستان-المعرفة-صفحة-كروم-مستقلة.html) — افتحه مباشرة في كروم على الكمبيوتر أو الهاتف ✓',
                })
              }
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md transition-all text-center"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>تحميل كصفحة كروم مستقلة (.HTML)</span>
            </a>
          </div>

          {/* Card B: Full Project Archive (GitHub + Windows .EXE + Android Capacitor) */}
          <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-950/90 border border-emerald-500/30 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <FolderArchive className="w-4 h-4 shrink-0" />
                <span>٢. الحزمة الكاملة (GitHub + تطبيق PC .EXE + أندرويد)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                ملف مضغوط (<span className="font-mono">.ZIP</span>) جاهز للرفع على حسابك في GitHub، ويحتوي على مشغّل الكمبيوتر المحلي، وإعدادات Electron لبناء <span className="font-mono">.exe</span>، وإعدادات أندرويد، وملف GitHub Actions الذي يبني لك <span className="font-mono">.exe</span> تلقائياً وينشر التطبيق على GitHub Pages.
              </p>
            </div>
            <a
              href="/KnowledgeGarden-Full-Project.zip"
              download="KnowledgeGarden-Full-Project.zip"
              onClick={() =>
                setStatusMsg({
                  type: 'ok',
                  text: 'بدأ تحميل الحزمة الكاملة (KnowledgeGarden-Full-Project.zip) الجاهزة للكمبيوتر والأندرويد والرفع على GitHub ✓',
                })
              }
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all text-center"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>تحميل حزمة المشروع الكاملة (.ZIP)</span>
            </a>
          </div>
        </div>

        {/* PWA Direct Install if browser supports beforeinstallprompt */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            عند رفع الحزمة على GitHub، يقوم ملف <span className="font-mono text-emerald-400">.github/workflows/build-release.yml</span> ببناء ملف <span className="font-mono text-violet-400">KnowledgeGarden-Setup.exe</span> ونسخة الأندرويد تلقائياً في قسم Releases.
          </span>
          {isInstalled ? (
            <span className="text-xs font-semibold text-emerald-400 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              مثبّت كبرنامج مستقل ✓
            </span>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              تثبيت مباشر على الجهاز (PWA)
            </button>
          ) : null}
        </div>
      </section>

      {/* 3. Appearance & Motion Intensity */}
      <section className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
            المظهر وكثافة المؤثرات الحركية
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="settings-theme-select"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
            >
              السمة اللونية
            </label>
            <select
              id="settings-theme-select"
              value={settings.theme}
              onChange={(e) =>
                onUpdateSettings({ theme: e.target.value as 'dark' | 'light' })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            >
              <option value="dark">الوضع الليلي الفاخر (افتراضي)</option>
              <option value="light">الوضع النهاري المشرق</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-intensity-select"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
            >
              كثافة الحركة والجزيئات (Animation Intensity)
            </label>
            <select
              id="settings-intensity-select"
              value={settings.animationIntensity}
              onChange={(e) =>
                onUpdateSettings({
                  animationIntensity: e.target.value as AnimationIntensity,
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            >
              <option value="high">عالية (60 إطار/ثانية مع جزيئات ونبضات)</option>
              <option value="medium">متوسطة (توازن الأداء والجمال)</option>
              <option value="low">منخفضة (تقليل الحركات للأجهزة الهادئة)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-goal-input"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
            >
              الهدف اليومي للفوائد
            </label>
            <input
              id="settings-goal-input"
              type="number"
              min={1}
              max={50}
              value={settings.dailyGoal}
              onChange={(e) =>
                onUpdateSettings({
                  dailyGoal: Math.max(1, Number(e.target.value) || 3),
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* 4. Data Safety, Backup & Restore */}
      <section className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
                أمان البيانات والنسخ الاحتياطي بملفات (JSON / Markdown)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بياناتك محفوظة محلياً في IndexedDB مع تفعيل الحماية الدائمة ضد الحذف التلقائي
              </p>
            </div>
          </div>
          {settings.lastBackupAt && (
            <span className="text-xs text-slate-400 font-mono">
              آخر نسخ: {new Date(settings.lastBackupAt).toLocaleDateString('ar-EG')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة احتياطية شاملة (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span>استيراد نسخة احتياطية (JSON)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleExportMarkdown}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>تصدير بصيغة Markdown</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await onLoadSampleData();
              setStatusMsg({
                type: 'ok',
                text: 'تم تحميل البيانات التجريبية (3 مجموعات و 25 فائدة عربية أصيلة) بنجاح ✓',
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>تحميل بيانات تجريبية</span>
          </button>
        </div>
      </section>

      {/* 5. Scale & Stress Test (5,000 / 20,000 entries) */}
      <section className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Gauge className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
                اختبار الأداء الفائق والضغط العالي (Stress Test)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اختبر سلاسة المحرك الرسومي والقوائم الافتراضية مع 5,000 أو 20,000 فائدة، ثم احذفها بضغطة زر
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            الإجمالي الحالي: {totalEntriesCount.toLocaleString('en-US')}
          </span>
        </div>

        {stressProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-400">
              <span>جارٍ توليد الفوائد وحساب الإحداثيات المكانية...</span>
              <span className="font-mono">
                {stressProgress.done.toLocaleString('en-US')} /{' '}
                {stressProgress.total.toLocaleString('en-US')}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: `${Math.round((stressProgress.done / stressProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={stressLoading}
            onClick={() => handleRunStressTest(5000)}
            className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold disabled:opacity-50"
          >
            توليد 5,000 فائدة تجريبية
          </button>

          <button
            type="button"
            disabled={stressLoading}
            onClick={() => handleRunStressTest(20000)}
            className="px-4 py-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-xs font-semibold disabled:opacity-50"
          >
            توليد 20,000 فائدة تجريبية
          </button>

          {stressEntriesCount > 0 && (
            <button
              type="button"
              disabled={stressLoading}
              onClick={handleClearStressTest}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                حذف بيانات الاختبار ({stressEntriesCount.toLocaleString('en-US')})
              </span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

