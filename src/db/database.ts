import Dexie, { type Table } from 'dexie';
import {
  AppSettings,
  EntryLink,
  KnowledgeEntry,
  KnowledgeGroup,
  NodePosition,
} from '../types';

export class KnowledgeGardenDB extends Dexie {
  groups!: Table<KnowledgeGroup, string>;
  entries!: Table<KnowledgeEntry, string>;
  links!: Table<EntryLink, string>;
  settings!: Table<AppSettings, string>;
  layout!: Table<NodePosition, string>;

  constructor() {
    super('KnowledgeGardenDB');
    this.version(1).stores({
      groups: 'id, order, deletedAt, createdAt',
      entries: 'id, groupId, type, date, isPinned, isStressTest, createdAt, updatedAt, *tags',
      links: 'id, entryId, domain',
      settings: 'id',
      layout: 'id, groupId, updatedAt',
    });
  }
}

export const db = new KnowledgeGardenDB();

export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore storage persistence errors in restricted frames
  }
  return false;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  theme: 'dark',
  animationIntensity: 'high',
  dailyGoal: 3,
  lastBackupAt: null,
  dismissedBackupBannerUntil: null,
  hasSeenFirstRun: false,
};

export async function getOrCreateSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('default');
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
