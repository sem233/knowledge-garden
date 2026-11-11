import {
  CardDecoration,
  CardShape,
  CardTemplate,
  EntryStyle,
  HeadingFont,
} from '../types';

export const ALL_TEMPLATES: CardTemplate[] = [
  'glass',
  'paper',
  'neon',
  'mesh',
  'sticky',
  'folded',
  'ribbon',
  'notebook',
  'flat',
  'stamp',
  'royal',
  'prism',
];

export const TEMPLATE_LABELS: Record<CardTemplate, string> = {
  glass: 'بلوري متوهج',
  paper: 'ورق عتيق',
  neon: 'إطار نيون',
  mesh: 'تدرج شبكي',
  sticky: 'قصاصة لاصقة',
  folded: 'زاوية مطوية',
  ribbon: 'شريط جانبي',
  notebook: 'دفتر مسطر',
  flat: 'تصميم بارز',
  stamp: 'ختم بريدي',
  royal: 'مخملي ملكي',
  prism: 'طيف منشوري',
};

export const ALL_DECORATIONS: CardDecoration[] = [
  'blob',
  'dots',
  'stripes',
  'waves',
  'orbits',
  'stars',
];

export const ALL_SHAPES: CardShape[] = ['rounded', 'notched', 'hex-badge', 'arched'];

export const ALL_FONTS: HeadingFont[] = ['cairo', 'amiri', 'kufi'];

const GOLDEN_ANGLE = 137.50776405003785;

/**
 * Deterministic 32-bit FNV-1a hash from string
 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Generates a unique, deterministic EntryStyle that never repeats the same template
 * or close hue within the last 8 entries of the same group.
 */
export function generateEntryStyle(
  entryId: string,
  groupIndex: number,
  recentStyles: EntryStyle[] = [],
  salt = 0
): EntryStyle {
  const recent8 = recentStyles.slice(0, 8);
  const usedTemplates = new Set(recent8.map((s) => s.template));
  const usedHues = recent8.map((s) => s.hue);

  const seed = hashString(`${entryId}:${salt}:${groupIndex}`);

  // Golden angle progression guarantees maximum perceptual separation
  let baseHue = Math.round(((groupIndex + salt * 3) * GOLDEN_ANGLE + (seed % 29)) % 360);

  // Ensure hue is at least 18 degrees away from any of the last 8 entries
  for (let attempt = 0; attempt < 16; attempt++) {
    const conflict = usedHues.some((h) => {
      const diff = Math.abs(h - baseHue);
      const circularDiff = Math.min(diff, 360 - diff);
      return circularDiff < 18;
    });
    if (!conflict) break;
    baseHue = Math.round((baseHue + GOLDEN_ANGLE) % 360);
  }

  // Pick a template not in the last 8 entries
  const availableTemplates = ALL_TEMPLATES.filter((t) => !usedTemplates.has(t));
  const templatePool = availableTemplates.length > 0 ? availableTemplates : ALL_TEMPLATES;
  const template = templatePool[seed % templatePool.length];

  const decoration = ALL_DECORATIONS[(seed >>> 4) % ALL_DECORATIONS.length];
  const shape = ALL_SHAPES[(seed >>> 8) % ALL_SHAPES.length];
  const headingFont = ALL_FONTS[(seed >>> 12) % ALL_FONTS.length];

  // Subtle organic rotation between -1.4 and +1.4 degrees
  const rawRot = ((seed % 280) - 140) / 100;
  const rotation = Number(rawRot.toFixed(2));

  const secondaryHue = (baseHue + 48) % 360;

  return {
    seed,
    hue: baseHue,
    secondaryHue,
    template,
    decoration,
    shape,
    rotation,
    headingFont,
  };
}

/**
 * Calculates growth stage and progress from total entry count
 */
export interface GrowthStageInfo {
  stageIndex: number;
  name: string;
  icon: string;
  minEntries: number;
  nextMilestone: number;
  progressPercent: number;
  description: string;
}

export const GROWTH_MILESTONES = [10, 50, 100, 500, 1000];

export function getGrowthStage(entryCount: number): GrowthStageInfo {
  if (entryCount < 10) {
    return {
      stageIndex: 0,
      name: 'بذرة واعدة',
      icon: '🌱',
      minEntries: 0,
      nextMilestone: 10,
      progressPercent: Math.min(100, Math.round((entryCount / 10) * 100)),
      description: 'بداية رحلتك المعرفية.. كل فكرة تزرعها اليوم تصنع غابتك غداً',
    };
  }
  if (entryCount < 50) {
    return {
      stageIndex: 1,
      name: 'برعم أخضر',
      icon: '🌿',
      minEntries: 10,
      nextMilestone: 50,
      progressPercent: Math.min(100, Math.round(((entryCount - 10) / 40) * 100)),
      description: 'بدأت الجذور تضرب في العمق والأغصان الأولى تتشكل',
    };
  }
  if (entryCount < 100) {
    return {
      stageIndex: 2,
      name: 'شجرة فتية',
      icon: '🌳',
      minEntries: 50,
      nextMilestone: 100,
      progressPercent: Math.min(100, Math.round(((entryCount - 50) / 50) * 100)),
      description: 'أغصانك تتفرع بقوة وتتشابك فيها المعارف والروابط',
    };
  }
  if (entryCount < 500) {
    return {
      stageIndex: 3,
      name: 'دوحة وارفة',
      icon: '🌲',
      minEntries: 100,
      nextMilestone: 500,
      progressPercent: Math.min(100, Math.round(((entryCount - 100) / 400) * 100)),
      description: 'شجرة عظيمة راسخة تظلل حقولاً واسعة من العلم والحكمة',
    };
  }
  return {
    stageIndex: 4,
    name: 'غابة المعرفة الخالدة',
    icon: '🏞️',
    minEntries: 500,
    nextMilestone: Math.max(1000, Math.ceil((entryCount + 1) / 500) * 500),
    progressPercent: Math.min(100, Math.round(((entryCount % 500) / 500) * 100)),
    description: 'عقل موسوعي متقد تتصل فيه آلاف الخلايا العصبية والثمار المعرفية',
  };
}

/**
 * Computes current streak (consecutive days up to today or yesterday)
 */
export function calculateStreak(dates: string[], todayStr: string): number {
  if (dates.length === 0) return 0;
  const uniqueDates = new Set(dates);

  const parseDate = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const formatDate = (dt: Date) => dt.toISOString().slice(0, 10);

  let cursor = parseDate(todayStr);
  if (!uniqueDates.has(formatDate(cursor))) {
    // Check yesterday
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!uniqueDates.has(formatDate(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (uniqueDates.has(formatDate(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Estimates reading time in Arabic
 */
export function estimateReadingTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}
