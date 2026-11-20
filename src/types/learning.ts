import type {
  Exam,
  Lesson,
  LessonLink,
  LessonMaterial,
  Subject,
  Topic,
} from './database';

export type ExamSubjectOption = {
  examSubjectId: string;
  examId: string;
  subjectId: string;
  isCompulsory: boolean;
  displayOrder: number;
  subject: Subject;
};

export type ExamWithSubjects = Exam & {
  availableSubjects: ExamSubjectOption[];
};

export type StudentEnrolledExam = {
  profileId: string;
  exam: Exam;
  intendedCourse: string | null;
  institution: string | null;
  selectedSubjects: Subject[];
};

export type TopicWithLessons = Topic & {
  lessons: Array<
    Lesson & {
      isCompleted: boolean;
    }
  >;
};

export type RecentLessonItem = {
  lessonId: string;
  lessonTitle: string;
  topicTitle: string;
  subjectName: string;
  subjectSlug: string;
  examName: string;
  examSlug: string;
  lastOpenedAt: string;
  isCompleted: boolean;
};

export type LessonDetailData = {
  lesson: Lesson;
  topic: Topic;
  exam: Exam;
  subject: Subject;
  materials: LessonMaterial[];
  links: LessonLink[];
  isCompleted: boolean;
  previousLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
  relatedLessons: Array<{
    id: string;
    title: string;
    short_description: string | null;
    topicTitle: string;
    isCompleted: boolean;
  }>;
};
