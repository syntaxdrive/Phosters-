import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import {
  deleteTopic,
  fetchAllExams,
  fetchAllSubjects,
  fetchAllTopics,
  saveTopic,
  updateTopicPublished,
} from '../../services/adminService';
import type { Exam, Subject, Topic } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function AdminTopicsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [filterExamId, setFilterExamId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [examsRes, subjectsRes, topicsRes] = await Promise.all([
      fetchAllExams(),
      fetchAllSubjects(),
      fetchAllTopics(),
    ]);

    const err = examsRes.error || subjectsRes.error || topicsRes.error;
    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    setExams(examsRes.exams);
    setSubjects(subjectsRes.subjects);
    setTopics(topicsRes.topics);

    if (examsRes.exams.length > 0) {
      setExamId((prev) => prev || examsRes.exams[0].id);
    }
    if (subjectsRes.subjects.length > 0) {
      setSubjectId((prev) => prev || subjectsRes.subjects[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setEditingId(undefined);
    setTitle('');
    setDescription('');
    setDisplayOrder(topics.length + 1);
    setIsPublished(false);
    setFormError(null);
  }

  function startEdit(topic: Topic) {
    setEditingId(topic.id);
    setExamId(topic.exam_id);
    setSubjectId(topic.subject_id);
    setTitle(topic.title);
    setDescription(topic.description ?? '');
    setDisplayOrder(topic.display_order);
    setIsPublished(topic.is_published);
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!examId || !subjectId) {
      setFormError('Select both an examination and a subject.');
      return;
    }
    if (title.trim().length < 2) {
      setFormError('Topic title must be at least 2 characters.');
      return;
    }

    setSaving(true);
    const res = await saveTopic({
      id: editingId,
      exam_id: examId,
      subject_id: subjectId,
      title,
      description,
      display_order: displayOrder,
      is_published: isPublished,
    });
    setSaving(false);

    if (res.error || !res.topic) {
      setFormError(res.error || 'Could not save topic.');
      return;
    }

    setFormSuccess(`Saved topic "${res.topic.title}".`);
    resetForm();
    await loadData();
  }

  async function handleTogglePublish(topic: Topic) {
    setFormError(null);
    const res = await updateTopicPublished(topic.id, !topic.is_published);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    await loadData();
  }

  async function handleDelete(topicId: string) {
    setFormError(null);
    const res = await deleteTopic(topicId);
    setConfirmDeleteId(null);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    if (editingId === topicId) resetForm();
    await loadData();
  }

  if (loading) return <LoadingState message="Loading topics..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadData()} />;

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const filteredTopics = topics.filter((t) => {
    if (filterExamId !== 'all' && t.exam_id !== filterExamId) return false;
    if (filterSubjectId !== 'all' && t.subject_id !== filterSubjectId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Topics</h1>
        <p className="text-sm text-slate-600">
          Organise each examination and subject into ordered syllabus topics.
        </p>
      </div>

      <AdminNav />

      {formError && <Alert tone="error">{formError}</Alert>}
      {formSuccess && <Alert tone="success">{formSuccess}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <Card padding="lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit topic' : 'Create topic'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-phosters-700 hover:underline cursor-pointer"
                >
                  + New instead
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Examination
                </label>
                <select
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  required
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Subject
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  required
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Topic title"
                placeholder="e.g. Comprehension & Summary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600"
                />
              </div>

              <Input
                label="Display order"
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
              />

              <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                />
                <span className="text-sm font-medium text-slate-800">
                  Published (visible to enrolled students)
                </span>
              </label>

              <Button type="submit" fullWidth loading={saving}>
                {editingId ? 'Save Changes' : 'Create Topic'}
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <Card padding="sm" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              aria-label="Filter by examination"
              value={filterExamId}
              onChange={(e) => setFilterExamId(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
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
              onChange={(e) => setFilterSubjectId(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Topics list</h2>
              <span className="text-xs text-slate-500 tabular-nums">
                {filteredTopics.length} shown
              </span>
            </div>

            {filteredTopics.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No topics match the selected filters yet.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredTopics.map((topic) => {
                  const examName = examMap.get(topic.exam_id)?.name ?? 'Exam';
                  const subjectName = subjectMap.get(topic.subject_id)?.name ?? 'Subject';
                  const isConfirming = confirmDeleteId === topic.id;

                  return (
                    <li key={topic.id} className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {topic.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {examName} · {subjectName} · Order {topic.display_order} ·{' '}
                            <span
                              className={
                                topic.is_published
                                  ? 'font-medium text-phosters-700'
                                  : 'font-medium text-amber-700'
                              }
                            >
                              {topic.is_published ? 'Published' : 'Draft'}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            onClick={() => void handleTogglePublish(topic)}
                          >
                            {topic.is_published ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button variant="secondary" onClick={() => startEdit(topic)}>
                            Edit
                          </Button>
                          <button
                            type="button"
                            aria-label={`Delete ${topic.title}`}
                            onClick={() =>
                              setConfirmDeleteId(isConfirming ? null : topic.id)
                            }
                            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {isConfirming && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900">
                          <span>Delete this topic and all lessons inside it?</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => void handleDelete(topic.id)}
                            >
                              Delete Topic
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
