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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerateTransferCode = async () => {
    setIsSyncBusy(true);
    try {
      const code = await generateOfflineTransferCode();
      setGeneratedCode(code);
      await onRefreshData();
      setStatusMsg({
        type: 'ok',
        text: 'تم توليد كود نقل البيانات المشفر بنجاح! انسخ الكود وأدخله على جهازك الآخر لنقل جميع فوائدك فوراً ✓',
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
        text: 'تم تحديد الكود، يمكنك نسخه الآن ✓',
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
        text: `تم نقل ودمج البيانات بالكود بنجاح: ${res.groupsCount} مجموعات و ${res.entriesCount} فائدة بكامل التظليلات ✓`,
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
        text: `تم توليد ${count.toLocaleString('en-US')} فائدة بسرعة فائقة! افتح شاشة «عقلي» لتجربة رسومات 120 FPS بدون أي تقطيع ✓`,
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
    <div className="h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)] overflow-y-auto px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 pb-24 lg:pb-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {statusMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs font-medium ${
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

      {/* 1. Data Transfer Code between PC and Android Phone */}
      <section className="p-4 sm:p-6 rounded-2xl bg-gradient-to-l from-violet-950/60 via-slate-900/90 to-emerald-950/50 border border-violet-500/35 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-kufi text-sm sm:text-base font-bold text-white">
                كود نقل ومزامنة البيانات الفوري (بين الكمبيوتر والهاتف)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300">
                انقل جميع مجموعاتك وفوائدك وتظليلاتك وشجرتك المعرفية بين أجهزتك بكود مشفر واحد
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 self-start sm:self-auto">
            ضغط GZIP محلي
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Generate Code Box */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
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
              <span>توليد كود نقل بياناتي ({totalEntriesCount.toLocaleString('en-US')} فائدة)</span>
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
                    <span>نسخ</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Restore from Code Box */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
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

      {/* 2. Appearance & 120Hz Motion Intensity */}
      <section className="p-4 sm:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h3 className="font-kufi text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            المظهر ومعدل الإطارات الفائق (120 FPS Ultra)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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
              دقة الجرافيكس ومعدل الإطارات
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
              <option value="high">فائقة (120 FPS Ultra + إضاءة ثلاثية الأبعاد)</option>
              <option value="medium">متوسطة (توازن الأداء والجمال)</option>
              <option value="low">هادئة (توفير الطاقة)</option>
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

      {/* 3. Data Safety, Backup & Restore */}
      <section className="p-4 sm:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <h3 className="font-kufi text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                النسخ الاحتياطي واستعادة الملفات (JSON / Markdown)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                جميع فوائدك محفوظة محلياً بأمان تام على جهازك
              </p>
            </div>
          </div>
          {settings.lastBackupAt && (
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              آخر نسخ: {new Date(settings.lastBackupAt).toLocaleDateString('ar-EG')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة احتياطية (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span>استيراد ملف (JSON)</span>
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>تحميل بيانات تجريبية</span>
          </button>
        </div>
      </section>

      {/* 4. Scale & Stress Test (5,000 / 20,000 entries) */}
      <section className="p-4 sm:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Gauge className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h3 className="font-kufi text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                اختبار الأداء الفائق والضغط العالي (120 FPS Stress Test)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                اختبر سلاسة الدماغ العصبي وشجرة المعرفة الواقعية مع 5,000 أو 20,000 فائدة بدون أي تقطيع أو بكسلة
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 shrink-0">
            الإجمالي: {totalEntriesCount.toLocaleString('en-US')}
          </span>
        </div>

        {stressProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-400">
              <span>جارٍ توليد الفوائد وبناء الطبقات الرسومية...</span>
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

        <div className="flex flex-wrap items-center gap-2.5">
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
