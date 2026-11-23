import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  CheckSquare,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Link2,
  Loader2,
  ScanText,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAdminLessonsList } from '../../services/adminService';
import {
  bulkApproveBankQuestions,
  convertDocumentFile,
  deleteBankQuestion,
  estimateClientQuestionCount,
  fetchQuestionBankItems,
  importPublicDriveFile,
  listPublicDriveFolder,
  ocrPdfFile,
  parseQuestionChunkText,
  saveParsedQuestionsToBank,
  splitTextClientChunks,
  updateBankQuestionStatus,
} from '../../services/questionBankService';
import type { Exam, Subject, Topic } from '../../types/database';
import type {
  DocumentSourceFormat,
  DriveFolderEntry,
  ParsedBankQuestionDraft,
  QuestionBankItem,
  QuestionBankStatus,
  QuestionDifficulty,
} from '../../types/questionBank';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

function localKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.csv,.tsv,.md,.html,.htm,.rtf,.json';

export function AdminQuestionBankPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parseAbortRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState<'ingest' | 'library'>('ingest');

  // Shared taxonomy data
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  // Target metadata for ingestion
  const [targetExamId, setTargetExamId] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [targetTopicId, setTargetTopicId] = useState('');
  const [defaultYearInput, setDefaultYearInput] = useState('');
  const [generateMissingExplanations, setGenerateMissingExplanations] = useState(true);

  // Conversion & OCR state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceFileName, setSourceFileName] = useState('pasted-questions.txt');
  const [sourceFormat, setSourceFormat] = useState<DocumentSourceFormat>('paste');
  const [pageCount, setPageCount] = useState(0);
  const [convertedText, setConvertedText] = useState('');
  const [isScannedLikely, setIsScannedLikely] = useState(false);
  const [converting, setConverting] = useState(false);
  const [runningOcr, setRunningOcr] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestNotice, setIngestNotice] = useState<string | null>(null);

  // Public Google Drive folder / file import
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [driveLoadingList, setDriveLoadingList] = useState(false);
  const [driveFolderTitle, setDriveFolderTitle] = useState('');
  const [driveEntries, setDriveEntries] = useState<DriveFolderEntry[]>([]);
  const [driveImportingId, setDriveImportingId] = useState<string | null>(null);

  // AI chunked parsing & review queue
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ParsedBankQuestionDraft[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);

  // Bank library tab state
  const [libraryItems, setLibraryItems] = useState<QuestionBankItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [filterExamId, setFilterExamId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterYearInput, setFilterYearInput] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<QuestionDifficulty | ''>('');
  const [filterStatus, setFilterStatus] = useState<QuestionBankStatus | ''>('');
  const [filterDiagram, setFilterDiagram] = useState<'all' | 'text_only' | 'needs_diagram'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [libraryBusyId, setLibraryBusyId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const loadTaxonomy = useCallback(async () => {
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    const res = await fetchAdminLessonsList();
    if (res.error) {
      setTaxonomyError(res.error);
      setTaxonomyLoading(false);
      return;
    }
    setExams(res.exams);
    setSubjects(res.subjects);
    setTopics(res.topics);
    setTargetExamId((prev) => prev || res.exams[0]?.id || '');
    setTargetSubjectId((prev) => prev || res.subjects[0]?.id || '');
    setTaxonomyLoading(false);
  }, []);

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    const parsedYear = Number(filterYearInput.trim());
    const validYear =
      Number.isFinite(parsedYear) && parsedYear >= 1978 && parsedYear <= 2035
        ? parsedYear
        : undefined;

    const res = await fetchQuestionBankItems({
      examId: filterExamId || undefined,
      subjectId: filterSubjectId || undefined,
      examYear: validYear,
      difficulty: filterDifficulty,
      status: filterStatus,
      diagramFilter: filterDiagram,
      search: searchQuery,
      limit: 200,
    });

    if (res.migrationMissing) {
      setMigrationMissing(true);
    }
    if (res.error) {
      setLibraryError(res.error);
      setLibraryLoading(false);
      return;
    }

    setLibraryItems(res.items);
    setSelectedBankIds(new Set());
    setLibraryLoading(false);
  }, [
    filterExamId,
    filterSubjectId,
    filterYearInput,
    filterDifficulty,
    filterStatus,
    filterDiagram,
    searchQuery,
  ]);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  useEffect(() => {
    if (activeTab === 'library') {
      void loadLibrary();
    }
  }, [activeTab, loadLibrary]);

  useEffect(() => {
    return () => {
      parseAbortRef.current?.abort();
    };
  }, []);

  const matchingTopics = useMemo(
    () => topics.filter((t) => t.exam_id === targetExamId && t.subject_id === targetSubjectId),
    [topics, targetExamId, targetSubjectId]
  );

  const examNameById = useMemo(
    () => new Map(exams.map((ex) => [ex.id, ex.name])),
    [exams]
  );
  const subjectNameById = useMemo(
    () => new Map(subjects.map((sub) => [sub.id, sub.name])),
    [subjects]
  );

  const liveChunks = useMemo(() => splitTextClientChunks(convertedText), [convertedText]);
  const estimatedQuestions = useMemo(
    () => estimateClientQuestionCount(convertedText),
    [convertedText]
  );

  const queueStats = useMemo(() => {
    let included = 0;
    let keyIssues = 0;
    let diagrams = 0;
    for (const q of reviewQueue) {
      if (q.include) included += 1;
      if (q.hasKeyIssue) keyIssues += 1;
      if (q.needsDiagram) diagrams += 1;
    }
    return { total: reviewQueue.length, included, keyIssues, diagrams };
  }, [reviewQueue]);

  async function processUploadedFile(file: File) {
    setIngestError(null);
    setIngestNotice(null);
    setSelectedFile(file);
    setSourceFileName(file.name);
    setConverting(true);

    const res = await convertDocumentFile(file);
    setConverting(false);

    if (res.error || !res.result) {
      setIngestError(res.error || 'Could not convert this file.');
      return;
    }

    setSourceFormat(res.result.sourceFormat);
    setPageCount(res.result.pageCount);
    setConvertedText(res.result.convertedText);
    setIsScannedLikely(res.result.isScannedLikely);

    if (res.result.isScannedLikely) {
      setIngestNotice(
        `Extracted ${res.result.charCount.toLocaleString()} characters across ${res.result.pageCount} PDF pages. This PDF appears scanned or image-based — run Gemini OCR below to extract text.`
      );
    } else {
      setIngestNotice(
        `Converted ${file.name} (${res.result.sourceFormat.toUpperCase()}) into ${res.result.charCount.toLocaleString()} characters of clean .txt (~${res.result.estimatedQuestions} questions, ${res.result.chunks.length} AI batch chunks).`
      );
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processUploadedFile(file);
    }
  }

  async function handleRunOcr() {
    if (!selectedFile) return;
    setIngestError(null);
    setIngestNotice(null);
    setRunningOcr(true);

    const res = await ocrPdfFile(selectedFile);
    setRunningOcr(false);

    if (res.error || !res.result) {
      setIngestError(res.error || 'OCR could not read text from this PDF.');
      return;
    }

    setConvertedText(res.result.convertedText);
    setIsScannedLikely(false);
    setIngestNotice(
      `Gemini OCR extracted ${res.result.charCount.toLocaleString()} characters (~${res.result.estimatedQuestions} questions, ${res.result.chunks.length} batch chunks).`
    );
  }

  function tryMatchSubjectFromTitle(title: string) {
    const lower = title.toLowerCase();
    const matched = subjects.find((s) => {
      const subLower = s.name.toLowerCase();
      if (lower.includes(subLower)) return true;
      if (subLower.includes('english') && (lower.includes('english') || lower.includes('use of eng'))) {
        return true;
      }
      if (subLower.includes('literature') && lower.includes('literature')) {
        return true;
      }
      if (subLower.includes('account') && lower.includes('account')) {
        return true;
      }
      if ((subLower.includes('christian') || subLower.includes('crk') || subLower.includes('crs')) && (lower.includes('crk') || lower.includes('crs'))) {
        return true;
      }
      return false;
    });
    if (matched) {
      setTargetSubjectId(matched.id);
      setTargetTopicId('');
    }
  }

  async function handleBrowseDriveLink(overrideUrlOrId?: string) {
    const target = (overrideUrlOrId ?? driveUrlInput).trim();
    if (!target) {
      setIngestError('Paste a public Google Drive folder or file link first.');
      return;
    }

    setIngestError(null);
    setIngestNotice(null);
    setDriveLoadingList(true);

    const res = await listPublicDriveFolder(target);
    setDriveLoadingList(false);

    if (res.error || !res.result) {
      setIngestError(res.error || 'Could not list Google Drive link.');
      return;
    }

    setDriveFolderTitle(res.result.folderTitle);
    setDriveEntries(res.result.entries);
    setIngestNotice(
      `Found ${res.result.entries.length} item${res.result.entries.length === 1 ? '' : 's'} in "${res.result.folderTitle}". Click any file to convert it into plain .txt.`
    );
  }

  async function handleImportDriveEntry(entry: DriveFolderEntry) {
    if (entry.isFolder) {
      const folderUrl = `https://drive.google.com/drive/folders/${entry.id}`;
      setDriveUrlInput(folderUrl);
      await handleBrowseDriveLink(folderUrl);
      return;
    }

    setIngestError(null);
    setIngestNotice(null);
    setDriveImportingId(entry.id);

    tryMatchSubjectFromTitle(entry.title);
    const res = await importPublicDriveFile(entry.id, entry.title);
    setDriveImportingId(null);

    if (res.error || !res.result) {
      setIngestError(res.error || `Could not import "${entry.title}" from Google Drive.`);
      return;
    }

    setSelectedFile(null);
    setSourceFileName(res.result.fileName);
    setSourceFormat(res.result.sourceFormat);
    setPageCount(res.result.pageCount);
    setConvertedText(res.result.convertedText);
    setIsScannedLikely(res.result.isScannedLikely);

    const hasAnswerKeys = /ANSWER(?:S)?\s*KEY(?:S)?/i.test(res.result.convertedText);
    if (res.result.isScannedLikely) {
      setIngestNotice(
        `Imported "${entry.title}" (${res.result.pageCount} pages), but text density is low — download and upload via Gemini OCR if it is scanned.`
      );
    } else if (!hasAnswerKeys) {
      setIngestNotice(
        `Imported "${entry.title}" (${res.result.pageCount} pages, ~${res.result.estimatedQuestions} est. questions). Note: No Answer Key section was detected inside this PDF, so verify correct options in the Review Queue before publishing.`
      );
    } else {
      setIngestNotice(
        `Imported "${entry.title}" (${res.result.pageCount} pages, ~${res.result.estimatedQuestions} est. questions, ${res.result.chunks.length} answer-key-linked chunks ready for AI parsing).`
      );
    }
  }

  function handleDownloadTxt() {
    if (!convertedText.trim()) return;
    const baseName = sourceFileName.replace(/\.[^.]+$/, '') || 'past-questions';
    const blob = new Blob([convertedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}-converted.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleParseWithAi(appendMode: boolean) {
    if (!convertedText.trim()) {
      setIngestError('Upload a file or paste past-question text before parsing.');
      return;
    }

    const chunks = splitTextClientChunks(convertedText);
    if (chunks.length === 0) {
      setIngestError('No parseable text chunks were found.');
      return;
    }

    setIngestError(null);
    setIngestNotice(null);
    setParsing(true);
    setParseProgress({ current: 0, total: chunks.length });

    const abortController = new AbortController();
    parseAbortRef.current = abortController;

    const examHint = examNameById.get(targetExamId) ?? 'JAMB UTME';
    const subjectHint = subjectNameById.get(targetSubjectId) ?? '';
    const parsedYear = Number(defaultYearInput.trim());
    const validYear =
      Number.isFinite(parsedYear) && parsedYear >= 1978 && parsedYear <= 2035
        ? parsedYear
        : null;

    if (!appendMode) {
      setReviewQueue([]);
    }

    let extractedCount = 0;

    for (let idx = 0; idx < chunks.length; idx++) {
      if (abortController.signal.aborted) break;
      setParseProgress({ current: idx + 1, total: chunks.length });

      const res = await parseQuestionChunkText(
        {
          chunkText: chunks[idx],
          examHint,
          subjectHint,
          defaultYear: validYear,
          generateMissingExplanations,
        },
        abortController.signal
      );

      if (res.error || !res.result) {
        setIngestError(
          `Stopped at chunk ${idx + 1} of ${chunks.length}: ${res.error || 'AI parsing failed.'}`
        );
        break;
      }

      const mapped: ParsedBankQuestionDraft[] = res.result.questions.map((item) => ({
        ...item,
        localKey: localKey(),
        include: true,
        options: item.options.map((opt) => ({
          ...opt,
          localKey: localKey(),
        })),
      }));

      extractedCount += mapped.length;
      setReviewQueue((prev) => [...prev, ...mapped]);
    }

    setParsing(false);
    setParseProgress(null);
    parseAbortRef.current = null;

    if (extractedCount > 0) {
      setIngestNotice(
        `AI extracted ${extractedCount} structured questions into the Review Queue below.`
      );
    }
  }

  function handleStopParsing() {
    parseAbortRef.current?.abort();
  }

  async function handleSaveBatch(targetStatus: QuestionBankStatus) {
    if (!user) return;
    setIngestError(null);
    setIngestNotice(null);
    setSavingBatch(true);

    const parsedYear = Number(defaultYearInput.trim());
    const validYear =
      Number.isFinite(parsedYear) && parsedYear >= 1978 && parsedYear <= 2035
        ? parsedYear
        : null;

    const res = await saveParsedQuestionsToBank({
      fileName: sourceFileName,
      sourceFormat,
      rawCharCount: convertedText.length,
      examId: targetExamId || null,
      subjectId: targetSubjectId || null,
      topicId: targetTopicId || null,
      defaultYear: validYear,
      targetStatus,
      userId: user.id,
      questions: reviewQueue,
    });

    setSavingBatch(false);
    if (res.migrationMissing) {
      setMigrationMissing(true);
    }
    if (res.error) {
      setIngestError(res.error);
      return;
    }

    setReviewQueue((prev) => prev.filter((q) => !q.include));
    setIngestNotice(
      `Saved ${res.insertedCount} ${targetStatus === 'approved' ? 'approved' : 'draft'} questions to the Question Bank.`
    );
  }

  function updateDraftQuestion(qKey: string, patch: Partial<ParsedBankQuestionDraft>) {
    setReviewQueue((prev) =>
      prev.map((q) => (q.localKey === qKey ? { ...q, ...patch } : q))
    );
  }

  function updateDraftOption(qKey: string, optKey: string, optionText: string) {
    setReviewQueue((prev) =>
      prev.map((q) => {
        if (q.localKey !== qKey) return q;
        return {
          ...q,
          options: q.options.map((o) => (o.localKey === optKey ? { ...o, optionText } : o)),
        };
      })
    );
  }

  function setDraftCorrectOption(qKey: string, optKey: string) {
    setReviewQueue((prev) =>
      prev.map((q) => {
        if (q.localKey !== qKey) return q;
        return {
          ...q,
          hasKeyIssue: false,
          options: q.options.map((o) => ({ ...o, isCorrect: o.localKey === optKey })),
        };
      })
    );
  }

  async function handleToggleLibraryStatus(item: QuestionBankItem) {
    setLibraryBusyId(item.id);
    setLibraryError(null);
    const nextStatus: QuestionBankStatus = item.status === 'approved' ? 'draft' : 'approved';
    const res = await updateBankQuestionStatus(item.id, nextStatus);
    setLibraryBusyId(null);
    if (res.error) {
      setLibraryError(res.error);
      return;
    }
    setLibraryItems((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: nextStatus } : q))
    );
  }

  async function handleDeleteLibraryItem(id: string) {
    setLibraryBusyId(id);
    setLibraryError(null);
    const res = await deleteBankQuestion(id);
    setLibraryBusyId(null);
    if (res.error) {
      setLibraryError(res.error);
      return;
    }
    setLibraryItems((prev) => prev.filter((q) => q.id !== id));
    setSelectedBankIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleBulkApproveSelected() {
    const ids = Array.from(selectedBankIds);
    if (ids.length === 0) return;
    setBulkApproving(true);
    setLibraryError(null);
    const res = await bulkApproveBankQuestions(ids);
    setBulkApproving(false);
    if (res.error) {
      setLibraryError(res.error);
      return;
    }
    setLibraryItems((prev) =>
      prev.map((q) => (selectedBankIds.has(q.id) ? { ...q, status: 'approved' } : q))
    );
    setLibraryNotice(`Approved ${ids.length} selected questions for Tutor CBT builders.`);
    setSelectedBankIds(new Set());
  }

  if (taxonomyLoading) {
    return <LoadingState message="Loading examinations and subjects..." />;
  }

  if (taxonomyError) {
    return <ErrorState message={taxonomyError} onRetry={() => void loadTaxonomy()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Super Admin Question Bank
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Upload PDF, DOCX, CSV, HTML, RTF, or TXT past-question packs, convert to clean plain{' '}
            <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
              .txt
            </code>
            , and parse verified MCQs for Tutors.
          </p>
        </div>

        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ingest')}
            className={[
              'min-h-[40px] px-4 py-1.5 rounded-md text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap',
              activeTab === 'ingest'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
            ].join(' ')}
          >
            Upload &amp; Convert
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={[
              'min-h-[40px] px-4 py-1.5 rounded-md text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap',
              activeTab === 'library'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
            ].join(' ')}
          >
            Bank Library
          </button>
        </div>
      </div>

      <AdminNav />

      {migrationMissing && (
        <Alert tone="warning" title="One-time database migration required">
          Run{' '}
          <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
            supabase/migrations/011_question_bank_schema.sql
          </code>{' '}
          in your Supabase SQL Editor to create{' '}
          <code className="font-mono text-xs">question_bank</code>,{' '}
          <code className="font-mono text-xs">question_bank_options</code>, and{' '}
          <code className="font-mono text-xs">question_bank_batches</code>.
        </Alert>
      )}

      {activeTab === 'ingest' ? (
        <div className="space-y-6">
          {ingestError && <Alert tone="error">{ingestError}</Alert>}
          {ingestNotice && <Alert tone="success">{ingestNotice}</Alert>}

          {/* Step 1: Target Exam / Subject / Topic */}
          <Card padding="lg" className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              1. Target classification
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Examination
                </label>
                <select
                  value={targetExamId}
                  onChange={(e) => {
                    setTargetExamId(e.target.value);
                    setTargetTopicId('');
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Any / General</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Subject
                </label>
                <select
                  value={targetSubjectId}
                  onChange={(e) => {
                    setTargetSubjectId(e.target.value);
                    setTargetTopicId('');
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Any / Mixed</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Topic (optional)
                </label>
                <select
                  value={targetTopicId}
                  onChange={(e) => setTargetTopicId(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Unassigned / Mixed topics</option>
                  {matchingTopics.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.title}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Default Year (optional)"
                type="number"
                min={1978}
                max={2035}
                placeholder="e.g. 2019"
                value={defaultYearInput}
                onChange={(e) => setDefaultYearInput(e.target.value)}
              />
            </div>

            <label className="inline-flex items-center gap-2.5 min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={generateMissingExplanations}
                onChange={(e) => setGenerateMissingExplanations(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Auto-generate concise explanations when the source past question does not include one
              </span>
            </label>
          </Card>

          {/* Step 2: Upload & Convert to .txt */}
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  2. Upload document &amp; convert to clean .txt
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Supported: PDF, DOCX, TXT, CSV/TSV, Markdown, HTML, RTF, JSON (max 16 MB). Scanned PDFs can use Gemini OCR.
                </p>
              </div>
              {convertedText.trim() && (
                <Button type="button" variant="secondary" onClick={handleDownloadTxt}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Download Converted .txt</span>
                </Button>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={[
                'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                isDragging
                  ? 'border-phosters-600 bg-phosters-50/60 dark:bg-phosters-950/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50',
              ].join(' ')}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void processUploadedFile(file);
                  e.target.value = '';
                }}
              />
              <Upload
                className="h-7 w-7 mx-auto text-phosters-600 dark:text-phosters-400"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Drop a past-question document here, or choose a file
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Cleanly converts PDFs, Word (.docx), HTML, RTF, CSV, and JSON into structured plain text ready for AI parsing.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={converting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span>{converting ? 'Converting Document...' : 'Select Document File'}</span>
                </Button>
                {selectedFile && isScannedLikely && (
                  <Button
                    type="button"
                    variant="primary"
                    loading={runningOcr}
                    onClick={() => void handleRunOcr()}
                  >
                    <ScanText className="h-4 w-4" aria-hidden="true" />
                    <span>{runningOcr ? 'Running Gemini OCR...' : 'Run Gemini OCR on Scanned PDF'}</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                <div className="flex-1 space-y-1">
                  <label
                    htmlFor="qb-drive-url"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Or load directly from a public Google Drive folder / file link
                  </label>
                  <input
                    id="qb-drive-url"
                    type="url"
                    value={driveUrlInput}
                    onChange={(e) => setDriveUrlInput(e.target.value)}
                    placeholder="https://drive.google.com/open?id=... or .../folders/..."
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  loading={driveLoadingList}
                  onClick={() => void handleBrowseDriveLink()}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  <span>{driveLoadingList ? 'Loading Drive...' : 'Browse Drive Link'}</span>
                </Button>
              </div>

              {driveEntries.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {driveFolderTitle}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                      {driveEntries.length} items
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {driveEntries.map((entry) => {
                      const isImporting = driveImportingId === entry.id;
                      const hasAnswersInName = /and answers/i.test(entry.title);
                      return (
                        <div
                          key={entry.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            {entry.isFolder ? (
                              <FolderOpen className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
                            ) : (
                              <FileText className="h-4 w-4 text-phosters-600 dark:text-phosters-400 shrink-0" aria-hidden="true" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {entry.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {entry.isFolder
                                  ? 'Subfolder'
                                  : hasAnswersInName
                                    ? 'Includes Answer Keys'
                                    : 'Past-question pack'}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            loading={isImporting}
                            disabled={driveImportingId !== null && !isImporting}
                            onClick={() => void handleImportDriveEntry(entry)}
                          >
                            <span>
                              {entry.isFolder
                                ? 'Open Folder'
                                : isImporting
                                  ? 'Converting...'
                                  : 'Convert to .txt'}
                            </span>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Normalized plain text ({sourceFileName})
                </span>
                <div className="flex flex-wrap items-center gap-x-2 tabular-nums">
                  {pageCount > 0 && (
                    <>
                      <span>{pageCount} pages</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>{convertedText.length.toLocaleString()} chars</span>
                  <span aria-hidden="true">·</span>
                  <span>~{estimatedQuestions} est. questions</span>
                  <span aria-hidden="true">·</span>
                  <span>{liveChunks.length} chunks</span>
                </div>
              </div>

              <textarea
                rows={10}
                value={convertedText}
                onChange={(e) => {
                  setConvertedText(e.target.value);
                  if (!selectedFile) {
                    setSourceFormat('paste');
                    setSourceFileName('pasted-questions.txt');
                  }
                }}
                placeholder="Upload a file above or paste raw past questions (e.g. 1. Question... A. ... B. ... Answer: B)..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 font-mono text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {parsing && parseProgress
                  ? `Parsing chunk ${parseProgress.current} of ${parseProgress.total}...`
                  : 'Questions are split on question-number boundaries so multi-year PDFs process cleanly without truncation.'}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {parsing ? (
                  <Button type="button" variant="danger" onClick={handleStopParsing}>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Stop Parsing</span>
                  </Button>
                ) : (
                  <>
                    {reviewQueue.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!convertedText.trim()}
                        onClick={() => void handleParseWithAi(true)}
                      >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        <span>Append Parsed Questions</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!convertedText.trim()}
                      onClick={() => void handleParseWithAi(false)}
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      <span>Parse Text with AI</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Step 3: Review Queue */}
          {reviewQueue.length > 0 && (
            <section aria-labelledby="review-queue-heading" className="space-y-4">
              <Card padding="lg" className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2
                      id="review-queue-heading"
                      className="text-base font-bold text-slate-900 dark:text-slate-100"
                    >
                      3. Review &amp; verify parsed questions
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      <span>{queueStats.total} extracted</span>
                      <span aria-hidden="true">·</span>
                      <span>{queueStats.included} selected</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          queueStats.keyIssues > 0
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : ''
                        }
                      >
                        {queueStats.keyIssues} key checks
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{queueStats.diagrams} diagram flags</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setReviewQueue((prev) => prev.map((q) => ({ ...q, include: true })))
                      }
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setReviewQueue((prev) =>
                          prev.map((q) => (q.needsDiagram ? { ...q, include: false } : q))
                        )
                      }
                    >
                      Exclude Diagram Qs
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setReviewQueue([])}>
                      Clear Queue
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {reviewQueue.map((q, idx) => (
                    <div
                      key={q.localKey}
                      className={[
                        'rounded-xl border p-4 space-y-3 transition-colors',
                        q.include
                          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          : 'border-slate-200/70 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 opacity-65',
                      ].join(' ')}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.include}
                            onChange={(e) =>
                              updateDraftQuestion(q.localKey, { include: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                          />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            Question #{idx + 1}
                          </span>
                        </label>

                        <div className="flex flex-wrap items-center gap-x-2 text-xs">
                          {q.hasKeyIssue && (
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              Verify answer key
                            </span>
                          )}
                          {q.hasKeyIssue && q.needsDiagram && (
                            <span className="text-slate-400" aria-hidden="true">
                              ·
                            </span>
                          )}
                          {q.needsDiagram && (
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              Diagram / figure referenced
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-6 space-y-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Question stem
                          </label>
                          <textarea
                            rows={2}
                            value={q.questionText}
                            onChange={(e) =>
                              updateDraftQuestion(q.localKey, { questionText: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Year
                          </label>
                          <input
                            type="number"
                            min={1978}
                            max={2035}
                            value={q.examYear ?? ''}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              updateDraftQuestion(q.localKey, {
                                examYear: e.target.value && Number.isFinite(n) ? n : null,
                              });
                            }}
                            className="w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Difficulty
                          </label>
                          <select
                            value={q.difficulty}
                            onChange={(e) =>
                              updateDraftQuestion(q.localKey, {
                                difficulty: e.target.value as QuestionDifficulty,
                              })
                            }
                            className="w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-sm text-slate-900 dark:text-slate-100"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Section
                          </label>
                          <input
                            type="text"
                            value={q.sectionLabel}
                            onChange={(e) =>
                              updateDraftQuestion(q.localKey, { sectionLabel: e.target.value })
                            }
                            placeholder="e.g. Lexis & Structure"
                            className="w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-sm text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => (
                          <div key={opt.localKey} className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer shrink-0">
                              <input
                                type="radio"
                                name={`qb-correct-${q.localKey}`}
                                checked={opt.isCorrect}
                                onChange={() => setDraftCorrectOption(q.localKey, opt.localKey)}
                                className="h-4 w-4 text-phosters-600 focus:ring-phosters-600"
                              />
                              <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {opt.optionKey}
                              </span>
                            </label>
                            <input
                              type="text"
                              value={opt.optionText}
                              onChange={(e) =>
                                updateDraftOption(q.localKey, opt.localKey, e.target.value)
                              }
                              className="flex-1 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Explanation
                        </label>
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) =>
                            updateDraftQuestion(q.localKey, { explanation: e.target.value })
                          }
                          placeholder="Short explanation shown after test submission"
                          className="w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={savingBatch}
                    disabled={queueStats.included === 0}
                    onClick={() => void handleSaveBatch('draft')}
                  >
                    Save Selected as Draft ({queueStats.included})
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={savingBatch}
                    disabled={queueStats.included === 0}
                    onClick={() => void handleSaveBatch('approved')}
                  >
                    Approve &amp; Publish to Question Bank ({queueStats.included})
                  </Button>
                </div>
              </Card>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {libraryError && <Alert tone="error">{libraryError}</Alert>}
          {libraryNotice && <Alert tone="success">{libraryNotice}</Alert>}

          <Card padding="lg" className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Filter className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
              <span>Filter Question Bank</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                aria-label="Filter by examination"
                value={filterExamId}
                onChange={(e) => setFilterExamId(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Examinations</option>
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
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by approval status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as QuestionBankStatus | '')}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved (Live for Tutors)</option>
                <option value="draft">Draft</option>
              </select>

              <select
                aria-label="Filter by difficulty"
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value as QuestionDifficulty | '')}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <select
                aria-label="Filter diagram dependency"
                value={filterDiagram}
                onChange={(e) =>
                  setFilterDiagram(e.target.value as 'all' | 'text_only' | 'needs_diagram')
                }
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="all">Text &amp; Diagram Questions</option>
                <option value="text_only">Text-Only Questions</option>
                <option value="needs_diagram">Diagram-Flagged Only</option>
              </select>

              <input
                type="number"
                aria-label="Filter by exam year"
                placeholder="Year (e.g. 2018)"
                min={1978}
                max={2035}
                value={filterYearInput}
                onChange={(e) => setFilterYearInput(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              />

              <input
                type="search"
                aria-label="Search question text"
                placeholder="Search question text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sm:col-span-2 w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Showing {libraryItems.length} bank questions · {selectedBankIds.size} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (selectedBankIds.size === libraryItems.length && libraryItems.length > 0) {
                      setSelectedBankIds(new Set());
                    } else {
                      setSelectedBankIds(new Set(libraryItems.map((q) => q.id)));
                    }
                  }}
                >
                  {selectedBankIds.size === libraryItems.length && libraryItems.length > 0 ? (
                    <CheckSquare className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {selectedBankIds.size === libraryItems.length && libraryItems.length > 0
                      ? 'Clear Selection'
                      : 'Select All Visible'}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={bulkApproving}
                  disabled={selectedBankIds.size === 0}
                  onClick={() => void handleBulkApproveSelected()}
                >
                  Approve Selected ({selectedBankIds.size})
                </Button>
              </div>
            </div>
          </Card>

          {libraryLoading ? (
            <LoadingState message="Loading Question Bank items..." />
          ) : libraryItems.length === 0 ? (
            <EmptyState
              title="No bank questions match these filters"
              description="Upload a past-question document in the Upload & Convert tab or broaden your search filters."
              action={
                <Button type="button" variant="primary" onClick={() => setActiveTab('ingest')}>
                  Upload Past Questions
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {libraryItems.map((item) => {
                const isSelected = selectedBankIds.has(item.id);
                const isBusy = libraryBusyId === item.id;
                const examLabel = item.exam_id ? examNameById.get(item.exam_id) : null;
                const subjectLabel = item.subject_id ? subjectNameById.get(item.subject_id) : null;

                return (
                  <Card key={item.id} padding="lg" className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          aria-label="Select question"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedBankIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            });
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600 shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className={
                                item.status === 'approved'
                                  ? 'font-semibold text-phosters-700 dark:text-phosters-400'
                                  : 'font-semibold text-amber-700 dark:text-amber-400'
                              }
                            >
                              {item.status === 'approved' ? 'Approved' : 'Draft'}
                            </span>
                            {examLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{examLabel}</span>
                              </>
                            )}
                            {subjectLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{subjectLabel}</span>
                              </>
                            )}
                            {item.exam_year && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">{item.exam_year}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{item.difficulty}</span>
                            {item.needs_diagram && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Needs Diagram
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                            {item.question_text}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          loading={isBusy}
                          onClick={() => void handleToggleLibraryStatus(item)}
                        >
                          {item.status === 'approved' ? 'Move to Draft' : 'Approve'}
                        </Button>
                        <button
                          type="button"
                          aria-label="Delete bank question"
                          disabled={isBusy}
                          onClick={() => void handleDeleteLibraryItem(item.id)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6 text-xs">
                      {item.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={
                            opt.is_correct
                              ? 'rounded-md border border-phosters-200 dark:border-phosters-800 bg-phosters-50/70 dark:bg-phosters-950/40 px-2.5 py-1.5 font-semibold text-phosters-900 dark:text-phosters-200'
                              : 'rounded-md border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300'
                          }
                        >
                          <span className="font-mono mr-1.5">{opt.option_key}.</span>
                          <span>{opt.option_text}</span>
                        </div>
                      ))}
                    </div>

                    {item.explanation && (
                      <p className="pl-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Explanation: {item.explanation}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
