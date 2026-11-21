import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CheckSquare, ChevronRight, PlayCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchStudentAnnouncements } from '../../services/announcementService';
import { fetchPublishedTopicTests } from '../../services/cbtService';
import { fetchSubjectTopicsAndLessons } from '../../services/learningService';
import type { AnnouncementFeedItem } from '../../types/announcement';
import type { Exam, Subject, Test } from '../../types/database';
import type { TopicWithLessons } from '../../types/learning';
import { AnnouncementFeed } from '../../components/student/AnnouncementFeed';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function SubjectDetailPage() {
  const { examSlug = '', subjectSlug = '' } = useParams();
  const { user } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<TopicWithLessons[]>([]);
  const [testsByTopic, setTestsByTopic] = useState<Map<string, Test[]>>(new Map());
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubject = useCallback(async () => {
    if (!user || !examSlug || !subjectSlug) return;
    setLoading(true);
    setError(null);

    const res = await fetchSubjectTopicsAndLessons(user.id, examSlug, subjectSlug);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    const topicIds = res.topics.map((t) => t.id);
    const [testsRes, annRes] = await Promise.all([
      fetchPublishedTopicTests(topicIds),
      res.hasAccess && res.exam && res.subject
        ? fetchStudentAnnouncements({
            examId: res.exam.id,
            subjectId: res.subject.id,
          })
        : Promise.resolve({ announcements: [], error: null }),
    ]);

    setExam(res.exam);
    setSubject(res.subject);
    setTopics(res.topics);
    setTestsByTopic(testsRes.testsByTopic);
    setAnnouncements(annRes.announcements);
    setHasAccess(res.hasAccess);
    setLoading(false);
  }, [user, examSlug, subjectSlug]);

  useEffect(() => {
    void loadSubject();
  }, [loadSubject]);

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
      </div>

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
          {topics.map((topic, index) => (
            <Card key={topic.id} padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
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
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{topic.description}</p>
                )}
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
