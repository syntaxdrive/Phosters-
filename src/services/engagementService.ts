import { supabase } from '../lib/supabase';
import type { EngagementTargetType, UserRole } from '../types/database';
import type { EngagementStats, TopicCommentItem } from '../types/engagement';

function isMissingMigrationError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === '42883' ||
    err.code === '42703' ||
    err.code === 'PGRST202' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the function')
  );
}

function mapEngagementError(err: { code?: string; message?: string } | null): string {
  if (!err) return 'An unexpected error occurred.';
  if (isMissingMigrationError(err)) {
    return 'Social engagement tables are not set up yet. Run supabase/migrations/007_social_engagement.sql in your Supabase SQL Editor.';
  }
  if (err.code === '42501') {
    return 'Comments are currently disabled for this topic or you do not have permission.';
  }
  return err.message || 'Unable to process this request right now.';
}

export function buildCourseTargetKey(examId: string, subjectId: string): string {
  return `${examId}:${subjectId}`;
}

export async function fetchEngagementStats(
  targets: Array<{ targetType: EngagementTargetType; targetKey: string }>
): Promise<{
  statsMap: Map<string, EngagementStats>;
  migrationRequired: boolean;
  error: string | null;
}> {
  const statsMap = new Map<string, EngagementStats>();
  if (!supabase || targets.length === 0) {
    return { statsMap, migrationRequired: false, error: null };
  }

  const payload = targets.map((t) => ({
    target_type: t.targetType,
    target_key: t.targetKey,
  }));

  const { data, error } = await supabase.rpc('get_engagement_stats', {
    p_targets: payload,
  });

  if (error) {
    if (isMissingMigrationError(error)) {
      return { statsMap, migrationRequired: true, error: null };
    }
    return { statsMap, migrationRequired: false, error: mapEngagementError(error) };
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{
    target_type: EngagementTargetType;
    target_key: string;
    likes_count: number;
    liked_by_me: boolean;
    views_count: number;
    comments_count: number;
  }>;

  for (const row of rows) {
    statsMap.set(`${row.target_type}:${row.target_key}`, {
      targetType: row.target_type,
      targetKey: row.target_key,
      likesCount: Number(row.likes_count ?? 0),
      likedByMe: Boolean(row.liked_by_me),
      viewsCount: Number(row.views_count ?? 0),
      commentsCount: Number(row.comments_count ?? 0),
    });
  }

  return { statsMap, migrationRequired: false, error: null };
}

export async function recordContentView(
  targetType: EngagementTargetType,
  targetKey: string
): Promise<{ viewsCount: number | null; error: string | null }> {
  if (!supabase || !targetKey) return { viewsCount: null, error: null };

  const { data, error } = await supabase.rpc('record_content_view', {
    p_target_type: targetType,
    p_target_key: targetKey,
  });

  if (error) {
    if (isMissingMigrationError(error)) {
      return { viewsCount: null, error: null };
    }
    return { viewsCount: null, error: mapEngagementError(error) };
  }

  return { viewsCount: Number(data ?? 0), error: null };
}

export async function toggleContentLike(
  targetType: EngagementTargetType,
  targetKey: string
): Promise<{
  liked: boolean | null;
  likesCount: number | null;
  error: string | null;
}> {
  if (!supabase) {
    return { liked: null, likesCount: null, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.rpc('toggle_content_like', {
    p_target_type: targetType,
    p_target_key: targetKey,
  });

  if (error) {
    return { liked: null, likesCount: null, error: mapEngagementError(error) };
  }

  const result = (data ?? {}) as { liked?: boolean; likes_count?: number };
  return {
    liked: Boolean(result.liked),
    likesCount: Number(result.likes_count ?? 0),
    error: null,
  };
}

export async function fetchTopicComments(topicId: string): Promise<{
  comments: TopicCommentItem[];
  migrationRequired: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return { comments: [], migrationRequired: false, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.rpc('get_topic_comments', {
    p_topic_id: topicId,
  });

  if (error) {
    if (isMissingMigrationError(error)) {
      return { comments: [], migrationRequired: true, error: null };
    }
    return { comments: [], migrationRequired: false, error: mapEngagementError(error) };
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{
    id: string;
    topic_id: string;
    lesson_id: string | null;
    user_id: string;
    author_name: string;
    author_role: string;
    body: string;
    created_at: string;
    is_own: boolean;
  }>;

  return {
    comments: rows.map((r) => ({
      id: r.id,
      topic_id: r.topic_id,
      lesson_id: r.lesson_id,
      user_id: r.user_id,
      author_name: r.author_name || 'Phosters Student',
      author_role: (r.author_role === 'admin' ? 'admin' : 'student') as UserRole,
      body: r.body,
      created_at: r.created_at,
      is_own: Boolean(r.is_own),
    })),
    migrationRequired: false,
    error: null,
  };
}

export async function postTopicComment(input: {
  topicId: string;
  lessonId?: string | null;
  userId: string;
  body: string;
}): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const cleanBody = input.body.trim();
  if (!cleanBody) {
    return { error: 'Please write a comment before posting.' };
  }
  if (cleanBody.length > 1000) {
    return { error: 'Comments must be 1,000 characters or fewer.' };
  }

  const { error } = await supabase.from('topic_comments').insert({
    topic_id: input.topicId,
    lesson_id: input.lessonId ?? null,
    user_id: input.userId,
    body: cleanBody,
  });

  if (error) {
    return { error: mapEngagementError(error) };
  }

  return { error: null };
}

export async function deleteTopicComment(commentId: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error } = await supabase
    .from('topic_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    return { error: mapEngagementError(error) };
  }

  return { error: null };
}
