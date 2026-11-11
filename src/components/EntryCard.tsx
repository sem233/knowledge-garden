import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Star,
  Dices,
  ExternalLink,
  RotateCw,
  BookOpen,
  Trash2,
  Palette,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  ALL_TEMPLATES,
  estimateReadingTimeMinutes,
  TEMPLATE_LABELS,
} from '../utils/styleEngine';
import {
  CardTemplate,
  ENTRY_TYPE_META,
  KnowledgeEntry,
  KnowledgeGroup,
} from '../types';

interface EntryCardProps {
  entry: KnowledgeEntry;
  group?: KnowledgeGroup;
  onOpen: (entry: KnowledgeEntry) => void;
  onTogglePin: (entry: KnowledgeEntry, e: React.MouseEvent) => void;
  onShuffleStyle: (entry: KnowledgeEntry, e: React.MouseEvent) => void;
  onPickStyle: (
    entry: KnowledgeEntry,
    patch: { hue?: number; template?: CardTemplate },
    e: React.MouseEvent
  ) => void;
  onDelete: (entry: KnowledgeEntry, e: React.MouseEvent) => void;
  compact?: boolean;
  isNewlyCreated?: boolean;
}

export const EntryCard: React.FC<EntryCardProps> = ({
  entry,
  group,
  onOpen,
  onTogglePin,
  onShuffleStyle,
  onPickStyle,
  onDelete,
  compact = false,
  isNewlyCreated = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const { style, type } = entry;
  const hue = style.hue;
  const secHue = style.secondaryHue;
  const typeMeta = ENTRY_TYPE_META[type];
  const readingMinutes = estimateReadingTimeMinutes(entry.contentText);

  const fontClass =
    style.headingFont === 'amiri'
      ? 'font-amiri'
      : style.headingFont === 'kufi'
      ? 'font-kufi'
      : 'font-cairo';

  const shapeClass =
    style.shape === 'notched'
      ? 'clip-notched rounded-xl'
      : style.shape === 'arched'
      ? 'rounded-t-3xl rounded-b-xl'
      : 'rounded-2xl';

  // Template surface styling using deterministic HSL from Golden Angle
  const getTemplateStyle = (): React.CSSProperties => {
    switch (style.template) {
      case 'glass':
        return {
          background: `linear-gradient(135deg, hsla(${hue}, 65%, 22%, 0.42), hsla(${secHue}, 60%, 14%, 0.55))`,
          borderColor: `hsla(${hue}, 75%, 62%, 0.28)`,
        };
      case 'neon':
        return {
          background: `hsla(${hue}, 40%, 11%, 0.85)`,
          borderColor: `hsla(${hue}, 90%, 60%, 0.65)`,
          boxShadow: `0 0 22px -6px hsla(${hue}, 90%, 55%, 0.28)`,
        };
      case 'mesh':
        return {
          background: `radial-gradient(at 15% 15%, hsla(${hue}, 75%, 32%, 0.45) 0px, transparent 60%), radial-gradient(at 85% 85%, hsla(${secHue}, 75%, 28%, 0.45) 0px, transparent 60%), hsla(225, 35%, 12%, 0.85)`,
          borderColor: `hsla(${hue}, 70%, 60%, 0.25)`,
        };
      case 'paper':
        return {
          background: `linear-gradient(180deg, hsla(${hue}, 28%, 18%, 0.78), hsla(${hue}, 22%, 14%, 0.88))`,
          borderColor: `hsla(${hue}, 45%, 55%, 0.25)`,
        };
      case 'sticky':
        return {
          background: `linear-gradient(145deg, hsla(${hue}, 55%, 24%, 0.52), hsla(${hue}, 45%, 16%, 0.72))`,
          borderColor: `hsla(${hue}, 75%, 62%, 0.35)`,
          transform: `rotate(${style.rotation}deg)`,
        };
      case 'notebook':
        return {
          backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, hsla(${hue}, 50%, 60%, 0.12) 28px)`,
          backgroundColor: `hsla(${hue}, 30%, 14%, 0.82)`,
          borderColor: `hsla(${hue}, 60%, 55%, 0.28)`,
        };
      case 'royal':
        return {
          background: `linear-gradient(135deg, hsla(${hue}, 68%, 20%, 0.7), hsla(42, 78%, 24%, 0.38))`,
          borderColor: `hsla(42, 85%, 60%, 0.38)`,
        };
      case 'prism':
        return {
          background: `linear-gradient(120deg, hsla(${hue}, 65%, 22%, 0.45), hsla(${(hue + 90) % 360}, 65%, 20%, 0.45))`,
          borderColor: `hsla(${hue}, 80%, 65%, 0.32)`,
        };
      default:
        return {
          background: `linear-gradient(145deg, hsla(${hue}, 50%, 18%, 0.65), hsla(${secHue}, 45%, 13%, 0.82))`,
          borderColor: `hsla(${hue}, 65%, 58%, 0.25)`,
        };
    }
  };

  const sanitizedExcerptHtml = DOMPurify.sanitize(entry.contentHtml, {
    ALLOWED_TAGS: ['p', 'b', 'strong', 'u', 'mark', 'a', 'span', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'data-color'],
  });

  // Render SVG background decoration according to entry.style.decoration
  const renderBackgroundDecoration = () => {
    const strokeColor = `hsla(${hue}, 80%, 65%, 0.12)`;
    switch (style.decoration) {
      case 'blob':
        return (
          <svg
            className="absolute -bottom-8 -left-8 w-36 h-36 pointer-events-none opacity-30"
            viewBox="0 0 200 200"
          >
            <path
              fill={strokeColor}
              d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.5,90,-16.3,88.5,-0.9C87,14.5,81.4,29,73.1,41.8C64.8,54.6,53.8,65.7,40.3,73.4C26.8,81.1,10.8,85.4,-4.6,83.4C-20,81.4,-34.8,73.1,-47.9,63.3C-61,53.5,-72.4,42.2,-78.9,28.2C-85.4,14.2,-87,-2.5,-83.2,-17.7C-79.4,-32.9,-70.2,-46.6,-57.8,-54.3C-45.4,-62,-29.8,-63.7,-15.2,-68.8C-0.6,-73.9,13,-82.4,27.7,-83.2C42.4,-84,58.2,-77.1,44.7,-76.4Z"
              transform="translate(100 100)"
            />
          </svg>
        );
      case 'waves':
        return (
          <svg
            className="absolute bottom-0 inset-x-0 w-full h-16 pointer-events-none opacity-25"
            viewBox="0 0 400 80"
            preserveAspectRatio="none"
          >
            <path
              d="M0 40 Q 100 10, 200 40 T 400 40 L 400 80 L 0 80 Z"
              fill={strokeColor}
            />
          </svg>
        );
      case 'orbits':
        return (
          <svg
            className="absolute -top-6 -left-6 w-28 h-28 pointer-events-none opacity-25"
            viewBox="0 0 100 100"
          >
            <circle cx="50" cy="50" r="38" fill="none" stroke={strokeColor} strokeWidth="1.5" />
            <circle cx="50" cy="50" r="24" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Word Flashcard Flip View
  if (type === 'word' && !compact) {
    return (
      <motion.article
        layoutId={`entry-card-${entry.id}`}
        initial={isNewlyCreated ? { scale: 0.85, opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        style={getTemplateStyle()}
        className={`group relative overflow-hidden border p-6 transition-all duration-200 hover:-translate-y-1 ${shapeClass} ${
          isNewlyCreated ? 'ring-2 ring-violet-400 shadow-xl shadow-violet-500/25' : ''
        }`}
      >
        {renderBackgroundDecoration()}

        {/* Unboxed Quiet Metadata Header */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <div className="flex items-center gap-1.5 truncate">
            <span style={{ color: `hsl(${hue}, 85%, 72%)` }} className="font-semibold">
              {typeMeta.label}
            </span>
            {group && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{group.name}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono">{entry.date}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped((f) => !f);
              }}
              aria-label={`قلب بطاقة الكلمة ${entry.title}`}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] flex items-center gap-1 transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              <span>{isFlipped ? 'الكلمة' : 'المعنى'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => onShuffleStyle(entry, e)}
              aria-label={`ستايل جديد لـ ${entry.title}`}
              title="ستايل جديد 🎲"
              className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 transition-colors"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => onTogglePin(entry, e)}
              aria-label={entry.isPinned ? `إلغاء تثبيت ${entry.title}` : `تثبيت ${entry.title}`}
              className={`p-1.5 rounded-lg transition-colors ${
                entry.isPinned ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${entry.isPinned ? 'fill-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        <div
          onClick={() => onOpen(entry)}
          className="cursor-pointer min-h-[120px] flex flex-col justify-center py-2"
        >
          {!isFlipped ? (
            <div>
              <h3 className="font-amiri text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {entry.title}
              </h3>
              <p className="text-xs text-slate-400">
                اضغط على «المعنى» لقلب البطاقة أو انقر لفتح المحرر الكامل
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-violet-300">المعنى والشرح:</div>
              <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                {entry.meaning || entry.contentText}
              </p>
              {entry.source && (
                <div className="text-xs text-slate-400 font-amiri">
                  المعجم / المصدر: {entry.source}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      layoutId={`entry-card-${entry.id}`}
      initial={isNewlyCreated ? { scale: 0.85, opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      style={getTemplateStyle()}
      onClick={() => onOpen(entry)}
      className={`group relative overflow-hidden border p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 ${shapeClass} ${
        isNewlyCreated ? 'ring-2 ring-violet-400 shadow-xl shadow-violet-500/25' : ''
      }`}
    >
      {renderBackgroundDecoration()}

      {/* Ornamental Quotation Mark for Wisdom */}
      {type === 'wisdom' && (
        <span
          aria-hidden="true"
          className="font-amiri text-6xl leading-none select-none pointer-events-none absolute top-3 left-5 opacity-20"
          style={{ color: `hsl(${hue}, 85%, 70%)` }}
        >
          ”
        </span>
      )}

      {/* Top Metadata Row (Zero-Pill Unboxed Text with · separators) */}
      <div className="relative z-10 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
        <div className="flex items-center gap-1.5 truncate">
          <span
            style={{ color: `hsl(${hue}, 85%, 70%)` }}
            className="font-semibold whitespace-nowrap"
          >
            {typeMeta.label}
          </span>
          {group && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{group.name}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="font-mono whitespace-nowrap">{entry.date}</span>
          {type === 'article' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{readingMinutes} د قراءة</span>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-85 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => onShuffleStyle(entry, e)}
            aria-label={`ستايل جديد لـ ${entry.title}`}
            title="ستايل جديد 🎲"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowStylePicker((s) => !s);
            }}
            aria-label={`تخصيص مظهر ${entry.title}`}
            title="تخصيص القالب واللون"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => onTogglePin(entry, e)}
            aria-label={entry.isPinned ? `إلغاء تثبيت ${entry.title}` : `تثبيت ${entry.title}`}
            className={`p-1.5 rounded-lg transition-colors ${
              entry.isPinned ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${entry.isPinned ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => onDelete(entry, e)}
            aria-label={`حذف ${entry.title}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Style Picker Popover */}
      {showStylePicker && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative z-20 mb-4 p-3 rounded-xl bg-slate-900/95 border border-slate-700 space-y-2.5 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200">اختر القالب الفني:</span>
            <span className="text-[11px] text-slate-400">{TEMPLATE_LABELS[style.template]}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {ALL_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={(e) => onPickStyle(entry, { template: tpl }, e)}
                className={`px-2 py-1 rounded text-[11px] truncate border ${
                  style.template === tpl
                    ? 'border-violet-400 bg-violet-500/25 text-white font-semibold'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {TEMPLATE_LABELS[tpl]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-slate-300">درجة اللون:</span>
            {[15, 42, 145, 195, 235, 270, 315, 345].map((h) => (
              <button
                key={h}
                type="button"
                onClick={(e) => onPickStyle(entry, { hue: h }, e)}
                aria-label={`درجة لون ${h}`}
                className="w-5 h-5 rounded-full border border-white/30"
                style={{ backgroundColor: `hsl(${h}, 80%, 55%)` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <h3
        className={`relative z-10 font-bold text-slate-900 dark:text-white leading-snug mb-2.5 ${
          type === 'wisdom' || type === 'sermon'
            ? 'font-amiri text-xl md:text-2xl'
            : `${fontClass} text-lg`
        }`}
      >
        {entry.title}
      </h3>

      {/* Excerpt / Rich Content Preview */}
      <div
        className={`relative z-10 text-slate-700 dark:text-slate-200/90 leading-relaxed line-clamp-4 ${
          type === 'wisdom' || type === 'sermon' ? 'font-amiri text-lg' : 'text-sm'
        }`}
        style={{ fontSize: `${Math.min(22, Math.max(14, entry.baseFontSize - 2))}px` }}
        dangerouslySetInnerHTML={{ __html: sanitizedExcerptHtml }}
      />

      {/* Links Section if present */}
      {entry.links && entry.links.length > 0 && (
        <div
          className="relative z-10 mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {entry.links.map((lnk) => (
            <a
              key={lnk.id}
              href={lnk.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 underline underline-offset-4"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{lnk.title || lnk.domain}</span>
            </a>
          ))}
        </div>
      )}

      {/* Footer: Source & Unboxed Tags */}
      {(entry.source || entry.tags.length > 0) && (
        <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 text-xs text-slate-400">
          {entry.source ? (
            <span className="truncate font-amiri text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 opacity-70 shrink-0" />
              <span className="truncate">{entry.source}</span>
            </span>
          ) : (
            <span />
          )}

          {entry.tags.length > 0 && (
            <div className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
              {entry.tags.slice(0, 3).map((tag, idx) => (
                <React.Fragment key={tag}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <span>#{tag}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
};
