import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Mail,
  RefreshCw,
  Search,
} from 'lucide-react';
import { fetchAdminStudentStatistics } from '../../services/adminStatsService';
import type {
  AdminStudentStatisticsPayload,
  AdminStudentUsageRow,
  StudentEngagementStatus,
} from '../../types/adminStats';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

type StatusFilter = StudentEngagementStatus | 'all' | 'inactive_7d';

const statusLabels: Record<StudentEngagementStatus, string> = {
  not_enrolled: 'Not enrolled',
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

const statusTextClasses: Record<StudentEngagementStatus, string> = {
  not_enrolled: 'text-slate-600',
  not_started: 'text-amber-700',
  in_progress: 'text-phosters-700',
  completed: 'text-phosters-800',
};

function formatShortDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Prevent CSV spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function getDefaultEmailDraft(filter: StatusFilter): { subject: string; body: string } {
  switch (filter) {
    case 'not_enrolled':
      return {
        subject: 'Complete your Phosters subject setup',
        body: 'Hello,\n\nWe noticed you registered on Phosters but have not selected your JAMB UTME or UI Post-UTME subjects yet. Sign in and choose your subjects to unlock your lessons and practice tests.\n\nBest regards,\nPhosters Team',
      };
    case 'not_started':
      return {
        subject: 'Start your first Phosters lesson today',
        body: 'Hello,\n\nYour Phosters subjects are set up, and your video lessons and practice tests are waiting for you. Sign in today to watch your first lesson and track your progress.\n\nBest regards,\nPhosters Team',
      };
    case 'inactive_7d':
      return {
        subject: 'Continue your JAMB & UI Post-UTME prep on Phosters',
        body: 'Hello,\n\nIt has been a few days since your last session on Phosters. Stay consistent with your preparation by completing your next lesson and practice test this week.\n\nBest regards,\nPhosters Team',
      };
    case 'in_progress':
      return {
        subject: 'Keep going — finish your remaining Phosters lessons',
        body: 'Hello,\n\nGreat work on the lessons you have completed so far on Phosters! Sign in to continue your remaining topics and attempt the practice tests.\n\nBest regards,\nPhosters Team',
      };
    default:
      return {
        subject: 'Phosters Tutorial Update & Study Reminder',
        body: 'Hello,\n\nHere is a quick reminder to sign in to Phosters for your latest lessons, downloadable notes, and practice tests.\n\nBest regards,\nPhosters Team',
      };
  }
}

export function AdminStudentsPage() {
  const [stats, setStats] = useState<AdminStudentStatisticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [examFilter, setExamFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState(getDefaultEmailDraft('all').subject);
  const [emailBody, setEmailBody] = useState(getDefaultEmailDraft('all').body);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'error'; message: string } | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminStudentStatistics();
    if (res.error || !res.data) {
      setError(res.error || 'Could not load student statistics.');
      setLoading(false);
      return;
    }
    setStats(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  function handleStatusFilterChange(next: StatusFilter) {
    setStatusFilter(next);
    setSelectedIds(new Set());
    setNotice(null);
    const draft = getDefaultEmailDraft(next);
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
  }

  const filteredStudents = useMemo(() => {
    if (!stats) return [];
    const q = searchQuery.trim().toLowerCase();

    return stats.students.filter((stu) => {
      if (statusFilter === 'inactive_7d') {
        if (stu.status === 'completed' || stu.daysSinceLastActivity < 7) return false;
      } else if (statusFilter !== 'all' && stu.status !== statusFilter) {
        return false;
      }

      if (examFilter !== 'all' && !stu.enrolledExamIds.includes(examFilter)) {
        return false;
      }

      if (subjectFilter !== 'all') {
        if (examFilter !== 'all') {
          if (!stu.enrolledCourseKeys.includes(`${examFilter}:${subjectFilter}`)) {
            return false;
          }
        } else if (!stu.enrolledSubjectIds.includes(subjectFilter)) {
          return false;
        }
      }

      if (q) {
        const haystack = [
          stu.fullName,
          stu.email ?? '',
          stu.phone ?? '',
          ...stu.enrollments.map((e) => `${e.examName} ${e.intendedCourse ?? ''} ${e.institution ?? ''}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [stats, searchQuery, statusFilter, examFilter, subjectFilter]);

  const targetStudentsForOutreach = useMemo(() => {
    if (selectedIds.size > 0) {
      return filteredStudents.filter((s) => selectedIds.has(s.studentId));
    }
    return filteredStudents;
  }, [filteredStudents, selectedIds]);

  const targetEmails = useMemo(() => {
    return Array.from(
      new Set(
        targetStudentsForOutreach
          .map((s) => s.email?.trim())
          .filter((e): e is string => Boolean(e))
      )
    );
  }, [targetStudentsForOutreach]);

  const mailtoUrl = useMemo(() => {
    if (targetEmails.length === 0) return null;
    const bcc = targetEmails.join(',');
    const url = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    return url.length <= 1800 ? url : null;
  }, [targetEmails, emailSubject, emailBody]);

  function toggleSelectAllFiltered() {
    const visibleIds = filteredStudents.map((s) => s.studentId);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  async function handleCopyEmails() {
    setNotice(null);
    if (targetEmails.length === 0) {
      setNotice({
        tone: 'info',
        message: stats?.contactsAvailable
          ? 'No student email addresses match your current selection.'
          : 'Run the 004_admin_student_statistics.sql migration in Supabase to load student emails.',
      });
      return;
    }

    const joined = targetEmails.join(', ');
    try {
      await navigator.clipboard.writeText(joined);
      setNotice({
        tone: 'success',
        message: `Copied ${targetEmails.length} student ${
          targetEmails.length === 1 ? 'email' : 'emails'
        } to clipboard. Paste into the BCC field of your email app.`,
      });
    } catch {
      setNotice({
        tone: 'error',
        message: 'Clipboard access was blocked by your browser. Use Export CSV to get the email list.',
      });
    }
  }

  function handleExportCsv() {
    setNotice(null);
    if (targetStudentsForOutreach.length === 0) {
      setNotice({ tone: 'info', message: 'No matching students to export.' });
      return;
    }

    const headers = [
      'Full Name',
      'Email',
      'Phone',
      'Status',
      'Examinations',
      'Selected Subjects',
      'Intended Course',
      'Target Institution',
      'Lessons Completed',
      'Available Published Lessons',
      'Lesson Completion %',
      'Test Attempts',
      'Average Test Score %',
      'Last Active',
      'Registered Date',
    ];

    const rows = targetStudentsForOutreach.map((s) => {
      const exams = s.enrollments.map((e) => e.examName).join('; ');
      const subjects = s.enrollments
        .map((e) => `${e.examName}: ${e.subjectNames.join(', ')}`)
        .join(' | ');
      const courses = s.enrollments
        .map((e) => e.intendedCourse)
        .filter(Boolean)
        .join('; ');
      const institutions = s.enrollments
        .map((e) => e.institution)
        .filter(Boolean)
        .join('; ');

      return [
        escapeCsvCell(s.fullName),
        escapeCsvCell(s.email ?? ''),
        escapeCsvCell(s.phone ?? ''),
        escapeCsvCell(statusLabels[s.status]),
        escapeCsvCell(exams),
        escapeCsvCell(subjects),
        escapeCsvCell(courses),
        escapeCsvCell(institutions),
        escapeCsvCell(s.completedLessonsCount),
        escapeCsvCell(s.availableLessonsCount),
        escapeCsvCell(`${s.completionPct}%`),
        escapeCsvCell(s.testAttemptsCount),
        escapeCsvCell(s.averageTestPct !== null ? `${s.averageTestPct}%` : ''),
        escapeCsvCell(formatShortDate(s.lastActivityAt)),
        escapeCsvCell(formatShortDate(s.registeredAt)),
      ].join(',');
    });

    const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phosters-student-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setNotice({
      tone: 'success',
      message: `Exported usage report for ${targetStudentsForOutreach.length} ${
        targetStudentsForOutreach.length === 1 ? 'student' : 'students'
      }.`,
    });
  }

  if (loading) return <LoadingState message="Loading student enrollment and usage statistics..." />;
  if (error || !stats) {
    return (
      <ErrorState
        message={error || 'Could not load student statistics.'}
        onRetry={() => void loadStats()}
      />
    );
  }

  const { summary, courseStats } = stats;
  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.has(s.studentId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Usage &amp; Progress
          </h1>
          <p className="text-sm text-slate-600">
            Track enrolled students across courses, spot inactive or not-started learners, and follow up by email.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => void loadStats()}
          className="self-start sm:self-auto"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Refresh Stats</span>
        </Button>
      </div>

      <AdminNav />

      {!stats.contactsAvailable && (
        <Alert tone="info" title="Unlock student email addresses & sign-in activity">
          Run{' '}
          <code className="font-mono text-xs bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
            supabase/migrations/004_admin_student_statistics.sql
          </code>{' '}
          in your Supabase SQL Editor to display student email addresses and last sign-in timestamps for follow-up emails.
        </Alert>
      )}

      {/* Top Usage Summary Strip */}
      <section aria-label="Student usage summary" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            { key: 'all', label: 'Total Students', value: summary.totalStudents },
            { key: 'not_enrolled', label: 'Not Enrolled', value: summary.notEnrolledCount },
            { key: 'not_started', label: 'Registered, Not Started', value: summary.notStartedCount },
            { key: 'in_progress', label: 'In Progress', value: summary.inProgressCount },
            { key: 'completed', label: 'Completed All', value: summary.completedCount },
            { key: 'inactive_7d', label: 'Inactive 7+ Days', value: summary.inactive7DaysCount },
          ] as Array<{ key: StatusFilter; label: string; value: number }>
        ).map((item) => {
          const isActive = statusFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleStatusFilterChange(item.key)}
              className={[
                'text-left rounded-xl border p-4 transition-colors cursor-pointer',
                isActive
                  ? 'bg-phosters-50 border-phosters-600'
                  : 'bg-white border-slate-200 hover:border-phosters-600',
              ].join(' ')}
            >
              <p className="text-xs font-medium text-slate-600">{item.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                {item.value}
              </p>
            </button>
          );
        })}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card padding="md" className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Average lesson completion (enrolled students)
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
              {summary.averageCompletionPct}%
            </p>
          </div>
          <div className="w-28 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-phosters-600"
              style={{ width: `${summary.averageCompletionPct}%` }}
            />
          </div>
        </Card>

        <Card padding="md" className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Practice tests submitted across platform
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
              {summary.totalTestAttempts}{' '}
              {summary.totalTestAttempts === 1 ? 'attempt' : 'attempts'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Average score</p>
            <p className="text-base font-bold text-phosters-700 tabular-nums">
              {summary.averageTestPct !== null ? `${summary.averageTestPct}%` : '—'}
            </p>
          </div>
        </Card>
      </div>

      {/* Course / Exam-Subject Enrollment Statistics */}
      <section aria-labelledby="course-stats-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="course-stats-heading" className="text-base font-bold text-slate-900">
              Enrollment &amp; progress by course
            </h2>
            <p className="text-xs text-slate-500">
              Select any examination and subject row to filter the student list below.
            </p>
          </div>
          {(examFilter !== 'all' || subjectFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setExamFilter('all');
                setSubjectFilter('all');
                setSelectedIds(new Set());
              }}
              className="text-xs font-semibold text-phosters-700 hover:underline cursor-pointer"
            >
              Clear course filter
            </button>
          )}
        </div>

        {courseStats.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-500">
              No students have enrolled in subjects or published lessons yet.
            </p>
          </Card>
        ) : (
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Course (Exam · Subject)</th>
                  <th className="px-4 py-3 text-right">Enrolled</th>
                  <th className="px-4 py-3 text-right">Published Lessons</th>
                  <th className="px-4 py-3 text-right">Not Started</th>
                  <th className="px-4 py-3 text-right">In Progress</th>
                  <th className="px-4 py-3 text-right">Completed</th>
                  <th className="px-4 py-3 text-right">Avg Progress</th>
                  <th className="px-4 py-3 text-right">Test Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {courseStats.map((course) => {
                  const isSelected =
                    examFilter === course.examId && subjectFilter === course.subjectId;
                  return (
                    <tr
                      key={course.courseKey}
                      onClick={() => {
                        if (isSelected) {
                          setExamFilter('all');
                          setSubjectFilter('all');
                        } else {
                          setExamFilter(course.examId);
                          setSubjectFilter(course.subjectId);
                        }
                        setSelectedIds(new Set());
                      }}
                      className={[
                        'cursor-pointer transition-colors',
                        isSelected ? 'bg-phosters-50' : 'hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {course.examName} · {course.subjectName}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                        {course.enrolledStudentsCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {course.publishedLessonsCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                        {course.notStartedCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-phosters-700">
                        {course.inProgressCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-phosters-800">
                        {course.completedCount}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                        {course.averageCompletionPct}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {course.averageTestPct !== null
                          ? `${course.averageTestPct}% (${course.testAttemptsCount})`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Filters & Email Follow-up Actions */}
      <section aria-labelledby="students-directory-heading" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h2 id="students-directory-heading" className="text-base font-bold text-slate-900">
            Students ({filteredStudents.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => void handleCopyEmails()}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>
                Copy Emails ({targetEmails.length})
              </span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => setShowComposer((prev) => !prev)}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>{showComposer ? 'Hide Email Draft' : 'Email Follow-up'}</span>
            </Button>

            <Button variant="secondary" onClick={handleExportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

        {showComposer && (
          <Card padding="lg" className="space-y-4 border-phosters-200 bg-phosters-50/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Follow-up email template ({targetEmails.length}{' '}
                  {targetEmails.length === 1 ? 'recipient' : 'recipients'} in BCC)
                </h3>
                <p className="text-xs text-slate-600">
                  Customize the message below, then open in your email app or copy addresses into BCC.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-800">
                  Email subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-800">
                  Message body
                </label>
                <textarea
                  rows={4}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {mailtoUrl ? (
                <a
                  href={mailtoUrl}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>Open Email App ({targetEmails.length} BCC)</span>
                </a>
              ) : (
                <p className="text-xs text-amber-800">
                  {targetEmails.length === 0
                    ? 'No student email addresses in the current selection.'
                    : 'Too many recipients for a single mailto link. Use "Copy Emails" and paste into BCC in Gmail or Outlook.'}
                </p>
              )}

              <Button variant="secondary" onClick={() => void handleCopyEmails()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Copy BCC Addresses</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Search & Filter Row */}
        <Card padding="sm" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search students"
              placeholder="Search name, email, course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900"
            />
          </div>

          <select
            aria-label="Filter by engagement status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilter)}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            <option value="all">All engagement statuses</option>
            <option value="not_enrolled">Not enrolled yet</option>
            <option value="not_started">Registered, not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed all lessons</option>
            <option value="inactive_7d">Inactive 7+ days (not completed)</option>
          </select>

          <select
            aria-label="Filter by examination"
            value={examFilter}
            onChange={(e) => {
              setExamFilter(e.target.value);
              setSelectedIds(new Set());
            }}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            <option value="all">All examinations</option>
            {stats.exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by subject"
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setSelectedIds(new Set());
            }}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            <option value="all">All subjects</option>
            {stats.subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </Card>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="No students match these filters"
            description="Try clearing the search term, status filter, or course selection to view all registered students."
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                />
                <span>
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : `Select all ${filteredStudents.length} shown`}
                </span>
              </label>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs font-semibold text-phosters-700 hover:underline cursor-pointer"
                >
                  Clear selection
                </button>
              )}
            </div>

            <ul className="divide-y divide-slate-100">
              {filteredStudents.map((stu: AdminStudentUsageRow) => {
                const isExpanded = expandedStudentId === stu.studentId;
                const isChecked = selectedIds.has(stu.studentId);

                return (
                  <li key={stu.studentId} className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          aria-label={`Select ${stu.fullName}`}
                          checked={isChecked}
                          onChange={() => toggleStudentSelection(stu.studentId)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600 shrink-0 cursor-pointer"
                        />

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="text-sm sm:text-base font-semibold text-slate-900">
                              {stu.fullName}
                            </p>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span
                              className={`text-xs font-semibold ${statusTextClasses[stu.status]}`}
                            >
                              {statusLabels[stu.status]}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                            <span>{stu.email || 'Email unavailable'}</span>
                            {stu.phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{stu.phone}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>Joined {formatShortDate(stu.registeredAt)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Last active{' '}
                              {stu.lastActivityAt
                                ? formatShortDate(stu.lastActivityAt)
                                : 'No activity yet'}
                            </span>
                          </div>

                          {stu.enrollments.length > 0 && (
                            <p className="text-xs text-slate-600">
                              {stu.enrollments
                                .map((e) => `${e.examName} (${e.subjectNames.join(', ')})`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pl-7 lg:pl-0 shrink-0">
                        <div className="min-w-[140px]">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600 tabular-nums">
                              {stu.completedLessonsCount}/{stu.availableLessonsCount} lessons
                            </span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {stu.completionPct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-phosters-600"
                              style={{ width: `${stu.completionPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-right tabular-nums min-w-[78px]">
                          <p className="text-slate-500">
                            {stu.testAttemptsCount}{' '}
                            {stu.testAttemptsCount === 1 ? 'test' : 'tests'}
                          </p>
                          <p className="font-semibold text-slate-900">
                            {stu.averageTestPct !== null ? `${stu.averageTestPct}% avg` : '—'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStudentId(isExpanded ? null : stu.studentId)
                          }
                          className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <span>Details</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="ml-7 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        {stu.enrollments.length === 0 ? (
                          <p className="text-xs text-slate-600">
                            This student has registered an account but has not completed exam &amp; subject setup yet.
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              {stu.enrollments.map((enr) => (
                                <div
                                  key={enr.examId}
                                  className="rounded-lg bg-white border border-slate-200 p-3 space-y-1"
                                >
                                  <p className="font-bold text-slate-900">{enr.examName}</p>
                                  {(enr.intendedCourse || enr.institution) && (
                                    <p className="text-slate-600">
                                      {[enr.intendedCourse, enr.institution]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                  <p className="text-slate-500">
                                    Subjects: {enr.subjectNames.join(', ')}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-bold text-slate-800">
                                Progress by subject
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {stu.subjectProgress.map((sp) => (
                                  <div
                                    key={`${sp.examId}:${sp.subjectId}`}
                                    className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-900 truncate">
                                        {sp.examName} · {sp.subjectName}
                                      </span>
                                      <span className="font-bold text-phosters-700 tabular-nums shrink-0">
                                        {sp.completionPct}%
                                      </span>
                                    </div>
                                    <p className="text-slate-500 tabular-nums">
                                      {sp.completedLessonsCount} completed · {sp.openedLessonsCount} opened · {sp.publishedLessonsCount} published
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
