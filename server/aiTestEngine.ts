import { GoogleGenAI, Type } from '@google/genai';
import type {
  AiGenerateQuestionsRequest,
  AiGenerateQuestionsResponse,
  AiGeneratedQuestionDraft,
} from '../src/types/cbt';
import type { QuestionDifficulty } from '../src/types/questionBank';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

function getGeminiClient(): { ai: GoogleGenAI | null; error?: string } {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      ai: null,
      error:
        'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets so tutors can generate AI questions.',
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

export async function generateTutorQuestionsWithGemini(
  input: AiGenerateQuestionsRequest
): Promise<{ status: number; body: AiGenerateQuestionsResponse | { error: string } }> {
  const { ai, error: keyErr } = getGeminiClient();
  if (!ai) {
    return { status: 503, body: { error: keyErr || 'Gemini API key missing.' } };
  }

  const subjectName = (input.subjectName || '').trim();
  if (!subjectName) {
    return { status: 400, body: { error: 'Select a subject before generating questions.' } };
  }

  const examName = (input.examName || 'JAMB UTME').trim();
  const topicTitle = (input.topicTitle || '').trim();
  const instructions = (input.instructions || '').trim().slice(0, 1200);
  const count = Math.max(1, Math.min(40, Math.round(Number(input.count) || 10)));
  const difficulty = input.difficulty || 'mixed';
  const modeLabel =
    input.purpose === 'mock_exam'
      ? 'timed full-length Nigerian examination Mock Exam'
      : 'topic/lesson practice test';

  const difficultyGuidance =
    difficulty === 'mixed'
      ? 'Mix roughly 30% easy foundational recall, 50% medium application/calculation, and 20% challenging exam-level questions.'
      : `Target "${difficulty}" Nigerian exam difficulty consistently.`;

  const prompt = [
    `Generate exactly ${count} original, syllabus-accurate multiple-choice questions for Nigerian students preparing for ${examName} (${modeLabel}).`,
    `Subject: ${subjectName}`,
    topicTitle ? `Topic / Syllabus Focus: ${topicTitle}` : '',
    `Difficulty: ${difficultyGuidance}`,
    instructions ? `Tutor's Extra Instructions: ${instructions}` : '',
    '',
    'Strict Quality Rules:',
    '- Every question must be self-contained in plain text (do NOT reference external figures, diagrams, or "the graph below").',
    '- Use clean Unicode/ASCII math and chemical symbols where helpful (e.g., x², √2, H₂SO₄, 10⁻⁵, θ, °C).',
    '- Provide exactly 4 options labeled A, B, C, D with plausible distractors and ONLY ONE unambiguous correct answer.',
    '- Verify calculations twice so the marked correct option is 100% mathematically and factually accurate.',
    '- Include a clear 1–3 sentence step-by-step explanation for every question so students learn immediately upon review.',
    '- Follow official Nigerian JAMB UTME / UI Post-UTME curriculum phrasing and standards.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an experienced Nigerian senior tutor and chief examiner setting authentic, error-free JAMB UTME and University of Ibadan (UI) Post-UTME multiple-choice questions with verified answer keys and concise student explanations.',
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
                    description: 'Self-contained question stem without leading Q1/1. numbering.',
                  },
                  difficulty: {
                    type: Type.STRING,
                    description: 'One of easy, medium, or hard.',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Step-by-step 1–3 sentence explanation of the correct option.',
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        optionKey: {
                          type: Type.STRING,
                          description: 'Uppercase letter A, B, C, or D.',
                        },
                        optionText: {
                          type: Type.STRING,
                          description: 'Option wording without leading A./B. label.',
                        },
                        isCorrect: {
                          type: Type.BOOLEAN,
                          description: 'True only for the single verified correct option.',
                        },
                      },
                      required: ['optionKey', 'optionText', 'isCorrect'],
                    },
                  },
                },
                required: ['questionText', 'explanation', 'options'],
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
        difficulty?: string;
        explanation?: string;
        options?: Array<{
          optionKey?: string;
          optionText?: string;
          isCorrect?: boolean;
        }>;
      }>;
    };

    const rawList = Array.isArray(parsed.questions) ? parsed.questions : [];
    const normalized: AiGeneratedQuestionDraft[] = [];

    for (const item of rawList) {
      const questionText = (item.questionText || '')
        .replace(/^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.):]\s+/i, '')
        .trim();
      if (!questionText) continue;

      const cleanedOptions = (Array.isArray(item.options) ? item.options : [])
        .slice(0, 4)
        .map((opt, idx) => ({
          optionKey: OPTION_LETTERS[idx] || String(idx + 1),
          optionText: (opt.optionText || '')
            .replace(/^[A-F]\s*[.):]\s+/i, '')
            .trim(),
          isCorrect: Boolean(opt.isCorrect),
        }))
        .filter((o) => o.optionText.length > 0);

      if (cleanedOptions.length < 2) continue;

      // Ensure strictly 1 correct answer
      const firstCorrectIdx = cleanedOptions.findIndex((o) => o.isCorrect);
      const safeCorrectIdx = firstCorrectIdx >= 0 ? firstCorrectIdx : 0;
      const fixedOptions = cleanedOptions.map((o, idx) => ({
        ...o,
        isCorrect: idx === safeCorrectIdx,
      }));

      const diffRaw = (item.difficulty || 'medium').trim().toLowerCase();
      const normalizedDifficulty: QuestionDifficulty =
        diffRaw === 'easy' || diffRaw === 'hard' ? diffRaw : 'medium';

      normalized.push({
        questionText,
        explanation: (item.explanation || '').trim(),
        difficulty: normalizedDifficulty,
        points: 1,
        options: fixedOptions,
      });
    }

    if (normalized.length === 0) {
      return {
        status: 502,
        body: { error: 'AI returned no valid questions. Try narrowing the topic instructions.' },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        questions: normalized.slice(0, count),
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected Gemini question generation error.';
    return { status: 502, body: { error: message } };
  }
}
