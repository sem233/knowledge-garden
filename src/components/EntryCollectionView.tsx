import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  LayoutGrid,
  List,
  Columns,
  Clock,
  Sparkles,
  Plus,
  Database,
} from 'lucide-react';
import {
  CardTemplate,
  ENTRY_TYPE_META,
  EntryType,
  GroupLayoutMode,
  KnowledgeEntry,
  KnowledgeGroup,
  SortOption,
} from '../types';
import { EntryCard } from './EntryCard';
import { AnimatedCounter } from './GroupIcon';

interface EntryCollectionViewProps {
  entries: KnowledgeEntry[];
  groups: KnowledgeGroup[];
  activeGroup?: KnowledgeGroup;
  isTodayView?: boolean;
  dailyGoal?: number;
  todayCount?: number;
  newlyCreatedId: string | null;
  onOpenEntry: (entry: KnowledgeEntry) => void;
  onOpenNewEntry: () => void;
  onLoadSampleData: () => Promise<void>;
  onTogglePin: (entry: KnowledgeEntry, e: React.MouseEvent) => void;
  onShuffleStyle: (entry: KnowledgeEntry, e: React.MouseEvent) => void;
  onPickStyle: (
    entry: KnowledgeEntry,
    patch: { hue?: number; template?: CardTemplate },
    e: React.MouseEvent
  ) => void;
  onDeleteEntry: (entry: KnowledgeEntry, e: React.MouseEvent) => void;
}

export const EntryCollectionView: React.FC<EntryCollectionViewProps> = ({
  entries,
  groups,
  activeGroup,
  isTodayView = false,
  dailyGoal = 3,
  todayCount = 0,
  newlyCreatedId,
  onOpenEntry,
  onOpenNewEntry,
  onLoadSampleData,
  onTogglePin,
  onShuffleStyle,
  onPickStyle,
  onDeleteEntry,
}) => {
  const [layoutMode, setLayoutMode] = useState<GroupLayoutMode>(
    activeGroup?.defaultLayout || 'mixed'
  );
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterType, setFilterType] = useState<EntryType | 'all'>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [randomSeed, setRandomSeed] = useState(1);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // Top tags in current collection
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (let i = 0; i < Math.min(entries.length, 600); i++) {
      for (const t of entries[i].tags) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [entries]);

  const filteredAndSorted = useMemo(() => {
    let list = entries;
    if (filterType !== 'all') {
      list = list.filter((e) => e.type === filterType);
    }
    if (filterTag !== 'all') {
      list = list.filter((e) => e.tags.includes(filterTag));
    }

    const copy = [...list];
    switch (sortBy) {
      case 'newest':
        copy.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        copy.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'pinned':
        copy.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt - a.createdAt);
        break;
      case 'random':
        copy.sort(
          (a, b) =>
            ((a.style.seed * randomSeed) % 997) - ((b.style.seed * randomSeed) % 997)
        );
        break;
    }
    return copy;
  }, [entries, filterType, filterTag, sortBy, randomSeed]);

  // Determine columns based on layoutMode
  const columns =
    layoutMode === 'list' || layoutMode === 'timeline' ? 1 : layoutMode === 'masonry' ? 3 : 2;

  const rowCount = Math.ceil(filteredAndSorted.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (layoutMode === 'list' ? 185 : 275),
    overscan: 4,
  });

  const goalRatio = Math.min(1, todayCount / Math.max(1, dailyGoal));
  const ringCircumference = 2 * Math.PI * 36;
  const ringOffset = ringCircumference * (1 - goalRatio);

  return (
    <div ref={parentRef} className="h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)] overflow-y-auto px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 pb-24 lg:pb-8 space-y-4 sm:space-y-6">
      {/* Today Hero Banner with Daily Goal Ring */}
      {isTodayView && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-l from-violet-950/75 via-indigo-950/60 to-slate-900/80 border border-violet-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 shadow-xl">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="text-[11px] sm:text-xs font-medium text-violet-300">
              حصاد اليوم المعرفي · {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <h3 className="font-kufi text-lg sm:text-2xl font-bold text-white leading-snug">
              {todayCount >= dailyGoal
                ? 'أحسنت! أتممت وردك المعرفي لهذا اليوم 🌟'
                : 'ماذا تعلمت اليوم لتغذي به شجرة معرفتك؟'}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-300 max-w-xl leading-relaxed">
              كل فائدة أو كلمة أو حكمة تقيّدها اليوم تتحول فوراً إلى خلية عصبية مضيئة في دماغك المعرفي وورقة خضراء في شجرتك.
            </p>
          </div>

          {/* Animated Daily Goal SVG Ring */}
          <div className="w-full md:w-auto flex items-center gap-4 shrink-0 bg-slate-950/50 px-4 py-3 rounded-2xl border border-white/10">
            <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
              <svg className="w-14 h-14 sm:w-20 sm:h-20 -rotate-90" viewBox="0 0 88 88">
                <circle
                  cx="44"
                  cy="44"
                  r="36"
                  fill="none"
                  stroke="rgba(139, 92, 246, 0.18)"
                  strokeWidth="7"
                />
                <circle
                  cx="44"
                  cy="44"
                  r="36"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xs sm:text-sm font-bold text-white tabular-nums">
                  {todayCount}/{dailyGoal}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400">هدف اليوم</span>
              </div>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xs font-semibold text-white">مؤشر الإنجاز اليومي</div>
              <div className="text-[11px] sm:text-xs text-slate-400">
                سجلت اليوم <AnimatedCounter value={todayCount} className="text-emerald-400 font-bold" /> فوائد
              </div>
              <button
                type="button"
                onClick={onOpenNewEntry}
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>أضف فائدة جديدة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Filter & Layout Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/70 dark:border-slate-800/70">
        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-300/50 dark:border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الكل ({entries.length})
          </button>
          {(Object.keys(ENTRY_TYPE_META) as EntryType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filterType === t
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {ENTRY_TYPE_META[t].label}
            </button>
          ))}
        </div>

        {/* Sort & Layout Mode Controls */}
        <div className="flex items-center gap-3">
          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <select
              aria-label="تصفية حسب الوسم"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200"
            >
              <option value="all">جميع الوسوم</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}

          {/* Sort Select */}
          <select
            aria-label="ترتيب الفوائد"
            value={sortBy}
            onChange={(e) => {
              const val = e.target.value as SortOption;
              setSortBy(val);
              if (val === 'random') setRandomSeed((s) => s + 1);
            }}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200"
          >
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
            <option value="pinned">المثبتة بالنجوم ⭐</option>
            <option value="random">عشوائي للاستذكار 🎲</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/80 border border-slate-300/50 dark:border-slate-800">
            {[
              { id: 'mixed', label: 'متنوع', icon: Sparkles },
              { id: 'grid', label: 'شبكة', icon: LayoutGrid },
              { id: 'masonry', label: 'فسيفساء', icon: Columns },
              { id: 'list', label: 'قائمة', icon: List },
              { id: 'timeline', label: 'زمني', icon: Clock },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLayoutMode(m.id as GroupLayoutMode)}
                  aria-label={`عرض ${m.label}`}
                  title={`عرض ${m.label}`}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layoutMode === m.id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty State with Animated SVG */}
      {filteredAndSorted.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5">
          <svg className="w-28 h-28 text-violet-400" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="50" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" />
            <path
              d="M60 95 V55 M60 75 C45 75 38 62 38 50 C50 50 60 60 60 75 Z M60 65 C75 65 82 52 82 40 C70 40 60 50 60 65 Z"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="60" cy="36" r="6" fill="#10B981" />
          </svg>
          <div className="space-y-2">
            <h3 className="font-kufi text-xl font-bold text-slate-900 dark:text-white">
              لا توجد فوائد مسجلة في هذا العرض بعد
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              ابدأ تدوين ما تعلمته اليوم من مقالات أو حكم أو مفردات، أو قم بتحميل البيانات التجريبية لاستكشاف إمكانيات البستان.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenNewEntry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>ازرع أول بذرة</span>
            </button>
            <button
              type="button"
              onClick={onLoadSampleData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>تحميل بيانات تجريبية</span>
            </button>
          </div>
        </div>
      ) : filteredAndSorted.length <= 120 ? (
        /* Standard Responsive Layout for <= 120 items so shared-element layoutId and Masonry shine */
        <div
          className={
            layoutMode === 'list'
              ? 'space-y-4 max-w-4xl mx-auto'
              : layoutMode === 'timeline'
              ? 'relative border-r-2 border-violet-500/30 pr-6 space-y-6 max-w-4xl mx-auto'
              : layoutMode === 'masonry'
              ? 'columns-1 md:columns-2 xl:columns-3 gap-5 space-y-5'
              : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'
          }
        >
          {filteredAndSorted.map((entry) => (
            <div
              key={entry.id}
              className={layoutMode === 'masonry' ? 'break-inside-avoid' : ' relative'}
            >
              {layoutMode === 'timeline' && (
                <div className="mb-1.5 flex items-center gap-2 text-xs font-mono text-violet-400">
                  <span>●</span>
                  <span>{entry.date}</span>
                </div>
              )}
              <EntryCard
                entry={entry}
                group={groupMap.get(entry.groupId)}
                onOpen={onOpenEntry}
                onTogglePin={onTogglePin}
                onShuffleStyle={onShuffleStyle}
                onPickStyle={onPickStyle}
                onDelete={onDeleteEntry}
                isNewlyCreated={newlyCreatedId === entry.id}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Virtualized List/Grid for 120 to 20,000+ entries */
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIdx = virtualRow.index * columns;
            const rowEntries = filteredAndSorted.slice(startIdx, startIdx + columns);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  left: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`pb-5 grid gap-5 ${
                  columns === 1
                    ? 'grid-cols-1 max-w-4xl mx-auto'
                    : columns === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {rowEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    group={groupMap.get(entry.groupId)}
                    onOpen={onOpenEntry}
                    onTogglePin={onTogglePin}
                    onShuffleStyle={onShuffleStyle}
                    onPickStyle={onPickStyle}
                    onDelete={onDeleteEntry}
                    compact
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
