import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  deleteExamSubject,
  fetchAllExams,
  fetchAllSubjects,
  fetchExamSubjects,
  saveExam,
  upsertExamSubject,
} from '../../services/adminService';
import { slugify } from '../../lib/slug';
import type { Exam, ExamSubject, Subject } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Exam form state
  const [editingExamId, setEditingExamId] = useState<string | undefined>(undefined);
  const [examName, setExamName] = useState('');
  const [examSlug, setExamSlug] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [examActive, setExamActive] = useState(true);
  const [savingExam, setSavingExam] = useState(false);

  // Add subject mapping state
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [addingMapping, setAddingMapping] = useState(false);

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [examsRes, subjectsRes] = await Promise.all([
      fetchAllExams(),
      fetchAllSubjects(),
    ]);

    if (examsRes.error || subjectsRes.error) {
      setError(examsRes.error || subjectsRes.error);
      setLoading(false);
      return;
    }

    setExams(examsRes.exams);
    setSubjects(subjectsRes.subjects);
    if (examsRes.exams.length > 0) {
      setSelectedExamId((prev) => prev || examsRes.exams[0].id);
    }
    setLoading(false);
  }, []);

  const loadMappings = useCallback(async (examId: string) => {
    if (!examId) {
      setExamSubjects([]);
      return;
    }
    const res = await fetchExamSubjects(examId);
    if (!res.error) {
      setExamSubjects(res.rows);
    }
  }, []);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (selectedExamId) {
      void loadMappings(selectedExamId);
    }
  }, [selectedExamId, loadMappings]);

  function startNewExam() {
    setEditingExamId(undefined);
    setExamName('');
    setExamSlug('');
    setExamDescription('');
    setExamActive(true);
    setActionError(null);
    setActionSuccess(null);
  }

  function startEditExam(exam: Exam) {
    setEditingExamId(exam.id);
    setExamName(exam.name);
    setExamSlug(exam.slug);
    setExamDescription(exam.description ?? '');
    setExamActive(exam.is_active);
    setActionError(null);
    setActionSuccess(null);
  }

  async function handleSaveExam(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (examName.trim().length < 2) {
      setActionError('Examination name must be at least 2 characters.');
      return;
    }

    const finalSlug = slugify(examSlug || examName);
    if (!finalSlug) {
      setActionError('Enter a valid slug for the examination.');
      return;
    }

    setSavingExam(true);
    const res = await saveExam({
      id: editingExamId,
      name: examName,
      slug: finalSlug,
      description: examDescription,
      is_active: examActive,
    });
    setSavingExam(false);

    if (res.error || !res.exam) {
      setActionError(res.error || 'Could not save examination.');
      return;
    }

    setActionSuccess(`Saved "${res.exam.name}".`);
    await loadBaseData();
    setSelectedExamId(res.exam.id);
    startNewExam();
  }

  async function handleAddSubjectToExam() {
    if (!selectedExamId || !subjectToAdd) return;
    setActionError(null);
    setActionSuccess(null);
    setAddingMapping(true);
    const res = await upsertExamSubject({
      exam_id: selectedExamId,
      subject_id: subjectToAdd,
      is_active: true,
      is_compulsory: false,
      display_order: examSubjects.length + 1,
    });
    setAddingMapping(false);

    if (res.error) {
      setActionError(res.error);
      return;
    }

    setSubjectToAdd('');
    await loadMappings(selectedExamId);
  }

  async function handleToggleMappingFlag(
    row: ExamSubject,
    field: 'is_active' | 'is_compulsory'
  ) {
    setActionError(null);
    const res = await upsertExamSubject({
      id: row.id,
      exam_id: row.exam_id,
      subject_id: row.subject_id,
      is_active: field === 'is_active' ? !row.is_active : row.is_active,
      is_compulsory: field === 'is_compulsory' ? !row.is_compulsory : row.is_compulsory,
      display_order: row.display_order,
    });
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadMappings(selectedExamId);
  }

  async function handleOrderChange(row: ExamSubject, nextOrder: number) {
    const res = await upsertExamSubject({
      id: row.id,
      exam_id: row.exam_id,
      subject_id: row.subject_id,
      is_active: row.is_active,
      is_compulsory: row.is_compulsory,
      display_order: nextOrder,
    });
    if (!res.error) {
      await loadMappings(selectedExamId);
    }
  }

  async function handleRemoveMapping(id: string) {
    setActionError(null);
    const res = await deleteExamSubject(id);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await loadMappings(selectedExamId);
  }

  if (loading) return <LoadingState message="Loading examinations..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadBaseData()} />;

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const mappedSubjectIds = new Set(examSubjects.map((es) => es.subject_id));
  const unmappedSubjects = subjects.filter((s) => !mappedSubjectIds.has(s.id));
  const selectedExam = exams.find((e) => e.id === selectedExamId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Examinations</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage examination profiles and configure allowed subjects separately for each examination.
        </p>
      </div>

      <AdminNav />

      {actionError && <Alert tone="error">{actionError}</Alert>}
      {actionSuccess && <Alert tone="success">{actionSuccess}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <Card padding="lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingExamId ? 'Edit examination' : 'Create examination'}
              </h2>
              {editingExamId && (
                <button
                  type="button"
                  onClick={startNewExam}
                  className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:underline cursor-pointer"
                >
                  + New instead
                </button>
              )}
            </div>

            <form onSubmit={handleSaveExam} className="mt-4 space-y-4">
              <Input
                label="Examination name"
                placeholder="e.g. JAMB UTME"
                value={examName}
                onChange={(e) => {
                  const val = e.target.value;
                  setExamName(val);
                  if (!editingExamId) {
                    setExamSlug(slugify(val));
                  }
                }}
                required
              />

              <Input
                label="URL slug"
                placeholder="e.g. jamb-utme"
                value={examSlug}
                onChange={(e) => setExamSlug(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  value={examDescription}
                  onChange={(e) => setExamDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
                  placeholder="Short description of this examination"
                />
              </div>

              <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={examActive}
                  onChange={(e) => setExamActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Active (visible to students)
                </span>
              </label>

              <Button type="submit" fullWidth loading={savingExam}>
                {editingExamId ? 'Save Changes' : 'Create Examination'}
              </Button>
            </form>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">All examinations</h3>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {exams.map((exam) => (
                <li
                  key={exam.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedExamId(exam.id)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <p
                      className={[
                        'text-sm font-semibold truncate',
                        selectedExamId === exam.id
                          ? 'text-phosters-700 dark:text-phosters-400'
                          : 'text-slate-900 dark:text-slate-100',
                      ].join(' ')}
                    >
                      {exam.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {exam.slug} · {exam.is_active ? 'Active' : 'Hidden'}
                    </p>
                  </button>
                  <Button variant="secondary" onClick={() => startEditExam(exam)}>
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card padding="lg" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Subject options {selectedExam ? `for ${selectedExam.name}` : ''}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure which subjects students can choose under this examination.
                </p>
              </div>
              {exams.length > 1 && (
                <select
                  aria-label="Select examination"
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {unmappedSubjects.length > 0 && selectedExamId && (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  aria-label="Choose subject to add"
                  value={subjectToAdd}
                  onChange={(e) => setSubjectToAdd(e.target.value)}
                  className="flex-1 min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select a subject to add...</option>
                  {unmappedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => void handleAddSubjectToExam()}
                  disabled={!subjectToAdd}
                  loading={addingMapping}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Subject</span>
                </Button>
              </div>
            )}

            {examSubjects.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                No subjects are assigned to this examination yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {examSubjects.map((row) => {
                  const subj = subjectMap.get(row.subject_id);
                  return (
                    <div
                      key={row.id}
                      className="p-3.5 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {subj?.name ?? 'Unknown subject'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Order {row.display_order} · {row.is_active ? 'Active' : 'Inactive'}
                          {row.is_compulsory ? ' · Compulsory' : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 mr-1">
                          <span>Order</span>
                          <input
                            type="number"
                            min={0}
                            value={row.display_order}
                            onChange={(e) =>
                              void handleOrderChange(row, Number(e.target.value) || 0)
                            }
                            className="w-16 min-h-[36px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => void handleToggleMappingFlag(row, 'is_compulsory')}
                          className={[
                            'min-h-[36px] px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer',
                            row.is_compulsory
                              ? 'bg-phosters-50 dark:bg-phosters-950/50 border-phosters-300 dark:border-phosters-700 text-phosters-800 dark:text-phosters-300'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                          ].join(' ')}
                        >
                          {row.is_compulsory ? 'Compulsory' : 'Optional'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleMappingFlag(row, 'is_active')}
                          className={[
                            'min-h-[36px] px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer',
                            row.is_active
                              ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400',
                          ].join(' ')}
                        >
                          {row.is_active ? 'Enabled' : 'Disabled'}
                        </button>

                        <button
                          type="button"
                          aria-label={`Remove ${subj?.name ?? 'subject'}`}
                          onClick={() => void handleRemoveMapping(row.id)}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
