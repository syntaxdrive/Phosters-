import type { EngagementTargetType, UserRole } from './database';

export type EngagementStats = {
  targetType: EngagementTargetType;
  targetKey: string;
  likesCount: number;
  likedByMe: boolean;
  viewsCount: number;
  commentsCount: number;
};

export type TopicCommentItem = {
  id: string;
  topic_id: string;
  lesson_id: string | null;
  user_id: string;
  author_name: string;
  author_role: UserRole;
  body: string;
  created_at: string;
  is_own: boolean;
};

export type SharePayload = {
  kind: 'course' | 'lesson' | 'test';
  title: string;
  shareText: string;
  shareUrl: string;
  subtitle?: string;
};
