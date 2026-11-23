-- ============================================================================
-- 015: Complete Official JAMB UTME & UI Post-UTME Subjects Seed
-- Safe & idempotent: adds missing subjects (e.g. Further Mathematics, Computer
-- Studies, Islamic Studies, Yoruba, Igbo, Hausa, French, Arabic, Fine Art,
-- Music, Home Economics, Physical and Health Education) without duplicating
-- or breaking any existing subject slugs.
-- ============================================================================

insert into public.subjects (name, slug, description, is_active)
values
  ('English Language', 'english-language', 'Comprehension, lexis and structure, oral forms, and essay fundamentals.', true),
  ('Mathematics', 'mathematics', 'Algebra, geometry, trigonometry, calculus, and statistics.', true),
  ('Further Mathematics', 'further-mathematics', 'Advanced algebra, vectors, mechanics, differential equations, and probability.', true),
  ('Physics', 'physics', 'Mechanics, waves, optics, electricity, magnetism, and modern physics.', true),
  ('Chemistry', 'chemistry', 'Stoichiometry, chemical bonding, organic chemistry, and electrochemistry.', true),
  ('Biology', 'biology', 'Cell biology, genetics, ecology, and human physiology.', true),
  ('Agricultural Science', 'agricultural-science', 'Crop production, soil science, animal husbandry, and agricultural economics.', true),
  ('Computer Studies', 'computer-studies', 'Computer hardware, software, data representation, logic gates, networking, and programming basics.', true),
  ('Geography', 'geography', 'Physical geography, map reading, and human geography.', true),
  ('Economics', 'economics', 'Microeconomics, macroeconomics, market structures, and national income.', true),
  ('Commerce', 'commerce', 'Trade, business organisations, banking, and consumer protection.', true),
  ('Financial Accounting', 'financial-accounting', 'Double-entry bookkeeping, financial statements, and partnership accounts.', true),
  ('Government', 'government', 'Political institutions, Nigerian constitutional development, and international relations.', true),
  ('Literature in English', 'literature-in-english', 'Prose, drama, poetry, and literary appreciation.', true),
  ('Christian Religious Studies', 'christian-religious-studies', 'Old and New Testament themes and moral teachings.', true),
  ('Islamic Studies', 'islamic-studies', 'Quranic teachings, Hadith, Islamic jurisprudence, and early Islamic history.', true),
  ('History', 'history', 'Nigerian history, West African states, and modern global history.', true),
  ('Yoruba', 'yoruba', 'Yoruba grammar, comprehension, oral traditions, literature, and culture.', true),
  ('Igbo', 'igbo', 'Igbo grammar, comprehension, oral literature, and cultural studies.', true),
  ('Hausa', 'hausa', 'Hausa language structure, comprehension, prose, poetry, and cultural heritage.', true),
  ('French', 'french', 'French grammar, reading comprehension, vocabulary, and written expression.', true),
  ('Arabic', 'arabic', 'Arabic grammar, comprehension, translation, and classical or modern literature.', true),
  ('Fine Art', 'fine-art', 'Drawing, painting, design principles, art history, and Nigerian traditional art.', true),
  ('Music', 'music', 'Music theory, notation, harmony, African instruments, and Nigerian music history.', true),
  ('Home Economics', 'home-economics', 'Food and nutrition, clothing and textiles, home management, and family living.', true),
  ('Physical and Health Education', 'physical-and-health-education', 'Anatomy, sports science, first aid, nutrition, and community health.', true)
on conflict (slug) do nothing;

-- Link every active subject above to JAMB UTME and UI Post-UTME if not already linked
insert into public.exam_subjects (exam_id, subject_id, is_active, is_compulsory, display_order)
select
  e.id,
  s.id,
  true,
  (e.slug = 'jamb-utme' and s.slug = 'english-language'),
  case s.slug
    when 'english-language' then 1
    when 'mathematics' then 2
    when 'further-mathematics' then 3
    when 'physics' then 4
    when 'chemistry' then 5
    when 'biology' then 6
    when 'agricultural-science' then 7
    when 'computer-studies' then 8
    when 'geography' then 9
    when 'economics' then 10
    when 'commerce' then 11
    when 'financial-accounting' then 12
    when 'government' then 13
    when 'literature-in-english' then 14
    when 'christian-religious-studies' then 15
    when 'islamic-studies' then 16
    when 'history' then 17
    when 'yoruba' then 18
    when 'igbo' then 19
    when 'hausa' then 20
    when 'french' then 21
    when 'arabic' then 22
    when 'fine-art' then 23
    when 'music' then 24
    when 'home-economics' then 25
    when 'physical-and-health-education' then 26
    else 99
  end
from public.exams e
join public.subjects s
  on s.slug in (
    'english-language',
    'mathematics',
    'further-mathematics',
    'physics',
    'chemistry',
    'biology',
    'agricultural-science',
    'computer-studies',
    'geography',
    'economics',
    'commerce',
    'financial-accounting',
    'government',
    'literature-in-english',
    'christian-religious-studies',
    'islamic-studies',
    'history',
    'yoruba',
    'igbo',
    'hausa',
    'french',
    'arabic',
    'fine-art',
    'music',
    'home-economics',
    'physical-and-health-education'
  )
where e.slug in ('jamb-utme', 'ui-post-utme')
on conflict (exam_id, subject_id) do nothing;
