import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import { motion } from 'motion/react';
import {
  X,
  Bold,
  Underline as UnderlineIcon,
  Highlighter,
  Eraser,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  ClipboardPaste,
  Dices,
  Edit3,
  BookOpen,
  Calendar,
} from 'lucide-react';
import {
  ENTRY_TYPE_META,
  EntryLink,
  EntryType,
  KnowledgeEntry,
  KnowledgeGroup,
} from '../types';

// Custom TipTap FontSize Extension on TextStyle
const FontSizeExtension = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const HIGHLIGHT_COLORS = [
  { name: 'أصفر ذهبي', color: '#fde047' },
  { name: 'أخضر زمردي', color: '#86efac' },
  { name: 'وردي مرجاني', color: '#f9a8d4' },
  { name: 'أزرق سماوي', color: '#93c5fd' },
  { name: 'برتقالي دافئ', color: '#fdba74' },
  { name: 'بنفسجي ملكي', color: '#d8b4fe' },
];

interface EntryEditorModalProps {
  isOpen: boolean;
  initialEntry: KnowledgeEntry | null;
  groups: KnowledgeGroup[];
  defaultGroupId: string;
  onSave: (entryData: {
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
  }) => Promise<KnowledgeEntry>;
  onClose: () => void;
}

export const EntryEditorModal: React.FC<EntryEditorModalProps> = ({
  isOpen,
  initialEntry,
  groups,
  defaultGroupId,
  onSave,
  onClose,
}) => {
  // Calm reading mode by default when opening an existing entry; edit mode when creating a new entry
  const [isEditing, setIsEditing] = useState<boolean>(!initialEntry);
  const [entryId, setEntryId] = useState<string | undefined>(initialEntry?.id);
  const [title, setTitle] = useState(initialEntry?.title || '');
  const [groupId, setGroupId] = useState(
    initialEntry?.groupId || defaultGroupId || groups[0]?.id || ''
  );
  const [type, setType] = useState<EntryType>(initialEntry?.type || 'article');
  const [meaning, setMeaning] = useState(initialEntry?.meaning || '');
  const [source, setSource] = useState(initialEntry?.source || '');
  const [tagsInput, setTagsInput] = useState((initialEntry?.tags || []).join('، '));
  const [date, setDate] = useState(
    initialEntry?.date || new Date().toISOString().slice(0, 10)
  );
  const [baseFontSize, setBaseFontSize] = useState(initialEntry?.baseFontSize || 18);
  const [links, setLinks] = useState<EntryLink[]>(initialEntry?.links || []);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [inlineLinkInput, setInlineLinkInput] = useState('');
  const [showInlineLinkBox, setShowInlineLinkBox] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [validationError, setValidationError] = useState('');
  const [selectionActive, setSelectionActive] = useState(false);
  const [liveHtml, setLiveHtml] = useState(initialEntry?.contentHtml || '<p></p>');

  const dirtyRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Avoid duplicate link/underline warnings in TipTap v3
      }),
      TextStyle,
      FontSizeExtension,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: 'اكتب خلاصة ما تعلمته اليوم، أو الصق النص ونسّقه بالألوان والأحجام...',
      }),
    ],
    content: initialEntry?.contentHtml || '<p></p>',
    editorProps: {
      transformPastedHTML(html) {
        return DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'p',
            'b',
            'strong',
            'i',
            'em',
            'u',
            'mark',
            'a',
            'ul',
            'ol',
            'li',
            'h1',
            'h2',
            'h3',
            'blockquote',
            'br',
            'span',
          ],
          ALLOWED_ATTR: ['href', 'style', 'data-color', 'class'],
        });
      },
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      setSelectionActive(to > from);
    },
    onUpdate: ({ editor: ed }) => {
      dirtyRef.current = true;
      setLiveHtml(ed.getHTML());
      setSaveStatus('saving');
    },
  });

  // Reset state when opening modal with different entry
  useEffect(() => {
    if (!isOpen) return;
    setIsEditing(!initialEntry);
    setEntryId(initialEntry?.id);
    setTitle(initialEntry?.title || '');
    setGroupId(initialEntry?.groupId || defaultGroupId || groups[0]?.id || '');
    setType(initialEntry?.type || 'article');
    setMeaning(initialEntry?.meaning || '');
    setSource(initialEntry?.source || '');
    setTagsInput((initialEntry?.tags || []).join('، '));
    setDate(initialEntry?.date || new Date().toISOString().slice(0, 10));
    setBaseFontSize(initialEntry?.baseFontSize || 18);
    setLinks(initialEntry?.links || []);
    setLiveHtml(initialEntry?.contentHtml || '<p></p>');
    setValidationError('');
    setSaveStatus(initialEntry ? 'saved' : 'idle');
    dirtyRef.current = false;
    if (editor && initialEntry?.contentHtml !== undefined) {
      editor.commands.setContent(initialEntry.contentHtml);
    } else if (editor && !initialEntry) {
      editor.commands.setContent('<p></p>');
    }
  }, [isOpen, initialEntry, defaultGroupId, groups, editor]);

  const performSave = useCallback(
    async (shuffleStyle = false): Promise<boolean> => {
      if (!editor) return false;
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setValidationError('يرجى كتابة عنوان الفائدة قبل الحفظ');
        return false;
      }
      const targetGroupId = groupId || groups[0]?.id;
      if (!targetGroupId) {
        setValidationError('يرجى اختيار مجموعة');
        return false;
      }

      setSaveStatus('saving');
      const rawHtml = editor.getHTML();
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ['mark'],
        ADD_ATTR: ['style', 'data-color', 'target', 'rel'],
      });
      setLiveHtml(cleanHtml);
      const plainText = editor.getText().trim();
      const highlightMatches = cleanHtml.match(/<mark/g);
      const highlightCount = highlightMatches ? highlightMatches.length : 0;

      const parsedTags = tagsInput
        .split(/[,،#]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const saved = await onSave({
        id: entryId,
        title: trimmedTitle,
        groupId: targetGroupId,
        type,
        contentHtml: cleanHtml,
        contentText: plainText || trimmedTitle,
        meaning: meaning.trim() || undefined,
        source: source.trim() || undefined,
        tags: parsedTags,
        links,
        highlightCount,
        baseFontSize,
        date,
        shuffleStyle,
      });

      setEntryId(saved.id);
      dirtyRef.current = false;
      setSaveStatus('saved');
      setValidationError('');
      return true;
    },
    [
      editor,
      title,
      groupId,
      groups,
      type,
      meaning,
      source,
      tagsInput,
      links,
      baseFontSize,
      date,
      entryId,
      onSave,
    ]
  );

  // Debounced auto-save when editing existing or titled entry
  useEffect(() => {
    if (!isOpen || !isEditing || !title.trim() || !dirtyRef.current) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      void performSave(false);
    }, 900);
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [
    isOpen,
    isEditing,
    title,
    groupId,
    type,
    meaning,
    source,
    tagsInput,
    links,
    baseFontSize,
    date,
    liveHtml,
    performSave,
  ]);

  // Flush save on visibilitychange / beforeunload
  useEffect(() => {
    if (!isOpen) return;
    const handleFlush = () => {
      if (dirtyRef.current && title.trim()) {
        void performSave(false);
      }
    };
    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleFlush);
    };
  }, [isOpen, title, performSave]);

  const applyFontSize = useCallback(
    (newSize: number) => {
      const clamped = Math.min(48, Math.max(12, newSize));
      setBaseFontSize(clamped);
      dirtyRef.current = true;
      if (editor && isEditing) {
        const { from, to } = editor.state.selection;
        if (to > from) {
          editor
            .chain()
            .focus()
            .setMark('textStyle', { fontSize: `${clamped}px` })
            .run();
        }
      }
    },
    [editor, isEditing]
  );

  // Keyboard shortcuts inside Modal: Ctrl+S, Esc, Ctrl+Shift+> / <
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void performSave(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '>' || e.key === '.')) {
        e.preventDefault();
        applyFontSize(baseFontSize + 2);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '<' || e.key === ',')) {
        e.preventDefault();
        applyFontSize(baseFontSize - 2);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, baseFontSize, applyFontSize, performSave, onClose]);

  const handlePastePlainText = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && editor) {
        editor.chain().focus().insertContent(text).run();
        dirtyRef.current = true;
      }
    } catch {
      // Clipboard read permission denied in some frames
    }
  };

  const handleAddInlineLink = () => {
    if (!editor || !inlineLinkInput.trim()) return;
    const url = inlineLinkInput.trim().startsWith('http')
      ? inlineLinkInput.trim()
      : `https://${inlineLinkInput.trim()}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setInlineLinkInput('');
    setShowInlineLinkBox(false);
    dirtyRef.current = true;
  };

  const handleAddAttachedLink = () => {
    if (!newLinkUrl.trim()) return;
    const formattedUrl = newLinkUrl.trim().startsWith('http')
      ? newLinkUrl.trim()
      : `https://${newLinkUrl.trim()}`;
    let domain = 'link';
    try {
      domain = new URL(formattedUrl).hostname.replace(/^www\./, '');
    } catch {
      domain = formattedUrl;
    }
    const newItem: EntryLink = {
      id: `lnk-${Date.now()}`,
      entryId: entryId || 'temp',
      title: newLinkTitle.trim() || domain,
      url: formattedUrl,
      domain,
    };
    setLinks((prev) => [...prev, newItem]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    dirtyRef.current = true;
  };

  if (!isOpen) return null;

  const currentGroup = groups.find((g) => g.id === groupId);
  const typeMeta = ENTRY_TYPE_META[type];
  const parsedTagsList = tagsInput
    .split(/[,،#]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const sanitizedReadingHtml = DOMPurify.sanitize(liveHtml, {
    ADD_TAGS: ['mark'],
    ADD_ATTR: ['style', 'data-color', 'target', 'rel'],
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        layoutId={entryId ? `entry-card-${entryId}` : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={
          !isEditing
            ? `قراءة: ${title}`
            : entryId
            ? 'تحرير الفائدة'
            : 'إضافة فائدة جديدة'
        }
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-3xl bg-white dark:bg-[#0F1526] border border-slate-200 dark:border-slate-800/90 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Modal Bar */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 min-w-0">
            {!isEditing ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                <span
                  className="font-bold whitespace-nowrap"
                  style={{ color: typeMeta.badgeColor }}
                >
                  {typeMeta.label}
                </span>
                {currentGroup && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                      {currentGroup.name}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono whitespace-nowrap">
                  <Calendar className="w-3 h-3 opacity-70" />
                  {date}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-kufi text-base font-bold text-slate-900 dark:text-white">
                  {entryId ? 'وضع التعديل والتخصيص' : 'ازرع فائدة جديدة في بستانك'}
                </span>
                {saveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <Check className="w-3.5 h-3.5" />
                    <span>تم الحفظ ✓</span>
                  </span>
                )}
                {saveStatus === 'saving' && (
                  <span className="text-xs text-amber-400">جارٍ الحفظ التلقائي...</span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/20 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل وتخصيص</span>
              </button>
            ) : (
              <>
                {entryId && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await performSave(false);
                      if (ok) setIsEditing(false);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 text-xs font-semibold transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>وضع القراءة الهادئة</span>
                  </button>
                )}
                {entryId && (
                  <button
                    type="button"
                    onClick={() => void performSave(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-600 dark:text-violet-300 text-xs font-medium transition-colors"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>ستايل جديد</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (debounceTimerRef.current) {
                      window.clearTimeout(debounceTimerRef.current);
                      debounceTimerRef.current = null;
                    }
                    try {
                      const ok = await performSave(false);
                      if (ok) onClose();
                    } catch (err) {
                      setValidationError(
                        err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ'
                      );
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  حفظ وإغلاق (Ctrl+S)
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق النافذة"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================
            MODE 1: CALM, SERENE READING VIEW (Default for opened entries)
           ============================================================ */}
        {!isEditing ? (
          <div className="flex-1 overflow-y-auto px-8 py-8 md:px-12 md:py-10 space-y-6">
            {/* Serene Reading Header */}
            <div className="space-y-3 border-b border-slate-200/60 dark:border-slate-800/70 pb-6">
              <h2
                className={`font-bold text-slate-900 dark:text-white leading-snug ${
                  type === 'wisdom' || type === 'sermon'
                    ? 'font-amiri text-3xl md:text-4xl'
                    : 'font-kufi text-2xl md:text-3xl'
                }`}
              >
                {title}
              </h2>

              {source && (
                <div className="flex items-center gap-2 text-sm font-amiri text-slate-600 dark:text-slate-300">
                  <BookOpen className="w-4 h-4 text-violet-400 shrink-0" />
                  <span>{source}</span>
                </div>
              )}
            </div>

            {/* Meaning Box if Word */}
            {type === 'word' && meaning && (
              <div className="p-5 rounded-2xl bg-violet-500/10 border border-violet-500/25 space-y-1.5">
                <div className="text-xs font-semibold text-violet-400">المعنى والبيان:</div>
                <p className="text-base font-medium text-slate-900 dark:text-white leading-relaxed">
                  {meaning}
                </p>
              </div>
            )}

            {/* Main Calm Reading Body with Vibrant Highlights */}
            <div
              className={`reading-content text-slate-800 dark:text-slate-100 leading-[2.05] ${
                type === 'wisdom' || type === 'sermon' ? 'font-amiri' : 'font-cairo'
              }`}
              style={{
                fontSize: `${
                  type === 'wisdom' || type === 'sermon'
                    ? Math.max(22, baseFontSize + 4)
                    : Math.max(18, baseFontSize)
                }px`,
              }}
              dangerouslySetInnerHTML={{ __html: sanitizedReadingHtml }}
            />

            {/* Attached Links in Reading View */}
            {links.length > 0 && (
              <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/70 space-y-3">
                <div className="text-xs font-semibold text-slate-400">الروابط والمصادر المرفقة:</div>
                <div className="flex flex-wrap gap-2.5">
                  {links.map((lnk) => (
                    <a
                      key={lnk.id}
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-violet-500/15 border border-slate-200 dark:border-slate-800 text-xs font-medium text-sky-500 dark:text-sky-400 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{lnk.title || lnk.domain}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Unboxed Quiet Tags Footer */}
            {parsedTagsList.length > 0 && (
              <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2 flex-wrap text-xs text-slate-400">
                {parsedTagsList.map((tag, idx) => (
                  <React.Fragment key={tag}>
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <span>#{tag}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
              MODE 2: FULL EDIT & CUSTOMIZATION MODE
             ============================================================ */
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {validationError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {validationError}
              </div>
            )}

            {/* Metadata Row 1: Title + Date */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label
                  htmlFor="entry-title-input"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  عنوان الفائدة أو الكلمة
                </label>
                <input
                  id="entry-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    dirtyRef.current = true;
                    setValidationError('');
                  }}
                  placeholder="اكتب عنواناً معبراً يلخص الفكرة..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="entry-date-input"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  تاريخ التدوين
                </label>
                <input
                  id="entry-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    dirtyRef.current = true;
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Metadata Row 2: Group + Entry Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="entry-group-select"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  المجموعة المعرفية
                </label>
                <select
                  id="entry-group-select"
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    dirtyRef.current = true;
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  نوع الفائدة (يحدد تصميم البطاقة)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {(Object.keys(ENTRY_TYPE_META) as EntryType[]).map((tKey) => {
                    const meta = ENTRY_TYPE_META[tKey];
                    const active = type === tKey;
                    return (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => {
                          setType(tKey);
                          dirtyRef.current = true;
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                          active
                            ? 'bg-violet-600 text-white border-violet-500 shadow-sm'
                            : 'bg-slate-100/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Meaning field if type === 'word' */}
            {type === 'word' && (
              <div>
                <label
                  htmlFor="entry-meaning-input"
                  className="block text-xs font-medium text-violet-400 mb-1"
                >
                  المعنى الموجز (يظهر عند قلب بطاقة الكلمة)
                </label>
                <input
                  id="entry-meaning-input"
                  type="text"
                  value={meaning}
                  onChange={(e) => {
                    setMeaning(e.target.value);
                    dirtyRef.current = true;
                  }}
                  placeholder="اكتب المعنى المباشر للكلمة أو المصطلح..."
                  className="w-full px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-sm text-slate-900 dark:text-white"
                />
              </div>
            )}

            {/* Fixed Rich Formatting Toolbar */}
            <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              {/* Text styles */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  aria-label="خط عريض"
                  className={`p-2 rounded-lg text-xs transition-colors ${
                    editor?.isActive('bold')
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  aria-label="تسطير"
                  className={`p-2 rounded-lg text-xs transition-colors ${
                    editor?.isActive('underline')
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <UnderlineIcon className="w-4 h-4" />
                </button>

                <span className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

                {/* Multi-color Highlighters */}
                <div className="flex items-center gap-1">
                  <Highlighter className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  {HIGHLIGHT_COLORS.map((hc) => (
                    <button
                      key={hc.color}
                      type="button"
                      onClick={() =>
                        editor?.chain().focus().toggleHighlight({ color: hc.color }).run()
                      }
                      aria-label={`تمييز بلون ${hc.name}`}
                      title={`تمييز: ${hc.name}`}
                      className="w-5 h-5 rounded-md border border-black/20 transition-transform hover:scale-110"
                      style={{ backgroundColor: hc.color }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      editor?.chain().focus().unsetHighlight().unsetAllMarks().run();
                    }}
                    aria-label="ممحاة التنسيق والتمييز"
                    title="ممحاة التمييز"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

                {/* Link on Selected Text */}
                <button
                  type="button"
                  onClick={() => setShowInlineLinkBox((s) => !s)}
                  aria-label="إدراج رابط على النص المحدد"
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>

                {/* Paste as Plain Text */}
                <button
                  type="button"
                  onClick={handlePastePlainText}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                  title="لصق كنص عادي بدون تنسيقات خارجية"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>لصق نص صافي</span>
                </button>
              </div>

              {/* Font Size Presets + Slider (12 - 48px) & Undo/Redo */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  {[
                    { label: 'صغير', size: 14 },
                    { label: 'عادي', size: 18 },
                    { label: 'كبير', size: 24 },
                    { label: 'ضخم', size: 32 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyFontSize(preset.size)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        baseFontSize === preset.size
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-500 dark:text-slate-300 hover:text-violet-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <input
                    type="range"
                    aria-label="حجم الخط بالبكسل"
                    min={12}
                    max={48}
                    value={baseFontSize}
                    onChange={(e) => applyFontSize(Number(e.target.value))}
                    className="w-20 accent-violet-500 cursor-pointer mx-1"
                  />
                  <span className="text-[11px] font-mono text-slate-400 w-9 text-left">
                    {baseFontSize}px
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().undo().run()}
                    aria-label="تراجع"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().redo().run()}
                    aria-label="إعادة"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Link Input Popover */}
            {showInlineLinkBox && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                <input
                  type="url"
                  value={inlineLinkInput}
                  onChange={(e) => setInlineLinkInput(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAddInlineLink}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium"
                >
                  ربط النص المحدد
                </button>
              </div>
            )}

            {/* Floating Selection Mini-Bar (Medium style when text is selected) */}
            {selectionActive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white border border-violet-500/40 shadow-lg w-fit text-xs">
                <span className="text-slate-400">تنسيق التحديد:</span>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className="px-2 py-0.5 rounded hover:bg-white/10 font-bold"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className="px-2 py-0.5 rounded hover:bg-white/10 underline"
                >
                  U
                </button>
                {HIGHLIGHT_COLORS.slice(0, 4).map((hc) => (
                  <button
                    key={hc.color}
                    type="button"
                    onClick={() =>
                      editor?.chain().focus().toggleHighlight({ color: hc.color }).run()
                    }
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: hc.color }}
                  />
                ))}
              </div>
            )}

            {/* Rich Text Editor Area */}
            <div
              className="rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 p-5 text-slate-900 dark:text-slate-100"
              style={{ fontSize: `${baseFontSize}px` }}
            >
              <EditorContent editor={editor} />
            </div>

            {/* Source & Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="entry-source-input"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  المصدر / المؤلف / المتحدث
                </label>
                <input
                  id="entry-source-input"
                  type="text"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    dirtyRef.current = true;
                  }}
                  placeholder="مثال: كتاب صيد الخاطر — ابن الجوزي"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="entry-tags-input"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  الوسوم (افصل بينها بفاصلة لربط الخلايا العصبية في عقلك)
                </label>
                <input
                  id="entry-tags-input"
                  type="text"
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    dirtyRef.current = true;
                  }}
                  placeholder="حكمة، تزكية، خوارزميات، لغة..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Dedicated Attached Links Section */}
            <div className="p-4 rounded-2xl bg-slate-100/60 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                الروابط والمصادر المرفقة ({links.length})
              </div>

              {links.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {links.map((lnk) => (
                    <div
                      key={lnk.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <a
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sky-500 hover:underline truncate"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate font-medium">{lnk.title}</span>
                        <span className="text-[11px] text-slate-400">({lnk.domain})</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setLinks((prev) => prev.filter((item) => item.id !== lnk.id));
                          dirtyRef.current = true;
                        }}
                        aria-label={`حذف الرابط ${lnk.title}`}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="عنوان الرابط (اختياري)"
                  className="sm:w-1/3 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddAttachedLink}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة رابط</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

