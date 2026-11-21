import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Settings2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  buildCourseTargetKey,
  fetchEngagementStats,
  toggleContentLike,
} from '../../services/engagementService';
import {
  fetchLessonCountsByExamSubject,
  fetchStudentEnrollments,
} from '../../services/learningService';
import type { EngagementStats, SharePayload } from '../../types/engagement';
import type { StudentEnrolledExam } from '../../types/learning';
import { EngagementBar } from '../../components/social/EngagementBar';
import { ShareDialog, buildCourseSharePayload } from '../../components/social/ShareDialog';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function SubjectsPage() {
  const { user } = useAuth();

  const [enrollments, setEnrollments] = useState<StudentEnrolledExam[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Map<string, number>>(new Map());
  const [statsMap, setStatsMap] = useState<Map<string, EngagementStats>>(new Map());
  const [likingKey, setLikingKey] = useState<string | null>(null);
  const [engagementError, setEngagementError] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [selectedExamSlug, setSelectedExamSlug] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setEngagementError(null);

    const enrollRes = await fetchStudentEnrollments(user.id);
    if (enrollRes.error) {
      setError(enrollRes.error);
      setLoading(false);
      return;
    }

    const loaded = enrollRes.enrollments;
    const examIds = Array.from(new Set(loaded.map((e) => e.exam.id)));
    const subjectIds = Array.from(
      new Set(loaded.flatMap((e) => e.selectedSubjects.map((s) => s.id)))
    );
    const courseTargets = loaded.flatMap((e) =>
      e.selectedSubjects.map((s) => ({
        targetType: 'course' as const,
        targetKey: buildCourseTargetKey(e.exam.id, s.id),
      }))
    );

    const [countsRes, statsRes] = await Promise.all([
      fetchLessonCountsByExamSubject(examIds, subjectIds),
      fetchEngagementStats(courseTargets),
    ]);

    setEnrollments(loaded);
    setLessonCounts(countsRes.counts);
    setStatsMap(statsRes.statsMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  async function handleToggleCourseLike(examId: string, subjectId: string) {
    const courseKey = buildCourseTargetKey(examId, subjectId);
    const mapKey = `course:${courseKey}`;
    setEngagementError(null);
    setLikingKey(mapKey);

    const res = await toggleContentLike('course', courseKey);
    setLikingKey(null);

    if (res.error || res.liked === null || res.likesCount === null) {
      setEngagementError(res.error || 'Could not update like right now.');
      return;
    }

    setStatsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(mapKey);
      next.set(mapKey, {
        targetType: 'course',
        targetKey: courseKey,
        likesCount: res.likesCount ?? 0,
        likedByMe: Boolean(res.liked),
        viewsCount: existing?.viewsCount ?? 0,
        commentsCount: existing?.commentsCount ?? 0,
      });
      return next;
    });
  }

  if (loading) {
    return <LoadingState message="Loading your subjects..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadSubjects()} />;
  }

  if (enrollments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Subjects</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select your examination profile to access your subjects and lessons.
          </p>
        </div>

        <EmptyState
          title="No examination selected yet"
          description="Choose JAMB UTME, UI Post-UTME, or both and pick your subjects so Phosters can show your lessons."
          action={
            <Link
              to="/app/setup-exams"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Choose Examinations &amp; Subjects
            </Link>
          }
        />
      </div>
    );
  }

  const visibleEnrollments =
    selectedExamSlug === 'all'
      ? enrollments
      : enrollments.filter((e) => e.exam.slug === selectedExamSlug);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Subjects</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Open a subject to browse topics and video lessons.
          </p>
        </div>

        <Link
          to="/app/setup-exams"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto"
        >
          <Settings2 className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
          <span>Edit Subjects</span>
        </Link>
      </div>

      {engagementError && <Alert tone="error">{engagementError}</Alert>}

      {enrollments.length > 1 && (
        <div
          role="tablist"
          aria-label="Filter subjects by examination"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedExamSlug === 'all'}
            onClick={() => setSelectedExamSlug('all')}
            className={[
              'min-h-[40px] px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap',
              selectedExamSlug === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
            ].join(' ')}
          >
            All Examinations
          </button>
          {enrollments.map((e) => (
            <button
              key={e.exam.id}
              type="button"
              role="tab"
              aria-selected={selectedExamSlug === e.exam.slug}
              onClick={() => setSelectedExamSlug(e.exam.slug)}
              className={[
                'min-h-[40px] px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap',
                selectedExamSlug === e.exam.slug
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              {e.exam.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-8">
        {visibleEnrollments.map((enrollment) => (
          <section key={enrollment.profileId} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{enrollment.exam.name}</h2>
              {enrollment.intendedCourse && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Intended course: {enrollment.intendedCourse}
                </span>
              )}
            </div>

            {enrollment.selectedSubjects.length === 0 ? (
              <Card padding="md">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No subjects selected for {enrollment.exam.name}.{' '}
                  <Link
                    to="/app/setup-exams"
                    className="font-semibold text-phosters-700 dark:text-phosters-400 hover:underline"
                  >
                    Add subjects
                  </Link>
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrollment.selectedSubjects.map((subject) => {
                  const courseKey = buildCourseTargetKey(enrollment.exam.id, subject.id);
                  const count = lessonCounts.get(courseKey) ?? 0;
                  const stats = statsMap.get(`course:${courseKey}`);

                  return (
                    <div
                      key={`${enrollment.exam.id}-${subject.id}`}
                      className="flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-phosters-600 dark:hover:border-phosters-500 transition-colors"
                    >
                      <Link
                        to={`/app/subjects/${enrollment.exam.slug}/${subject.slug}`}
                        className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-phosters-600 rounded-lg"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-phosters-700 dark:group-hover:text-phosters-400 transition-colors">
                            {subject.name}
                          </h3>
                          <ArrowRight
                            className="h-4 w-4 text-slate-400 group-hover:text-phosters-700 dark:group-hover:text-phosters-400 shrink-0 mt-1"
                            aria-hidden="true"
                          />
                        </div>
                        {subject.description && (
                          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {subject.description}
                          </p>
                        )}
                        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                          {count === 1 ? '1 published lesson' : `${count} published lessons`}
                        </p>
                      </Link>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <EngagementBar
                          compact
                          likesCount={stats?.likesCount ?? 0}
                          likedByMe={stats?.likedByMe ?? false}
                          viewsCount={stats?.viewsCount ?? 0}
                          liking={likingKey === `course:${courseKey}`}
                          onToggleLike={() =>
                            void handleToggleCourseLike(enrollment.exam.id, subject.id)
                          }
                          onShare={() =>
                            setSharePayload(
                              buildCourseSharePayload({
                                examName: enrollment.exam.name,
                                examSlug: enrollment.exam.slug,
                                subjectName: subject.name,
                                subjectSlug: subject.slug,
                              })
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <ShareDialog
        open={Boolean(sharePayload)}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
}
