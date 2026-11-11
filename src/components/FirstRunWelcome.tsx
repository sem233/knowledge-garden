import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Database, Sprout } from 'lucide-react';

interface FirstRunWelcomeProps {
  onPlantFirstSeed: () => void;
  onLoadSampleGarden: () => Promise<void>;
}

export const FirstRunWelcome: React.FC<FirstRunWelcomeProps> = ({
  onPlantFirstSeed,
  onLoadSampleGarden,
}) => {
  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl w-full p-8 md:p-10 rounded-3xl bg-white/85 dark:bg-[#11172B]/90 border border-violet-500/30 shadow-2xl text-center space-y-6 backdrop-blur-xl"
      >
        {/* Animated Glowing Seed / Tree Emblem */}
        <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/25 via-indigo-500/20 to-emerald-500/25 border border-violet-400/30 flex items-center justify-center shadow-inner">
          <svg className="w-14 h-14" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="34" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="4 4" />
            <path
              d="M40 62 V34 M40 48 C28 48 22 38 22 28 C32 28 40 36 40 48 Z M40 40 C52 40 58 30 58 20 C48 20 40 28 40 40 Z"
              stroke="#10B981"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="40" cy="18" r="5" fill="#A855F7" />
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="80" y2="80">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>مرحباً بك في بستان المعرفة</span>
          </div>
          <h2 className="font-kufi text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
            حوّل كل فائدة تتعلمها اليوم إلى شجرةٍ ودماغٍ ينبض بالحياة
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            دفتر يومي شخصي مصمم لسطح المكتب: دوّن مقالاتك، الحِكم، المواعظ، المفردات الجديدة، والروابط. كل إضافة تولد بتصميم فريد وتنمو أمام عينيك كخلية عصبية متوهجة أو ورقة وارفة.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={onPlantFirstSeed}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-l from-violet-600 via-indigo-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white text-sm font-bold shadow-xl shadow-violet-600/30 transition-transform active:scale-95"
          >
            <Sprout className="w-5 h-5" />
            <span>ازرع أول بذرة</span>
          </button>

          <button
            type="button"
            onClick={onLoadSampleGarden}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-sm font-semibold transition-colors"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>تحميل بيانات تجريبية (25 فائدة)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
