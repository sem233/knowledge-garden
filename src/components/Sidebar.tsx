import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Brain,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ActiveSection,
  GROUP_COLORS,
  GROUP_ICONS,
  GroupLayoutMode,
  KnowledgeGroup,
} from '../types';
import { GroupIcon, AnimatedCounter } from './GroupIcon';

interface SidebarProps {
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  groups: KnowledgeGroup[];
  trashedGroups: KnowledgeGroup[];
  entryCountsByGroup: Record<string, number>;
  totalEntriesCount: number;
  todayEntriesCount: number;
  onCreateGroup: (data: {
    name: string;
    icon: string;
    color: string;
    defaultLayout: GroupLayoutMode;
  }) => Promise<void>;
  onUpdateGroup: (
    id: string,
    data: Partial<Pick<KnowledgeGroup, 'name' | 'icon' | 'color' | 'defaultLayout'>>
  ) => Promise<void>;
  onReorderGroups: (orderedIds: string[]) => Promise<void>;
  onSoftDeleteGroup: (id: string) => Promise<void>;
  onRestoreGroup: (id: string) => Promise<void>;
  onPermanentDeleteGroup: (id: string) => Promise<void>;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  groups,
  trashedGroups,
  entryCountsByGroup,
  totalEntriesCount,
  todayEntriesCount,
  onCreateGroup,
  onUpdateGroup,
  onReorderGroups,
  onSoftDeleteGroup,
  onRestoreGroup,
  onPermanentDeleteGroup,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<KnowledgeGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupIcon, setGroupIcon] = useState(GROUP_ICONS[0]);
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0]);
  const [groupLayout, setGroupLayout] = useState<GroupLayoutMode>('mixed');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const openNewGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupIcon(GROUP_ICONS[groups.length % GROUP_ICONS.length]);
    setGroupColor(GROUP_COLORS[groups.length % GROUP_COLORS.length]);
    setGroupLayout('mixed');
    setFormError('');
    setIsGroupModalOpen(true);
  };

  const openEditGroupModal = (g: KnowledgeGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupIcon(g.icon);
    setGroupColor(g.color);
    setGroupLayout(g.defaultLayout);
    setFormError('');
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupName.trim();
    if (!trimmed) {
      setFormError('يرجى إدخال اسم المجموعة');
      return;
    }
    if (editingGroup) {
      await onUpdateGroup(editingGroup.id, {
        name: trimmed,
        icon: groupIcon,
        color: groupColor,
        defaultLayout: groupLayout,
      });
    } else {
      await onCreateGroup({
        name: trimmed,
        icon: groupIcon,
        color: groupColor,
        defaultLayout: groupLayout,
      });
    }
    setIsGroupModalOpen(false);
  };

  const moveGroup = async (index: number, direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= groups.length) return;
    const nextOrder = groups.map((g) => g.id);
    const [removed] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIdx, 0, removed);
    await onReorderGroups(nextOrder);
  };

  const handleDropGroup = async (targetGroupId: string) => {
    if (!draggedGroupId || draggedGroupId === targetGroupId) return;
    const ids = groups.map((g) => g.id);
    const fromIdx = ids.indexOf(draggedGroupId);
    const toIdx = ids.indexOf(targetGroupId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedGroupId);
    setDraggedGroupId(null);
    await onReorderGroups(ids);
  };

  const mainNavItems: Array<{
    id: ActiveSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    highlight?: boolean;
  }> = [
    { id: 'today', label: 'اليوم', icon: Calendar, badge: todayEntriesCount },
    { id: 'all', label: 'الكل', icon: Layers, badge: totalEntriesCount },
    { id: 'brain', label: 'عقلي', icon: Brain, highlight: true },
    { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  const handleSelectAndCloseMobile = (sec: ActiveSection) => {
    onSelectSection(sec);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        aria-label="القائمة الجانبية والمجموعات"
        className={`w-72 shrink-0 h-screen fixed lg:sticky top-0 right-0 z-40 lg:z-20 flex flex-col border-l border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0D1222]/95 lg:bg-white/80 lg:dark:bg-[#0D1222]/85 backdrop-blur-xl select-none transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-kufi text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                بستان المعرفة
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حديقتك الفكرية الحية
              </p>
            </div>
          </div>
        </div>

        {/* Main Sections */}
        <nav aria-label="الأقسام الرئيسية" className="p-3 space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectAndCloseMobile(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? item.highlight
                      ? 'bg-gradient-to-l from-violet-600 to-sky-600 text-white shadow-md shadow-violet-600/25'
                      : 'bg-violet-600/12 dark:bg-violet-500/20 text-violet-700 dark:text-violet-200 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? item.highlight
                          ? 'text-white'
                          : 'text-violet-600 dark:text-violet-300'
                        : 'text-slate-400 dark:text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && (
                  <AnimatedCounter
                    value={item.badge}
                    className={`text-xs ${
                      isActive
                        ? 'text-violet-700 dark:text-violet-200'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

      {/* Groups Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-400">
          المجموعات المعرفية ({groups.length})
        </span>
        <button
          type="button"
          onClick={openNewGroupModal}
          aria-label="إنشاء مجموعة جديدة"
          className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 px-2 py-1 rounded-lg hover:bg-violet-500/10 transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>مجموعة جديدة</span>
        </button>
      </div>

      {/* Groups List with Drag & Drop + Reorder */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {groups.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
            لا توجد مجموعات بعد. أنشئ مجموعتك الأولى لتنظيم فوائدك.
          </div>
        ) : (
          groups.map((grp, idx) => {
            const isSelected = activeSection === grp.id;
            const count = entryCountsByGroup[grp.id] || 0;
            return (
              <div
                key={grp.id}
                draggable
                onDragStart={() => setDraggedGroupId(grp.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropGroup(grp.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900/8 dark:bg-white/10 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => handleSelectAndCloseMobile(grp.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${grp.color}20`,
                      color: grp.color,
                    }}
                  >
                    <GroupIcon name={grp.icon} className="w-4 h-4" />
                  </span>
                  <span className="truncate">{grp.name}</span>
                </div>

                {/* Count vs Hover Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <AnimatedCounter
                    value={count}
                    className="text-xs text-slate-400 dark:text-slate-500 group-hover:hidden"
                  />
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => moveGroup(idx, -1, e)}
                        aria-label={`تحريك ${grp.name} للأعلى`}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    {idx < groups.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => moveGroup(idx, 1, e)}
                        aria-label={`تحريك ${grp.name} للأسفل`}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => openEditGroupModal(grp, e)}
                      aria-label={`تعديل مجموعة ${grp.name}`}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(grp.id);
                      }}
                      aria-label={`حذف مجموعة ${grp.name}`}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Trash Section if any deleted groups exist */}
        {trashedGroups.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-800/60">
            <button
              type="button"
              onClick={() => onSelectSection('trash')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeSection === 'trash'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                <span>سلة المهملات</span>
              </span>
              <span className="font-mono tabular-nums">{trashedGroups.length}</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-2">
          <span>بستان المعرفة · 120 FPS</span>
          <span className="font-mono">Ctrl+K للبحث</span>
        </div>
      </div>

      {/* Create / Edit Group Modal */}
      {isGroupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setIsGroupModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingGroup ? 'تعديل المجموعة' : 'إنشاء مجموعة جديدة'}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131A2E] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-kufi text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingGroup ? 'تعديل المجموعة' : 'إنشاء مجموعة معرفية جديدة'}
            </h2>
            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label
                  htmlFor="group-name-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  اسم المجموعة
                </label>
                <input
                  id="group-name-input"
                  type="text"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    setFormError('');
                  }}
                  placeholder="مثال: الفلسفة والتفكر، علوم القرآن، هندسة البرمجيات..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
                {formError && <p className="text-xs text-rose-500 mt-1">{formError}</p>}
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  لون المجموعة
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setGroupColor(c)}
                      aria-label={`اختيار اللون ${c}`}
                      className={`w-7 h-7 rounded-lg transition-transform ${
                        groupColor === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  الأيقونة الرمزية
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {GROUP_ICONS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setGroupIcon(iconName)}
                      aria-label={`أيقونة ${iconName}`}
                      className={`p-2 rounded-xl flex items-center justify-center border transition-colors ${
                        groupIcon === iconName
                          ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <GroupIcon name={iconName} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="group-layout-select"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
                >
                  التخطيط الافتراضي للبطاقات
                </label>
                <select
                  id="group-layout-select"
                  value={groupLayout}
                  onChange={(e) => setGroupLayout(e.target.value as GroupLayoutMode)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="mixed">متنوع ذكي (حسب نوع كل فائدة)</option>
                  <option value="grid">شبكة متناسقة (Grid)</option>
                  <option value="masonry">فسيفساء حرة (Masonry)</option>
                  <option value="list">قائمة مركزة (List)</option>
                  <option value="timeline">خط زمني متسلسل (Timeline)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20"
                >
                  {editingGroup ? 'حفظ التغييرات' : 'إنشاء المجموعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="تأكيد نقل المجموعة إلى سلة المهملات"
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131A2E] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-kufi text-base font-bold text-slate-900 dark:text-white mb-2">
              نقل المجموعة إلى سلة المهملات؟
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
              ستنتقل هذه المجموعة إلى سلة المهملات ويمكنك استعادتها في أي وقت مع جميع فوائدها.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onSoftDeleteGroup(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
              >
                نقل إلى المهملات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash Drawer Modal if activeSection === 'trash' */}
      {activeSection === 'trash' && (
        <div className="px-3 pb-4">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="text-xs font-semibold text-rose-500">المجموعات المحذوفة</div>
            {trashedGroups.map((tg) => (
              <div
                key={tg.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-rose-500/10 last:border-0"
              >
                <span className="truncate text-slate-700 dark:text-slate-200">{tg.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRestoreGroup(tg.id)}
                    aria-label={`استعادة ${tg.name}`}
                    className="p-1 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                    title="استعادة"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPermanentDeleteGroup(tg.id)}
                    aria-label={`حذف نهائي ${tg.name}`}
                    className="p-1 rounded bg-rose-500/20 text-rose-500 hover:bg-rose-500/30"
                    title="حذف نهائي"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
    </>
  );
};
