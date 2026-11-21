import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react';
import type { SharePayload } from '../../types/engagement';
import { Button } from '../ui/Button';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  payload: SharePayload | null;
}

function getAppOrigin(): string {
  if (typeof window === 'undefined') return 'https://phosters.academy';
  return window.location.origin;
}

export function buildCourseSharePayload(params: {
  examName: string;
  examSlug: string;
  subjectName: string;
  subjectSlug: string;
}): SharePayload {
  const query = new URLSearchParams({
    kind: 'course',
    exam: params.examName,
    subject: params.subjectName,
    examSlug: params.examSlug,
    subjectSlug: params.subjectSlug,
  });
  const shareUrl = `${getAppOrigin()}/share?${query.toString()}`;
  const shareText = `I'm taking ${params.subjectName} (${params.examName}) for free on Phosters Academy! Join me for structured video lessons, notes & practice tests.`;

  return {
    kind: 'course',
    title: `${params.examName} · ${params.subjectName}`,
    subtitle: 'Share this course with friends and classmates',
    shareText,
    shareUrl,
  };
}

export function buildLessonSharePayload(params: {
  examName: string;
  examSlug: string;
  subjectName: string;
  subjectSlug: string;
  lessonTitle: string;
}): SharePayload {
  const query = new URLSearchParams({
    kind: 'course',
    exam: params.examName,
    subject: params.subjectName,
    title: params.lessonTitle,
    examSlug: params.examSlug,
    subjectSlug: params.subjectSlug,
  });
  const shareUrl = `${getAppOrigin()}/share?${query.toString()}`;
  const shareText = `I'm studying "${params.lessonTitle}" in ${params.subjectName} (${params.examName}) on Phosters Academy! Learn and practice for free:`;

  return {
    kind: 'lesson',
    title: params.lessonTitle,
    subtitle: `${params.examName} · ${params.subjectName}`,
    shareText,
    shareUrl,
  };
}

export function buildTestResultSharePayload(params: {
  testTitle: string;
  percentage: number;
  score: number;
  totalPoints: number;
  examName?: string | null;
  subjectName?: string | null;
}): SharePayload {
  const pct = Math.round(Number(params.percentage));
  const examLabel = params.examName?.trim() || 'JAMB UTME / UI Post-UTME';
  const subjectPart = params.subjectName?.trim() ? ` (${params.subjectName.trim()})` : '';

  const query = new URLSearchParams({
    kind: 'test',
    exam: examLabel,
    title: params.testTitle,
    pct: String(pct),
    score: String(params.score),
    total: String(params.totalPoints),
  });
  if (params.subjectName?.trim()) {
    query.set('subject', params.subjectName.trim());
  }

  const shareUrl = `${getAppOrigin()}/share?${query.toString()}`;
  const shareText = `I just took a free ${examLabel}${subjectPart} test ("${params.testTitle}") on Phosters Academy for free and scored ${pct}% (${params.score}/${params.totalPoints})! Try a free test too:`;

  return {
    kind: 'test',
    title: `${pct}% on ${params.testTitle}`,
    subtitle: 'Share your test result across your social platforms',
    shareText,
    shareUrl,
  };
}

export function ShareDialog({ open, onClose, payload }: ShareDialogProps) {
  const [caption, setCaption] = useState('');
  const [copied, setCopied] = useState(false);
  const [nativeNotice, setNativeNotice] = useState<string | null>(null);

  useEffect(() => {
    if (payload) {
      setCaption(payload.shareText);
      setCopied(false);
      setNativeNotice(null);
    }
  }, [payload]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !payload) return null;

  const trimmedText = caption.trim() || payload.shareText;
  const fullMessageWithUrl = `${trimmedText} ${payload.shareUrl}`;
  const canUseNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const platforms = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(fullMessageWithUrl)}`,
      className:
        'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent',
    },
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(trimmedText)}&url=${encodeURIComponent(payload.shareUrl)}`,
      className:
        'bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 border-transparent',
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.shareUrl)}&quote=${encodeURIComponent(trimmedText)}`,
      className:
        'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(payload.shareUrl)}&text=${encodeURIComponent(trimmedText)}`,
      className:
        'bg-sky-600 hover:bg-sky-700 text-white border-transparent',
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(payload.shareUrl)}`,
      className:
        'bg-blue-800 hover:bg-blue-900 text-white border-transparent',
    },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullMessageWithUrl);
      setCopied(true);
      setNativeNotice(null);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setNativeNotice('Clipboard access was blocked. Select and copy the link manually.');
    }
  }

  async function handleNativeShare() {
    if (!canUseNativeShare || !payload) return;
    setNativeNotice(null);
    try {
      await navigator.share({
        title: `Phosters Academy · ${payload.title}`,
        text: trimmedText,
        url: payload.shareUrl,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setNativeNotice('Could not open device share sheet. Use the social links below.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0">
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="share-dialog-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                {payload.title}
              </h2>
              {payload.subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {payload.subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close share dialog"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="share-caption-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Your share message (editable)
          </label>
          <textarea
            id="share-caption-input"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={400}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Share to platform
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {platforms.map((platform) => (
              <a
                key={platform.name}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors ${platform.className}`}
              >
                <span>{platform.name}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {nativeNotice && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{nativeNotice}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {canUseNativeShare && (
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => void handleNativeShare()}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span>More Apps (Device Share)</span>
            </Button>
          )}
          <Button
            type="button"
            variant={canUseNativeShare ? 'secondary' : 'primary'}
            fullWidth
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Copied Text &amp; Link</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Copy Text &amp; Link</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
