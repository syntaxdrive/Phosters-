import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronRight, PlayCircle, Settings2, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchStudentAnnouncements } from '../../services/announcementService';
import { fetchStudentAttempts } from '../../services/cbtService';
import {
  fetchLessonCountsByExamSubject,
  fetchRecentLesson,
  fetchStudentEnrollments,
} from '../../services/learningService';
import type { AnnouncementFeedItem } from '../../types/announcement';
import type { StudentAttemptSummary } from '../../types/cbt';
import type { RecentLessonItem, StudentEnrolledExam } from '../../types/learning';
import { AnnouncementFeed } from '../../components/student/AnnouncementFeed';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function HomePage() {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || 'Student';

  const [enrollments, setEnrollments] = useState<StudentEnrolledExam[]>([]);
  const [recentLesson, setRecentLesson] = useState<RecentLessonItem | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<StudentAttemptSummary[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [enrollRes, recentRes, attemptsRes, annRes] = await Promise.all([
      fetchStudentEnrollments(user.id),
      fetchRecentLesson(user.id),
      fetchStudentAttempts(user.id, 3),
      fetchStudentAnnouncements(),
    ]);

    if (enrollRes.error) {
      setError(enrollRes.error);
      setLoading(false);
      return;
    }

    const loadedEnrollments = enrollRes.enrollments;
    const examIds = Array.from(new Set(loadedEnrollments.map((e) => e.exam.id)));
    const subjectIds = Array.from(
      new Set(loadedEnrollments.flatMap((e) => e.selectedSubjects.map((s) => s.id)))
    );

    const countsRes = await fetchLessonCountsByExamSubject(examIds, subjectIds);

    setEnrollments(loadedEnrollments);
    setRecentLesson(recentRes.recentLesson);
    setRecentAttempts(attemptsRes.attempts);
    setAnnouncements(annRes.announcements);
    setLessonCounts(countsRes.counts);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return <LoadingState message="Loading your dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadDashboard()} />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Welcome, {displayName}
          </h1>
          <p className="text-sm text-slate-600">
            {enrollments.length > 0
              ? `Preparing for ${enrollments.map((e) => e.exam.name).join(' and ')}`
              : 'Set up your examination profile to start learning.'}
          </p>
        </div>

        <Link
          to="/app/setup-exams"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <Settings2 className="h-4 w-4 text-phosters-700" aria-hidden="true" />
          <span>{enrollments.length > 0 ? 'Edit Exam & Subjects' : 'Choose Examinations'}</span>
        </Link>
      </section>

      {recentLesson && (
        <Card padding="md" className="bg-phosters-50/60 border-phosters-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold text-phosters-800">
                Continue learning
              </p>
              <h2 className="text-base font-bold text-slate-900 truncate">
                {recentLesson.lessonTitle}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                <span>{recentLesson.examName}</span>
                <span aria-hidden="true">·</span>
                <span>{recentLesson.subjectName}</span>
                <span aria-hidden="true">·</span>
                <span>{recentLesson.topicTitle}</span>
                {recentLesson.isCompleted && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-phosters-700">Completed</span>
                  </>
                )}
              </div>
            </div>
            <Link
              to={`/app/lessons/${recentLesson.lessonId}`}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              <span>Resume Lesson</span>
            </Link>
          </div>
        </Card>
      )}

      {announcements.length > 0 && <AnnouncementFeed items={announcements} />}

      {enrollments.length === 0 ? (
        <Card padding="lg" className="space-y-4">
          <div className="h-10 w-10 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">
              Choose your examination &amp; subjects
            </h2>
            <p className="text-sm text-slate-600 max-w-xl leading-relaxed">
              Select JAMB UTME, UI Post-UTME, or both, then pick the subjects you are preparing for. Phosters will tailor your subject list and lessons accordingly.
            </p>
          </div>
          <div>
            <Link
              to="/app/setup-exams"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              <span>Select Examinations</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Card>
      ) : (
        <section aria-labelledby="my-subjects-heading" className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="my-subjects-heading" className="text-lg font-bold text-slate-900">
              Your subjects
            </h2>
            <Link
              to="/app/subjects"
              className="text-sm font-semibold text-phosters-700 hover:text-phosters-800 hover:underline py-1"
            >
              Browse all
            </Link>
          </div>

          <div className="space-y-6">
            {enrollments.map((enrollment) => (
              <div key={enrollment.profileId} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    {enrollment.exam.name}
                  </h3>
                  {(enrollment.intendedCourse || enrollment.institution) && (
                    <p className="text-xs text-slate-500">
                      {[enrollment.intendedCourse, enrollment.institution]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                {enrollment.selectedSubjects.length === 0 ? (
                  <Card padding="md">
                    <p className="text-sm text-slate-600">
                      No subjects chosen yet for {enrollment.exam.name}.{' '}
                      <Link
                        to="/app/setup-exams"
                        className="font-semibold text-phosters-700 hover:underline"
                      >
                        Select subjects
                      </Link>
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {enrollment.selectedSubjects.map((subject) => {
                      const count =
                        lessonCounts.get(`${enrollment.exam.id}:${subject.id}`) ?? 0;
                      return (
                        <Link
                          key={`${enrollment.exam.id}-${subject.id}`}
                          to={`/app/subjects/${enrollment.exam.slug}/${subject.slug}`}
                          className="group block bg-white border border-slate-200 rounded-xl p-4 hover:border-phosters-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phosters-600"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 group-hover:text-phosters-700 transition-colors">
                              {subject.name}
                            </h4>
                            <ArrowRight
                              className="h-4 w-4 text-slate-400 group-hover:text-phosters-700 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500 tabular-nums">
                            {count === 1 ? '1 published lesson' : `${count} published lessons`}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {recentAttempts.length > 0 && (
        <section aria-labelledby="recent-results-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent-results-heading" className="text-lg font-bold text-slate-900">
              Recent test results
            </h2>
            <Link
              to="/app/results"
              className="text-sm font-semibold text-phosters-700 hover:text-phosters-800 hover:underline py-1"
            >
              All results
            </Link>
          </div>

          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {recentAttempts.map((attempt) => (
                <li key={attempt.id}>
                  <Link
                    to={`/app/results/${attempt.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 min-h-[56px] hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {attempt.test_title}
                      </p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Score {attempt.score} / {attempt.total_points}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-phosters-700 tabular-nums">
                        {Math.round(attempt.percentage)}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {profile?.role === 'admin' && (
        <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 border border-phosters-200 flex items-center justify-center text-phosters-700 shrink-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Administrator workspace</h2>
              <p className="text-xs text-slate-600">
                Signed in with administrator permissions.
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Open Admin Area
          </Link>
        </Card>
      )}
    </div>
  );
}
