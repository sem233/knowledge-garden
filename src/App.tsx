/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  BarChart3,
  Brain,
  Calendar,
  Layers,
  Settings as SettingsIcon,
  ShieldAlert,
  WifiOff,
  X,
} from 'lucide-react';
import {
  ActiveSection,
  AppSettings,
  CardTemplate,
  EntryLink,
  EntryType,
  GroupLayoutMode,
  KnowledgeEntry,
  KnowledgeGroup,
  NodePosition,
} from './types';
import {
  db,
  DEFAULT_SETTINGS,
  ensurePersistentStorage,
  getOrCreateSettings,
} from './db/database';
import { seedSampleArabicData } from './db/seedData';
import {
  calculateStreak,
  generateEntryStyle,
  GROWTH_MILESTONES,
  getGrowthStage,
} from './utils/styleEngine';
import { computeNodePositionForEntry } from './utils/brainGeometry';
import { searchEngine } from './utils/searchIndex';
import { exportFullBackupJSON, triggerFileDownload } from './utils/backup';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { LivingBackground } from './components/LivingBackground';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EntryCollectionView } from './components/EntryCollectionView';
import { EntryEditorModal } from './components/EntryEditorModal';
import { MyBrainView } from './components/MyBrainView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { FirstRunWelcome } from './components/FirstRunWelcome';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [groups, setGroups] = useState<KnowledgeGroup[]>([]);
  const [trashedGroups, setTrashedGroups] = useState<KnowledgeGroup[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [positionsMap, setPositionsMap] = useState<Map<string, NodePosition>>(new Map());

  const [activeSection, setActiveSection] = useState<ActiveSection>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [celebrationMilestone, setCelebrationMilestone] = useState<number | null>(null);

  const isOnline = useOnlineStatus();

  const loadAllFromDB = useCallback(async () => {
    const [loadedSettings, allGroups, allEntries, allPositions] = await Promise.all([
      getOrCreateSettings(),
      db.groups.orderBy('order').toArray(),
      db.entries.toArray(),
      db.layout.toArray(),
    ]);

    const activeGrps = allGroups.filter((g) => g.deletedAt === null);
    const trashedGrps = allGroups.filter((g) => g.deletedAt !== null);
    const activeGroupIds = new Set(activeGrps.map((g) => g.id));
    const visibleEntries = allEntries.filter((e) => activeGroupIds.has(e.groupId));

    setSettings(loadedSettings);
    setGroups(activeGrps);
    setTrashedGroups(trashedGrps);
    setEntries(visibleEntries);

    const pMap = new Map<string, NodePosition>();
    for (const p of allPositions) {
      pMap.set(p.id, p);
    }
    setPositionsMap(pMap);

    searchEngine.rebuildIndex(visibleEntries, activeGrps);
  }, []);

  // Initial Bootstrap: request persistent storage, seed realistic Arabic data if DB is empty
  useEffect(() => {
    let mounted = true;
    (async () => {
      await ensurePersistentStorage();
      const existingGroupsCount = await db.groups.count();
      const params = new URLSearchParams(window.location.search);
      const forceEmpty = params.get('empty') === '1';

      if (existingGroupsCount === 0 && !forceEmpty) {
        await seedSampleArabicData();
      }
      await loadAllFromDB();
      if (mounted) setIsReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [loadAllFromDB]);

  // Sync Dark / Light theme class on <html> and <body>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      document.body.className =
        'bg-[#0B0F1A] text-slate-100 antialiased selection:bg-violet-500/30 selection:text-violet-200 overflow-hidden';
    } else {
      root.classList.remove('dark');
      document.body.className =
        'bg-[#F8FAFC] text-slate-900 antialiased selection:bg-violet-500/20 selection:text-violet-900 overflow-hidden';
    }
  }, [settings.theme]);

  // Global Keyboard Shortcuts: Alt+N (new entry), Ctrl+K (command palette), Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingEntry(null);
        setIsEditorOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUpdateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const updated = { ...settings, ...patch };
      setSettings(updated);
      await db.settings.put(updated);
    },
    [settings]
  );

  // Group CRUD handlers
  const handleCreateGroup = useCallback(
    async (data: {
      name: string;
      icon: string;
      color: string;
      defaultLayout: GroupLayoutMode;
    }) => {
      const newGroup: KnowledgeGroup = {
        id: `grp-${Date.now()}`,
        name: data.name,
        icon: data.icon,
        color: data.color,
        defaultLayout: data.defaultLayout,
        order: groups.length,
        deletedAt: null,
        createdAt: Date.now(),
      };
      await db.groups.put(newGroup);
      await loadAllFromDB();
      setActiveSection(newGroup.id);
    },
    [groups.length, loadAllFromDB]
  );

  const handleUpdateGroup = useCallback(
    async (
      id: string,
      patch: Partial<Pick<KnowledgeGroup, 'name' | 'icon' | 'color' | 'defaultLayout'>>
    ) => {
      await db.groups.update(id, patch);
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  const handleReorderGroups = useCallback(
    async (orderedIds: string[]) => {
      await db.transaction('rw', db.groups, async () => {
        for (let i = 0; i < orderedIds.length; i++) {
          await db.groups.update(orderedIds[i], { order: i });
        }
      });
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  const handleSoftDeleteGroup = useCallback(
    async (id: string) => {
      await db.groups.update(id, { deletedAt: Date.now() });
      if (activeSection === id) {
        setActiveSection('all');
      }
      await loadAllFromDB();
    },
    [activeSection, loadAllFromDB]
  );

  const handleRestoreGroup = useCallback(
    async (id: string) => {
      await db.groups.update(id, { deletedAt: null });
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  const handlePermanentDeleteGroup = useCallback(
    async (id: string) => {
      const entryIds = await db.entries.where('groupId').equals(id).primaryKeys();
      await db.transaction('rw', [db.groups, db.entries, db.layout], async () => {
        await db.groups.delete(id);
        if (entryIds.length > 0) {
          await db.entries.bulkDelete(entryIds);
          await db.layout.bulkDelete(entryIds);
        }
      });
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  // Entry Save / Update / Style Shuffle handlers
  const handleSaveEntry = useCallback(
    async (data: {
      id?: string;
      title: string;
      groupId: string;
      type: EntryType;
      contentHtml: string;
      contentText: string;
      meaning?: string;
      source?: string;
      tags: string[];
      links: EntryLink[];
      highlightCount: number;
      baseFontSize: number;
      date: string;
      shuffleStyle?: boolean;
    }): Promise<KnowledgeEntry> => {
      const now = Date.now();
      const isNew = !data.id;
      const entryId = data.id || `entry-${now}`;

      const groupEntries = entries
        .filter((e) => e.groupId === data.groupId && e.id !== entryId)
        .sort((a, b) => b.createdAt - a.createdAt);

      const recentStyles = groupEntries.slice(0, 8).map((e) => e.style);
      const existingEntry = entries.find((e) => e.id === entryId);

      const style =
        existingEntry && !data.shuffleStyle
          ? existingEntry.style
          : generateEntryStyle(
              entryId,
              groupEntries.length,
              recentStyles,
              data.shuffleStyle ? Math.floor(Math.random() * 1000) + 1 : 0
            );

      const normalizedLinks = data.links.map((l) => ({
        ...l,
        entryId,
      }));

      const savedEntry: KnowledgeEntry = {
        id: entryId,
        title: data.title,
        groupId: data.groupId,
        type: data.type,
        contentHtml: data.contentHtml,
        contentText: data.contentText,
        meaning: data.meaning,
        source: data.source,
        tags: data.tags,
        links: normalizedLinks,
        highlightCount: data.highlightCount,
        baseFontSize: data.baseFontSize,
        style,
        isPinned: existingEntry?.isPinned || false,
        isSample: false,
        isStressTest: false,
        date: data.date,
        createdAt: existingEntry?.createdAt || now,
        updatedAt: now,
      };

      const grpIndex = Math.max(
        0,
        groups.findIndex((g) => g.id === data.groupId)
      );
      const nodePos =
        positionsMap.get(entryId) ||
        computeNodePositionForEntry(
          entryId,
          data.groupId,
          groupEntries.length,
          grpIndex,
          Math.max(1, groups.length),
          style.seed
        );

      const prevTotalCount = entries.length;

      await db.transaction('rw', [db.entries, db.layout, db.settings], async () => {
        await db.entries.put(savedEntry);
        await db.layout.put(nodePos);
        await db.settings.update('default', { hasSeenFirstRun: true });
      });

      await loadAllFromDB();

      if (isNew) {
        setNewlyCreatedId(entryId);
        const nextTotal = prevTotalCount + 1;
        if (GROWTH_MILESTONES.includes(nextTotal)) {
          setCelebrationMilestone(nextTotal);
        }
      }

      return savedEntry;
    },
    [entries, groups, positionsMap, loadAllFromDB]
  );

  const handleTogglePin = useCallback(
    async (entry: KnowledgeEntry, e: React.MouseEvent) => {
      e.stopPropagation();
      await db.entries.update(entry.id, { isPinned: !entry.isPinned });
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  const handleShuffleStyle = useCallback(
    async (entry: KnowledgeEntry, e: React.MouseEvent) => {
      e.stopPropagation();
      const groupEntries = entries
        .filter((item) => item.groupId === entry.groupId && item.id !== entry.id)
        .sort((a, b) => b.createdAt - a.createdAt);
      const recent8 = groupEntries.slice(0, 8).map((item) => item.style);
      const nextStyle = generateEntryStyle(
        entry.id,
        groupEntries.length,
        recent8,
        Math.floor(Math.random() * 10000) + 1
      );
      await db.entries.update(entry.id, { style: nextStyle });
      await loadAllFromDB();
    },
    [entries, loadAllFromDB]
  );

  const handlePickStyle = useCallback(
    async (
      entry: KnowledgeEntry,
      patch: { hue?: number; template?: CardTemplate },
      e: React.MouseEvent
    ) => {
      e.stopPropagation();
      const nextStyle = {
        ...entry.style,
        ...patch,
        secondaryHue:
          patch.hue !== undefined ? (patch.hue + 48) % 360 : entry.style.secondaryHue,
      };
      await db.entries.update(entry.id, { style: nextStyle });
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  const handleDeleteEntry = useCallback(
    async (entry: KnowledgeEntry, e: React.MouseEvent) => {
      e.stopPropagation();
      await db.transaction('rw', [db.entries, db.links, db.layout], async () => {
        await db.entries.delete(entry.id);
        await db.links.where('entryId').equals(entry.id).delete();
        await db.layout.delete(entry.id);
      });
      await loadAllFromDB();
    },
    [loadAllFromDB]
  );

  const handleSaveComputedPositions = useCallback(async (positions: NodePosition[]) => {
    if (positions.length === 0) return;
    await db.layout.bulkPut(positions);
    setPositionsMap((prev) => {
      const next = new Map(prev);
      for (const p of positions) next.set(p.id, p);
      return next;
    });
  }, []);

  const handleLoadSampleData = useCallback(async () => {
    await seedSampleArabicData();
    await loadAllFromDB();
  }, [loadAllFromDB]);

  // Derived Counts & Search Filtering
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === todayStr),
    [entries, todayStr]
  );

  const entryCountsByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.groupId] = (counts[e.groupId] || 0) + 1;
    }
    return counts;
  }, [entries]);

  const stressEntriesCount = useMemo(
    () => entries.filter((e) => e.isStressTest).length,
    [entries]
  );

  const streak = useMemo(
    () => calculateStreak(entries.map((e) => e.date), todayStr),
    [entries, todayStr]
  );

  const hasActiveSearch = searchQuery.trim().length > 0;
  const searchMatchedIds = useMemo(() => {
    if (!hasActiveSearch) return new Set<string>();
    return searchEngine.search(searchQuery);
  }, [hasActiveSearch, searchQuery]);

  const displayedEntries = useMemo(() => {
    let base = entries;
    if (activeSection === 'today') {
      base = todayEntries;
    } else if (
      activeSection !== 'all' &&
      activeSection !== 'brain' &&
      activeSection !== 'stats' &&
      activeSection !== 'settings' &&
      activeSection !== 'trash'
    ) {
      base = entries.filter((e) => e.groupId === activeSection);
    }

    if (hasActiveSearch) {
      const q = searchQuery.trim().toLowerCase();
      return base.filter(
        (e) =>
          searchMatchedIds.has(e.id) ||
          e.title.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return base;
  }, [entries, todayEntries, activeSection, hasActiveSearch, searchQuery, searchMatchedIds]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeSection),
    [groups, activeSection]
  );

  const topBarMeta = useMemo(() => {
    if (activeSection === 'today') {
      return { title: 'اليوم', subtitle: 'حصادك المعرفي اليومي وهدفك المستمر' };
    }
    if (activeSection === 'all') {
      return { title: 'الكل', subtitle: `${entries.length.toLocaleString('en-US')} فائدة في بستانك` };
    }
    if (activeSection === 'brain') {
      return { title: 'عقلي', subtitle: 'الدماغ العصبي التفاعلي وشجرة المعرفة الحية' };
    }
    if (activeSection === 'stats') {
      return { title: 'الإحصائيات', subtitle: 'تتبع نموك المعرفي وخريطة الاستمرارية السنوية' };
    }
    if (activeSection === 'settings') {
      return { title: 'الإعدادات', subtitle: 'كود نقل البيانات، التحميل المباشر، والنسخ الاحتياطي' };
    }
    if (activeGroup) {
      return {
        title: activeGroup.name,
        subtitle: `${(entryCountsByGroup[activeGroup.id] || 0).toLocaleString('en-US')} فائدة`,
      };
    }
    return { title: 'بستان المعرفة', subtitle: '' };
  }, [activeSection, activeGroup, entries.length, entryCountsByGroup]);

  // Weekly Backup Reminder check (if > 7 days since lastBackupAt and entries > 0)
  const showWeeklyBackupReminder = useMemo(() => {
    if (entries.length === 0) return false;
    const now = Date.now();
    if (settings.dismissedBackupBannerUntil && now < settings.dismissedBackupBannerUntil) {
      return false;
    }
    if (!settings.lastBackupAt) return false;
    return now - settings.lastBackupAt > 7 * 86400000;
  }, [entries.length, settings.lastBackupAt, settings.dismissedBackupBannerUntil]);

  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F1A] text-white">
        <div className="text-center space-y-2">
          <div className="font-kufi text-xl font-bold text-violet-300">بستان المعرفة</div>
          <div className="text-xs text-slate-400">جارٍ تجهيز حديقتك المعرفية...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex bg-transparent text-slate-900 dark:text-slate-100">
      {/* Living Animated Background */}
      <LivingBackground
        intensity={settings.animationIntensity}
        theme={settings.theme}
      />

      {/* Right Sidebar (RTL first flex child on desktop, slide-over drawer on mobile/Android) */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        groups={groups}
        trashedGroups={trashedGroups}
        entryCountsByGroup={entryCountsByGroup}
        totalEntriesCount={entries.length}
        todayEntriesCount={todayEntries.length}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onReorderGroups={handleReorderGroups}
        onSoftDeleteGroup={handleSoftDeleteGroup}
        onRestoreGroup={handleRestoreGroup}
        onPermanentDeleteGroup={handlePermanentDeleteGroup}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNewEntry={() => {
            setEditingEntry(null);
            setIsEditorOpen(true);
          }}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenSyncSection={() => setActiveSection('settings')}
          theme={settings.theme}
          onToggleTheme={() =>
            handleUpdateSettings({
              theme: settings.theme === 'dark' ? 'light' : 'dark',
            })
          }
          activeTitle={topBarMeta.title}
          activeSubtitle={topBarMeta.subtitle}
        />

        {/* Weekly Backup Reminder Banner */}
        {showWeeklyBackupReminder && (
          <div className="px-8 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                مضى أكثر من أسبوع على آخر نسخة احتياطية لبستانك المعرفي. احفظ نسخة JSON الآن لضمان أمان فوائدك.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const json = await exportFullBackupJSON();
                  triggerFileDownload(
                    `knowledge-garden-backup-${todayStr}.json`,
                    json,
                    'application/json'
                  );
                  await loadAllFromDB();
                }}
                className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-semibold"
              >
                حفظ نسخة الآن
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateSettings({
                    dismissedBackupBannerUntil: Date.now() + 3 * 86400000,
                  })
                }
                aria-label="إغلاق التذكير"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Section Viewport with AnimatePresence */}
        <main className="flex-1 min-h-0 relative">
          <AnimatePresence mode="wait">
            {entries.length === 0 &&
            activeSection !== 'settings' &&
            activeSection !== 'stats' ? (
              <motion.div
                key="first-run"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <FirstRunWelcome
                  onPlantFirstSeed={async () => {
                    if (groups.length === 0) {
                      await handleCreateGroup({
                        name: 'فوائدي اليومية',
                        icon: 'Sparkles',
                        color: '#8B5CF6',
                        defaultLayout: 'mixed',
                      });
                    }
                    setEditingEntry(null);
                    setIsEditorOpen(true);
                  }}
                  onLoadSampleGarden={handleLoadSampleData}
                />
              </motion.div>
            ) : activeSection === 'brain' ? (
              <motion.div
                key="brain-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MyBrainView
                  entries={entries}
                  groups={groups}
                  positionsMap={positionsMap}
                  searchMatchedIds={searchMatchedIds}
                  hasActiveSearch={hasActiveSearch}
                  newlyCreatedId={newlyCreatedId}
                  streak={streak}
                  animationIntensity={settings.animationIntensity}
                  theme={settings.theme}
                  onOpenEntry={(entry) => {
                    setEditingEntry(entry);
                    setIsEditorOpen(true);
                  }}
                  onOpenNewEntry={() => {
                    setEditingEntry(null);
                    setIsEditorOpen(true);
                  }}
                  onSaveComputedPositions={handleSaveComputedPositions}
                />
              </motion.div>
            ) : activeSection === 'stats' ? (
              <motion.div
                key="stats-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <StatsView
                  entries={entries}
                  groups={groups}
                  streak={streak}
                  todayCount={todayEntries.length}
                />
              </motion.div>
            ) : activeSection === 'settings' ? (
              <motion.div
                key="settings-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <SettingsView
                  settings={settings}
                  totalEntriesCount={entries.length}
                  stressEntriesCount={stressEntriesCount}
                  onUpdateSettings={handleUpdateSettings}
                  onLoadSampleData={handleLoadSampleData}
                  onRefreshData={loadAllFromDB}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`collection-${activeSection}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <EntryCollectionView
                  entries={displayedEntries}
                  groups={groups}
                  activeGroup={activeGroup}
                  isTodayView={activeSection === 'today'}
                  dailyGoal={settings.dailyGoal}
                  todayCount={todayEntries.length}
                  newlyCreatedId={newlyCreatedId}
                  onOpenEntry={(entry) => {
                    setEditingEntry(entry);
                    setIsEditorOpen(true);
                  }}
                  onOpenNewEntry={() => {
                    setEditingEntry(null);
                    setIsEditorOpen(true);
                  }}
                  onLoadSampleData={handleLoadSampleData}
                  onTogglePin={handleTogglePin}
                  onShuffleStyle={handleShuffleStyle}
                  onPickStyle={handlePickStyle}
                  onDeleteEntry={handleDeleteEntry}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Android / Mobile Bottom Navigation Bar (< lg) */}
      <nav
        aria-label="التنقل السفلي للهاتف"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 px-2 bg-white/90 dark:bg-[#0B0F1A]/95 border-t border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl flex items-center justify-around"
      >
        {[
          { id: 'today', label: 'اليوم', icon: Calendar },
          { id: 'all', label: 'الكل', icon: Layers },
          { id: 'brain', label: 'عقلي', icon: Brain },
          { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
          { id: 'settings', label: 'الإعدادات', icon: SettingsIcon },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-colors ${
                active
                  ? 'text-violet-600 dark:text-violet-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Rich Entry Editor Modal */}
      <EntryEditorModal
        isOpen={isEditorOpen}
        initialEntry={editingEntry}
        groups={groups}
        defaultGroupId={activeGroup?.id || groups[0]?.id || ''}
        onSave={handleSaveEntry}
        onClose={() => setIsEditorOpen(false)}
      />

      {/* Command Palette Modal (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        entries={entries}
        groups={groups}
        onSelectSection={setActiveSection}
        onOpenEntry={(entry) => {
          setEditingEntry(entry);
          setIsEditorOpen(true);
        }}
        onOpenNewEntry={() => {
          setEditingEntry(null);
          setIsEditorOpen(true);
        }}
        onToggleTheme={() =>
          handleUpdateSettings({
            theme: settings.theme === 'dark' ? 'light' : 'dark',
          })
        }
        onLoadSampleData={handleLoadSampleData}
      />

      {/* Milestone Celebration Modal (10 / 50 / 100 / 500 / 1000 entries) */}
      {celebrationMilestone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={() => setCelebrationMilestone(null)}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-8 rounded-3xl bg-gradient-to-b from-violet-950 to-slate-950 border border-amber-400/40 text-center text-white shadow-2xl space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mx-auto text-amber-300">
              <Award className="w-9 h-9" />
            </div>
            <div className="text-xs font-semibold text-amber-300">إنجاز معرفي جديد 🎉</div>
            <h3 className="font-kufi text-2xl font-bold">
              بلغت {celebrationMilestone} فائدة في بستان المعرفة!
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {getGrowthStage(celebrationMilestone).description}
            </p>
            <button
              type="button"
              onClick={() => {
                setCelebrationMilestone(null);
                setActiveSection('brain');
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
            >
              شاهد نمو شجرتك الآن
            </button>
          </motion.div>
        </div>
      )}

      {/* Offline Mode Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>وضع عدم الاتصال — جميع بياناتك محفوظة محلياً</span>
        </div>
      )}
    </div>
  );
}

