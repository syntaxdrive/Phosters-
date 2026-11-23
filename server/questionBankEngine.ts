import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import { verifyAdminAuthorization } from './pushEngine.js';
import type {
  ConvertDocumentRequest,
  ConvertDocumentResponse,
  DocumentSourceFormat,
  DriveFolderEntry,
  DriveImportRequest,
  DriveListRequest,
  DriveListResponse,
  OcrPdfRequest,
  OcrPdfResponse,
  ParseChunkRequest,
  ParseChunkResponse,
  QuestionDifficulty,
} from '../src/types/questionBank';

const SUPER_ADMIN_EMAIL = 'oyasordaniel@gmail.com';
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024; // 16 MB binary upload limit
const MAX_OCR_PDF_BYTES = 12 * 1024 * 1024; // 12 MB limit for inline multimodal PDF OCR
const DEFAULT_CHUNK_CHARS = 11000;
const MAX_PARSE_CHUNK_CHARS = 35000;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const DIAGRAM_REF_REGEX =
  /\b(diagram|figure|fig\.?|graph|chart|histogram|pie chart|bar chart|circuit below|circuit above|map below|map above|use the table|table below|sketch below|shown below|shown above)\b/i;

export async function verifySuperAdminAuthorization(
  authorizationHeader: string | undefined
) {
  const adminCheck = await verifyAdminAuthorization(authorizationHeader);
  if (!adminCheck.ok) {
    return adminCheck;
  }

  const email = (adminCheck.userEmail ?? '').trim().toLowerCase();
  if (email !== SUPER_ADMIN_EMAIL) {
    return {
      ok: false,
      status: 403,
      error: `Super Administrator access (${SUPER_ADMIN_EMAIL}) is required for Question Bank document ingestion.`,
    };
  }

  return adminCheck;
}

function getGeminiClient(): { ai: GoogleGenAI | null; error?: string } {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      ai: null,
      error:
        'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to run AI OCR and question parsing.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return { ai };
}

function stripBase64Prefix(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1).trim();
  }
  return trimmed;
}

function normalizePlainText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const unescaped = withoutScripts
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });

  return normalizePlainText(unescaped);
}

function decodeRtfToText(rtf: string): string {
  const stripped = rtf
    .replace(/\{\\\*\\[^}]*\}/g, ' ')
    .replace(/\\(par|line)\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '');

  return normalizePlainText(stripped);
}

function detectSourceFormat(
  fileName: string,
  mimeType?: string
): DocumentSourceFormat | 'legacy_doc' {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf' || mimeType === 'application/pdf') return 'pdf';
  if (
    ext === '.docx' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (ext === '.doc' || mimeType === 'application/msword') return 'legacy_doc';
  if (ext === '.csv' || ext === '.tsv' || mimeType === 'text/csv') return 'csv';
  if (ext === '.md' || ext === '.markdown' || mimeType === 'text/markdown') {
    return 'md';
  }
  if (ext === '.html' || ext === '.htm' || mimeType === 'text/html') {
    return 'html';
  }
  if (ext === '.rtf' || mimeType === 'application/rtf') return 'rtf';
  return 'txt';
}

export function estimateQuestionsCount(text: string): number {
  const matches = text.match(/^(?:\s*(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\):])/gim);
  return matches ? matches.length : 0;
}

function splitIntoBalancedLinesChunks(
  rawSection: string,
  maxChars: number
): string[] {
  const clean = normalizePlainText(rawSection);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const lines = clean.split('\n');
  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentLength = 0;

  const isQuestionBoundary = (line: string) =>
    /^(?:Q(?:uestion)?\s*\d{1,3}\s*[\.\):]|\d{1,3}\s*[\.\)]\s+\S|===|---\s*PAGE)/i.test(
      line.trim()
    );

  for (const line of lines) {
    const lineLen = line.length + 1;

    if (
      currentLength > maxChars * 0.65 &&
      currentLength + lineLen > maxChars &&
      isQuestionBoundary(line)
    ) {
      chunks.push(currentLines.join('\n').trim());
      currentLines = [line];
      currentLength = lineLen;
      continue;
    }

    if (currentLength + lineLen > maxChars && currentLines.length > 0) {
      chunks.push(currentLines.join('\n').trim());
      currentLines = [line];
      currentLength = lineLen;
      continue;
    }

    currentLines.push(line);
    currentLength += lineLen;
  }

  if (currentLines.length > 0) {
    const tail = currentLines.join('\n').trim();
    if (tail) chunks.push(tail);
  }

  return chunks;
}

const YEAR_SECTION_SPLIT_REGEX =
  /\n(?=(?:---\s*PAGE\s+\d+\s*---\s*\n)?(?:UTME\s+(?:19[7-9]\d|20[0-3]\d)|(?:Use\s+of\s+English|English(?:\s+Language)?|Mathematics|Physics|Chemistry|Biology|Economics|Government|Commerce|CRK|Literature(?:-In-English)?|Principles\s+of\s+Accounts)\s+(?:19[7-9]\d|20[0-3]\d)|={3}\s*(?:19[7-9]\d|20[0-3]\d)\s*={3}))/i;

export function splitTextIntoQuestionChunks(
  rawText: string,
  maxChars = DEFAULT_CHUNK_CHARS
): string[] {
  const clean = normalizePlainText(rawText);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const yearSections = clean
    .split(YEAR_SECTION_SPLIT_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);

  if (yearSections.length <= 1) {
    return splitIntoBalancedLinesChunks(clean, maxChars);
  }

  const allChunks: string[] = [];

  for (const section of yearSections) {
    const keyMatch = section.match(
      /(?:^|\n)\s*(?:ANSWER(?:S)?\s*KEY(?:S)?\s*:?[\s\S]*)$/i
    );
    const answerKeyBlock = keyMatch ? keyMatch[0].trim() : '';

    if (
      answerKeyBlock &&
      answerKeyBlock.length < 3200 &&
      section.length > maxChars
    ) {
      const bodyWithoutKey = section
        .slice(0, keyMatch?.index ?? section.length)
        .trim();
      const keySuffix = `\n\n--- REFERENCE ANSWER KEY FOR THIS YEAR SECTION ---\n${answerKeyBlock}`;
      const effectiveMax = Math.max(4500, maxChars - keySuffix.length);
      const bodyChunks = splitIntoBalancedLinesChunks(bodyWithoutKey, effectiveMax);
      for (const chunk of bodyChunks) {
        allChunks.push(`${chunk}${keySuffix}`.trim());
      }
    } else {
      const subChunks = splitIntoBalancedLinesChunks(section, maxChars);
      allChunks.push(...subChunks);
    }
  }

  return allChunks.filter(Boolean);
}

export async function convertBufferToDocument(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<{ status: number; body: ConvertDocumentResponse | { error: string } }> {
  const fileName = path.basename((params.fileName || 'document.txt').trim());
  const { buffer } = params;

  if (buffer.byteLength === 0) {
    return { status: 400, body: { error: 'Document file is empty.' } };
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return {
      status: 413,
      body: {
        error:
          'File exceeds the 16 MB limit. Split multi-year booklets by subject or year.',
      },
    };
  }

  const format = detectSourceFormat(fileName, params.mimeType);
  if (format === 'legacy_doc') {
    return {
      status: 400,
      body: {
        error:
          'Legacy binary .doc files cannot be converted reliably. Open it in Word or Google Docs and Save As .docx, .pdf, or .txt first.',
      },
    };
  }

  let pageCount = 1;
  let convertedText = '';
  let isScannedLikely = false;

  if (format === 'pdf') {
    const pdfResult = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });
    pageCount = Math.max(1, pdfResult.totalPages || 1);
    const pages = Array.isArray(pdfResult.text)
      ? pdfResult.text
      : [String(pdfResult.text ?? '')];

    const joined = pages
      .map((pageText, idx) => `--- PAGE ${idx + 1} ---\n${normalizePlainText(pageText)}`)
      .join('\n\n');

    convertedText = normalizePlainText(joined);
    const charsWithoutHeaders = convertedText
      .replace(/--- PAGE \d+ ---/g, '')
      .trim().length;
    isScannedLikely = charsWithoutHeaders / pageCount < 80;
  } else if (format === 'docx') {
    const docRes = await mammoth.extractRawText({ buffer });
    convertedText = normalizePlainText(docRes.value || '');
  } else if (format === 'html') {
    convertedText = decodeHtmlToText(buffer.toString('utf8'));
  } else if (format === 'rtf') {
    convertedText = decodeRtfToText(buffer.toString('utf8'));
  } else {
    convertedText = normalizePlainText(buffer.toString('utf8'));
  }

  const chunks = splitTextIntoQuestionChunks(convertedText);
  return {
    status: 200,
    body: {
      ok: true,
      fileName,
      sourceFormat: format,
      pageCount,
      charCount: convertedText.length,
      convertedText,
      isScannedLikely,
      chunks,
      estimatedQuestions: estimateQuestionsCount(convertedText),
    },
  };
}

export async function convertUploadedDocument(
  input: ConvertDocumentRequest
): Promise<{ status: number; body: ConvertDocumentResponse | { error: string } }> {
  const fileName = path.basename((input.fileName || 'document.txt').trim());
  const cleanBase64 = stripBase64Prefix(input.fileBase64 || '');

  if (!cleanBase64) {
    return { status: 400, body: { error: 'Uploaded file payload is empty.' } };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.byteLength === 0) {
    return { status: 400, body: { error: 'Could not decode uploaded file.' } };
  }

  return convertBufferToDocument({
    buffer,
    fileName,
    mimeType: input.mimeType,
  });
}

export async function ocrScannedPdfWithGemini(
  input: OcrPdfRequest
): Promise<{ status: number; body: OcrPdfResponse | { error: string } }> {
  const { ai, error: keyErr } = getGeminiClient();
  if (!ai) {
    return { status: 503, body: { error: keyErr || 'Gemini API key missing.' } };
  }

  const fileName = path.basename((input.fileName || 'scanned.pdf').trim());
  const cleanBase64 = stripBase64Prefix(input.fileBase64 || '');
  if (!cleanBase64) {
    return { status: 400, body: { error: 'PDF payload is empty.' } };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.byteLength > MAX_OCR_PDF_BYTES) {
    return {
      status: 413,
      body: {
        error:
          'Scanned PDF exceeds the 12 MB AI OCR limit. Split the PDF into smaller 1–3 year chunks and upload each part.',
      },
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64,
            },
          },
          {
            text: [
              'Transcribe ALL multiple-choice exam questions, options (A, B, C, D, E), comprehension passages, and answer keys from this Nigerian JAMB/Post-UTME PDF into clean, well-formatted plain UTF-8 text.',
              'Rules:',
              '- Handle 2-column layouts accurately in true reading order (left column top-to-bottom, then right column).',
              '- Convert mathematical powers and chemical formulas into clean Unicode/ASCII notation (e.g., x², H₂SO₄, 10^-5, √x, ->).',
              '- Preserve year headings (e.g., === 2018 ===) and section headings.',
              '- If a question depends on a visual diagram, graph, or circuit that text alone cannot show, add [DIAGRAM NEEDED] right beside that question.',
              '- Keep every question numbered and every answer option labeled A., B., C., D. on clean lines, plus any Answer Keys found.',
            ].join('\n'),
          },
        ],
      },
      config: {
        systemInstruction:
          'You are a precise academic OCR transcriber converting scanned Nigerian examination past-question PDFs into structured plain text without omitting questions or options.',
      },
    });

    const convertedText = normalizePlainText(response.text || '');
    if (!convertedText) {
      return {
        status: 502,
        body: { error: 'Gemini OCR returned empty text for this PDF.' },
      };
    }

    const chunks = splitTextIntoQuestionChunks(convertedText);
    return {
      status: 200,
      body: {
        ok: true,
        fileName,
        convertedText,
        charCount: convertedText.length,
        chunks,
        estimatedQuestions: estimateQuestionsCount(convertedText),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected Gemini OCR error.';
    return { status: 502, body: { error: message } };
  }
}

export async function parseQuestionChunkWithGemini(
  input: ParseChunkRequest
): Promise<{ status: number; body: ParseChunkResponse | { error: string } }> {
  const { ai, error: keyErr } = getGeminiClient();
  if (!ai) {
    return { status: 503, body: { error: keyErr || 'Gemini API key missing.' } };
  }

  const chunkText = normalizePlainText(input.chunkText || '');
  if (chunkText.length < 10) {
    return {
      status: 400,
      body: { error: 'Text chunk is too short to parse questions.' },
    };
  }
  if (chunkText.length > MAX_PARSE_CHUNK_CHARS) {
    return {
      status: 400,
      body: {
        error: `Chunk exceeds ${MAX_PARSE_CHUNK_CHARS} characters. Split into smaller batches first.`,
      },
    };
  }

  const examContext = input.examHint?.trim() || 'JAMB UTME / Nigerian Post-UTME';
  const subjectContext = input.subjectHint?.trim() || 'General Subject';
  const defaultYear =
    typeof input.defaultYear === 'number' &&
    input.defaultYear >= 1978 &&
    input.defaultYear <= 2035
      ? input.defaultYear
      : null;

  const explainInstruction = input.generateMissingExplanations
    ? 'If a question has no explanation in the source text, write a concise 1–3 sentence step-by-step solution/explanation for the correct option.'
    : 'Only include explanations that appear in the source text; leave explanation empty if none is present.';

  const prompt = [
    `Extract every multiple-choice question from the text chunk below.`,
    `Context: Exam = ${examContext}, Subject = ${subjectContext}${defaultYear ? `, Default Year = ${defaultYear}` : ''}.`,
    `Rules:`,
    `1. Extract ONLY actual subject questions present in the text chunk — never invent new questions. Skip JAMB booklet metadata questions such as "Which Question Paper Type of ... is given to you?" (Type A/B/C/D).`,
    `2. Match answer keys carefully whether they appear inline ("Ans: C", "*B") or in an Answer Key / "--- REFERENCE ANSWER KEY FOR THIS YEAR SECTION ---" block (including multi-column keys like "1. C 26. A"). If NO answer key exists anywhere in the text for a question, set isCorrect=false on all its options rather than guessing.`,
    `3. If a comprehension passage or instruction precedes several questions, include the relevant short passage or prompt context inside each dependent questionText so every question stands cleanly on its own in a randomized CBT bank.`,
    `4. Detect examYear (integer 1978–2035) if visible in headings/labels; otherwise use ${defaultYear ?? 'null'}.`,
    `5. Set needsDiagram=true if the question requires an unincluded diagram, graph, figure, or circuit.`,
    `6. ${explainInstruction}`,
    `7. Return valid JSON matching the schema strictly.`,
    ``,
    `--- SOURCE TEXT CHUNK ---`,
    chunkText,
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an expert Nigerian JAMB UTME & UI Post-UTME question extraction parser. Convert raw document text into clean, accurate structured multiple-choice JSON without altering numbers, formulas, or correct answer keys.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionText: {
                    type: Type.STRING,
                    description: 'Clean question prompt without leading numbering.',
                  },
                  examYear: {
                    type: Type.INTEGER,
                    nullable: true,
                    description: '4-digit exam year if known, else null.',
                  },
                  sectionLabel: {
                    type: Type.STRING,
                    description:
                      'Short topic or section label e.g. Comprehension, Lexis & Structure, Stoichiometry.',
                  },
                  difficulty: {
                    type: Type.STRING,
                    description: 'One of easy, medium, hard.',
                  },
                  needsDiagram: {
                    type: Type.BOOLEAN,
                    description:
                      'True if question references a missing visual figure, graph, or diagram.',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Concise solution explanation or empty string.',
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        optionKey: {
                          type: Type.STRING,
                          description: 'Uppercase letter A, B, C, D, or E.',
                        },
                        optionText: {
                          type: Type.STRING,
                          description: 'Option wording without leading A./B. prefix.',
                        },
                        isCorrect: {
                          type: Type.BOOLEAN,
                          description: 'True only for the correct answer option.',
                        },
                      },
                      required: ['optionKey', 'optionText', 'isCorrect'],
                    },
                  },
                },
                required: ['questionText', 'options'],
              },
            },
          },
          required: ['questions'],
        },
      },
    });

    const jsonText = (response.text ?? '{"questions":[]}').trim();
    const parsed = JSON.parse(jsonText) as {
      questions?: Array<{
        questionText?: string;
        examYear?: number | null;
        sectionLabel?: string;
        difficulty?: string;
        needsDiagram?: boolean;
        explanation?: string;
        options?: Array<{
          optionKey?: string;
          optionText?: string;
          isCorrect?: boolean;
        }>;
      }>;
    };

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const normalizedQuestions: ParseChunkResponse['questions'] = [];

    for (const item of rawQuestions) {
      const qText = (item.questionText || '')
        .replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[\.\):]\s+/i, '')
        .trim();
      if (!qText) continue;

      const cleanedOptions = (Array.isArray(item.options) ? item.options : [])
        .map((opt, idx) => ({
          optionKey:
            (opt.optionKey || OPTION_LETTERS[idx] || String(idx + 1))
              .trim()
              .toUpperCase()
              .slice(0, 2) || OPTION_LETTERS[idx] || 'A',
          optionText: (opt.optionText || '')
            .replace(/^[A-F]\s*[\.\):]\s+/i, '')
            .trim(),
          isCorrect: Boolean(opt.isCorrect),
        }))
        .filter((opt) => opt.optionText.length > 0)
        .slice(0, 6);

      if (cleanedOptions.length < 2) continue;

      const correctCount = cleanedOptions.filter((o) => o.isCorrect).length;
      const hasKeyIssue = correctCount !== 1;
      const yearCandidate =
        typeof item.examYear === 'number' &&
        item.examYear >= 1978 &&
        item.examYear <= 2035
          ? Math.round(item.examYear)
          : defaultYear;

      const diffRaw = (item.difficulty || 'medium').trim().toLowerCase();
      const difficulty: QuestionDifficulty =
        diffRaw === 'easy' || diffRaw === 'hard' ? diffRaw : 'medium';

      const needsDiagram =
        Boolean(item.needsDiagram) || DIAGRAM_REF_REGEX.test(qText);

      normalizedQuestions.push({
        questionText: qText,
        explanation: (item.explanation || '').trim(),
        examYear: yearCandidate,
        sectionLabel: (item.sectionLabel || '').trim().slice(0, 80),
        difficulty,
        points: 1,
        needsDiagram,
        hasKeyIssue,
        options: cleanedOptions,
      });
    }

    return {
      status: 200,
      body: {
        ok: true,
        questions: normalizedQuestions,
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected Gemini question parsing error.';
    return { status: 502, body: { error: message } };
  }
}

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,120}$/;

function isAllowedGoogleDriveHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'drive.google.com' ||
    host === 'docs.google.com' ||
    host === 'drive.usercontent.google.com' ||
    host.endsWith('.googleusercontent.com')
  );
}

function parseGoogleDriveInput(rawInput: string): {
  id: string;
  sourceTypeHint: 'folder' | 'file' | 'unknown';
} | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  if (DRIVE_ID_REGEX.test(trimmed)) {
    return { id: trimmed, sourceTypeHint: 'unknown' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'https:' || !isAllowedGoogleDriveHost(parsedUrl.hostname)) {
    return null;
  }

  const folderMatch = parsedUrl.pathname.match(/\/folders\/([a-zA-Z0-9_-]{10,120})/);
  if (folderMatch) {
    return { id: folderMatch[1], sourceTypeHint: 'folder' };
  }

  const fileMatch = parsedUrl.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,120})/);
  if (fileMatch) {
    return { id: fileMatch[1], sourceTypeHint: 'file' };
  }

  const queryId = parsedUrl.searchParams.get('id');
  if (queryId && DRIVE_ID_REGEX.test(queryId)) {
    return { id: queryId, sourceTypeHint: 'unknown' };
  }

  return null;
}

function decodeBasicHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function fetchGoogleDriveHttps(
  urlString: string,
  maxBytes: number,
  depth = 0
): Promise<{
  statusCode: number;
  contentType: string;
  contentDisposition: string;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    if (depth > 5) {
      reject(new Error('Too many Google Drive redirects.'));
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      reject(new Error('Invalid redirect URL.'));
      return;
    }

    if (parsed.protocol !== 'https:') {
      reject(new Error('Blocked non-HTTPS Google Drive redirect.'));
      return;
    }

    if (parsed.hostname.toLowerCase() === 'accounts.google.com') {
      reject(
        new Error(
          'This Google Drive item is private or requires sign-in. Share it as "Anyone with the link" first.'
        )
      );
      return;
    }

    if (!isAllowedGoogleDriveHost(parsed.hostname)) {
      reject(new Error('Blocked redirect outside Google Drive domains.'));
      return;
    }

    const req = https.get(
      parsed,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PhostersQuestionBank/1.0)',
        },
        timeout: 20000,
      },
      (res: http.IncomingMessage) => {
        const statusCode = res.statusCode ?? 0;
        const location = res.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location) {
          res.resume();
          const resolved = new URL(location, parsed).toString();
          fetchGoogleDriveHttps(resolved, maxBytes, depth + 1).then(resolve, reject);
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.byteLength;
          if (total > maxBytes) {
            req.destroy();
            reject(
              new Error(
                'Google Drive file exceeds the 16 MB upload limit. Download and split the file into smaller parts.'
              )
            );
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve({
            statusCode,
            contentType: String(res.headers['content-type'] ?? ''),
            contentDisposition: String(res.headers['content-disposition'] ?? ''),
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timed out while contacting Google Drive.'));
    });

    req.on('error', (err) => reject(err));
  });
}

export async function listPublicDriveFolder(
  input: DriveListRequest
): Promise<{ status: number; body: DriveListResponse | { error: string } }> {
  const parsed = parseGoogleDriveInput(input.urlOrId || '');
  if (!parsed) {
    return {
      status: 400,
      body: {
        error:
          'Enter a valid public Google Drive folder or file link (https://drive.google.com/...).',
      },
    };
  }

  try {
    if (parsed.sourceTypeHint !== 'file') {
      const folderUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(
        parsed.id
      )}#list`;
      const res = await fetchGoogleDriveHttps(folderUrl, 4 * 1024 * 1024);
      if (res.statusCode === 200) {
        const html = res.body.toString('utf8');
        const entries: DriveFolderEntry[] = [];
        const entryRe =
          /href="https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/([^"?\/]+)[^"]*"[^>]*>[\s\S]*?<div class="flip-entry-title">([^<]+)<\/div>/g;
        let m: RegExpExecArray | null;
        while ((m = entryRe.exec(html)) !== null) {
          const entryId = m[2]?.trim();
          const entryTitle = decodeBasicHtmlEntities(m[3] || '');
          if (entryId && DRIVE_ID_REGEX.test(entryId) && entryTitle) {
            entries.push({
              id: entryId,
              title: entryTitle,
              isFolder: m[1] === 'drive/folders',
            });
          }
        }

        if (entries.length > 0) {
          const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
          const folderTitle = titleMatch
            ? decodeBasicHtmlEntities(titleMatch[1]).replace(/\s*[–-]\s*Google Drive$/i, '')
            : 'Google Drive Folder';

          return {
            status: 200,
            body: {
              ok: true,
              sourceType: 'folder',
              driveId: parsed.id,
              folderTitle,
              entries,
            },
          };
        }
      }
    }

    // Fallback: treat ID as an individual public file
    const fileViewRes = await fetchGoogleDriveHttps(
      `https://drive.google.com/file/d/${encodeURIComponent(parsed.id)}/view`,
      2 * 1024 * 1024
    );
    if (fileViewRes.statusCode >= 400) {
      return {
        status: 400,
        body: {
          error:
            'Could not read this Google Drive link. Ensure sharing is set to "Anyone with the link".',
        },
      };
    }

    const fileHtml = fileViewRes.body.toString('utf8');
    const titleMatch = fileHtml.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch
      ? decodeBasicHtmlEntities(titleMatch[1]).replace(/\s*[–-]\s*Google Drive$/i, '')
      : `drive-file-${parsed.id}.pdf`;

    return {
      status: 200,
      body: {
        ok: true,
        sourceType: 'file',
        driveId: parsed.id,
        folderTitle: title,
        entries: [{ id: parsed.id, title, isFolder: false }],
      },
    };
  } catch (err) {
    return {
      status: 502,
      body: {
        error:
          err instanceof Error
            ? err.message
            : 'Unable to list Google Drive folder contents.',
      },
    };
  }
}

export async function importPublicDriveFile(
  input: DriveImportRequest
): Promise<{ status: number; body: ConvertDocumentResponse | { error: string } }> {
  const fileId = (input.fileId || '').trim();
  if (!DRIVE_ID_REGEX.test(fileId)) {
    return { status: 400, body: { error: 'Invalid Google Drive file ID.' } };
  }

  try {
    let downloadRes = await fetchGoogleDriveHttps(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
      MAX_UPLOAD_BYTES
    );

    if (downloadRes.contentType.includes('text/html')) {
      const html = downloadRes.body.toString('utf8');
      const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
      const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
      if (confirmMatch) {
        const extraUuid = uuidMatch ? `&uuid=${encodeURIComponent(uuidMatch[1])}` : '';
        downloadRes = await fetchGoogleDriveHttps(
          `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
            fileId
          )}&export=download&confirm=${encodeURIComponent(confirmMatch[1])}${extraUuid}`,
          MAX_UPLOAD_BYTES
        );
      }
    }

    if (downloadRes.statusCode >= 400) {
      return {
        status: 400,
        body: {
          error:
            'Could not download this file from Google Drive. Make sure sharing is public ("Anyone with the link").',
        },
      };
    }

    if (
      downloadRes.contentType.includes('text/html') &&
      !downloadRes.body.subarray(0, 5).toString().startsWith('%PDF')
    ) {
      return {
        status: 400,
        body: {
          error:
            'Google Drive returned an HTML page instead of a document file. Confirm this item is public and is a supported file (PDF, DOCX, TXT, CSV).',
        },
      };
    }

    let resolvedFileName = path.basename((input.fileName || '').trim());
    if (!resolvedFileName) {
      const dispMatch = downloadRes.contentDisposition.match(
        /filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i
      );
      resolvedFileName = dispMatch
        ? decodeURIComponent(dispMatch[1].trim())
        : `drive-${fileId}.pdf`;
    }

    return convertBufferToDocument({
      buffer: downloadRes.body,
      fileName: resolvedFileName,
      mimeType: downloadRes.contentType.split(';')[0]?.trim(),
    });
  } catch (err) {
    return {
      status: 502,
      body: {
        error:
          err instanceof Error
            ? err.message
            : 'Unable to download and convert the Google Drive file.',
      },
    };
  }
}

