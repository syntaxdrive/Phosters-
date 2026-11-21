import { supabase } from '../lib/supabase';
import type {
  AdminCourseEnrollmentStat,
  AdminStudentStatisticsPayload,
  AdminStudentUsageRow,
  StudentEngagementStatus,
  StudentExamEnrollmentSummary,
  StudentSubjectProgressItem,
} from '../types/adminStats';
import type {
  Exam,
  Lesson,
  Profile,
  StudentExamProfile,
  StudentExamSubject,
  StudentLessonProgress,
  Subject,
  Test,
  TestAttempt,
  Topic,
} from '../types/database';

function mapStatsError(err: { message?: string; code?: string } | null): string {
  if (!err) return 'An unexpected error occurred.';
  if (err.code === '42501') {
    return 'Permission denied. Administrator access is required.';
  }
  return err.message || 'Unable to load student usage statistics.';
}

function maxIsoDate(dates: Array<string | null | undefined>): string | null {
  let bestMs = -1;
  let bestIso: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    const ms = Date.parse(d);
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      bestIso = d;
    }
  }
  return bestIso;
}

function daysSince(isoDate: string): number {
  const ms = Date.parse(isoDate);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)));
}

export async function fetchAdminStudentStatistics(): Promise<{
  data: AdminStudentStatisticsPayload | null;
  error: string | null;
}> {
  if (!supabase) return { data: null, error: 'Supabase is not configured.' };

  const [
    profilesRes,
    examsRes,
    subjectsRes,
    examProfilesRes,
    examSubjectsRes,
    topicsRes,
    lessonsRes,
    progressRes,
    testsRes,
    attemptsRes,
    contactsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at, updated_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false }),
    supabase.from('exams').select('id, name, slug, is_active').order('name', { ascending: true }),
    supabase.from('subjects').select('id, name, slug, is_active').order('name', { ascending: true }),
    supabase
      .from('student_exam_profiles')
      .select('id, student_id, exam_id, intended_course, institution, created_at, updated_at'),
    supabase
      .from('student_exam_subjects')
      .select('id, student_exam_profile_id, subject_id, created_at'),
    supabase
      .from('topics')
      .select('id, exam_id, subject_id, is_published')
      .eq('is_published', true),
    supabase
      .from('lessons')
      .select('id, topic_id, is_published')
      .eq('is_published', true),
    supabase
      .from('student_lesson_progress')
      .select('id, student_id, lesson_id, is_completed, completed_at, last_opened_at'),
    supabase.from('tests').select('id, topic_id, lesson_id'),
    supabase
      .from('test_attempts')
      .select('id, test_id, student_id, percentage, submitted_at'),
    supabase.rpc('get_admin_student_contacts'),
  ]);

  const coreErr =
    profilesRes.error ||
    examsRes.error ||
    subjectsRes.error ||
    examProfilesRes.error ||
    examSubjectsRes.error ||
    topicsRes.error ||
    lessonsRes.error ||
    progressRes.error;

  if (coreErr) {
    return { data: null, error: mapStatsError(coreErr) };
  }

  // Gracefully allow CBT tables to be absent if Phase 4 SQL hasn't been applied yet
  const testsData =
    testsRes.error && testsRes.error.code === '42P01'
      ? []
      : ((testsRes.data ?? []) as Array<Pick<Test, 'id' | 'topic_id' | 'lesson_id'>>);
  if (testsRes.error && testsRes.error.code !== '42P01') {
    return { data: null, error: mapStatsError(testsRes.error) };
  }

  const attemptsData =
    attemptsRes.error && attemptsRes.error.code === '42P01'
      ? []
      : ((attemptsRes.data ?? []) as Array<
          Pick<TestAttempt, 'id' | 'test_id' | 'student_id' | 'percentage' | 'submitted_at'>
        >);
  if (attemptsRes.error && attemptsRes.error.code !== '42P01') {
    return { data: null, error: mapStatsError(attemptsRes.error) };
  }

  const contactsAvailable = !contactsRes.error;
  const contactsMap = new Map<
    string,
    { email: string | null; lastSignInAt: string | null }
  >();
  if (contactsAvailable && Array.isArray(contactsRes.data)) {
    for (const c of contactsRes.data as Array<{
      student_id: string;
      email: string | null;
      last_sign_in_at: string | null;
    }>) {
      contactsMap.set(c.student_id, {
        email: c.email,
        lastSignInAt: c.last_sign_in_at,
      });
    }
  }

  const exams = (examsRes.data ?? []) as Array<Pick<Exam, 'id' | 'name' | 'slug' | 'is_active'>>;
  const subjects = (subjectsRes.data ?? []) as Array<Pick<Subject, 'id' | 'name' | 'slug' | 'is_active'>>;
  const examMap = new Map(exams.map((e) => [e.id, e]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Map published lessons to (examId, subjectId)
  const publishedTopics = (topicsRes.data ?? []) as Array<
    Pick<Topic, 'id' | 'exam_id' | 'subject_id' | 'is_published'>
  >;
  const topicById = new Map(publishedTopics.map((t) => [t.id, t]));

  const publishedLessonsByCourse = new Map<string, Set<string>>();
  const lessonToCourseKey = new Map<string, string>();
  const lessonToTopicId = new Map<string, string>();

  for (const lesson of (lessonsRes.data ?? []) as Array<Pick<Lesson, 'id' | 'topic_id' | 'is_published'>>) {
    lessonToTopicId.set(lesson.id, lesson.topic_id);
    const parentTopic = topicById.get(lesson.topic_id);
    if (!parentTopic) continue;
    const courseKey = `${parentTopic.exam_id}:${parentTopic.subject_id}`;
    lessonToCourseKey.set(lesson.id, courseKey);
    const set = publishedLessonsByCourse.get(courseKey) ?? new Set<string>();
    set.add(lesson.id);
    publishedLessonsByCourse.set(courseKey, set);
  }

  // Map tests -> courseKey (`${examId}:${subjectId}`)
  const testToCourseKey = new Map<string, string>();
  for (const tst of testsData) {
    const resolvedTopicId =
      tst.topic_id ?? (tst.lesson_id ? lessonToTopicId.get(tst.lesson_id) ?? null : null);
    if (!resolvedTopicId) continue;
    const topic = topicById.get(resolvedTopicId);
    if (!topic) continue;
    testToCourseKey.set(tst.id, `${topic.exam_id}:${topic.subject_id}`);
  }

  // Group student exam profiles & subjects
  const examProfilesByStudent = new Map<string, StudentExamProfile[]>();
  for (const ep of (examProfilesRes.data ?? []) as StudentExamProfile[]) {
    const list = examProfilesByStudent.get(ep.student_id) ?? [];
    list.push(ep);
    examProfilesByStudent.set(ep.student_id, list);
  }

  const subjectsByExamProfile = new Map<string, string[]>();
  for (const es of (examSubjectsRes.data ?? []) as StudentExamSubject[]) {
    const list = subjectsByExamProfile.get(es.student_exam_profile_id) ?? [];
    list.push(es.subject_id);
    subjectsByExamProfile.set(es.student_exam_profile_id, list);
  }

  // Group progress & test attempts by student
  const progressByStudent = new Map<string, StudentLessonProgress[]>();
  for (const p of (progressRes.data ?? []) as StudentLessonProgress[]) {
    const list = progressByStudent.get(p.student_id) ?? [];
    list.push(p);
    progressByStudent.set(p.student_id, list);
  }

  const attemptsByStudent = new Map<
    string,
    Array<Pick<TestAttempt, 'id' | 'test_id' | 'student_id' | 'percentage' | 'submitted_at'>>
  >();
  const attemptsByCourse = new Map<string, number[]>();

  for (const att of attemptsData) {
    const list = attemptsByStudent.get(att.student_id) ?? [];
    list.push(att);
    attemptsByStudent.set(att.student_id, list);

    const ck = testToCourseKey.get(att.test_id);
    if (ck) {
      const scores = attemptsByCourse.get(ck) ?? [];
      scores.push(Number(att.percentage));
      attemptsByCourse.set(ck, scores);
    }
  }

  // Track course-level aggregates while building per-student usage rows
  const courseEnrollmentBuckets = new Map<
    string,
    {
      examId: string;
      subjectId: string;
      notStarted: number;
      inProgress: number;
      completed: number;
      completionPcts: number[];
    }
  >();

  function ensureCourseBucket(examId: string, subjectId: string) {
    const key = `${examId}:${subjectId}`;
    let existing = courseEnrollmentBuckets.get(key);
    if (!existing) {
      existing = {
        examId,
        subjectId,
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        completionPcts: [],
      };
      courseEnrollmentBuckets.set(key, existing);
    }
    return existing;
  }

  const studentRows: AdminStudentUsageRow[] = [];

  for (const prof of (profilesRes.data ?? []) as Profile[]) {
    const contact = contactsMap.get(prof.id);
    const stuExamProfiles = examProfilesByStudent.get(prof.id) ?? [];
    const stuProgress = progressByStudent.get(prof.id) ?? [];
    const stuAttempts = attemptsByStudent.get(prof.id) ?? [];

    const openedLessonIds = new Set<string>();
    const completedLessonIds = new Set<string>();
    let lastLessonOpenedAt: string | null = null;

    for (const p of stuProgress) {
      openedLessonIds.add(p.lesson_id);
      if (p.is_completed) completedLessonIds.add(p.lesson_id);
      lastLessonOpenedAt = maxIsoDate([lastLessonOpenedAt, p.last_opened_at, p.completed_at]);
    }

    let lastTestSubmittedAt: string | null = null;
    for (const a of stuAttempts) {
      lastTestSubmittedAt = maxIsoDate([lastTestSubmittedAt, a.submitted_at]);
    }

    const enrollments: StudentExamEnrollmentSummary[] = [];
    const subjectProgress: StudentSubjectProgressItem[] = [];
    const enrolledExamIds = new Set<string>();
    const enrolledSubjectIds = new Set<string>();
    const enrolledCourseKeys = new Set<string>();

    const allAvailableLessons = new Set<string>();
    const allOpenedEnrolledLessons = new Set<string>();
    const allCompletedEnrolledLessons = new Set<string>();

    for (const ep of stuExamProfiles) {
      const exam = examMap.get(ep.exam_id);
      if (!exam) continue;
      const selectedSubjectIds = subjectsByExamProfile.get(ep.id) ?? [];
      if (selectedSubjectIds.length === 0) continue;

      enrolledExamIds.add(ep.exam_id);
      const subjectNames: string[] = [];

      for (const sid of selectedSubjectIds) {
        const subj = subjectMap.get(sid);
        if (!subj) continue;
        enrolledSubjectIds.add(sid);
        subjectNames.push(subj.name);

        const courseKey = `${ep.exam_id}:${sid}`;
        enrolledCourseKeys.add(courseKey);

        const courseLessons = publishedLessonsByCourse.get(courseKey) ?? new Set<string>();
        let courseOpened = 0;
        let courseCompleted = 0;

        for (const lid of courseLessons) {
          allAvailableLessons.add(lid);
          if (openedLessonIds.has(lid)) {
            courseOpened++;
            allOpenedEnrolledLessons.add(lid);
          }
          if (completedLessonIds.has(lid)) {
            courseCompleted++;
            allCompletedEnrolledLessons.add(lid);
          }
        }

        const totalCourseLessons = courseLessons.size;
        const coursePct =
          totalCourseLessons > 0
            ? Math.round((courseCompleted / totalCourseLessons) * 100)
            : 0;

        subjectProgress.push({
          examId: ep.exam_id,
          examName: exam.name,
          subjectId: sid,
          subjectName: subj.name,
          publishedLessonsCount: totalCourseLessons,
          openedLessonsCount: courseOpened,
          completedLessonsCount: courseCompleted,
          completionPct: coursePct,
        });

        const bucket = ensureCourseBucket(ep.exam_id, sid);
        bucket.completionPcts.push(coursePct);
        if (courseOpened === 0 && courseCompleted === 0) {
          bucket.notStarted += 1;
        } else if (totalCourseLessons > 0 && courseCompleted >= totalCourseLessons) {
          bucket.completed += 1;
        } else {
          bucket.inProgress += 1;
        }
      }

      enrollments.push({
        examId: ep.exam_id,
        examName: exam.name,
        intendedCourse: ep.intended_course,
        institution: ep.institution,
        subjectNames: subjectNames.sort((a, b) => a.localeCompare(b)),
      });
    }

    const availableLessonsCount = allAvailableLessons.size;
    const openedLessonsCount = allOpenedEnrolledLessons.size;
    const completedLessonsCount = allCompletedEnrolledLessons.size;
    const completionPct =
      availableLessonsCount > 0
        ? Math.round((completedLessonsCount / availableLessonsCount) * 100)
        : 0;

    const testAttemptsCount = stuAttempts.length;
    const averageTestPct =
      testAttemptsCount > 0
        ? Math.round(
            stuAttempts.reduce((sum, a) => sum + Number(a.percentage), 0) /
              testAttemptsCount
          )
        : null;

    let status: StudentEngagementStatus;
    if (enrolledCourseKeys.size === 0) {
      status = 'not_enrolled';
    } else if (
      openedLessonsCount === 0 &&
      completedLessonsCount === 0 &&
      testAttemptsCount === 0
    ) {
      status = 'not_started';
    } else if (
      availableLessonsCount > 0 &&
      completedLessonsCount >= availableLessonsCount
    ) {
      status = 'completed';
    } else {
      status = 'in_progress';
    }

    const lastActivityAt = maxIsoDate([
      lastLessonOpenedAt,
      lastTestSubmittedAt,
      contact?.lastSignInAt,
    ]);
    const daysSinceLastActivity = daysSince(lastActivityAt ?? prof.created_at);

    studentRows.push({
      studentId: prof.id,
      fullName: prof.full_name,
      email: contact?.email ?? null,
      phone: prof.phone,
      registeredAt: prof.created_at,
      lastSignInAt: contact?.lastSignInAt ?? null,
      lastActivityAt,
      daysSinceLastActivity,
      status,
      enrollments: enrollments.sort((a, b) => a.examName.localeCompare(b.examName)),
      subjectProgress: subjectProgress.sort(
        (a, b) =>
          a.examName.localeCompare(b.examName) ||
          a.subjectName.localeCompare(b.subjectName)
      ),
      enrolledExamIds: Array.from(enrolledExamIds),
      enrolledSubjectIds: Array.from(enrolledSubjectIds),
      enrolledCourseKeys: Array.from(enrolledCourseKeys),
      availableLessonsCount,
      openedLessonsCount,
      completedLessonsCount,
      completionPct,
      testAttemptsCount,
      averageTestPct,
    });
  }

  // Also include published courses that have lessons even if 0 students enrolled yet
  for (const [courseKey] of publishedLessonsByCourse.entries()) {
    const [examId, subjectId] = courseKey.split(':');
    if (examMap.has(examId) && subjectMap.has(subjectId)) {
      ensureCourseBucket(examId, subjectId);
    }
  }

  const courseStats: AdminCourseEnrollmentStat[] = Array.from(
    courseEnrollmentBuckets.entries()
  )
    .map(([courseKey, bucket]) => {
      const examName = examMap.get(bucket.examId)?.name ?? 'Exam';
      const subjectName = subjectMap.get(bucket.subjectId)?.name ?? 'Subject';
      const publishedLessonsCount = publishedLessonsByCourse.get(courseKey)?.size ?? 0;
      const enrolledStudentsCount = bucket.completionPcts.length;
      const averageCompletionPct =
        enrolledStudentsCount > 0
          ? Math.round(
              bucket.completionPcts.reduce((s, v) => s + v, 0) /
                enrolledStudentsCount
            )
          : 0;
      const courseTestScores = attemptsByCourse.get(courseKey) ?? [];
      const averageTestPct =
        courseTestScores.length > 0
          ? Math.round(
              courseTestScores.reduce((s, v) => s + v, 0) / courseTestScores.length
            )
          : null;

      return {
        courseKey,
        examId: bucket.examId,
        examName,
        subjectId: bucket.subjectId,
        subjectName,
        publishedLessonsCount,
        enrolledStudentsCount,
        notStartedCount: bucket.notStarted,
        inProgressCount: bucket.inProgress,
        completedCount: bucket.completed,
        averageCompletionPct,
        testAttemptsCount: courseTestScores.length,
        averageTestPct,
      };
    })
    .sort(
      (a, b) =>
        b.enrolledStudentsCount - a.enrolledStudentsCount ||
        a.examName.localeCompare(b.examName) ||
        a.subjectName.localeCompare(b.subjectName)
    );

  const enrolledStudents = studentRows.filter((s) => s.status !== 'not_enrolled');
  const averageCompletionPct =
    enrolledStudents.length > 0
      ? Math.round(
          enrolledStudents.reduce((sum, s) => sum + s.completionPct, 0) /
            enrolledStudents.length
        )
      : 0;

  const averageTestPct =
    attemptsData.length > 0
      ? Math.round(
          attemptsData.reduce((sum, a) => sum + Number(a.percentage), 0) /
            attemptsData.length
        )
      : null;

  const summary = {
    totalStudents: studentRows.length,
    notEnrolledCount: studentRows.filter((s) => s.status === 'not_enrolled').length,
    notStartedCount: studentRows.filter((s) => s.status === 'not_started').length,
    inProgressCount: studentRows.filter((s) => s.status === 'in_progress').length,
    completedCount: studentRows.filter((s) => s.status === 'completed').length,
    inactive7DaysCount: studentRows.filter(
      (s) => s.status !== 'completed' && s.daysSinceLastActivity >= 7
    ).length,
    averageCompletionPct,
    totalTestAttempts: attemptsData.length,
    averageTestPct,
  };

  return {
    data: {
      summary,
      courseStats,
      students: studentRows,
      exams: exams.map((e) => ({ id: e.id, name: e.name })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
      contactsAvailable,
    },
    error: null,
  };
}
