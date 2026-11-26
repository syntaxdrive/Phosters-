export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionBankStatus = 'draft' | 'approved';
export type DocumentSourceFormat =
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'csv'
  | 'md'
  | 'html'
  | 'rtf'
  | 'paste';

export interface ParsedBankOptionDraft {
  localKey: string;
  optionKey: string;
  optionText: string;
  isCorrect: boolean;
}

export interface ParsedBankQuestionDraft {
  localKey: string;
  questionText: string;
  explanation: string;
  examYear: number | null;
  sectionLabel: string;
  difficulty: QuestionDifficulty;
  points: number;
  needsDiagram: boolean;
  hasKeyIssue: boolean;
  include: boolean;
  options: ParsedBankOptionDraft[];
}

export interface QuestionBankOptionRecord {
  id: string;
  bank_question_id: string;
  option_key: string;
  option_text: string;
  is_correct: boolean;
  display_order: number;
}

export interface QuestionBankItem {
  id: string;
  batch_id: string | null;
  exam_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  exam_year: number | null;
  difficulty: QuestionDifficulty;
  section_label: string | null;
  question_text: string;
  explanation: string | null;
  points: number;
  needs_diagram: boolean;
  status: QuestionBankStatus;
  source_reference: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  options: QuestionBankOptionRecord[];
}
