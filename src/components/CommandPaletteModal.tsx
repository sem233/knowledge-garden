import React, { useState } from 'react';
import {
  Search,
  Plus,
  Brain,
  Calendar,
  BarChart3,
  Settings,
  Database,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import {
  ActiveSection,
  ENTRY_TYPE_META,
  KnowledgeEntry,
  KnowledgeGroup,
} from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: KnowledgeEntry[];
  groups: KnowledgeGroup[];
  onSelectSection: (sec: ActiveSection) => void;
  onOpenEntry: (entry: KnowledgeEntry) => void;
  onOpenNewEntry: () => void;
  onToggleTheme: () => void;
  onLoadSampleData: () => Promise<void>;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  entries,
  groups,
  onSelectSection,
  onOpenEntry,
  onOpenNewEntry,
  onToggleTheme,
  onLoadSampleData,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchingEntries = q
    ? entries
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.contentText.toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, 8)
    : entries.slice(0, 5);

  const quickActions = [
    {
      label: 'إضافة فائدة أو كلمة جديدة (Alt+N)',
      icon: Plus,
      run: () => {
        onClose();
        onOpenNewEntry();
      },
    },
    {
      label: 'الانتقال إلى «عقلي» (الدماغ العصبي وشجرة المعرفة)',
      icon: Brain,
      run: () => {
        onSelectSection('brain');
        onClose();
      },
    },
    {
      label: 'الانتقال إلى حصاد «اليوم»',
      icon: Calendar,
      run: () => {
        onSelectSection('today');
        onClose();
      },
    },
    {
      label: 'عرض «الإحصائيات» وخريطة النشاط السنوية',
      icon: BarChart3,
      run: () => {
        onSelectSection('stats');
        onClose();
      },
    },
    {
      label: 'تبديل الوضع الليلي / النهاري',
      icon: Sun,
      run: () => {
        onToggleTheme();
        onClose();
      },
    },
    {
      label: 'تحميل بيانات تجريبية (3 مجموعات و 25 فائدة)',
      icon: Database,
      run: async () => {
        await onLoadSampleData();
        onClose();
      },
    },
    {
      label: 'فتح الإعدادات والنسخ الاحتياطي',
      icon: Settings,
      run: () => {
        onSelectSection('settings');
        onClose();
      },
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 backdrop-blur-sm pt-20 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر والبحث السريع"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-violet-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن فائدة، كلمة، وسم، أو نفّذ أمراً سريعاً..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة الأوامر"
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Matching Entries */}
          {matchingEntries.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 text-[11px] font-semibold text-slate-400">
                {q ? 'نتائج الفوائد المطابقة' : 'أحدث الفوائد'}
              </div>
              {matchingEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEntry(entry);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-violet-500/15 text-right transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {entry.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {entry.contentText}
                    </div>
                  </div>
                  <span className="text-[11px] text-violet-400 shrink-0 mr-3">
                    {ENTRY_TYPE_META[entry.type].label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Groups */}
          {groups.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 text-[11px] font-semibold text-slate-400">
                المجموعات المعرفية
              </div>
              <div className="flex flex-wrap gap-1.5 px-2">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onSelectSection(g.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-violet-500/20 text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Commands */}
          <div className="space-y-1">
            <div className="px-2.5 text-[11px] font-semibold text-slate-400">
              أوامر سريعة
            </div>
            {quickActions.map((act) => {
              const Icon = act.icon || Moon;
              return (
                <button
                  key={act.label}
                  type="button"
                  onClick={act.run}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-xs text-slate-700 dark:text-slate-200 transition-colors"
                >
                  <Icon className="w-4 h-4 text-violet-400" />
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
