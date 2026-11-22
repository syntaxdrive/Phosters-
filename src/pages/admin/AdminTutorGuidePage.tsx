import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { TUTOR_GUIDE_CHAPTERS } from '../../data/tutorGuideChapters';
import { AdminNav } from '../../components/admin/AdminNav';
import { TutorMotionStage } from '../../components/admin/TutorMotionStage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

const SPEED_OPTIONS = [0.8, 1, 1.25] as const;

export function AdminTutorGuidePage() {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [replayNonce, setReplayNonce] = useState(0);

  const chapter = TUTOR_GUIDE_CHAPTERS[chapterIndex];
  const durationSec = chapter.durationSec;
  const rawBeat = Math.min(3, Math.floor((elapsedSec / durationSec) * 4));
  const beatIndex = rawBeat as 0 | 1 | 2 | 3;
  const progressPercent = (elapsedSec / durationSec) * 100;

  const goToChapter = useCallback((nextIndex: number, keepPlaying = true) => {
    const clamped =
      (nextIndex + TUTOR_GUIDE_CHAPTERS.length) % TUTOR_GUIDE_CHAPTERS.length;
    setChapterIndex(clamped);
    setElapsedSec(0);
    setReplayNonce((n) => n + 1);
    setIsPlaying(keepPlaying);
  }, []);

  const jumpToBeat = useCallback(
    (beat: 0 | 1 | 2 | 3) => {
      const targetSec = (beat / 4) * durationSec + 0.05;
      setElapsedSec(Math.min(durationSec - 0.1, targetSec));
      setReplayNonce((n) => n + 1);
    },
    [durationSec]
  );

  const handleRestart = useCallback(() => {
    setElapsedSec(0);
    setReplayNonce((n) => n + 1);
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const tickMs = 100;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + (tickMs / 1000) * speed;
        if (next >= durationSec) {
          if (autoAdvance && chapterIndex < TUTOR_GUIDE_CHAPTERS.length - 1) {
            setChapterIndex((idx) =>
              Math.min(TUTOR_GUIDE_CHAPTERS.length - 1, idx + 1)
            );
            setReplayNonce((n) => n + 1);
            return 0;
          }
          if (autoAdvance && chapterIndex === TUTOR_GUIDE_CHAPTERS.length - 1) {
            setIsPlaying(false);
            return durationSec;
          }
          setIsPlaying(false);
          return durationSec;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, speed, durationSec, autoAdvance, chapterIndex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.code === 'ArrowRight') {
        e.preventDefault();
        goToChapter(chapterIndex + 1, isPlaying);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        goToChapter(chapterIndex - 1, isPlaying);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chapterIndex, goToChapter, isPlaying]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tutor Motion Guide
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Interactive walkthrough</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {TUTOR_GUIDE_CHAPTERS.length} chapters
            </span>
            <span aria-hidden="true">·</span>
            <span>Low-data CSS motion graphics</span>
          </div>
        </div>

        <Link
          to={chapter.routeTo}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <span>{chapter.routeLabel}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <AdminNav />

      {/* Two-zone interactive sandbox: Motion Stage (left) + Chapter Deck (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Zone: Interactive Motion Stage & Playback Deck */}
        <div className="lg:col-span-8 space-y-4">
          <TutorMotionStage
            chapter={chapter}
            beatIndex={beatIndex}
            isPlaying={isPlaying}
            progressPercent={progressPercent}
            sceneInstanceKey={`${chapter.id}-${replayNonce}`}
          />

          {/* Playback & Beat Controller */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (elapsedSec >= durationSec) {
                      handleRestart();
                    } else {
                      setIsPlaying((p) => !p);
                    }
                  }}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>{elapsedSec >= durationSec ? 'Replay' : 'Play'}</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRestart}
                  aria-label="Restart current chapter"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Restart</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goToChapter(chapterIndex - 1, isPlaying)}
                  disabled={chapterIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Prev</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goToChapter(chapterIndex + 1, isPlaying)}
                  disabled={chapterIndex === TUTOR_GUIDE_CHAPTERS.length - 1}
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Speed segmented selector */}
                <div
                  role="group"
                  aria-label="Playback speed"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1"
                >
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSpeed(opt)}
                      className={[
                        'min-h-[34px] px-2.5 rounded-md text-xs font-semibold tabular-nums whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                        speed === opt
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
                      ].join(' ')}
                    >
                      {opt}x
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                  />
                  <span>Auto-advance</span>
                </label>
              </div>
            </div>

            {/* Interactive 4-beat step scrubber */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {chapter.beats.map((beat, idx) => {
                const bIdx = idx as 0 | 1 | 2 | 3;
                const active = beatIndex === bIdx;
                return (
                  <button
                    key={beat.title}
                    type="button"
                    onClick={() => jumpToBeat(bIdx)}
                    className={[
                      'text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer',
                      active
                        ? 'border-phosters-600 dark:border-phosters-500 bg-phosters-50/70 dark:bg-phosters-900/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60',
                    ].join(' ')}
                  >
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      STEP 0{idx + 1}
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {beat.title}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Action Checklist for Current Chapter */}
          <Card padding="lg" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {chapter.number}. {chapter.title}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {chapter.subtitle}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {chapter.summary}
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {chapter.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Right Zone: 7-Chapter Index */}
        <div className="lg:col-span-4 space-y-2">
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Course Chapters
              </span>
              <span className="tabular-nums">
                {chapterIndex + 1} / {TUTOR_GUIDE_CHAPTERS.length}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {TUTOR_GUIDE_CHAPTERS.map((item, idx) => {
                const active = idx === chapterIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToChapter(idx, true)}
                    className={[
                      'w-full text-left py-3 px-2.5 first:pt-2 last:pb-2 rounded-lg transition-colors cursor-pointer flex items-start justify-between gap-3',
                      active
                        ? 'bg-phosters-50 dark:bg-phosters-900/40 text-phosters-900 dark:text-phosters-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300',
                    ].join(' ')}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className="font-mono text-xs text-phosters-700 dark:text-phosters-400 tabular-nums">
                          {item.number}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.subtitle}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0 mt-0.5">
                      {item.durationSec}s
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
