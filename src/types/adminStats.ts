export type StudentEngagementStatus =
  | 'not_enrolled'
  | 'not_started'
  | 'in_progress'
  | 'completed';

export type StudentSubjectProgressItem = {
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  publishedLessonsCount: number;
  openedLessonsCount: number;
  completedLessonsCount: number;
  completionPct: number;
};

export type StudentExamEnrollmentSummary = {
  examId: string;
  examName: string;
  intendedCourse: string | null;
  institution: string | null;
  subjectNames: string[];
};

export type AdminStudentUsageRow = {
  studentId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  registeredAt: string;
  lastSignInAt: string | null;
  lastActivityAt: string | null;
  daysSinceLastActivity: number;
  status: StudentEngagementStatus;
  enrollments: StudentExamEnrollmentSummary[];
  subjectProgress: StudentSubjectProgressItem[];
  enrolledExamIds: string[];
  enrolledSubjectIds: string[];
  enrolledCourseKeys: string[];
  availableLessonsCount: number;
  openedLessonsCount: number;
  completedLessonsCount: number;
  completionPct: number;
  testAttemptsCount: number;
  averageTestPct: number | null;
};

export type AdminCourseEnrollmentStat = {
  courseKey: string; // `${examId}:${subjectId}`
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  publishedLessonsCount: number;
  enrolledStudentsCount: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  averageCompletionPct: number;
  testAttemptsCount: number;
  averageTestPct: number | null;
};

export type AdminUsageSummary = {
  totalStudents: number;
  notEnrolledCount: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  inactive7DaysCount: number;
  averageCompletionPct: number;
  totalTestAttempts: number;
  averageTestPct: number | null;
};

export type AdminStudentStatisticsPayload = {
  summary: AdminUsageSummary;
  courseStats: AdminCourseEnrollmentStat[];
  students: AdminStudentUsageRow[];
  exams: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  contactsAvailable: boolean;
};
