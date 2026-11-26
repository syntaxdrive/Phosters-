export type CourseFaculty =
  | 'College of Medicine'
  | 'Science & Computing'
  | 'Technology & Engineering'
  | 'Law & Arts'
  | 'Social & Management'
  | 'Agriculture & Environmental'
  | 'Education';

export interface CourseComboEntry {
  id: string;
  course: string;
  faculty: CourseFaculty;
  jambSubjects: string[];
  subjectSlugs: string[];
  oLevelNotes: string;
  uiCutOffGuide: string;
  advice: string;
}

export const COURSE_COMBO_GUIDE: CourseComboEntry[] = [
  {
    id: 'medicine-surgery',
    course: 'Medicine & Surgery (MBBS)',
    faculty: 'College of Medicine',
    jambSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    subjectSlugs: ['english-language', 'biology', 'chemistry', 'physics'],
    oLevelNotes: '5 Credits in one sitting (UI): English, Maths, Biology, Chemistry, Physics.',
    uiCutOffGuide: '78% – 86% aggregate',
    advice: 'UI Medicine strictly requires all 5 science O-Level credits in ONE sitting.',
  },
  {
    id: 'nursing-science',
    course: 'Nursing Science',
    faculty: 'College of Medicine',
    jambSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    subjectSlugs: ['english-language', 'biology', 'chemistry', 'physics'],
    oLevelNotes: '5 Credits in 1 sitting (recommended): English, Maths, Biology, Chemistry, Physics.',
    uiCutOffGuide: '70% – 77% aggregate',
    advice: 'Aim for 280+ in JAMB and 68+ in UI Post-UTME for strong merit standing.',
  },
  {
    id: 'pharmacy',
    course: 'Pharmacy (B.Pharm)',
    faculty: 'College of Medicine',
    jambSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    subjectSlugs: ['english-language', 'biology', 'chemistry', 'physics'],
    oLevelNotes: '5 Credits in 1 sitting: English, Maths, Biology, Chemistry, Physics.',
    uiCutOffGuide: '70% – 76% aggregate',
    advice: 'Organic Chemistry and Stoichiometry carry heavy weight in Post-UTME.',
  },
  {
    id: 'physiotherapy-mls',
    course: 'Physiotherapy / Medical Lab Science',
    faculty: 'College of Medicine',
    jambSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    subjectSlugs: ['english-language', 'biology', 'chemistry', 'physics'],
    oLevelNotes: '5 Credits: English, Maths, Biology, Chemistry, Physics.',
    uiCutOffGuide: '67% – 74% aggregate',
    advice: 'Consistent Biology and Physics drilling lifts aggregate scores quickly.',
  },
  {
    id: 'computer-science',
    course: 'Computer Science',
    faculty: 'Science & Computing',
    jambSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    subjectSlugs: ['english-language', 'mathematics', 'physics', 'chemistry'],
    oLevelNotes: '5 Credits: English, Maths, Physics, Chemistry + 1 other science/trade subject.',
    uiCutOffGuide: '66% – 74% aggregate',
    advice: 'Chemistry is preferred at UI over Economics/Geography for Computer Science.',
  },
  {
    id: 'mathematics-statistics',
    course: 'Mathematics / Statistics',
    faculty: 'Science & Computing',
    jambSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    subjectSlugs: ['english-language', 'mathematics', 'physics', 'chemistry'],
    oLevelNotes: '5 Credits: English, Maths, Physics + 2 science subjects.',
    uiCutOffGuide: '52% – 60% aggregate',
    advice: 'Calculus, indices, logarithms, and probability form core JAMB & Post-UTME topics.',
  },
  {
    id: 'biochemistry-microbiology',
    course: 'Biochemistry / Microbiology',
    faculty: 'Science & Computing',
    jambSubjects: ['English Language', 'Biology', 'Chemistry', 'Physics'],
    subjectSlugs: ['english-language', 'biology', 'chemistry', 'physics'],
    oLevelNotes: '5 Credits: English, Maths, Biology, Chemistry, Physics.',
    uiCutOffGuide: '56% – 66% aggregate',
    advice: 'Keep Physics strong; many students drop marks on waves, electricity, and optics.',
  },
  {
    id: 'industrial-chemistry',
    course: 'Chemistry / Industrial Chemistry',
    faculty: 'Science & Computing',
    jambSubjects: ['English Language', 'Chemistry', 'Physics', 'Mathematics'],
    subjectSlugs: ['english-language', 'chemistry', 'physics', 'mathematics'],
    oLevelNotes: '5 Credits: English, Maths, Chemistry, Physics, Biology.',
    uiCutOffGuide: '52% – 60% aggregate',
    advice: 'Master mole concept, gas laws, and redox equations for fast CBT points.',
  },
  {
    id: 'electrical-mechanical-engineering',
    course: 'Electrical / Mechanical / Civil Engineering',
    faculty: 'Technology & Engineering',
    jambSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    subjectSlugs: ['english-language', 'mathematics', 'physics', 'chemistry'],
    oLevelNotes: '5 Credits: English, Maths, Physics, Chemistry + Biology or Further Maths.',
    uiCutOffGuide: '63% – 74% aggregate',
    advice: 'Never swap Chemistry for Further Maths or Economics in JAMB Engineering.',
  },
  {
    id: 'petroleum-agricultural-engineering',
    course: 'Petroleum / Agricultural Engineering',
    faculty: 'Technology & Engineering',
    jambSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    subjectSlugs: ['english-language', 'mathematics', 'physics', 'chemistry'],
    oLevelNotes: '5 Credits: English, Maths, Physics, Chemistry + 1 other science credit.',
    uiCutOffGuide: '58% – 68% aggregate',
    advice: 'Mechanics, calculus, and chemical thermodynamics show up repeatedly.',
  },
  {
    id: 'law',
    course: 'Law (LL.B)',
    faculty: 'Law & Arts',
    jambSubjects: ['English Language', 'Literature in English', 'CRS / IRS', 'Government'],
    subjectSlugs: ['english-language', 'literature-in-english', 'crs', 'government'],
    oLevelNotes: '5 Credits: English, Literature in English, Maths (pass/credit per UI) + 2 Arts.',
    uiCutOffGuide: '68% – 76% aggregate',
    advice: 'Literature in English is compulsory at UI; avoid substituting History without checking.',
  },
  {
    id: 'communication-language-arts',
    course: 'Communication & Language Arts (Mass Comm)',
    faculty: 'Law & Arts',
    jambSubjects: ['English Language', 'Literature in English', 'Government', 'CRS / History'],
    subjectSlugs: ['english-language', 'literature-in-english', 'government', 'crs'],
    oLevelNotes: '5 Credits: English, Literature in English, Maths + 2 Arts/Social Science subjects.',
    uiCutOffGuide: '62% – 69% aggregate',
    advice: 'Strong Use of English comprehension and Lexis & Structure gives you a big edge.',
  },
  {
    id: 'english-literary-studies',
    course: 'English & Literary Studies',
    faculty: 'Law & Arts',
    jambSubjects: ['English Language', 'Literature in English', 'CRS / History', 'Government'],
    subjectSlugs: ['english-language', 'literature-in-english', 'crs', 'government'],
    oLevelNotes: '5 Credits: English, Literature in English + 3 Arts/Social Science credits.',
    uiCutOffGuide: '55% – 63% aggregate',
    advice: 'Read all JAMB prescribed Literature texts and literary devices carefully.',
  },
  {
    id: 'history-international-studies',
    course: 'History & Diplomatic / International Studies',
    faculty: 'Law & Arts',
    jambSubjects: ['English Language', 'History', 'Government', 'Literature in English'],
    subjectSlugs: ['english-language', 'history', 'government', 'literature-in-english'],
    oLevelNotes: '5 Credits: English, History or Government, Maths + 2 Arts/Social Science credits.',
    uiCutOffGuide: '54% – 62% aggregate',
    advice: 'Focus on pre-colonial Nigerian history, nationalism, and West African treaties.',
  },
  {
    id: 'economics',
    course: 'Economics',
    faculty: 'Social & Management',
    jambSubjects: ['English Language', 'Economics', 'Mathematics', 'Government'],
    subjectSlugs: ['english-language', 'economics', 'mathematics', 'government'],
    oLevelNotes: '5 Credits: English, Mathematics, Economics + 2 Social Science/Arts credits.',
    uiCutOffGuide: '64% – 72% aggregate',
    advice: 'Mathematics is compulsory in JAMB for UI Economics—do not omit it.',
  },
  {
    id: 'accounting',
    course: 'Accounting',
    faculty: 'Social & Management',
    jambSubjects: ['English Language', 'Mathematics', 'Economics', 'Financial Accounting'],
    subjectSlugs: ['english-language', 'mathematics', 'economics', 'accounting'],
    oLevelNotes: '5 Credits: English, Mathematics, Economics + 2 Commercial/Social Science credits.',
    uiCutOffGuide: '62% – 70% aggregate',
    advice: 'Practice JAMB basic calculator speed on ledger, ratio, and partnership questions.',
  },
  {
    id: 'business-administration',
    course: 'Business Administration / Finance',
    faculty: 'Social & Management',
    jambSubjects: ['English Language', 'Mathematics', 'Economics', 'Commerce'],
    subjectSlugs: ['english-language', 'mathematics', 'economics', 'commerce'],
    oLevelNotes: '5 Credits: English, Mathematics, Economics + 2 Commercial subjects.',
    uiCutOffGuide: '58% – 66% aggregate',
    advice: 'Mathematics + Economics are non-negotiable for Management Sciences.',
  },
  {
    id: 'political-science',
    course: 'Political Science',
    faculty: 'Social & Management',
    jambSubjects: ['English Language', 'Government', 'Economics', 'CRS / History'],
    subjectSlugs: ['english-language', 'government', 'economics', 'crs'],
    oLevelNotes: '5 Credits: English, Mathematics, Government + 2 Social Science/Arts credits.',
    uiCutOffGuide: '58% – 65% aggregate',
    advice: 'Review Nigerian constitutions (1960–1999), ECOWAS, AU, and UN organs.',
  },
  {
    id: 'psychology-sociology',
    course: 'Psychology / Sociology',
    faculty: 'Social & Management',
    jambSubjects: ['English Language', 'Government', 'Economics', 'Biology'],
    subjectSlugs: ['english-language', 'government', 'economics', 'biology'],
    oLevelNotes: '5 Credits: English, Mathematics + 3 Arts/Social Science/Science credits (Biology helps for Psychology).',
    uiCutOffGuide: '56% – 64% aggregate',
    advice: 'For UI Psychology, Biology is strongly recommended alongside Social Science credits.',
  },
  {
    id: 'geography',
    course: 'Geography',
    faculty: 'Social & Management',
    jambSubjects: ['English Language', 'Geography', 'Mathematics', 'Economics'],
    subjectSlugs: ['english-language', 'geography', 'mathematics', 'economics'],
    oLevelNotes: '5 Credits: English, Mathematics, Geography + 2 Science/Social Science credits.',
    uiCutOffGuide: '50% – 58% aggregate',
    advice: 'Map reading, climatology, and drainage patterns appear in every JAMB sitting.',
  },
  {
    id: 'architecture',
    course: 'Architecture',
    faculty: 'Agriculture & Environmental',
    jambSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    subjectSlugs: ['english-language', 'mathematics', 'physics', 'chemistry'],
    oLevelNotes: '5 Credits: English, Maths, Physics, Chemistry + Geography or Technical Drawing.',
    uiCutOffGuide: '62% – 70% aggregate',
    advice: 'Physics + Mathematics + Chemistry keeps all top architecture schools open.',
  },
  {
    id: 'agricultural-science',
    course: 'Agriculture / Animal Science / Crop Protection',
    faculty: 'Agriculture & Environmental',
    jambSubjects: ['English Language', 'Chemistry', 'Biology / Agric Science', 'Physics'],
    subjectSlugs: ['english-language', 'chemistry', 'agricultural-science', 'physics'],
    oLevelNotes: '5 Credits: English, Maths, Chemistry, Biology/Agric Science, Physics.',
    uiCutOffGuide: '50% – 57% aggregate',
    advice: 'Chemistry is compulsory in JAMB Agriculture; Physics or Maths fills the 4th slot.',
  },
  {
    id: 'science-education',
    course: 'Science / Mathematics Education',
    faculty: 'Education',
    jambSubjects: ['English Language', 'Mathematics', 'Physics', 'Chemistry'],
    subjectSlugs: ['english-language', 'mathematics', 'physics', 'chemistry'],
    oLevelNotes: '5 Credits: English, Mathematics + teaching science subjects.',
    uiCutOffGuide: '50% – 56% aggregate',
    advice: 'Education courses often have accessible cut-offs while granting full university degrees.',
  },
  {
    id: 'arts-social-education',
    course: 'Arts & Social Science Education',
    faculty: 'Education',
    jambSubjects: ['English Language', 'Government', 'Economics', 'CRS / Literature'],
    subjectSlugs: ['english-language', 'government', 'economics', 'crs'],
    oLevelNotes: '5 Credits: English, Maths + 3 relevant Arts/Social Science subjects.',
    uiCutOffGuide: '50% – 56% aggregate',
    advice: 'Choose the teaching subject you want to specialize in as one of your 3 electives.',
  },
];

export function computeUiAggregate(jambScore: number, postUtmeScore: number) {
  const safeJamb = Math.min(400, Math.max(0, Number.isFinite(jambScore) ? jambScore : 0));
  const safePostUtme = Math.min(
    100,
    Math.max(0, Number.isFinite(postUtmeScore) ? postUtmeScore : 0)
  );
  const jambPart = safeJamb / 8;
  const postUtmePart = safePostUtme / 2;
  return {
    jambPart,
    postUtmePart,
    totalAggregate: jambPart + postUtmePart,
  };
}

export function requiredPostUtmeForTarget(
  jambScore: number,
  targetAggregate: number
): { neededPostUtme: number; achievable: boolean } {
  const safeJamb = Math.min(400, Math.max(0, Number.isFinite(jambScore) ? jambScore : 0));
  const jambPart = safeJamb / 8;
  const needed = (targetAggregate - jambPart) * 2;
  return {
    neededPostUtme: Math.max(0, Math.ceil(needed * 10) / 10),
    achievable: needed <= 100,
  };
}

export function isUiPostUtmeExam(
  examSlug?: string | null,
  examName?: string | null,
  title?: string | null
): boolean {
  if (examSlug && examSlug.toLowerCase() === 'ui-post-utme') {
    return true;
  }
  const combined = `${examName ?? ''} ${title ?? ''}`.toLowerCase();
  return combined.includes('post-utme') || combined.includes('post utme');
}

export function getUiPostUtmeScore100(percentage: number): number {
  const num = Number(percentage);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Math.round(num)));
}

