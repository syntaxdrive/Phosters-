import type { MaterialFileType } from './database';

export type AdminOverviewCounts = {
  examsCount: number;
  subjectsCount: number;
  topicsCount: number;
  publishedLessonsCount: number;
  draftLessonsCount: number;
  studentsCount: number;
};

export type MaterialDraft = {
  localKey: string;
  id?: string;
  title: string;
  file_type: MaterialFileType;
  file_url: string;
};

export type LinkDraft = {
  localKey: string;
  id?: string;
  title: string;
  url: string;
};

export type LessonEditorInput = {
  id?: string;
  topic_id: string;
  title: string;
  short_description: string;
  description: string;
  tutor_name: string;
  youtube_url: string;
  display_order: number;
  is_published: boolean;
  materials: MaterialDraft[];
  links: LinkDraft[];
};

export type AdminLessonListItem = {
  id: string;
  topic_id: string;
  title: string;
  short_description: string | null;
  tutor_name: string | null;
  youtube_url: string | null;
  display_order: number;
  is_published: boolean;
  updated_at: string;
  topicTitle: string;
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
};
