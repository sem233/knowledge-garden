import React from 'react';
import { Search, Plus, Sun, Moon, Command, X, Menu, RefreshCw } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenNewEntry: () => void;
  onOpenCommandPalette: () => void;
  onOpenMobileMenu?: () => void;
  onOpenSyncSection?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTitle: string;
  activeSubtitle?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  onOpenNewEntry,
  onOpenCommandPalette,
  onOpenMobileMenu,
  onOpenSyncSection,
  theme,
  onToggleTheme,
  activeTitle,
  activeSubtitle,
}) => {
  return (
    <header className="sticky top-0 z-20 h-14 lg:h-16 px-3 sm:px-5 md:px-8 flex items-center justify-between gap-2 sm:gap-4 md:gap-8 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B0F1A]/90 backdrop-blur-xl shrink-0">
      {/* Zone 1: Mobile Menu Trigger + Current View Title */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="فتح قائمة المجموعات"
            className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        <h2 className="font-kufi text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white truncate max-w-[110px] sm:max-w-none">
          {activeTitle}
        </h2>
        {activeSubtitle && (
          <>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
              {activeSubtitle}
            </span>
          </>
        )}
      </div>

      {/* Zone 2: Instant Search Input */}
      <div className="flex-1 max-w-xl relative min-w-0">
        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          aria-label="بحث فوري في جميع الفوائد والوسوم والمجموعات"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث في الفوائد... (Ctrl+K)"
          className="w-full pr-8 sm:pr-10 pl-7 md:pl-20 py-1.5 sm:py-2 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/60 transition-all"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="مسح البحث"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="فتح لوحة الأوامر السريعة"
            className="hidden md:flex absolute left-2.5 top-1/2 -translate-y-1/2 items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <Command className="w-3 h-3" />
            <span>K</span>
          </button>
        )}
      </div>

      {/* Zone 3: Sync Code button, Theme Toggle & Primary "+ إضافة" CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {onOpenSyncSection && (
          <button
            type="button"
            onClick={onOpenSyncSection}
            title="كود نقل البيانات بين الكمبيوتر والهاتف"
            aria-label="كود نقل البيانات بين الكمبيوتر والهاتف"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-300 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>مزامنة</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenNewEntry}
          className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-600/25 transition-all active:scale-95 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة</span>
        </button>
      </div>
    </header>
  );
};

