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

    // Index up to 25,000 entries fast
    const docs: SearchDocument[] = entries.map((e) => ({
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
  }

  search(query: string): Set<string> {
    const trimmed = query.trim();
    if (!trimmed) return new Set();
    const results = this.miniSearch.search(trimmed);
    return new Set(results.map((r) => String(r.id)));
  }
}

export const searchEngine = new KnowledgeSearchEngine();
