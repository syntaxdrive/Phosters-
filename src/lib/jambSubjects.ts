import type { Subject } from '../types/database';

export interface OfficialJambSubjectSpec {
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isCompulsoryInJamb?: boolean;
  aliases?: string[];
}

export const OFFICIAL_JAMB_SUBJECTS: OfficialJambSubjectSpec[] = [
  {
    name: 'English Language',
    slug: 'english-language',
    description: 'Comprehension, lexis and structure, oral forms, and essay fundamentals.',
    displayOrder: 1,
    isCompulsoryInJamb: true,
    aliases: ['use-of-english', 'english'],
  },
  {
    name: 'Mathematics',
    slug: 'mathematics',
    description: 'Algebra, geometry, trigonometry, calculus, and statistics.',
    displayOrder: 2,
    aliases: ['maths', 'general-mathematics'],
  },
  {
    name: 'Further Mathematics',
    slug: 'further-mathematics',
    description: 'Advanced algebra, vectors, mechanics, differential equations, and probability.',
    displayOrder: 3,
    aliases: ['further-maths', 'additional-mathematics'],
  },
  {
    name: 'Physics',
    slug: 'physics',
    description: 'Mechanics, waves, optics, electricity, magnetism, and modern physics.',
    displayOrder: 4,
  },
  {
    name: 'Chemistry',
    slug: 'chemistry',
    description: 'Stoichiometry, chemical bonding, organic chemistry, and electrochemistry.',
    displayOrder: 5,
  },
  {
    name: 'Biology',
    slug: 'biology',
    description: 'Cell biology, genetics, ecology, and human physiology.',
    displayOrder: 6,
  },
  {
    name: 'Agricultural Science',
    slug: 'agricultural-science',
    description: 'Crop production, soil science, animal husbandry, and agricultural economics.',
    displayOrder: 7,
    aliases: ['agriculture', 'agric-science'],
  },
  {
    name: 'Computer Studies',
    slug: 'computer-studies',
    description: 'Computer hardware, software, data representation, logic gates, networking, and programming basics.',
    displayOrder: 8,
    aliases: ['computer-science', 'ict'],
  },
  {
    name: 'Geography',
    slug: 'geography',
    description: 'Physical geography, map reading, and human geography.',
    displayOrder: 9,
  },
  {
    name: 'Economics',
    slug: 'economics',
    description: 'Microeconomics, macroeconomics, market structures, and national income.',
    displayOrder: 10,
  },
  {
    name: 'Commerce',
    slug: 'commerce',
    description: 'Trade, business organisations, banking, and consumer protection.',
    displayOrder: 11,
  },
  {
    name: 'Financial Accounting',
    slug: 'financial-accounting',
    description: 'Double-entry bookkeeping, financial statements, and partnership accounts.',
    displayOrder: 12,
    aliases: ['principles-of-accounts', 'accounting'],
  },
  {
    name: 'Government',
    slug: 'government',
    description: 'Political institutions, Nigerian constitutional development, and international relations.',
    displayOrder: 13,
  },
  {
    name: 'Literature in English',
    slug: 'literature-in-english',
    description: 'Prose, drama, poetry, and literary appreciation.',
    displayOrder: 14,
    aliases: ['literature'],
  },
  {
    name: 'Christian Religious Studies',
    slug: 'christian-religious-studies',
    description: 'Old and New Testament themes and moral teachings.',
    displayOrder: 15,
    aliases: ['crs', 'crk'],
  },
  {
    name: 'Islamic Studies',
    slug: 'islamic-studies',
    description: 'Quranic teachings, Hadith, Islamic jurisprudence, and early Islamic history.',
    displayOrder: 16,
    aliases: ['irs', 'irk', 'islamic-religious-studies'],
  },
  {
    name: 'History',
    slug: 'history',
    description: 'Nigerian history, West African states, and modern global history.',
    displayOrder: 17,
  },
  {
    name: 'Yoruba',
    slug: 'yoruba',
    description: 'Yoruba grammar, comprehension, oral traditions, literature, and culture.',
    displayOrder: 18,
  },
  {
    name: 'Igbo',
    slug: 'igbo',
    description: 'Igbo grammar, comprehension, oral literature, and cultural studies.',
    displayOrder: 19,
  },
  {
    name: 'Hausa',
    slug: 'hausa',
    description: 'Hausa language structure, comprehension, prose, poetry, and cultural heritage.',
    displayOrder: 20,
  },
  {
    name: 'French',
    slug: 'french',
    description: 'French grammar, reading comprehension, vocabulary, and written expression.',
    displayOrder: 21,
  },
  {
    name: 'Arabic',
    slug: 'arabic',
    description: 'Arabic grammar, comprehension, translation, and classical or modern literature.',
    displayOrder: 22,
  },
  {
    name: 'Fine Art',
    slug: 'fine-art',
    description: 'Drawing, painting, design principles, art history, and Nigerian traditional art.',
    displayOrder: 23,
    aliases: ['art', 'fine-arts', 'visual-art'],
  },
  {
    name: 'Music',
    slug: 'music',
    description: 'Music theory, notation, harmony, African instruments, and Nigerian music history.',
    displayOrder: 24,
  },
  {
    name: 'Home Economics',
    slug: 'home-economics',
    description: 'Food and nutrition, clothing and textiles, home management, and family living.',
    displayOrder: 25,
  },
  {
    name: 'Physical and Health Education',
    slug: 'physical-and-health-education',
    description: 'Anatomy, sports science, first aid, nutrition, and community health.',
    displayOrder: 26,
    aliases: ['phe', 'physical-health-education'],
  },
];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function findMatchingSubject(
  spec: OfficialJambSubjectSpec,
  existingSubjects: Subject[]
): Subject | undefined {
  const acceptedKeys = new Set<string>([
    spec.slug,
    normalizeKey(spec.name),
    ...(spec.aliases ?? []),
  ]);

  return existingSubjects.find(
    (s) => acceptedKeys.has(s.slug.toLowerCase()) || acceptedKeys.has(normalizeKey(s.name))
  );
}

export function getMissingOfficialJambSubjects(
  existingSubjects: Subject[]
): OfficialJambSubjectSpec[] {
  return OFFICIAL_JAMB_SUBJECTS.filter(
    (spec) => !findMatchingSubject(spec, existingSubjects)
  );
}
