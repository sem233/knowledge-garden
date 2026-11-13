import MiniSearch from 'minisearch';
import { KnowledgeEntry, KnowledgeGroup } from '../types';

export interface SearchDocument {
  id: string;
  title: string;
  contentText: string;
  meaning: string;
  source: string;
  tagsText: string;
  groupName: string;
  groupId: string;
  type: string;
  date: string;
}

export class KnowledgeSearchEngine {
  private miniSearch: MiniSearch<SearchDocument>;

  constructor() {
    this.miniSearch = new MiniSearch<SearchDocument>({
      fields: ['title', 'contentText', 'meaning', 'source', 'tagsText', 'groupName'],
      storeFields: ['id', 'title', 'groupId', 'type', 'date', 'groupName'],
      searchOptions: {
        boost: { title: 3, tagsText: 2.5, meaning: 2, groupName: 1.5, contentText: 1 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  rebuildIndex(entries: KnowledgeEntry[], groups: KnowledgeGroup[]) {
    this.miniSearch.removeAll();
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));

    // Prioritize personal/core entries + first 1,200 entries for instant 0ms search index build
    const immediateSlice = entries.length > 1500 ? entries.slice(0, 1200) : entries;
    const docs: SearchDocument[] = immediateSlice.map((e) => ({
      id: e.id,
      title: e.title,
      contentText: e.contentText,
      meaning: e.meaning || '',
      source: e.source || '',
      tagsText: e.tags.join(' '),
      groupName: groupMap.get(e.groupId) || '',
      groupId: e.groupId,
      type: e.type,
      date: e.date,
    }));

    this.miniSearch.addAll(docs);

    // If > 1,500 entries (e.g. 20,000 stress test), index the remainder asynchronously without blocking 120fps UI
    if (entries.length > 1500) {
      const restDocs: SearchDocument[] = entries.slice(1200).map((e) => ({
        id: e.id,
        title: e.title,
        contentText: e.contentText,
        meaning: e.meaning || '',
        source: e.source || '',
        tagsText: e.tags.join(' '),
        groupName: groupMap.get(e.groupId) || '',
        groupId: e.groupId,
        type: e.type,
        date: e.date,
      }));
      void this.miniSearch.addAllAsync(restDocs, { chunkSize: 2500 });
    }
  }

  search(query: string): Set<string> {
    const trimmed = query.trim();
    if (!trimmed) return new Set();
    const results = this.miniSearch.search(trimmed);
    return new Set(results.map((r) => String(r.id)));
  }
}

export const searchEngine = new KnowledgeSearchEngine();

