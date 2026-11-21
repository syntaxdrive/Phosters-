import type { PushNotificationType } from './database';

export interface PushPreferences {
  notify_lessons: boolean;
  notify_tests: boolean;
  notify_broadcasts: boolean;
  notify_reminders: boolean;
}

export type PushAuthMode = 'service_role' | 'admin_jwt' | 'none';

export interface PushServerStatus {
  configured: boolean;
  authMode: PushAuthMode;
  supabaseUrlConfigured: boolean;
  anonKeyConfigured: boolean;
  vapidPublicKeyConfigured: boolean;
  vapidPrivateKeyConfigured: boolean;
  serviceRoleConfigured: boolean;
  cronSecretConfigured: boolean;
}

export interface GeneratedVapidKeypair {
  publicKey: string;
  privateKey: string;
}

export interface PublicPushConfig {
  vapidPublicKey: string;
}

export type SendPushPayload =
  | {
      type: 'lesson';
      lessonId: string;
    }
  | {
      type: 'test';
      testId: string;
      onlyUnattempted?: boolean;
    }
  | {
      type: 'broadcast';
      announcementId: string;
    }
  | {
      type: 'custom';
      title: string;
      body: string;
      targetUrl?: string;
      studentIds?: string[];
      preferenceCategory?: 'lessons' | 'tests' | 'broadcasts' | 'reminders';
    };

export interface SendPushResponse {
  ok: boolean;
  notificationType: PushNotificationType;
  recipientsCount: number;
  deliveredCount: number;
  failedCount: number;
  removedExpiredCount: number;
  message: string;
}

export interface RemindInactiveInput {
  inactiveDays?: number;
  cooldownHours?: number;
  studentIds?: string[];
  force?: boolean;
}

export interface RemindInactiveResponse {
  ok: boolean;
  evaluatedSubscriptions: number;
  targetedCount: number;
  deliveredCount: number;
  failedCount: number;
  removedExpiredCount: number;
  message: string;
}
