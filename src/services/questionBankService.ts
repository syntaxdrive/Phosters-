import { supabase } from '../lib/supabase';
import type {
  ConvertDocumentRequest,
  ConvertDocumentResponse,
  DocumentSourceFormat,
  OcrPdfRequest,
  OcrPdfResponse,
  ParseChunkRequest,
  ParseChunkResponse,
  ParsedBankQuestionDraft,
  QuestionBankItem,
  QuestionBankOptionRecord,
  QuestionBankStatus,
  QuestionDifficulty,
} from '../types/questionBank';

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function isMissingMigrationError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('question_bank') && (msg.includes('does not exist') || msg.includes('schema cache'))
  );
}

async function parseApiJson<T>(
  res: Response,
  fallbackError: string
): Promise<{ data: T | null; error: string | null }> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return {
      data: null,
      error: `Question Bank API returned HTTP ${res.status} with an unreadable response.`,
    };
  }

  let parsed: (T & { error?: string }) | null = null;
  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText) as T & { error?: string };
    } catch {
      parsed = null;
    }
  }

  if (!parsed) {
    const trimmed = rawText.trim();
    if (res.status === 404) {
      return {
        data: null,
        error: 'Question Bank API route returned 404. Restart or deploy the backend routes.',
      };
    }
    if (res.status === 413) {
      return {
        data: null,
        error: 'Document exceeds the upload size limit. Split large files or convert to .txt first.',
      };
    }
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      return {
        data: null,
        error: `Question Bank API returned an HTML page instead of JSON (HTTP ${res.status}).`,
      };
    }
    return {
      data: null,
      error: trimmed
        ? `Question Bank API returned HTTP ${res.status}: ${trimmed.slice(0, 140)}`
        : `Question Bank API returned HTTP ${res.status}.`,
    };
  }

  if (!res.ok) {
    return { data: null, error: parsed.error || `${fallbackError} (HTTP ${res.status})` };
  }

  return { data: parsed as T, error: null };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export function splitTextClientChunks(rawText: string, maxChars = 11000): string[] {
  const normalized = rawText.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const blocks = normalized
    .split(/\n(?=\s*(?:Q(?:uestion)?\.?\s*\d{1,4}|\d{1,4}\s*[.)]\s+))/i)
    .filter((b) => b.trim().length > 0);

  if (blocks.length <= 1) {
    const paragraphs = normalized.split(/\n{2,}/);
    const chunks: string[] = [];
    let current = '';
    for (const para of paragraphs) {
      if (current && current.length + para.length + 2 > maxChars) {
        chunks.push(current.trim());
        current = para;
      } else {
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  const chunks: string[] = [];
  let current = '';
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      for (let i = 0; i < trimmed.length; i += maxChars) {
        chunks.push(trimmed.slice(i, i + maxChars).trim());
      }
      continue;
    }

    if (current && current.length + trimmed.length + 2 > maxChars) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function estimateClientQuestionCount(text: string): number {
  const matches = text.match(/(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*\d{1,4}|\d{1,4}\s*[.)])/gi);
  return matches ? matches.length : 0;
}

export async function convertDocumentFile(
  file: File
): Promise<{ result: ConvertDocumentResponse | null; error: string | null }> {
  const token = await getAccessToken();
  if (!token) {
    return { result: null, error: 'You must be signed in as Super Admin.' };
  }

  try {
    const fileBase64 = await fileToBase64(file);
    const payload: ConvertDocumentRequest = {
      fileName: file.name,
      mimeType: file.type || undefined,
      fileBase64,
    };

    const res = await fetch('/api/question-bank/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const parsed = await parseApiJson<ConvertDocumentResponse>(
      res,
      'Failed to convert document to clean text.'
    );
    return { result: parsed.data, error: parsed.error };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Unable to reach document converter.',
    };
  }
}

export async function ocrPdfFile(
  file: File
): Promise<{ result: OcrPdfResponse | null; error: string | null }> {
  const token = await getAccessToken();
  if (!token) {
    return { result: null, error: 'You must be signed in as Super Admin.' };
  }

  try {
    const fileBase64 = await fileToBase64(file);
    const payload: OcrPdfRequest = {
      fileName: file.name,
      fileBase64,
    };

    const res = await fetch('/api/question-bank/ocr-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const parsed = await parseApiJson<OcrPdfResponse>(
      res,
      'OCR failed for scanned PDF.'
    );
    return { result: parsed.data, error: parsed.error };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Unable to reach OCR endpoint.',
    };
  }
}

export async function parseQuestionChunkText(
  req: ParseChunkRequest,
  signal?: AbortSignal
): Promise<{ result: ParseChunkResponse | null; error: string | null }> {
  const token = await getAccessToken();
  if (!token) {
    return { result: null, error: 'You must be signed in as Super Admin.' };
  }

  try {
    const res = await fetch('/api/question-bank/parse-chunk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req),
      signal,
    });

    const parsed = await parseApiJson<ParseChunkResponse>(
      res,
      'AI parser failed to extract questions from chunk.'
    );
    return { result: parsed.data, error: parsed.error };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { result: null, error: 'Parsing cancelled.' };
    }
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Unable to reach AI question parser.',
    };
  }
}

export interface SaveQuestionBankBatchInput {
  fileName: string;
  sourceFormat: DocumentSourceFormat;
  rawCharCount: number;
  examId: string | null;
  subjectId: string | null;
  topicId: string | null;
  defaultYear: number | null;
  targetStatus: QuestionBankStatus;
  userId: string;
  questions: ParsedBankQuestionDraft[];
}

export async function saveParsedQuestionsToBank(
  input: SaveQuestionBankBatchInput
): Promise<{ insertedCount: number; migrationMissing?: boolean; error: string | null }> {
  if (!supabase) {
    return { insertedCount: 0, error: 'Supabase is not configured.' };
  }

  const included = input.questions.filter((q) => q.include);
  if (included.length === 0) {
    return { insertedCount: 0, error: 'Select at least one question to save.' };
  }

  for (let i = 0; i < included.length; i++) {
    const q = included[i];
    if (!q.questionText.trim()) {
      return { insertedCount: 0, error: `Selected question #${i + 1} has an empty question stem.` };
    }
    const validOpts = q.options.filter((o) => o.optionText.trim().length > 0);
    if (validOpts.length < 2) {
      return {
        insertedCount: 0,
        error: `Selected question #${i + 1} needs at least 2 non-empty answer options.`,
      };
    }
    if (!validOpts.some((o) => o.isCorrect)) {
      return {
        insertedCount: 0,
        error: `Selected question #${i + 1} has no correct option selected.`,
      };
    }
  }

  const batchInsert = await supabase
    .from('question_bank_batches')
    .insert({
      file_name: input.fileName.trim() || 'pasted-questions.txt',
      source_format: input.sourceFormat,
      exam_id: input.examId || null,
      subject_id: input.subjectId || null,
      exam_year: input.defaultYear,
      raw_char_count: Math.max(0, input.rawCharCount),
      imported_count: included.length,
      uploaded_by: input.userId,
    })
    .select('id')
    .single();

  if (batchInsert.error || !batchInsert.data) {
    return {
      insertedCount: 0,
      migrationMissing: isMissingMigrationError(batchInsert.error),
      error: batchInsert.error?.message || 'Could not create import batch record.',
    };
  }

  const batchId = batchInsert.data.id;
  let insertedCount = 0;

  // Insert questions in slices of 50 so PostgREST handles large past-question imports reliably
  const CHUNK_SIZE = 50;
  for (let offset = 0; offset < included.length; offset += CHUNK_SIZE) {
    const slice = included.slice(offset, offset + CHUNK_SIZE);
    const questionRows = slice.map((q) => ({
      batch_id: batchId,
      exam_id: input.examId || null,
      subject_id: input.subjectId || null,
      topic_id: input.topicId || null,
      exam_year: q.examYear ?? input.defaultYear ?? null,
      difficulty: q.difficulty,
      section_label: q.sectionLabel.trim() || null,
      question_text: q.questionText.trim(),
      explanation: q.explanation.trim() || null,
      points: Math.max(1, Number(q.points) || 1),
      needs_diagram: Boolean(q.needsDiagram),
      status: input.targetStatus,
      source_reference: input.fileName.trim() || null,
      created_by: input.userId,
    }));

    const qRes = await supabase
      .from('question_bank')
      .insert(questionRows)
      .select('id');

    if (qRes.error || !qRes.data) {
      return {
        insertedCount,
        migrationMissing: isMissingMigrationError(qRes.error),
        error:
          qRes.error?.message ||
          `Saved ${insertedCount} questions before hitting a database error.`,
      };
    }

    const optionRows: Array<{
      bank_question_id: string;
      option_key: string;
      option_text: string;
      is_correct: boolean;
      display_order: number;
    }> = [];

    qRes.data.forEach((createdRow, idx) => {
      const sourceQ = slice[idx];
      const validOpts = sourceQ.options.filter((o) => o.optionText.trim().length > 0);
      validOpts.forEach((opt, optIdx) => {
        optionRows.push({
          bank_question_id: createdRow.id,
          option_key: opt.optionKey || String.fromCharCode(65 + optIdx),
          option_text: opt.optionText.trim(),
          is_correct: opt.isCorrect,
          display_order: optIdx + 1,
        });
      });
    });

    if (optionRows.length > 0) {
      const optRes = await supabase.from('question_bank_options').insert(optionRows);
      if (optRes.error) {
        return {
          insertedCount,
          error: optRes.error.message,
        };
      }
    }

    insertedCount += qRes.data.length;
  }

  return { insertedCount, error: null };
}

export interface QuestionBankFilter {
  examId?: string;
  subjectId?: string;
  topicId?: string;
  examYear?: number | null;
  difficulty?: QuestionDifficulty | '';
  status?: QuestionBankStatus | '';
  diagramFilter?: 'all' | 'text_only' | 'needs_diagram';
  search?: string;
  limit?: number;
}

export async function fetchQuestionBankItems(
  filter: QuestionBankFilter = {}
): Promise<{
  items: QuestionBankItem[];
  migrationMissing?: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return { items: [], error: 'Supabase is not configured.' };
  }

  let query = supabase
    .from('question_bank')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.examId) query = query.eq('exam_id', filter.examId);
  if (filter.subjectId) query = query.eq('subject_id', filter.subjectId);
  if (filter.topicId) query = query.eq('topic_id', filter.topicId);
  if (filter.examYear) query = query.eq('exam_year', filter.examYear);
  if (filter.difficulty) query = query.eq('difficulty', filter.difficulty);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.diagramFilter === 'text_only') query = query.eq('needs_diagram', false);
  if (filter.diagramFilter === 'needs_diagram') query = query.eq('needs_diagram', true);

  const searchTerm = filter.search?.trim();
  if (searchTerm) {
    query = query.ilike('question_text', `%${searchTerm}%`);
  }

  const res = await query;
  if (res.error) {
    return {
      items: [],
      migrationMissing: isMissingMigrationError(res.error),
      error: res.error.message,
    };
  }

  const rows = res.data ?? [];
  if (rows.length === 0) {
    return { items: [], error: null };
  }

  const questionIds = rows.map((r) => r.id);
  const optRes = await supabase
    .from('question_bank_options')
    .select('*')
    .in('bank_question_id', questionIds)
    .order('display_order', { ascending: true });

  if (optRes.error) {
    return { items: [], error: optRes.error.message };
  }

  const optionsByQuestionId = new Map<string, QuestionBankOptionRecord[]>();
  for (const opt of optRes.data ?? []) {
    const existing = optionsByQuestionId.get(opt.bank_question_id) ?? [];
    existing.push(opt);
    optionsByQuestionId.set(opt.bank_question_id, existing);
  }

  const items: QuestionBankItem[] = rows.map((row) => ({
    ...row,
    options: optionsByQuestionId.get(row.id) ?? [],
  }));

  return { items, error: null };
}

export async function fetchApprovedBankQuestionsForTestBuilder(params: {
  examId?: string;
  subjectId?: string;
  topicId?: string;
  examYear?: number | null;
  difficulty?: QuestionDifficulty | '';
  excludeDiagrams?: boolean;
  count: number;
}): Promise<{
  items: QuestionBankItem[];
  migrationMissing?: boolean;
  error: string | null;
}> {
  const poolLimit = Math.max(params.count * 4, 160);
  const res = await fetchQuestionBankItems({
    examId: params.examId || undefined,
    subjectId: params.subjectId || undefined,
    topicId: params.topicId || undefined,
    examYear: params.examYear ?? undefined,
    difficulty: params.difficulty || undefined,
    status: 'approved',
    diagramFilter: params.excludeDiagrams ? 'text_only' : 'all',
    limit: poolLimit,
  });

  if (res.error) return res;

  // Fisher-Yates shuffle for randomized balanced exam assembly
  const pool = [...res.items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return {
    items: pool.slice(0, Math.max(1, params.count)),
    error: null,
  };
}

export async function updateBankQuestionStatus(
  id: string,
  status: QuestionBankStatus
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('question_bank')
    .update({ status })
    .eq('id', id);
  return { error: error ? error.message : null };
}

export async function bulkApproveBankQuestions(
  ids: string[]
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from('question_bank')
    .update({ status: 'approved' })
    .in('id', ids);
  return { error: error ? error.message : null };
}

export async function deleteBankQuestion(
  id: string
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { error } = await supabase
    .from('question_bank')
    .delete()
    .eq('id', id);
  return { error: error ? error.message : null };
}
