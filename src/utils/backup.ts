import { db } from '../db/database';
import {
  AppSettings,
  ENTRY_TYPE_META,
  KnowledgeEntry,
  KnowledgeGroup,
  NodePosition,
} from '../types';

export interface KnowledgeGardenBackup {
  version: number;
  exportedAt: string;
  groups: KnowledgeGroup[];
  entries: KnowledgeEntry[];
  layout: NodePosition[];
  settings?: AppSettings;
}

export async function exportFullBackupJSON(): Promise<string> {
  const [groups, entries, layout, settings] = await Promise.all([
    db.groups.toArray(),
    db.entries.filter((e) => !e.isStressTest).toArray(),
    db.layout.toArray(),
    db.settings.get('default'),
  ]);

  const payload: KnowledgeGardenBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
    entries,
    layout,
    settings,
  };

  await db.settings.update('default', { lastBackupAt: Date.now() });
  return JSON.stringify(payload, null, 2);
}

export async function importFullBackupJSON(jsonString: string): Promise<{
  groupsCount: number;
  entriesCount: number;
}> {
  let parsed: KnowledgeGardenBackup;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('ملف النسخة الاحتياطية غير صالح (صيغة JSON تالفة).');
  }

  if (!parsed || !Array.isArray(parsed.groups) || !Array.isArray(parsed.entries)) {
    throw new Error('لا يحتوي الملف على بنية مجموعات وفوائد بستان المعرفة.');
  }

  await db.transaction('rw', [db.groups, db.entries, db.links, db.layout, db.settings], async () => {
    await db.groups.bulkPut(parsed.groups);
    await db.entries.bulkPut(parsed.entries);
    const links = parsed.entries.flatMap((e) => e.links || []);
    if (links.length > 0) {
      await db.links.bulkPut(links);
    }
    if (Array.isArray(parsed.layout) && parsed.layout.length > 0) {
      await db.layout.bulkPut(parsed.layout);
    }
    await db.settings.update('default', {
      lastBackupAt: Date.now(),
      hasSeenFirstRun: true,
    });
  });

  return {
    groupsCount: parsed.groups.length,
    entriesCount: parsed.entries.length,
  };
}

export async function exportToMarkdown(): Promise<string> {
  const [groups, entries] = await Promise.all([
    db.groups.filter((g) => g.deletedAt === null).sortBy('order'),
    db.entries.filter((e) => !e.isStressTest).toArray(),
  ]);

  const lines: string[] = [
    '# بستان المعرفة — تصدير شامل',
    `> تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`,
    '',
  ];

  for (const grp of groups) {
    const grpEntries = entries
      .filter((e) => e.groupId === grp.id)
      .sort((a, b) => b.createdAt - a.createdAt);

    lines.push(`## 🌿 ${grp.name} (${grpEntries.length})`);
    lines.push('');

    for (const entry of grpEntries) {
      const typeLabel = ENTRY_TYPE_META[entry.type]?.label || entry.type;
      lines.push(`### ${entry.title} [${typeLabel}]`);
      lines.push(`- **التاريخ**: ${entry.date}`);
      if (entry.source) lines.push(`- **المصدر**: ${entry.source}`);
      if (entry.tags.length > 0) lines.push(`- **الوسوم**: ${entry.tags.join(' ، ')}`);
      if (entry.meaning) lines.push(`- **المعنى**: ${entry.meaning}`);
      lines.push('');
      lines.push(entry.contentText);
      lines.push('');
      if (entry.links && entry.links.length > 0) {
        lines.push('**الروابط المرفقة:**');
        for (const l of entry.links) {
          lines.push(`- [${l.title}](${l.url})`);
        }
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import {
  decodeTransferCodeToPayload,
  encodePayloadToTransferCode,
} from './transferCode';

export { encodePayloadToTransferCode, decodeTransferCodeToPayload };

/**
 * Compresses full DB backup into a portable Transfer Code (KG1-...) using browser CompressionStream (gzip + base64url)
 * Works 100% offline between PC and Android phone!
 */
export async function generateOfflineTransferCode(): Promise<string> {
  const json = await exportFullBackupJSON();
  return await encodePayloadToTransferCode(json);
}

/**
 * Restores data from a Transfer Code (KG1-... or KG0-...)
 */
export async function restoreFromOfflineTransferCode(
  code: string
): Promise<{ groupsCount: number; entriesCount: number }> {
  const jsonString = await decodeTransferCodeToPayload(code);
  return await importFullBackupJSON(jsonString);
}



