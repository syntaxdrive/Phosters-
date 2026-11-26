import type { ReleaseStatus } from './database';

export type StudentTestOption = {
  id: string;
  option_key: string;
  option_text: string;
  display_order: number;
};

export type StudentTestQuestion = {
  id: string;
  question_text: string;
  display_order: number;
  points: number;
  options: StudentTestOption[];
};

export type StudentTestPayload = {
  test: {
    id: string;
    title: string;
    description: string | null;
    topic_id: string | null;
    lesson_id: string | null;
    show_explanations_after_submission: boolean;
  };
  questions: StudentTestQuestion[];
};

export type StudentAttemptSummary = {
  id: string;
  test_id: string;
  test_title: string;
  score: number;
  total_points: number;
  percentage: number;
  submitted_at: string;
};

export type AttemptReviewOption = {
  id: string;
  option_key: string;
  option_text: string;
  is_correct: boolean;
};

export type AttemptReviewItem = {
  question_id: string;
  question_text: string;
  explanation: string | null;
  points: number;
  selected_option_id: string | null;
  is_correct: boolean;
  points_awarded: number;
  correct_option_id: string | null;
  options: AttemptReviewOption[];
};

export type AttemptReviewPayload = {
  attempt: {
    id: string;
    test_id: string;
    test_title: string;
    lesson_id: string | null;
    topic_id: string | null;
    score: number;
    total_points: number;
    percentage: number;
    correct_count: number;
    total_questions: number;
    submitted_at: string;
    show_explanations_after_submission: boolean;
  };
  review_items: AttemptReviewItem[];
};

export type AdminTestListItem = {
  id: string;
  title: string;
  description: string | null;
  topic_id: string | null;
  lesson_id: string | null;
  subjectId?: string | null;
  is_published: boolean;
  release_status: ReleaseStatus;
  scheduled_release_at: string | null;
  show_explanations_after_submission: boolean;
  updated_at: string;
  questionCount: number;
  targetLabel: string;
};

export type AdminOptionDraft = {
  localKey: string;
  option_key: string;
  option_text: string;
  is_correct: boolean;
};

export type AdminQuestionDraft = {
  localKey: string;
  question_text: string;
  explanation: string;
  points: number;
  options: AdminOptionDraft[];
};

export type AdminTestEditorInput = {
  id?: string;
  title: string;
  description: string;
  topic_id: string | null;
  lesson_id: string | null;
  is_published: boolean;
  release_status?: ReleaseStatus;
  scheduled_release_at?: string | null;
  show_explanations_after_submission: boolean;
  questions: AdminQuestionDraft[];
};

// ============================================================================
// 4-Subject Timed Mock Exam Types
// ============================================================================

export type MockExamMode = 'full_mock' | 'mini_mock' | 'published_mock';

export type MockExamRecord = {
  id: string;
  exam_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  english_question_count: number;
  other_subject_question_count: number;
  uses_question_bank: boolean;
  exclude_diagrams: boolean;
  is_published: boolean;
  release_status?: ReleaseStatus;
  scheduled_release_at?: string | null;
  show_explanations_after_submission: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MockSubjectReadiness = {
  subject_id: string;
  subject_name: string;
  subject_slug: string;
  approved_text_count: number;
  approved_total_count: number;
};

export type MockQuestionOption = {
  key: string;
  text: string;
};

export type MockQuestionItem = {
  id: string; // mock_attempt_items.id
  question_text: string;
  options: MockQuestionOption[];
};

export type MockSubjectSection = {
  subject_id: string;
  subject_name: string;
  subject_slug: string;
  section_order: number;
  target_count: number;
  available_count: number;
  questions: MockQuestionItem[];
};

export type MockSessionPayload = {
  attempt_id: string;
  exam_id: string;
  exam_name: string;
  exam_slug: string;
  mock_exam_id: string | null;
  title: string;
  mode: MockExamMode;
  duration_minutes: number;
  started_at: string;
  show_explanations_after_submission: boolean;
  total_questions: number;
  sections: MockSubjectSection[];
};

export type MockSubjectBreakdown = {
  subject_id: string;
  subject_name: string;
  subject_slug: string;
  correct: number;
  total: number;
  jamb_score_100: number;
  percentage: number;
};

export type MockAttemptSummary = {
  id: string;
  exam_id: string;
  exam_name?: string;
  exam_slug?: string;
  mock_exam_id: string | null;
  title: string;
  mode: MockExamMode;
  duration_minutes: number;
  started_at: string;
  submitted_at: string | null;
  elapsed_seconds: number | null;
  total_score_400: number;
  total_correct: number;
  total_questions: number;
  percentage: number;
  subject_scores: MockSubjectBreakdown[];
};

export type MockReviewQuestionItem = {
  id: string;
  question_order: number;
  question_text: string;
  explanation: string | null;
  options: MockQuestionOption[];
  selected_option_key: string | null;
  correct_option_key: string;
  is_correct: boolean;
};

export type MockReviewSection = {
  subject_id: string;
  subject_name: string;
  subject_slug: string;
  section_order: number;
  items: MockReviewQuestionItem[];
};

export type MockAttemptReviewPayload = {
  attempt: {
    id: string;
    exam_id: string;
    exam_name: string;
    exam_slug: string;
    mock_exam_id: string | null;
    title: string;
    mode: MockExamMode;
    duration_minutes: number;
    started_at: string;
    submitted_at: string;
    elapsed_seconds: number | null;
    total_score_400: number;
    total_correct: number;
    total_questions: number;
    percentage: number;
    show_explanations_after_submission: boolean;
    subject_scores: MockSubjectBreakdown[];
  };
  sections: MockReviewSection[];
};

export type AdminMockExamListItem = MockExamRecord & {
  examName: string;
  customQuestionCount: number;
};

export type AdminMockCustomQuestionInput = {
  subject_id: string;
  question_text: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  options: AdminOptionDraft[];
};
