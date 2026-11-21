import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  deleteLesson,
  fetchAdminLessonsList,
  updateLessonOrder,
  updateLessonPublished,
} from '../../services/adminService';
import type { AdminLessonListItem } from '../../types/admin';
import type { Exam, Subject, Topic } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function AdminLessonsPage() {
  const [lessons, setLessons] = useState<AdminLessonListItem[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [filterExamId, setFilterExamId] = useState('all');
  const [filterSubjectId, setFilterSubjectId] = useState('all');
  const [filterTopicId, setFilterTopicId] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminLessonsList();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setLessons(res.lessons);
    setExams(res.exams);
    setSubjects(res.subjects);
    setTopics(res.topics);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  async function handleTogglePublish(item: AdminLessonListItem) {
    setActionError(null);
    const res = await updateLessonPublished(item.id, !item.is_published);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadLessons();
  }

  async function handleNudgeOrder(item: AdminLessonListItem, delta: number) {
    setActionError(null);
    const nextOrder = Math.max(0, item.display_order + delta);
    const res = await updateLessonOrder(item.id, nextOrder);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadLessons();
  }

  async function handleDelete(lessonId: string) {
    setActionError(null);
    const res = await deleteLesson(lessonId);
    setConfirmDeleteId(null);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadLessons();
  }

  if (loading) return <LoadingState message="Loading lessons..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadLessons()} />;

  const availableFilterTopics = topics.filter((t) => {
    if (filterExamId !== 'all' && t.exam_id !== filterExamId) return false;
    if (filterSubjectId !== 'all' && t.subject_id !== filterSubjectId) return false;
    return true;
  });

  const filteredLessons = lessons.filter((l) => {
    if (filterExamId !== 'all' && l.examId !== filterExamId) return false;
    if (filterSubjectId !== 'all' && l.subjectId !== filterSubjectId) return false;
    if (filterTopicId !== 'all' && l.topic_id !== filterTopicId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Lessons</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Manage video lessons, study notes, ordering, and publishing status.
          </p>
        </div>

        <Link
          to="/admin/lessons/new"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create Lesson</span>
        </Link>
      </div>

      <AdminNav />

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <Card padding="sm" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          aria-label="Filter by examination"
          value={filterExamId}
          onChange={(e) => {
            setFilterExamId(e.target.value);
            setFilterTopicId('all');
          }}
          className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
        >
          <option value="all">All examinations</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by subject"
          value={filterSubjectId}
          onChange={(e) => {
            setFilterSubjectId(e.target.value);
            setFilterTopicId('all');
          }}
          className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by topic"
          value={filterTopicId}
          onChange={(e) => setFilterTopicId(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
        >
          <option value="all">All topics</option>
          {availableFilterTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </Card>

      {filteredLessons.length === 0 ? (
        <EmptyState
          title="No lessons found"
          description="Create a topic first if needed, then add your first lesson with a YouTube video link and downloadable notes."
          action={
            <Link
              to="/admin/lessons/new"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Create Lesson
            </Link>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLessons.map((lesson) => {
              const isConfirming = confirmDeleteId === lesson.id;
              return (
                <li key={lesson.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {lesson.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{lesson.examName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lesson.subjectName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lesson.topicTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">Order {lesson.display_order}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            lesson.is_published
                              ? 'font-medium text-phosters-700 dark:text-phosters-400'
                              : 'font-medium text-amber-700 dark:text-amber-400'
                          }
                        >
                          {lesson.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Move ${lesson.title} earlier`}
                        onClick={() => void handleNudgeOrder(lesson, -1)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${lesson.title} later`}
                        onClick={() => void handleNudgeOrder(lesson, 1)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <Button
                        variant="secondary"
                        onClick={() => void handleTogglePublish(lesson)}
                      >
                        {lesson.is_published ? 'Unpublish' : 'Publish'}
                      </Button>

                      <Link
                        to={`/admin/lessons/${lesson.id}`}
                        className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        Edit
                      </Link>

                      <button
                        type="button"
                        aria-label={`Delete ${lesson.title}`}
                        onClick={() =>
                          setConfirmDeleteId(isConfirming ? null : lesson.id)
                        }
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isConfirming && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/70 p-3 text-xs text-red-900 dark:text-red-200">
                      <span>Delete this lesson permanently?</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => void handleDelete(lesson.id)}
                        >
                          Delete Lesson
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
