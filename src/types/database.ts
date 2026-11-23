export type UserRole = 'student' | 'admin';
export type MaterialFileType = 'pdf' | 'image' | 'zip' | 'other';
export type AnnouncementAudienceType = 'all' | 'exam' | 'exam_subject';
export type PushNotificationType =
  | 'lesson'
  | 'test'
  | 'broadcast'
  | 'inactivity_reminder'
  | 'test_reminder'
  | 'custom';
export type EngagementTargetType = 'course' | 'topic' | 'lesson';
export type ReleaseStatus = 'draft' | 'queued' | 'published';

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
  comments_enabled: boolean;
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
  release_status?: ReleaseStatus;
  scheduled_release_at?: string | null;
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

export type PushSubscriptionRecord = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  notify_lessons: boolean;
  notify_tests: boolean;
  notify_broadcasts: boolean;
  notify_reminders: boolean;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PushNotificationLog = {
  id: string;
  notification_type: PushNotificationType;
  title: string;
  body: string;
  target_url: string;
  sent_by: string | null;
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
};

export type TopicCommentRecord = {
  id: string;
  topic_id: string;
  lesson_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ContentLikeRecord = {
  id: string;
  user_id: string;
  target_type: EngagementTargetType;
  target_key: string;
  created_at: string;
};

export type ContentViewRecord = {
  id: string;
  user_id: string;
  target_type: EngagementTargetType;
  target_key: string;
  created_at: string;
};

export type ContentViewCounter = {
  target_type: EngagementTargetType;
  target_key: string;
  views_count: number;
  updated_at: string;
};

export type TutorSubjectAssignment = {
  id: string;
  tutor_id: string;
  subject_id: string;
  assigned_by: string | null;
  created_at: string;
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
          comments_enabled?: boolean;
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
          comments_enabled?: boolean;
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
          release_status?: ReleaseStatus;
          scheduled_release_at?: string | null;
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
          release_status?: ReleaseStatus;
          scheduled_release_at?: string | null;
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
      push_subscriptions: {
        Row: PushSubscriptionRecord;
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          notify_lessons?: boolean;
          notify_tests?: boolean;
          notify_broadcasts?: boolean;
          notify_reminders?: boolean;
          last_notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          notify_lessons?: boolean;
          notify_tests?: boolean;
          notify_broadcasts?: boolean;
          notify_reminders?: boolean;
          last_notified_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_notification_logs: {
        Row: PushNotificationLog;
        Insert: {
          id?: string;
          notification_type: PushNotificationType;
          title: string;
          body: string;
          target_url?: string;
          sent_by?: string | null;
          recipients_count?: number;
          delivered_count?: number;
          failed_count?: number;
          created_at?: string;
        };
        Update: {
          recipients_count?: number;
          delivered_count?: number;
          failed_count?: number;
        };
        Relationships: [];
      };
      topic_comments: {
        Row: TopicCommentRecord;
        Insert: {
          id?: string;
          topic_id: string;
          lesson_id?: string | null;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_likes: {
        Row: ContentLikeRecord;
        Insert: {
          id?: string;
          user_id: string;
          target_type: EngagementTargetType;
          target_key: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      content_view_counters: {
        Row: ContentViewCounter;
        Insert: {
          target_type: EngagementTargetType;
          target_key: string;
          views_count?: number;
          updated_at?: string;
        };
        Update: {
          views_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_views: {
        Row: ContentViewRecord;
        Insert: {
          id?: string;
          user_id: string;
          target_type: EngagementTargetType;
          target_key: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      question_bank_batches: {
        Row: {
          id: string;
          file_name: string;
          source_format: 'pdf' | 'docx' | 'txt' | 'csv' | 'md' | 'html' | 'rtf' | 'paste';
          exam_id: string | null;
          subject_id: string | null;
          exam_year: number | null;
          raw_char_count: number;
          imported_count: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          source_format: 'pdf' | 'docx' | 'txt' | 'csv' | 'md' | 'html' | 'rtf' | 'paste';
          exam_id?: string | null;
          subject_id?: string | null;
          exam_year?: number | null;
          raw_char_count?: number;
          imported_count?: number;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          imported_count?: number;
        };
        Relationships: [];
      };
      question_bank: {
        Row: {
          id: string;
          batch_id: string | null;
          exam_id: string | null;
          subject_id: string | null;
          topic_id: string | null;
          exam_year: number | null;
          difficulty: 'easy' | 'medium' | 'hard';
          section_label: string | null;
          question_text: string;
          explanation: string | null;
          points: number;
          needs_diagram: boolean;
          status: 'draft' | 'approved';
          source_reference: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id?: string | null;
          exam_id?: string | null;
          subject_id?: string | null;
          topic_id?: string | null;
          exam_year?: number | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          section_label?: string | null;
          question_text: string;
          explanation?: string | null;
          points?: number;
          needs_diagram?: boolean;
          status?: 'draft' | 'approved';
          source_reference?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          exam_id?: string | null;
          subject_id?: string | null;
          topic_id?: string | null;
          exam_year?: number | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          section_label?: string | null;
          question_text?: string;
          explanation?: string | null;
          points?: number;
          needs_diagram?: boolean;
          status?: 'draft' | 'approved';
          source_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_bank_options: {
        Row: {
          id: string;
          bank_question_id: string;
          option_key: string;
          option_text: string;
          is_correct: boolean;
          display_order: number;
        };
        Insert: {
          id?: string;
          bank_question_id: string;
          option_key: string;
          option_text: string;
          is_correct?: boolean;
          display_order?: number;
        };
        Update: {
          option_key?: string;
          option_text?: string;
          is_correct?: boolean;
          display_order?: number;
        };
        Relationships: [];
      };
      mock_exams: {
        Row: {
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
        Insert: {
          id?: string;
          exam_id: string;
          title: string;
          description?: string | null;
          duration_minutes?: number;
          english_question_count?: number;
          other_subject_question_count?: number;
          uses_question_bank?: boolean;
          exclude_diagrams?: boolean;
          is_published?: boolean;
          release_status?: ReleaseStatus;
          scheduled_release_at?: string | null;
          show_explanations_after_submission?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          exam_id?: string;
          title?: string;
          description?: string | null;
          duration_minutes?: number;
          english_question_count?: number;
          other_subject_question_count?: number;
          uses_question_bank?: boolean;
          exclude_diagrams?: boolean;
          is_published?: boolean;
          release_status?: ReleaseStatus;
          scheduled_release_at?: string | null;
          show_explanations_after_submission?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      mock_exam_custom_questions: {
        Row: {
          id: string;
          mock_exam_id: string;
          subject_id: string;
          question_text: string;
          explanation: string | null;
          difficulty: 'easy' | 'medium' | 'hard';
          points: number;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          mock_exam_id: string;
          subject_id: string;
          question_text: string;
          explanation?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          points?: number;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          subject_id?: string;
          question_text?: string;
          explanation?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard';
          points?: number;
          display_order?: number;
        };
        Relationships: [];
      };
      mock_exam_custom_options: {
        Row: {
          id: string;
          custom_question_id: string;
          option_key: string;
          option_text: string;
          is_correct: boolean;
          display_order: number;
        };
        Insert: {
          id?: string;
          custom_question_id: string;
          option_key: string;
          option_text: string;
          is_correct?: boolean;
          display_order?: number;
        };
        Update: {
          option_key?: string;
          option_text?: string;
          is_correct?: boolean;
          display_order?: number;
        };
        Relationships: [];
      };
      mock_attempts: {
        Row: {
          id: string;
          student_id: string;
          exam_id: string;
          mock_exam_id: string | null;
          title: string;
          mode: 'full_mock' | 'mini_mock' | 'published_mock';
          duration_minutes: number;
          started_at: string;
          submitted_at: string | null;
          elapsed_seconds: number | null;
          total_score_400: number;
          total_correct: number;
          total_questions: number;
          percentage: number;
          show_explanations_after_submission: boolean;
          subject_scores: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          exam_id: string;
          mock_exam_id?: string | null;
          title: string;
          mode?: 'full_mock' | 'mini_mock' | 'published_mock';
          duration_minutes?: number;
          started_at?: string;
          submitted_at?: string | null;
          elapsed_seconds?: number | null;
          total_score_400?: number;
          total_correct?: number;
          total_questions?: number;
          percentage?: number;
          show_explanations_after_submission?: boolean;
          subject_scores?: unknown;
          created_at?: string;
        };
        Update: {
          submitted_at?: string | null;
          elapsed_seconds?: number | null;
          total_score_400?: number;
          total_correct?: number;
          total_questions?: number;
          percentage?: number;
          subject_scores?: unknown;
        };
        Relationships: [];
      };
      mock_attempt_items: {
        Row: {
          id: string;
          attempt_id: string;
          subject_id: string;
          subject_name: string;
          subject_slug: string;
          section_order: number;
          question_order: number;
          question_source: 'bank' | 'custom';
          source_question_id: string | null;
          question_text: string;
          explanation: string | null;
          options_json: unknown;
          selected_option_key: string | null;
          correct_option_key: string;
          is_correct: boolean;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          subject_id: string;
          subject_name: string;
          subject_slug: string;
          section_order?: number;
          question_order?: number;
          question_source?: 'bank' | 'custom';
          source_question_id?: string | null;
          question_text: string;
          explanation?: string | null;
          options_json?: unknown;
          selected_option_key?: string | null;
          correct_option_key: string;
          is_correct?: boolean;
        };
        Update: {
          selected_option_key?: string | null;
          is_correct?: boolean;
        };
        Relationships: [];
      };
      tutor_subject_assignments: {
        Row: TutorSubjectAssignment;
        Insert: {
          id?: string;
          tutor_id: string;
          subject_id: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: never;
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
      user_can_engage_target: {
        Args: {
          p_target_type: string;
          p_target_key: string;
        };
        Returns: boolean;
      };
      get_topic_comments: {
        Args: {
          p_topic_id: string;
        };
        Returns: Array<{
          id: string;
          topic_id: string;
          lesson_id: string | null;
          user_id: string;
          author_name: string;
          author_role: string;
          body: string;
          created_at: string;
          is_own: boolean;
        }>;
      };
      record_content_view: {
        Args: {
          p_target_type: string;
          p_target_key: string;
        };
        Returns: number;
      };
      toggle_content_like: {
        Args: {
          p_target_type: string;
          p_target_key: string;
        };
        Returns: {
          liked: boolean;
          likes_count: number;
        };
      };
      get_engagement_stats: {
        Args: {
          p_targets: Array<{
            target_type: string;
            target_key: string;
          }>;
        };
        Returns: Array<{
          target_type: string;
          target_key: string;
          likes_count: number;
          liked_by_me: boolean;
          views_count: number;
          comments_count: number;
        }>;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_admin_managed_accounts: {
        Args: Record<string, never>;
        Returns: Array<{
          user_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: string;
          is_super_admin: boolean;
          created_at: string;
          last_sign_in_at: string | null;
        }>;
      };
      set_user_account_role: {
        Args: {
          p_target_user_id: string;
          p_new_role: string;
        };
        Returns: Array<{
          user_id: string;
          role: string;
        }>;
      };
      get_student_mock_readiness: {
        Args: {
          p_exam_id?: string | null;
        };
        Returns: unknown;
      };
      start_mock_exam_session: {
        Args: {
          p_exam_id: string;
          p_mock_exam_id?: string | null;
          p_mode?: string;
        };
        Returns: unknown;
      };
      get_pending_mock_session: {
        Args: {
          p_attempt_id: string;
        };
        Returns: unknown;
      };
      submit_mock_attempt: {
        Args: {
          p_attempt_id: string;
          p_answers: Record<string, string>;
          p_elapsed_seconds?: number | null;
        };
        Returns: string;
      };
      get_mock_attempt_review: {
        Args: {
          p_attempt_id: string;
        };
        Returns: unknown;
      };
      tutor_can_access_subject: {
        Args: {
          p_subject_id: string;
        };
        Returns: boolean;
      };
      tutor_can_access_test: {
        Args: {
          p_topic_id: string | null;
          p_lesson_id: string | null;
        };
        Returns: boolean;
      };
      set_tutor_assigned_subjects: {
        Args: {
          p_tutor_id: string;
          p_subject_ids: string[];
        };
        Returns: Array<{
          tutor_id: string;
          subject_id: string;
        }>;
      };
      is_item_released: {
        Args: {
          p_is_published: boolean;
          p_release_status: string;
          p_scheduled_release_at: string | null;
        };
        Returns: boolean;
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
