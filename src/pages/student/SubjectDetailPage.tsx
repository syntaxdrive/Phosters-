import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Download,
  MessageSquare,
  MessageSquareOff,
  PlayCircle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { fetchStudentAnnouncements } from '../../services/announcementService';
import { fetchPublishedTopicTests } from '../../services/cbtService';
import {
  buildCourseTargetKey,
  fetchEngagementStats,
  recordContentView,
  toggleContentLike,
} from '../../services/engagementService';
import { fetchSubjectTopicsAndLessons } from '../../services/learningService';
import {
  downloadSubjectPackForOffline,
  removeOfflineSubject,
} from '../../services/offlineSyncService';
import type { AnnouncementFeedItem } from '../../types/announcement';
import type { EngagementTargetType, Exam, Subject, Test } from '../../types/database';
import type { EngagementStats, SharePayload } from '../../types/engagement';
import type { TopicWithLessons } from '../../types/learning';
import { EngagementBar } from '../../components/social/EngagementBar';
import { ShareDialog, buildCourseSharePayload } from '../../components/social/ShareDialog';
import { TopicCommentsSection } from '../../components/social/TopicCommentsSection';
import { AnnouncementFeed } from '../../components/student/AnnouncementFeed';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function SubjectDetailPage() {
  const { examSlug = '', subjectSlug = '' } = useParams();
  const { user } = useAuth();
  const {
    isOnline,
    downloadedSubjectKeys,
    downloadedLessonIds,
    refreshVault,
  } = useOfflineSync();

  const [exam, setExam] = useState<Exam | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<TopicWithLessons[]>([]);
  const [testsByTopic, setTestsByTopic] = useState<Map<string, Test[]>>(new Map());
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [statsMap, setStatsMap] = useState<Map<string, EngagementStats>>(new Map());
  const [likingKey, setLikingKey] = useState<string | null>(null);
  const [openCommentsTopicId, setOpenCommentsTopicId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [engagementError, setEngagementError] = useState<string | null>(null);
  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recordedCourseViewRef = useRef<string | null>(null);
  const recordedTopicViewsRef = useRef<Set<string>>(new Set());

  const loadSubject = useCallback(async () => {
    if (!user || !examSlug || !subjectSlug) return;
    setLoading(true);
    setError(null);
    setEngagementError(null);

    const res = await fetchSubjectTopicsAndLessons(user.id, examSlug, subjectSlug);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    const topicIds = res.topics.map((t) => t.id);
    const courseKey =
      res.exam && res.subject ? buildCourseTargetKey(res.exam.id, res.subject.id) : '';
    const engagementTargets =
      res.hasAccess && courseKey
        ? [
            { targetType: 'course' as const, targetKey: courseKey },
            ...topicIds.map((id) => ({ targetType: 'topic' as const, targetKey: id })),
          ]
        : [];

    const [testsRes, annRes, statsRes] = await Promise.all([
      fetchPublishedTopicTests(topicIds, user.id, { examSlug, subjectSlug }),
      res.hasAccess && res.exam && res.subject
        ? fetchStudentAnnouncements({
            examId: res.exam.id,
            subjectId: res.subject.id,
            userId: user.id,
          })
        : Promise.resolve({ announcements: [], error: null }),
      fetchEngagementStats(engagementTargets),
    ]);

    const nextStats = new Map(statsRes.statsMap);
    if (res.hasAccess && courseKey && recordedCourseViewRef.current !== courseKey) {
      recordedCourseViewRef.current = courseKey;
      const viewRes = await recordContentView('course', courseKey);
      if (viewRes.viewsCount !== null) {
        const existing = nextStats.get(`course:${courseKey}`);
        nextStats.set(`course:${courseKey}`, {
          targetType: 'course',
          targetKey: courseKey,
          likesCount: existing?.likesCount ?? 0,
          likedByMe: existing?.likedByMe ?? false,
          viewsCount: viewRes.viewsCount,
          commentsCount: existing?.commentsCount ?? 0,
        });
      }
    }

    setExam(res.exam);
    setSubject(res.subject);
    setTopics(res.topics);
    setTestsByTopic(testsRes.testsByTopic);
    setAnnouncements(annRes.announcements);
    setHasAccess(res.hasAccess);
    setStatsMap(nextStats);
    setLoading(false);
  }, [user, examSlug, subjectSlug]);

  useEffect(() => {
    void loadSubject();
  }, [loadSubject]);

  async function handleToggleLike(targetType: EngagementTargetType, targetKey: string) {
    const mapKey = `${targetType}:${targetKey}`;
    setEngagementError(null);
    setLikingKey(mapKey);
    const res = await toggleContentLike(targetType, targetKey);
    setLikingKey(null);

    if (res.error || res.liked === null || res.likesCount === null) {
      setEngagementError(res.error || 'Could not update like right now.');
      return;
    }

    setStatsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(mapKey);
      next.set(mapKey, {
        targetType,
        targetKey,
        likesCount: res.likesCount ?? 0,
        likedByMe: Boolean(res.liked),
        viewsCount: existing?.viewsCount ?? 0,
        commentsCount: existing?.commentsCount ?? 0,
      });
      return next;
    });
  }

  async function handleToggleTopicComments(topicId: string) {
    const isOpening = openCommentsTopicId !== topicId;
    setOpenCommentsTopicId(isOpening ? topicId : null);

    if (isOpening && !recordedTopicViewsRef.current.has(topicId)) {
      recordedTopicViewsRef.current.add(topicId);
      const viewRes = await recordContentView('topic', topicId);
      if (viewRes.viewsCount !== null) {
        setStatsMap((prev) => {
          const next = new Map(prev);
          const mapKey = `topic:${topicId}`;
          const existing = next.get(mapKey);
          next.set(mapKey, {
            targetType: 'topic',
            targetKey: topicId,
            likesCount: existing?.likesCount ?? 0,
            likedByMe: existing?.likedByMe ?? false,
            viewsCount: viewRes.viewsCount ?? existing?.viewsCount ?? 0,
            commentsCount: existing?.commentsCount ?? 0,
          });
          return next;
        });
      }
    }
  }

  async function handleSaveSubjectOffline() {
    if (!user || !examSlug || !subjectSlug) return;
    setOfflineNotice(null);
    setSavingOffline(true);
    setOfflineProgress('Preparing download...');

    const res = await downloadSubjectPackForOffline(
      user.id,
      examSlug,
      subjectSlug,
      (done, total) => {
        setOfflineProgress(`Saving ${done} of ${total}...`);
      }
    );

    setSavingOffline(false);
    setOfflineProgress(null);
    await refreshVault();

    if (res.error) {
      setOfflineNotice({ tone: 'error', message: res.error });
      return;
    }

    const summaryText = `Saved ${res.lessonsSaved} lessons, ${res.testsSaved} practice tests, and ${res.materialsSaved} study files for offline study.`;
    setOfflineNotice({
      tone: res.warnings.length > 0 ? 'info' : 'success',
      message:
        res.warnings.length > 0
          ? `${summaryText} Some files could not be cached: ${res.warnings[0]}`
          : summaryText,
    });
  }

  async function handleRemoveSubjectOffline() {
    if (!user || !examSlug || !subjectSlug) return;
    setOfflineNotice(null);
    await removeOfflineSubject(user.id, examSlug, subjectSlug);
    await refreshVault();
    setOfflineNotice({
      tone: 'info',
      message: 'Removed subject overview from your offline list.',
    });
  }

  const handleTopicCommentsCountChange = useCallback(
    (topicId: string, count: number) => {
      setStatsMap((prev) => {
        const next = new Map(prev);
        const mapKey = `topic:${topicId}`;
        const existing = next.get(mapKey);
        if (existing && existing.commentsCount === count) return prev;
        next.set(mapKey, {
          targetType: 'topic',
          targetKey: topicId,
          likesCount: existing?.likesCount ?? 0,
          likedByMe: existing?.likedByMe ?? false,
          viewsCount: existing?.viewsCount ?? 0,
          commentsCount: count,
        });
        return next;
      });
    },
    []
  );

  if (loading) {
    return <LoadingState message="Loading subject topics and lessons..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadSubject()} />;
  }

  if (!hasAccess) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <Link
          to="/app/subjects"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Subjects</span>
        </Link>
        <EmptyState
          title="Subject not in your current selection"
          description={`Add ${subject?.name ?? 'this subject'} under ${exam?.name ?? 'your examination profile'} to unlock its topics and lessons.`}
          action={
            <Link
              to="/app/setup-exams"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Update Subject Selection
            </Link>
          }
        />
      </div>
    );
  }

  const totalLessons = topics.reduce((sum, t) => sum + t.lessons.length, 0);
  const isSubjectSavedOffline = downloadedSubjectKeys.has(`${examSlug}:${subjectSlug}`);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          to="/app/subjects"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>All Subjects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-phosters-700 dark:text-phosters-400">
              <span>{exam?.name}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {subject?.name}
            </h1>
            {subject?.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                {subject.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
            <Button
              variant={isSubjectSavedOffline ? 'secondary' : 'primary'}
              loading={savingOffline}
              disabled={!isOnline && !isSubjectSavedOffline}
              onClick={() => void handleSaveSubjectOffline()}
            >
              {isSubjectSavedOffline ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
                  <span>{savingOffline && offlineProgress ? offlineProgress : 'Update Offline Pack'}</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{savingOffline && offlineProgress ? offlineProgress : 'Save Subject Offline'}</span>
                </>
              )}
            </Button>
            {isSubjectSavedOffline && !savingOffline && (
              <button
                type="button"
                aria-label="Remove subject from offline list"
                title="Remove subject from offline list"
                onClick={() => void handleRemoveSubjectOffline()}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {exam && subject && (
          <div className="pt-1">
            {(() => {
              const courseKey = buildCourseTargetKey(exam.id, subject.id);
              const courseStats = statsMap.get(`course:${courseKey}`);
              return (
                <EngagementBar
                  likesCount={courseStats?.likesCount ?? 0}
                  likedByMe={courseStats?.likedByMe ?? false}
                  viewsCount={courseStats?.viewsCount ?? 0}
                  liking={likingKey === `course:${courseKey}`}
                  onToggleLike={() => void handleToggleLike('course', courseKey)}
                  onShare={() =>
                    setSharePayload(
                      buildCourseSharePayload({
                        examName: exam.name,
                        examSlug: exam.slug,
                        subjectName: subject.name,
                        subjectSlug: subject.slug,
                      })
                    )
                  }
                  shareLabel="Share Course"
                />
              );
            })()}
          </div>
        )}
      </div>

      {offlineNotice && <Alert tone={offlineNotice.tone}>{offlineNotice.message}</Alert>}
      {engagementError && <Alert tone="error">{engagementError}</Alert>}

      {announcements.length > 0 && (
        <AnnouncementFeed
          items={announcements}
          heading={`${subject?.name ?? 'Subject'} announcements`}
          initialVisibleCount={3}
        />
      )}

      {topics.length === 0 ? (
        <EmptyState
          title="No published topics yet"
          description="Lessons for this subject have not been published yet. Check back soon as your tutors add content."
          action={
            <Link
              to="/app/subjects"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Back to Subjects
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {topics.map((topic, index) => {
            const topicStats = statsMap.get(`topic:${topic.id}`);
            const commentsCount = topicStats?.commentsCount ?? 0;
            const isCommentsOpen = openCommentsTopicId === topic.id;

            return (
              <Card key={topic.id} padding="none" className="overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {String(index + 1).padStart(2, '0')}. {topic.title}
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {topic.lessons.length}{' '}
                      {topic.lessons.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </div>
                  {topic.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">{topic.description}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <EngagementBar
                      compact
                      likesCount={topicStats?.likesCount ?? 0}
                      likedByMe={topicStats?.likedByMe ?? false}
                      viewsCount={topicStats?.viewsCount ?? 0}
                      commentsCount={commentsCount}
                      liking={likingKey === `topic:${topic.id}`}
                      onToggleLike={() => void handleToggleLike('topic', topic.id)}
                    />

                    <button
                      type="button"
                      onClick={() => void handleToggleTopicComments(topic.id)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {topic.comments_enabled ? (
                        <MessageSquare
                          className="h-3.5 w-3.5 text-phosters-700 dark:text-phosters-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <MessageSquareOff className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      )}
                      <span>
                        {isCommentsOpen
                          ? 'Hide Comments'
                          : topic.comments_enabled
                            ? `Comments (${commentsCount})`
                            : 'Comments Off'}
                      </span>
                    </button>
                  </div>
                </div>

                {topic.lessons.length === 0 && (testsByTopic.get(topic.id)?.length ?? 0) === 0 ? (
                  <div className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                    No published lessons in this topic yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topic.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          to={`/app/lessons/${lesson.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 min-h-[56px] hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-phosters-600"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {lesson.isCompleted ? (
                              <CheckCircle2
                                className="h-5 w-5 text-phosters-600 dark:text-phosters-400 shrink-0 mt-0.5"
                                aria-label="Completed"
                              />
                            ) : (
                              <PlayCircle
                                className="h-5 w-5 text-slate-400 shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {lesson.title}
                              </p>
                              {lesson.short_description && (
                                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {lesson.short_description}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>{topic.title}</span>
                                {lesson.tutor_name && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{lesson.tutor_name}</span>
                                  </>
                                )}
                                {lesson.isCompleted && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-phosters-700 dark:text-phosters-400">
                                      Completed
                                    </span>
                                  </>
                                )}
                                {downloadedLessonIds.has(lesson.id) && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                      Saved offline
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight
                            className="h-4 w-4 text-slate-400 shrink-0"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                    {(testsByTopic.get(topic.id) ?? []).map((tst) => (
                      <li key={tst.id} className="bg-phosters-50/40 dark:bg-phosters-900/20">
                        <Link
                          to={`/app/tests/${tst.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 min-h-[56px] hover:bg-phosters-50 dark:hover:bg-phosters-900/40 transition-colors"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <CheckSquare
                              className="h-5 w-5 text-phosters-700 dark:text-phosters-400 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {tst.title}
                              </p>
                              <p className="mt-0.5 text-xs text-phosters-700 dark:text-phosters-400 font-medium">
                                Topic practice test
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {isCommentsOpen && (
                  <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <TopicCommentsSection
                      topicId={topic.id}
                      topicTitle={topic.title}
                      commentsEnabled={topic.comments_enabled}
                      onCommentsCountChange={handleTopicCommentsCountChange}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ShareDialog
        open={Boolean(sharePayload)}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
}
