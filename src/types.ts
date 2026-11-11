export type EntryType = 'article' | 'wisdom' | 'sermon' | 'word' | 'note' | 'link';

export type GroupLayoutMode = 'mixed' | 'grid' | 'masonry' | 'list' | 'timeline';

export type CardTemplate =
  | 'glass'
  | 'paper'
  | 'neon'
  | 'mesh'
  | 'sticky'
  | 'folded'
  | 'ribbon'
  | 'notebook'
  | 'flat'
  | 'stamp'
  | 'royal'
  | 'prism';

export type CardDecoration = 'blob' | 'dots' | 'stripes' | 'waves' | 'orbits' | 'stars';

export type CardShape = 'rounded' | 'notched' | 'hex-badge' | 'arched';

export type HeadingFont = 'cairo' | 'amiri' | 'kufi';

export interface EntryStyle {
  seed: number;
  hue: number;
  secondaryHue: number;
  template: CardTemplate;
  decoration: CardDecoration;
  shape: CardShape;
  rotation: number; // -1.6 to +1.6 deg
  headingFont: HeadingFont;
}

export interface EntryLink {
  id: string;
  entryId: string;
  title: string;
  url: string;
  domain: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  groupId: string;
  type: EntryType;
  contentHtml: string;
  contentText: string;
  meaning?: string; // especially for 'word' flashcard back or key takeaway
  source?: string; // author, speaker, book, or URL
  tags: string[];
  links: EntryLink[];
  highlightCount: number;
  baseFontSize: number; // 12 - 48px
  style: EntryStyle;
  isPinned: boolean;
  isSample?: boolean;
  isStressTest?: boolean;
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  defaultLayout: GroupLayoutMode;
  order: number;
  deletedAt: number | null; // null = active, timestamp = in trash
  createdAt: number;
}

export interface NodePosition {
  id: string; // entryId
  groupId: string;
  brainX: number;
  brainY: number;
  treeX: number;
  treeY: number;
  updatedAt: number;
}

export type AnimationIntensity = 'high' | 'medium' | 'low';

export interface AppSettings {
  id: string; // 'default'
  theme: 'dark' | 'light';
  animationIntensity: AnimationIntensity;
  dailyGoal: number;
  lastBackupAt: number | null;
  dismissedBackupBannerUntil: number | null;
  hasSeenFirstRun: boolean;
}

export type ActiveSection = 'today' | 'all' | 'brain' | 'stats' | 'settings' | 'trash' | string; // string for groupId

export type SortOption = 'newest' | 'oldest' | 'pinned' | 'random';

export const ENTRY_TYPE_META: Record<
  EntryType,
  { label: string; plural: string; description: string; badgeColor: string }
> = {
  article: {
    label: 'مقال',
    plural: 'مقالات',
    description: 'خلاصة مقال أو قراءة معمقة مع وقت القراءة',
    badgeColor: '#38BDF8',
  },
  wisdom: {
    label: 'حكمة',
    plural: 'حِكم واقتباسات',
    description: 'اقتباس بليغ أو حكمة خالدة بخط الأميري',
    badgeColor: '#F59E0B',
  },
  sermon: {
    label: 'موعظة',
    plural: 'مواعظ وخواطر',
    description: 'خاطرة إيمانية أو درس مؤثر مع المصدر والملقي',
    badgeColor: '#10B981',
  },
  word: {
    label: 'كلمة',
    plural: 'مفردات ومصطلحات',
    description: 'بطاقة استذكار تنقلب لتكشف المعنى والشرح',
    badgeColor: '#A855F7',
  },
  note: {
    label: 'ملاحظة',
    plural: 'ملاحظات سريعة',
    description: 'قصاصة فكرية أو فكرة يومية مركزة',
    badgeColor: '#EC4899',
  },
  link: {
    label: 'رابط',
    plural: 'روابط ومصادر',
    description: 'مرجع رقمي أو موقع مفيد مع النطاق والوصف',
    badgeColor: '#6366F1',
  },
};

export const GROUP_COLORS = [
  '#8B5CF6', // Deep Violet
  '#38BDF8', // Electric Blue
  '#10B981', // Emerald Teal
  '#F59E0B', // Royal Gold
  '#F43F5E', // Rose Jewel
  '#EC4899', // Magenta
  '#6366F1', // Indigo
  '#14B8A6', // Cyan Teal
];

export const GROUP_ICONS = [
  'BookOpen',
  'Sparkles',
  'Compass',
  'Feather',
  'Cpu',
  'Globe',
  'Lightbulb',
  'Heart',
  'Scroll',
  'Layers',
  'Flame',
  'Award',
];
