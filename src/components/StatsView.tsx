import React, { useMemo } from 'react';
import { Flame, Sparkles, Layers, Award, Calendar } from 'lucide-react';
import {
  ENTRY_TYPE_META,
  EntryType,
  KnowledgeEntry,
  KnowledgeGroup,
} from '../types';
import { getGrowthStage } from '../utils/styleEngine';
import { AnimatedCounter, GroupIcon } from './GroupIcon';

interface StatsViewProps {
  entries: KnowledgeEntry[];
  groups: KnowledgeGroup[];
  streak: number;
  todayCount: number;
}

export const StatsView: React.FC<StatsViewProps> = ({
  entries,
  groups,
  streak,
  todayCount,
}) => {
  const growthStage = useMemo(() => getGrowthStage(entries.length), [entries.length]);

  // Count entries by date for the last 52 weeks (364 days)
  const heatmapWeeks = useMemo(() => {
    const countsByDate = new Map<string, number>();
    for (const e of entries) {
      countsByDate.set(e.date, (countsByDate.get(e.date) || 0) + 1);
    }

    const today = new Date();
    const weeks: Array<Array<{ date: string; count: number }>> = [];

    for (let w = 51; w >= 0; w--) {
      const weekDays: Array<{ date: string; count: number }> = [];
      for (let d = 6; d >= 0; d--) {
        const dt = new Date(today);
        dt.setDate(today.getDate() - (w * 7 + d));
        const iso = dt.toISOString().slice(0, 10);
        weekDays.push({
          date: iso,
          count: countsByDate.get(iso) || 0,
        });
      }
      weeks.push(weekDays);
    }
    return weeks;
  }, [entries]);

  const countsByType = useMemo(() => {
    const map: Record<EntryType, number> = {
      article: 0,
      wisdom: 0,
      sermon: 0,
      word: 0,
      note: 0,
      link: 0,
    };
    for (const e of entries) {
      map[e.type] = (map[e.type] || 0) + 1;
    }
    return map;
  }, [entries]);

  const countsByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.groupId, (map.get(e.groupId) || 0) + 1);
    }
    return groups.map((g) => ({
      group: g,
      count: map.get(g.id) || 0,
    }));
  }, [entries, groups]);

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto px-4 md:px-8 py-6 pb-24 lg:pb-8 space-y-8">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>إجمالي الحصيلة المعرفية</span>
            <Sparkles className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            <AnimatedCounter value={entries.length} />
          </div>
          <div className="text-xs text-slate-400">خلية عصبية وثمرة معرفية</div>
        </div>

        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>سلسلة الاستمرار (Streak)</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-500">
            <AnimatedCounter value={streak} /> <span className="text-base font-normal">يوم</span>
          </div>
          <div className="text-xs text-slate-400">أيام متتالية من التعلم والتدوين</div>
        </div>

        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>حصاد اليوم</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-500">
            <AnimatedCounter value={todayCount} />
          </div>
          <div className="text-xs text-slate-400">فوائد مسجلة بتاريخ اليوم</div>
        </div>

        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>مرحلة شجرة المعرفة</span>
            <Award className="w-4 h-4 text-sky-500" />
          </div>
          <div className="font-kufi text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{growthStage.icon}</span>
            <span>{growthStage.name}</span>
          </div>
          <div className="text-xs text-slate-400">
            المرحلة التالية عند {growthStage.nextMilestone} فائدة
          </div>
        </div>
      </div>

      {/* Yearly Activity Heatmap (GitHub Style) */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
              خريطة النشاط المعرفي السنوية
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              توزيع أيام التدوين والتعلم على مدار الـ 52 أسبوعاً الماضية
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>أقل</span>
            <span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-800" />
            <span className="w-3 h-3 rounded-sm bg-emerald-900" />
            <span className="w-3 h-3 rounded-sm bg-emerald-600" />
            <span className="w-3 h-3 rounded-sm bg-emerald-400" />
            <span>أكثر</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1.5 min-w-max">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day) => {
                  const level =
                    day.count === 0
                      ? 'bg-slate-200/70 dark:bg-slate-800/80'
                      : day.count === 1
                      ? 'bg-emerald-700/70'
                      : day.count <= 3
                      ? 'bg-emerald-500'
                      : 'bg-emerald-300 shadow-sm shadow-emerald-400/50';
                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.count} فوائد`}
                      className={`w-3.5 h-3.5 rounded-[3px] transition-transform hover:scale-125 ${level}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution by Group and by Entry Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Group */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />
            <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
              توزيع المعرفة حسب المجموعات
            </h3>
          </div>
          <div className="space-y-3">
            {countsByGroup.map(({ group, count }) => {
              const pct = entries.length > 0 ? Math.round((count / entries.length) * 100) : 0;
              return (
                <div key={group.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                      <GroupIcon
                        name={group.icon}
                        className="w-3.5 h-3.5"
                        style={{ color: group.color }}
                      />
                      <span>{group.name}</span>
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: group.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Type */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white">
            توزيع الفوائد حسب القالب المعرفي
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.keys(ENTRY_TYPE_META) as EntryType[]).map((t) => {
              const meta = ENTRY_TYPE_META[t];
              const count = countsByType[t] || 0;
              return (
                <div
                  key={t}
                  className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1"
                >
                  <div
                    className="text-xs font-semibold"
                    style={{ color: meta.badgeColor }}
                  >
                    {meta.plural}
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {count.toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1">
                    {meta.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
