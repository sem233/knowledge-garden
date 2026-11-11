import { db } from './database';
import {
  EntryStyle,
  EntryType,
  KnowledgeEntry,
  KnowledgeGroup,
  NodePosition,
} from '../types';
import { generateEntryStyle } from '../utils/styleEngine';
import { computeNodePositionForEntry } from '../utils/brainGeometry';

function formatDateOffset(daysAgo: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return dt.toISOString().slice(0, 10);
}

export async function seedSampleArabicData(): Promise<{ groupsAdded: number; entriesAdded: number }> {
  const now = Date.now();

  const sampleGroups: KnowledgeGroup[] = [
    {
      id: 'grp-hikma-adab',
      name: 'الحكمة والأدب العربي',
      icon: 'Feather',
      color: '#F59E0B',
      defaultLayout: 'mixed',
      order: 0,
      deletedAt: null,
      createdAt: now - 86400000 * 20,
    },
    {
      id: 'grp-tafakur-tazkiyah',
      name: 'التزكية والتفكر',
      icon: 'Sparkles',
      color: '#10B981',
      defaultLayout: 'mixed',
      order: 1,
      deletedAt: null,
      createdAt: now - 86400000 * 19,
    },
    {
      id: 'grp-uloom-tech',
      name: 'العلوم وهندسة الحاسوب',
      icon: 'Cpu',
      color: '#38BDF8',
      defaultLayout: 'mixed',
      order: 2,
      deletedAt: null,
      createdAt: now - 86400000 * 18,
    },
  ];

  const rawEntries: Array<{
    id: string;
    groupId: string;
    type: EntryType;
    title: string;
    contentHtml: string;
    meaning?: string;
    source?: string;
    tags: string[];
    links?: Array<{ title: string; url: string; domain: string }>;
    daysAgo: number;
    isPinned?: boolean;
  }> = [
    // Group 1: الحكمة والأدب العربي
    {
      id: 'sample-1',
      groupId: 'grp-hikma-adab',
      type: 'wisdom',
      title: 'قيمة العلم والعمل به',
      contentHtml:
        '<p>قال الإمام الشافعي رحمه الله: <mark data-color="#fde047" style="background-color: #fde047">العلمُ ما نَفَع، ليس العلمُ ما حُفِظ</mark>. فكم من حافظٍ لمتون الكتب لم ينتفع بخلقها، وكم من متبصرٍ بآية واحدة أحيَت قلبه وسيرته.</p>',
      source: 'ديوان الإمام الشافعي',
      tags: ['حكمة', 'العلم', 'الأخلاق'],
      daysAgo: 0,
      isPinned: true,
    },
    {
      id: 'sample-2',
      groupId: 'grp-hikma-adab',
      type: 'word',
      title: 'السَّكِينَةُ والوَفَاء',
      contentHtml:
        '<p>السكينة: طمأنينةٌ ووقارٌ ينزل في القلب عند اضطراب الأحوال، فتسكن به الجوارح ويستقيم به الرأي.</p>',
      meaning: 'طمأنينة القلب وثباته عند الشدائد، وهي ضد القلق والاضطراب.',
      source: 'مقاييس اللغة لابن فارس',
      tags: ['لغة', 'معاجم', 'بلاغة'],
      daysAgo: 0,
    },
    {
      id: 'sample-3',
      groupId: 'grp-hikma-adab',
      type: 'article',
      title: 'كيف يبني القارئ ذاكرةً ثانية لا تشيخ؟',
      contentHtml:
        '<p>حين تقرأ كتاباً وتكتفي بقلب صفحاته، يتبخر أكثر من ثمانين بالمئة مما قرأت خلال أسبوعين. أما حين <mark data-color="#86efac" style="background-color: #86efac">تعيد صياغة الفكرة بلغتك الخاصة</mark> وتربطها بما تعرفه مسبقاً، فإنك تنسج مساراً عصبياً دائماً في عقلك.</p><p>التدوين اليومي ليس جمعاً للمعلومات، بل هو مختبر لتحويل المعرفة العابرة إلى بصيرة راسخة.</p>',
      source: 'مقالات في منهجية القراءة — الجاحظ في كتاب الحيوان',
      tags: ['القراءة', 'التدوين', 'الذاكرة'],
      daysAgo: 1,
      isPinned: true,
    },
    {
      id: 'sample-4',
      groupId: 'grp-hikma-adab',
      type: 'wisdom',
      title: 'في صحبة الكتب وبساتين الفكر',
      contentHtml:
        '<p>الكتابُ جليسٌ لا يطريك، وصديقٌ لا يغريك، ورفيقٌ لا يَمَلُّك، يفتح لك أبواب العصور الغابرة وأنت في خلوة غرفتك.</p>',
      source: 'الجاحظ — كتاب الحيوان',
      tags: ['الكتب', 'الجاحظ', 'أدب'],
      daysAgo: 2,
    },
    {
      id: 'sample-5',
      groupId: 'grp-hikma-adab',
      type: 'word',
      title: 'الإِتْقَانُ (الإحسان في الصنعة)',
      contentHtml:
        '<p>إحكامُ الشيءِ وإجادته حتى يخلو من الخلل والنقص، وهو ثمرة الصبر والمراجعة المستمرة.</p>',
      meaning: 'إحكام العمل وإتمامه على أكمل وجهٍ ممكن بلا تهاون.',
      source: 'لسان العرب لابن منظور',
      tags: ['لغة', 'إتقان', 'عمل'],
      daysAgo: 3,
    },
    {
      id: 'sample-6',
      groupId: 'grp-hikma-adab',
      type: 'note',
      title: 'قاعدة الدقائق العشر في الكتابة اليومية',
      contentHtml:
        '<p>لا تنتظر الإلهام الكامل لتبدأ التدوين. ابدأ بكتابة <mark data-color="#93c5fd" style="background-color: #93c5fd">ثلاث جمل فقط</mark> عما تعلمته اليوم، وستجد الأفكار تتداعى تلقائياً كأنها ينبوعٌ انفتح.</p>',
      source: 'ملاحظة شخصية',
      tags: ['كتابة', 'عادات', 'إنتاجية'],
      daysAgo: 4,
    },
    {
      id: 'sample-7',
      groupId: 'grp-hikma-adab',
      type: 'wisdom',
      title: 'الصبر مفتاح الظفر',
      contentHtml:
        '<p>لا تكره المكروه عند نزوله، فربما كان في طياته فرجٌ عظيم لم تكن لتبلغه لولا مرارة الصبر.</p>',
      source: 'ابن المقفع — الأدب الكبير',
      tags: ['حكمة', 'صبر', 'ابن_المقفع'],
      daysAgo: 5,
    },
    {
      id: 'sample-8',
      groupId: 'grp-hikma-adab',
      type: 'link',
      title: 'الموسوعة الشعرية — المجمع الثقافي',
      contentHtml:
        '<p>أرشيف رقمي ضخم يضم دواوين الشعر العربي الفصيح عبر العصور مع المعاجم اللغوية المحققة.</p>',
      source: 'poetry.ac',
      tags: ['شعر', 'مراجع', 'تراث'],
      links: [
        {
          title: 'بوابة الموسوعة الشعرية العربية',
          url: 'https://poetry.ac',
          domain: 'poetry.ac',
        },
      ],
      daysAgo: 6,
    },
    {
      id: 'sample-9',
      groupId: 'grp-hikma-adab',
      type: 'word',
      title: 'البَصِيرَةُ',
      contentHtml: '<p>نورٌ في القلب يدرك به الإنسان حقائق الأمور وعواقبها كما يدرك البصرُ الصورَ الظاهرة.</p>',
      meaning: 'الفطنةُ والحجةُ واستنارة القلب لرؤية الحقائق خلف المظاهر.',
      source: 'المفردات في غريب القرآن للراغب الأصفهاني',
      tags: ['لغة', 'بصيرة', 'تفكر'],
      daysAgo: 7,
    },

    // Group 2: التزكية والتفكر
    {
      id: 'sample-10',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'sermon',
      title: 'أثر الخلوة الصادقة في صفاء القلب',
      contentHtml:
        '<p>إن القلوب تصدأ كما يصدأ الحديد حين تنغمس في ضجيج الدنيا وتزاحم الشواغل. ولن يجد المرء حلاوة الفهم حتى يجعل لنفسه كل يومٍ ساعةً يخلو فيها بربه ويتأمل في مسيرته، <mark data-color="#fde047" style="background-color: #fde047">فيحاسب نفسه قبل أن يُحاسب</mark>، ويزن أعماله بميزان الإخلاص.</p>',
      source: 'من مواعظ ابن القيم في مدارج السالكين',
      tags: ['تزكية', 'القلب', 'خلوة'],
      daysAgo: 0,
      isPinned: true,
    },
    {
      id: 'sample-11',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'sermon',
      title: 'بركة البكور واغتنام الساعات الأولى',
      contentHtml:
        '<p>في ساعات الفجر الأولى بركةٌ خفية لا يدركها إلا من جرّبها؛ الذهن فيها صافٍ لم تكدّره المقاطعات، والكون كله في تسبيحٍ وهدوء. من جعل صيد فوائده في بكوره، بارك الله له في سائر يومه.</p>',
      source: 'خاطرة صباحية — صيد الخاطر لابن الجوزي',
      tags: ['البكور', 'الوقت', 'بركة'],
      daysAgo: 1,
    },
    {
      id: 'sample-12',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'wisdom',
      title: 'قليلٌ دائم خيرٌ من كثيرٍ منقطع',
      contentHtml:
        '<p>الأعمال العظيمة لا تُبنى بالوثبات المتقطعة، بل بالمداومة الهادئة؛ قطرةُ الماء على لُطفها تثقب الصخر الأصم بالتكرار لا بالقوة.</p>',
      source: 'الإمام الغزالي — إحياء علوم الدين',
      tags: ['استمرارية', 'عادات', 'حكمة'],
      daysAgo: 2,
    },
    {
      id: 'sample-13',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'article',
      title: 'فلسفة الامتنان وتحول النظرة إلى النعم اليومية',
      contentHtml:
        '<p>الإنسان يألف النعمة إذا دامت، فينسى عظمها. التدوين اليومي لنعم الله ولِما تعلمته يوقظ القلب من غفلته، ويحول الأيام العادية إلى محطات شكرٍ وارتقاء.</p>',
      source: 'تأملات في فقه الشكر',
      tags: ['امتنان', 'تأمل', 'سكينة'],
      daysAgo: 3,
    },
    {
      id: 'sample-14',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'note',
      title: 'وصية عملية عند فتور الهمة',
      contentHtml:
        '<p>إذا ثقلت عليك المطالعة الطويلة، فلا تترك وردك بالكامل؛ اقرأ صفحةً واحدة أو قيّد فائدةً واحدة، لئلا ينقطع خيط الاستمرار.</p>',
      source: 'مذكرة ذاتية',
      tags: ['همة', 'استمرارية', 'عمل'],
      daysAgo: 4,
    },
    {
      id: 'sample-15',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'sermon',
      title: 'إصلاح السرائر قبل تزيين الظواهر',
      contentHtml:
        '<p>ما أسرَّ عبدٌ سريرةً إلا ألبسه الله رداءها علانيةً؛ فاعتنِ بجذور نيتك في الخفاء كما يعتني البستاني بجذور الشجرة تحت التراب، وستورق الأغصان في أوانها بلا تكلف.</p>',
      source: 'حلية الأولياء',
      tags: ['إخلاص', 'نية', 'تزكية'],
      daysAgo: 6,
    },
    {
      id: 'sample-16',
      groupId: 'grp-tafakur-tazkiyah',
      type: 'word',
      title: 'التَّؤَدَةُ والحِلْم',
      contentHtml: '<p>الأناةُ والتمهل في الأمر مع ضبط النفس عند الغضب.</p>',
      meaning: 'الرزانة والتأني في اتخاذ القرار بعيداً عن العجلة والانفعال.',
      source: 'الصحاح للجوهري',
      tags: ['أخلاق', 'حلم', 'لغة'],
      daysAgo: 8,
    },

    // Group 3: العلوم وهندسة الحاسوب
    {
      id: 'sample-17',
      groupId: 'grp-uloom-tech',
      type: 'article',
      title: 'كيف تعمل الفهارس المكانية (Quadtrees) في تسريع الرسوميات التفاعلية؟',
      contentHtml:
        '<p>عندما نحتاج إلى رسم عشرة آلاف عقدة تفاعلية على الشاشة بمعدل 60 إطاراً في الثانية، فإن فحص تصادم الفأرة مع كل عقدة يستهلك وقت المعالج. هنا يأتي دور <mark data-color="#c084fc" style="background-color: #c084fc">شجرة التقسيم الرباعي (Quadtree)</mark> التي تقسم الفضاء ثنائي الأبعاد إلى أرباع متداخلة.</p><p>بفضل هذا التقسيم، نستبعد آلاف العقد الواقعة خارج نطاق الرؤية في أجزاء من الألف من الثانية.</p>',
      source: 'هندسة الرسوميات والخوارزميات المكانية',
      tags: ['خوارزميات', 'رسوميات', 'أداء', 'WebGL'],
      daysAgo: 0,
      isPinned: true,
    },
    {
      id: 'sample-18',
      groupId: 'grp-uloom-tech',
      type: 'note',
      title: 'مبدأ Local-First في تصميم البرمجيات الحديثة',
      contentHtml:
        '<p>التطبيقات التي تخزن بياناتها محلياً في IndexedDB تمنح المستخدم <mark data-color="#86efac" style="background-color: #86efac">استجابة فورية صفرية التأخير</mark> وملكية كاملة لبياناته، مع عملٍ كامل دون اتصال بالإنترنت.</p>',
      source: 'معمارية الأنظمة الموزعة',
      tags: ['IndexedDB', 'معمارية', 'أداء'],
      daysAgo: 1,
    },
    {
      id: 'sample-19',
      groupId: 'grp-uloom-tech',
      type: 'word',
      title: 'Idempotency (التكافؤ التكراري)',
      contentHtml:
        '<p>خاصية في العمليات البرمجية تعني أن تنفيذ العملية عدة مرات ينتج نفس النتيجة تماماً كما لو نُفذت مرة واحدة دون آثار جانبية مكررة.</p>',
      meaning: 'ثبات النتيجة عند تكرار تنفيذ نفس العملية البرمجية أكثر من مرة.',
      source: 'معجم هندسة البرمجيات',
      tags: ['برمجة', 'معمارية', 'مصطلحات'],
      daysAgo: 2,
    },
    {
      id: 'sample-20',
      groupId: 'grp-uloom-tech',
      type: 'link',
      title: 'توثيق WebGL 2 و PixiJS لبناء المحركات البصرية',
      contentHtml:
        '<p>مرجع شامل لتقنيات الرسم المتسارع بالعتاد، تجميع القوام (Sprite Batching)، وإدارة الذاكرة الرسومية بكفاءة عالية.</p>',
      source: 'pixijs.com',
      tags: ['WebGL', 'PixiJS', 'رسوميات'],
      links: [
        {
          title: 'الدليل الرسمي لمحرك PixiJS',
          url: 'https://pixijs.com',
          domain: 'pixijs.com',
        },
        {
          title: 'أساسيات WebGL2 العلمية',
          url: 'https://webgl2fundamentals.org',
          domain: 'webgl2fundamentals.org',
        },
      ],
      daysAgo: 3,
    },
    {
      id: 'sample-21',
      groupId: 'grp-uloom-tech',
      type: 'article',
      title: 'الزاوية الذهبية (137.5°) في الطبيعة وتصميم الواجهات',
      contentHtml:
        '<p>ترتب زهرة عباد الشمس بذورها بزاوية دوران تبلغ 137.5 درجة تقريباً، وهي الزاوية الذهبية المشتقة من نسبة فيبوناتشي. هذا الترتيب يضمن عدم تكدس البذور على نفس الخط الشعاعي أبداً.</p><p>استخدام نفس المبدأ في توليد ألوان البطاقات ومواقع العقد العصبية يمنح الواجهة توازناً بصرياً طبيعياً مدهشاً.</p>',
      source: 'الرياضيات في الطبيعة والتصميم البصري',
      tags: ['رياضيات', 'تصميم', 'الزاوية_الذهبية'],
      daysAgo: 4,
    },
    {
      id: 'sample-22',
      groupId: 'grp-uloom-tech',
      type: 'note',
      title: 'فصل الحسابات الفيزيائية في Web Workers',
      contentHtml:
        '<p>تشغيل محاكاة القوى (d3-force) لآلاف العقد على الخيط الرئيسي يجمّد واجهة المستخدم. نقل المحاكاة أو حساب التوزيع المكاني خارج خيط الرسم يحافظ على سلاسة التفاعل.</p>',
      source: 'ملاحظات تحسين الأداء',
      tags: ['أداء', 'WebWorkers', 'رسوميات'],
      daysAgo: 5,
    },
    {
      id: 'sample-23',
      groupId: 'grp-uloom-tech',
      type: 'word',
      title: 'Virtualization (الافتراضية البصرية للقوائم)',
      contentHtml:
        '<p>تقنية تقوم برسم العناصر الظاهرة فقط داخل نافذة العرض (Viewport) بدلاً من إنشاء آلاف عقد DOM في الذاكرة.</p>',
      meaning: 'رسم العناصر المرئية فقط على الشاشة للحفاظ على سرعة المتصفح مع البيانات الضخمة.',
      source: 'هندسة الواجهات الأمامية',
      tags: ['أداء', 'React', 'مصطلحات'],
      daysAgo: 6,
    },
    {
      id: 'sample-24',
      groupId: 'grp-uloom-tech',
      type: 'wisdom',
      title: 'البساطة قمة التعقيد المتقن',
      contentHtml:
        '<p>البرمجيات العظيمة هي التي تخفي أعقد الخوارزميات خلف واجهةٍ بديهية تشعر المستخدم بالسكينة والوضوح.</p>',
      source: 'مبادئ هندسة النظم',
      tags: ['تصميم', 'حكمة', 'برمجة'],
      daysAgo: 7,
    },
    {
      id: 'sample-25',
      groupId: 'grp-uloom-tech',
      type: 'link',
      title: 'مكتبة Dexie.js لإدارة قواعد بيانات IndexedDB',
      contentHtml:
        '<p>واجهة برمجية أنيقة وسريعة للتعامل مع المعاملات (Transactions) والاستعلامات المفهرسة في المتصفح.</p>',
      source: 'dexie.org',
      tags: ['IndexedDB', 'مراجع', 'قواعد_بيانات'],
      links: [
        {
          title: 'الموقع الرسمي لمكتبة Dexie.js',
          url: 'https://dexie.org',
          domain: 'dexie.org',
        },
      ],
      daysAgo: 9,
    },
  ];

  const recentByGroup: Record<string, EntryStyle[]> = {};
  const countByGroup: Record<string, number> = {};
  const entriesToSave: KnowledgeEntry[] = [];
  const positionsToSave: NodePosition[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const gIdx = sampleGroups.findIndex((g) => g.id === raw.groupId);
    const inGroupIdx = countByGroup[raw.groupId] || 0;
    countByGroup[raw.groupId] = inGroupIdx + 1;

    const recentStyles = recentByGroup[raw.groupId] || [];
    const style = generateEntryStyle(raw.id, inGroupIdx, recentStyles);
    recentByGroup[raw.groupId] = [style, ...recentStyles];

    const plainText = raw.contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const highlightMatches = raw.contentHtml.match(/<mark/g);
    const highlightCount = highlightMatches ? highlightMatches.length : 0;

    const entryLinks = (raw.links || []).map((l, idx) => ({
      id: `${raw.id}-link-${idx}`,
      entryId: raw.id,
      title: l.title,
      url: l.url,
      domain: l.domain,
    }));

    const createdAt = now - raw.daysAgo * 86400000 - i * 60000;

    entriesToSave.push({
      id: raw.id,
      title: raw.title,
      groupId: raw.groupId,
      type: raw.type,
      contentHtml: raw.contentHtml,
      contentText: plainText,
      meaning: raw.meaning,
      source: raw.source,
      tags: raw.tags,
      links: entryLinks,
      highlightCount,
      baseFontSize: 18,
      style,
      isPinned: Boolean(raw.isPinned),
      isSample: true,
      isStressTest: false,
      date: formatDateOffset(raw.daysAgo),
      createdAt,
      updatedAt: createdAt,
    });

    positionsToSave.push(
      computeNodePositionForEntry(
        raw.id,
        raw.groupId,
        inGroupIdx,
        Math.max(0, gIdx),
        sampleGroups.length,
        style.seed
      )
    );
  }

  await db.transaction('rw', [db.groups, db.entries, db.links, db.layout, db.settings], async () => {
    await db.groups.bulkPut(sampleGroups);
    await db.entries.bulkPut(entriesToSave);
    const allLinks = entriesToSave.flatMap((e) => e.links);
    if (allLinks.length > 0) {
      await db.links.bulkPut(allLinks);
    }
    await db.layout.bulkPut(positionsToSave);
    await db.settings.update('default', { hasSeenFirstRun: true });
  });

  return { groupsAdded: sampleGroups.length, entriesAdded: entriesToSave.length };
}

/**
 * Generates 5,000 or 20,000 synthetic entries in bulk chunks for Stress Testing scale
 */
export async function generateStressTestEntries(
  count: number,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  let groups = await db.groups.filter((g) => g.deletedAt === null).toArray();
  if (groups.length === 0) {
    await seedSampleArabicData();
    groups = await db.groups.filter((g) => g.deletedAt === null).toArray();
  }

  const types: EntryType[] = ['article', 'wisdom', 'sermon', 'word', 'note', 'link'];
  const sampleTitles = [
    'تأملات في هندسة المعرفة وبناء العقل المركب',
    'حكمة عربية أصيلة في الصبر وإتقان العمل',
    'مفهوم التفرع الشجري والخوارزميات المكانية السريعة',
    'موعظة في اغتنام الأوقات وصفاء السرائر',
    'مصطلح بلاغي دقيق من أمهات المعاجم العربية',
    'ملاحظة تطبيقية في تحسين سرعة الاسترجاع الذهني',
  ];
  const sampleTags = ['معرفة', 'حكمة', 'علوم', 'أدب', 'تفكر', 'خوارزميات', 'لغة', 'تزكية'];

  const now = Date.now();
  const batchSize = 2500;
  let createdCount = 0;

  while (createdCount < count) {
    const currentBatch = Math.min(batchSize, count - createdCount);
    const entriesBatch: KnowledgeEntry[] = [];
    const layoutBatch: NodePosition[] = [];

    for (let i = 0; i < currentBatch; i++) {
      const globalIdx = createdCount + i;
      const grpIdx = globalIdx % groups.length;
      const grp = groups[grpIdx];
      const type = types[globalIdx % types.length];
      const id = `stress-${now}-${globalIdx}`;
      const daysAgo = globalIdx % 360;

      const style = generateEntryStyle(id, globalIdx, [], globalIdx);
      const title = `${sampleTitles[globalIdx % sampleTitles.length]} #${globalIdx + 1}`;
      const text =
        'هذه فائدة تجريبية مولدة لاختبار الأداء الفائق لبستان المعرفة مع آلاف الخلايا العصبية والثمار المعرفية دون أي بطء.';

      entriesBatch.push({
        id,
        title,
        groupId: grp.id,
        type,
        contentHtml: `<p>${text}</p>`,
        contentText: text,
        meaning: type === 'word' ? 'ثبات الأداء وسلاسة العرض عند التعامل مع عشرات الآلاف من السجلات.' : undefined,
        source: 'اختبار الضغط العالي — بستان المعرفة',
        tags: [sampleTags[globalIdx % sampleTags.length], sampleTags[(globalIdx + 3) % sampleTags.length]],
        links: [],
        highlightCount: globalIdx % 4,
        baseFontSize: 18,
        style,
        isPinned: globalIdx % 40 === 0,
        isSample: false,
        isStressTest: true,
        date: formatDateOffset(daysAgo),
        createdAt: now - daysAgo * 86400000 - globalIdx * 1000,
        updatedAt: now,
      });

      layoutBatch.push(
        computeNodePositionForEntry(
          id,
          grp.id,
          Math.floor(globalIdx / groups.length),
          grpIdx,
          groups.length,
          style.seed
        )
      );
    }

    await db.transaction('rw', [db.entries, db.layout], async () => {
      await db.entries.bulkPut(entriesBatch);
      await db.layout.bulkPut(layoutBatch);
    });

    createdCount += currentBatch;
    if (onProgress) onProgress(createdCount, count);
    await new Promise((r) => setTimeout(r, 10));
  }
}

export async function clearStressTestEntries(): Promise<number> {
  const stressIds = await db.entries
    .filter((e) => Boolean(e.isStressTest))
    .primaryKeys();
  if (stressIds.length === 0) return 0;

  await db.transaction('rw', [db.entries, db.layout], async () => {
    await db.entries.bulkDelete(stressIds);
    await db.layout.bulkDelete(stressIds);
  });
  return stressIds.length;
}
