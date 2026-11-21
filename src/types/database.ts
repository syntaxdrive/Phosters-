export type UserRole = 'student' | 'admin';
export type MaterialFileType = 'pdf' | 'image' | 'zip' | 'other';
export type AnnouncementAudienceType = 'all' | 'exam' | 'exam_subject';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Exam = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type Subject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type ExamSubject = {
  id: string;
  exam_id: string;
  subject_id: string;
  is_active: boolean;
  is_compulsory: boolean;
  display_order: number;
  created_at: string;
};

export type StudentExamProfile = {
  id: string;
  student_id: string;
  exam_id: string;
  intended_course: string | null;
  institution: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentExamSubject = {
  id: string;
  student_exam_profile_id: string;
  subject_id: string;
  created_at: string;
};

export type Topic = {
  id: string;
  exam_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  topic_id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  tutor_name: string | null;
  youtube_url: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type LessonMaterial = {
  id: string;
  lesson_id: string;
  title: string;
  file_type: MaterialFileType;
  file_url: string;
  display_order: number;
  created_at: string;
};

export type LessonLink = {
  id: string;
  lesson_id: string;
  title: string;
  url: string;
  display_order: number;
};

export type StudentLessonProgress = {
  id: string;
  student_id: string;
  lesson_id: string;
  is_completed: boolean;
  completed_at: string | null;
  last_opened_at: string;
};

export type Test = {
  id: string;
  title: string;
  description: string | null;
  topic_id: string | null;
  lesson_id: string | null;
  is_published: boolean;
  show_explanations_after_submission: boolean;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  test_id: string;
  question_text: string;
  explanation: string | null;
  display_order: number;
  points: number;
};

export type QuestionOption = {
  id: string;
  question_id: string;
  option_text: string;
  option_key: string;
  is_correct: boolean;
  display_order: number;
};

export type TestAttempt = {
  id: string;
  test_id: string;
  student_id: string;
  score: number;
  total_points: number;
  percentage: number;
  submitted_at: string;
  created_at: string;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_correct: boolean;
  points_awarded: number;
};

export type Announcement = {
  id: string;
  title: string;
  message: string;
  audience_type: AnnouncementAudienceType;
  exam_id: string | null;
  subject_id: string | null;
  is_pinned: boolean;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementLink = {
  id: string;
  announcement_id: string;
  title: string;
  url: string;
  display_order: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      exams: {
        Row: Exam;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      subjects: {
        Row: Subject;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      exam_subjects: {
        Row: ExamSubject;
        Insert: {
          id?: string;
          exam_id: string;
          subject_id: string;
          is_active?: boolean;
          is_compulsory?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          is_active?: boolean;
          is_compulsory?: boolean;
          display_order?: number;
        };
        Relationships: [];
      };
      student_exam_profiles: {
        Row: StudentExamProfile;
        Insert: {
          id?: string;
          student_id: string;
          exam_id: string;
          intended_course?: string | null;
          institution?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          intended_course?: string | null;
          institution?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_exam_subjects: {
        Row: StudentExamSubject;
        Insert: {
          id?: string;
          student_exam_profile_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: {
          subject_id?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: Topic;
        Insert: {
          id?: string;
          exam_id: string;
          subject_id: string;
          title: string;
          description?: string | null;
          display_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          exam_id?: string;
          subject_id?: string;
          title?: string;
          description?: string | null;
          display_order?: number;
          is_published?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      lessons: {
        Row: Lesson;
        Insert: {
          id?: string;
          topic_id: string;
          title: string;
          short_description?: string | null;
          description?: string | null;
          tutor_name?: string | null;
          youtube_url?: string | null;
          display_order?: number;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          topic_id?: string;
          title?: string;
          short_description?: string | null;
          description?: string | null;
          tutor_name?: string | null;
          youtube_url?: string | null;
          display_order?: number;
          is_published?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_materials: {
        Row: LessonMaterial;
        Insert: {
          id?: string;
          lesson_id: string;
          title: string;
          file_type?: MaterialFileType;
          file_url: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          file_type?: MaterialFileType;
          file_url?: string;
          display_order?: number;
        };
        Relationships: [];
      };
      lesson_links: {
        Row: LessonLink;
        Insert: {
          id?: string;
          lesson_id: string;
          title: string;
          url: string;
          display_order?: number;
        };
        Update: {
          title?: string;
          url?: string;
          display_order?: number;
        };
        Relationships: [];
      };
      student_lesson_progress: {
        Row: StudentLessonProgress;
        Insert: {
          id?: string;
          student_id: string;
          lesson_id: string;
          is_completed?: boolean;
          completed_at?: string | null;
          last_opened_at?: string;
        };
        Update: {
          is_completed?: boolean;
          completed_at?: string | null;
          last_opened_at?: string;
        };
        Relationships: [];
      };
      tests: {
        Row: Test;
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          topic_id?: string | null;
          lesson_id?: string | null;
          is_published?: boolean;
          show_explanations_after_submission?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          topic_id?: string | null;
          lesson_id?: string | null;
          is_published?: boolean;
          show_explanations_after_submission?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: Question;
        Insert: {
          id?: string;
          test_id: string;
          question_text: string;
          explanation?: string | null;
          display_order?: number;
          points?: number;
        };
        Update: {
          question_text?: string;
          explanation?: string | null;
          display_order?: number;
          points?: number;
        };
        Relationships: [];
      };
      question_options: {
        Row: QuestionOption;
        Insert: {
          id?: string;
          question_id: string;
          option_text: string;
          option_key: string;
          is_correct?: boolean;
          display_order?: number;
        };
        Update: {
          option_text?: string;
          option_key?: string;
          is_correct?: boolean;
          display_order?: number;
        };
        Relationships: [];
      };
      test_attempts: {
        Row: TestAttempt;
        Insert: {
          id?: string;
          test_id: string;
          student_id: string;
          score?: number;
          total_points?: number;
          percentage?: number;
          submitted_at?: string;
          created_at?: string;
        };
        Update: {
          score?: number;
          total_points?: number;
          percentage?: number;
        };
        Relationships: [];
      };
      attempt_answers: {
        Row: AttemptAnswer;
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_option_id?: string | null;
          is_correct?: boolean;
          points_awarded?: number;
        };
        Update: {
          selected_option_id?: string | null;
          is_correct?: boolean;
          points_awarded?: number;
        };
        Relationships: [];
      };
      announcements: {
        Row: Announcement;
        Insert: {
          id?: string;
          title: string;
          message: string;
          audience_type?: AnnouncementAudienceType;
          exam_id?: string | null;
          subject_id?: string | null;
          is_pinned?: boolean;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          message?: string;
          audience_type?: AnnouncementAudienceType;
          exam_id?: string | null;
          subject_id?: string | null;
          is_pinned?: boolean;
          is_published?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcement_links: {
        Row: AnnouncementLink;
        Insert: {
          id?: string;
          announcement_id: string;
          title: string;
          url: string;
          display_order?: number;
        };
        Update: {
          title?: string;
          url?: string;
          display_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      student_has_subject_access: {
        Args: {
          p_exam_id: string;
          p_subject_id: string;
        };
        Returns: boolean;
      };
      student_can_access_test: {
        Args: {
          p_test_id: string;
        };
        Returns: boolean;
      };
      student_can_access_announcement: {
        Args: {
          p_announcement_id: string;
        };
        Returns: boolean;
      };
      get_published_test_for_student: {
        Args: {
          p_test_id: string;
        };
        Returns: unknown;
      };
      submit_test_attempt: {
        Args: {
          p_test_id: string;
          p_answers: Record<string, string>;
        };
        Returns: string;
      };
      get_test_attempt_review: {
        Args: {
          p_attempt_id: string;
        };
        Returns: unknown;
      };
      get_admin_student_contacts: {
        Args: Record<string, never>;
        Returns: Array<{
          student_id: string;
          email: string | null;
          last_sign_in_at: string | null;
        }>;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
