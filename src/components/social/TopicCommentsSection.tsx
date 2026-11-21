import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MessageSquare, MessageSquareOff, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteTopicComment,
  fetchTopicComments,
  postTopicComment,
} from '../../services/engagementService';
import type { TopicCommentItem } from '../../types/engagement';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';

interface TopicCommentsSectionProps {
  topicId: string;
  topicTitle: string;
  commentsEnabled: boolean;
  lessonId?: string | null;
  onCommentsCountChange?: (topicId: string, count: number) => void;
}

function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TopicCommentsSection({
  topicId,
  topicTitle,
  commentsEnabled,
  lessonId = null,
  onCommentsCountChange,
}: TopicCommentsSectionProps) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [comments, setComments] = useState<TopicCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchTopicComments(topicId);
    setMigrationRequired(res.migrationRequired);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setComments(res.comments);
    onCommentsCountChange?.(topicId, res.comments.length);
    setLoading(false);
  }, [topicId, onCommentsCountChange]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    setPosting(true);
    const res = await postTopicComment({
      topicId,
      lessonId,
      userId: user.id,
      body,
    });
    setPosting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setBody('');
    await loadComments();
  }

  async function handleDelete(commentId: string) {
    setError(null);
    setDeletingId(commentId);
    const res = await deleteTopicComment(commentId);
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (res.error) {
      setError(res.error);
      return;
    }

    await loadComments();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {commentsEnabled ? (
            <MessageSquare
              className="h-4 w-4 text-phosters-700 dark:text-phosters-400"
              aria-hidden="true"
            />
          ) : (
            <MessageSquareOff
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
          )}
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Topic discussion · {topicTitle}
          </h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {migrationRequired && (
        <Alert tone="info">
          Run <code className="font-mono text-xs">supabase/migrations/007_social_engagement.sql</code> in Supabase to activate student comments.
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {!commentsEnabled && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
          {isAdmin
            ? 'Comments are currently disabled for students on this topic. As an administrator, you can still post or moderate below.'
            : 'Comments have been turned off for this topic by your instructor.'}
        </div>
      )}

      {!migrationRequired && (commentsEnabled || isAdmin) && (
        <form onSubmit={handlePost} className="space-y-2">
          <label htmlFor={`comment-${topicId}`} className="sr-only">
            Add a comment on {topicTitle}
          </label>
          <textarea
            id={`comment-${topicId}`}
            rows={2}
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Ask a question or share a helpful note on ${topicTitle}...`}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {body.length}/1000
            </span>
            <Button type="submit" variant="primary" loading={posting} disabled={!body.trim()}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Post Comment</span>
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
          {commentsEnabled
            ? 'No comments on this topic yet. Be the first to start a discussion.'
            : 'No comments were posted on this topic.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          {comments.map((comment) => {
            const canDelete = comment.is_own || isAdmin;
            const isConfirming = confirmDeleteId === comment.id;
            return (
              <li key={comment.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {comment.author_name}
                      </span>
                      {comment.author_role === 'admin' && (
                        <span className="font-semibold text-phosters-700 dark:text-phosters-400">
                          Tutor / Admin
                        </span>
                      )}
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatCommentDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line break-words leading-relaxed">
                      {comment.body}
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() =>
                        setConfirmDeleteId(isConfirming ? null : comment.id)
                      }
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 px-3 py-2 text-xs text-red-900 dark:text-red-200">
                    <span>Delete this comment?</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        loading={deletingId === comment.id}
                        onClick={() => void handleDelete(comment.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
