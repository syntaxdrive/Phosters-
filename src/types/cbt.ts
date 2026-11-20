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
  is_published: boolean;
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
  show_explanations_after_submission: boolean;
  questions: AdminQuestionDraft[];
};
