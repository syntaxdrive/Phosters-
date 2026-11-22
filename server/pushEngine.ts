import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { generateVAPIDKeys, sendNotification, setVapidDetails } from 'web-push';
import type { Database, PushNotificationType, PushSubscriptionRecord } from '../src/types/database';
import type {
  GeneratedVapidKeypair,
  PublicPushConfig,
  PushAuthMode,
  PushServerStatus,
  RemindInactiveInput,
  RemindInactiveResponse,
  SendPushPayload,
  SendPushResponse,
} from '../src/types/push';

function getServerEnv() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const supabaseAnonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const vapidPublicKey = (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.VITE_VAPID_PUBLIC_KEY ||
    ''
  ).trim();
  const vapidPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const rawSubject = (process.env.VAPID_SUBJECT || 'mailto:notifications@phosters.com').trim();
  const vapidSubject =
    rawSubject.startsWith('mailto:') || rawSubject.startsWith('https://')
      ? rawSubject
      : `mailto:${rawSubject}`;
  const cronSecret = (process.env.CRON_SECRET || '').trim();

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    cronSecret,
  };
}

export function getPublicPushConfig(): PublicPushConfig {
  const env = getServerEnv();
  return {
    vapidPublicKey: env.vapidPublicKey,
  };
}

export function generateFreshVapidKeypair(): GeneratedVapidKeypair {
  return generateVAPIDKeys();
}

export function getPushServerStatus(): PushServerStatus {
  const env = getServerEnv();
  const supabaseUrlConfigured = Boolean(env.supabaseUrl);
  const anonKeyConfigured = Boolean(env.supabaseAnonKey);
  const vapidPublicKeyConfigured = Boolean(env.vapidPublicKey);
  const vapidPrivateKeyConfigured = Boolean(env.vapidPrivateKey);
  const serviceRoleConfigured = Boolean(env.supabaseUrl && env.serviceRoleKey);
  const cronSecretConfigured = Boolean(env.cronSecret);

  const authMode: PushAuthMode = serviceRoleConfigured
    ? 'service_role'
    : supabaseUrlConfigured && anonKeyConfigured
      ? 'admin_jwt'
      : 'none';

  return {
    configured:
      vapidPublicKeyConfigured && vapidPrivateKeyConfigured && authMode !== 'none',
    authMode,
    supabaseUrlConfigured,
    anonKeyConfigured,
    vapidPublicKeyConfigured,
    vapidPrivateKeyConfigured,
    serviceRoleConfigured,
    cronSecretConfigured,
  };
}

function getServiceRoleSupabaseClient(): {
  client: SupabaseClient<Database> | null;
  error: string | null;
} {
  const env = getServerEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return {
      client: null,
      error:
        'Unattended push delivery requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    };
  }

  const client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { client, error: null };
}

function getUserScopedSupabaseClient(accessToken: string): {
  client: SupabaseClient<Database> | null;
  error: string | null;
} {
  const env = getServerEnv();
  if (!env.supabaseUrl || (!env.supabaseAnonKey && !env.serviceRoleKey)) {
    return {
      client: null,
      error:
        'Server push delivery requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY).',
    };
  }

  const apiKey = env.serviceRoleKey || env.supabaseAnonKey;
  const client = createClient<Database>(env.supabaseUrl, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  return { client, error: null };
}

function ensureWebPushConfigured(): { ok: boolean; error?: string } {
  const env = getServerEnv();
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    return {
      ok: false,
      error:
        'Web Push VAPID keys are not configured. Set VAPID_PUBLIC_KEY (or VITE_VAPID_PUBLIC_KEY) and VAPID_PRIVATE_KEY on the server.',
    };
  }

  try {
    setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Invalid VAPID configuration: ${err.message}`
          : 'Invalid VAPID configuration.',
    };
  }
}

function sanitizeTargetPath(raw: unknown, fallback = '/app'): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }
  return trimmed.slice(0, 300);
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function verifyAdminAuthorization(authorizationHeader: string | undefined): Promise<{
  ok: boolean;
  status: number;
  userId?: string;
  userEmail?: string | null;
  client?: SupabaseClient<Database>;
  usingServiceRole?: boolean;
  error?: string;
}> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token.' };
  }

  const env = getServerEnv();
  const serviceRes = env.serviceRoleKey ? getServiceRoleSupabaseClient() : null;
  const scopedRes = serviceRes?.client
    ? serviceRes
    : getUserScopedSupabaseClient(token);

  if (!scopedRes.client) {
    return { ok: false, status: 503, error: scopedRes.error || 'Server not configured.' };
  }

  const client = scopedRes.client;
  const { data: userData, error: authErr } = await client.auth.getUser(token);
  if (authErr || !userData.user) {
    return { ok: false, status: 401, error: 'Invalid or expired session token.' };
  }

  const { data: profile, error: profileErr } = await client
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileErr || profile?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Administrator access required.' };
  }

  return {
    ok: true,
    status: 200,
    userId: userData.user.id,
    userEmail: userData.user.email ?? null,
    client,
    usingServiceRole: Boolean(serviceRes?.client),
  };
}

export async function verifyCronOrAdminAuthorization(
  authorizationHeader: string | undefined
): Promise<{
  ok: boolean;
  status: number;
  triggeredByUserId: string | null;
  client?: SupabaseClient<Database>;
  usingServiceRole?: boolean;
  error?: string;
}> {
  const token = extractBearerToken(authorizationHeader);
  const { cronSecret } = getServerEnv();

  if (token && cronSecret) {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(cronSecret);
    if (
      tokenBuf.length === secretBuf.length &&
      crypto.timingSafeEqual(tokenBuf, secretBuf)
    ) {
      const { client, error } = getServiceRoleSupabaseClient();
      if (!client) {
        return {
          ok: false,
          status: 503,
          triggeredByUserId: null,
          error: error || 'Cron reminder delivery requires SUPABASE_SERVICE_ROLE_KEY.',
        };
      }
      return {
        ok: true,
        status: 200,
        triggeredByUserId: null,
        client,
        usingServiceRole: true,
      };
    }
  }

  const adminCheck = await verifyAdminAuthorization(authorizationHeader);
  if (!adminCheck.ok || !adminCheck.client) {
    return {
      ok: false,
      status: adminCheck.status,
      triggeredByUserId: null,
      error: adminCheck.error,
    };
  }

  return {
    ok: true,
    status: 200,
    triggeredByUserId: adminCheck.userId ?? null,
    client: adminCheck.client,
    usingServiceRole: adminCheck.usingServiceRole,
  };
}

async function resolveEnrolledStudentIds(
  client: SupabaseClient<Database>,
  examId: string,
  subjectId?: string | null
): Promise<string[]> {
  const { data: profiles } = await client
    .from('student_exam_profiles')
    .select('id, student_id')
    .eq('exam_id', examId);

  const examProfiles = profiles ?? [];
  if (examProfiles.length === 0) return [];

  if (!subjectId) {
    return Array.from(new Set(examProfiles.map((p) => p.student_id)));
  }

  const profileIds = examProfiles.map((p) => p.id);
  const profileToStudent = new Map(examProfiles.map((p) => [p.id, p.student_id]));

  const { data: subjectLinks } = await client
    .from('student_exam_subjects')
    .select('student_exam_profile_id')
    .in('student_exam_profile_id', profileIds)
    .eq('subject_id', subjectId);

  const studentIds = new Set<string>();
  for (const link of subjectLinks ?? []) {
    const sid = profileToStudent.get(link.student_exam_profile_id);
    if (sid) studentIds.add(sid);
  }
  return Array.from(studentIds);
}

async function deliverToSubscriptions(
  client: SupabaseClient<Database>,
  subscriptions: PushSubscriptionRecord[],
  payloadBuilder: (sub: PushSubscriptionRecord) => {
    title: string;
    body: string;
    url: string;
    tag: string;
  },
  logMeta: {
    notificationType: PushNotificationType;
    summaryTitle: string;
    summaryBody: string;
    summaryUrl: string;
    sentBy: string | null;
  }
): Promise<{
  recipientsCount: number;
  deliveredCount: number;
  failedCount: number;
  removedExpiredCount: number;
}> {
  if (subscriptions.length === 0) {
    await client.from('push_notification_logs').insert({
      notification_type: logMeta.notificationType,
      title: logMeta.summaryTitle.slice(0, 160),
      body: logMeta.summaryBody.slice(0, 500),
      target_url: sanitizeTargetPath(logMeta.summaryUrl),
      sent_by: logMeta.sentBy,
      recipients_count: 0,
      delivered_count: 0,
      failed_count: 0,
    });

    return {
      recipientsCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      removedExpiredCount: 0,
    };
  }

  const deliveredIds: string[] = [];
  const expiredIds: string[] = [];
  let failedCount = 0;

  const BATCH_SIZE = 20;
  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (sub) => {
        const msg = payloadBuilder(sub);
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title: msg.title,
            body: msg.body,
            url: sanitizeTargetPath(msg.url),
            tag: msg.tag,
          }),
          { TTL: 60 * 60 * 24 }
        );
        return sub.id;
      })
    );

    results.forEach((result, idx) => {
      const sub = batch[idx];
      if (result.status === 'fulfilled') {
        deliveredIds.push(sub.id);
      } else {
        const statusCode =
          typeof result.reason === 'object' &&
          result.reason !== null &&
          'statusCode' in result.reason
            ? Number((result.reason as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        } else {
          failedCount += 1;
        }
      }
    });
  }

  if (expiredIds.length > 0) {
    try {
      await client.from('push_subscriptions').delete().in('id', expiredIds);
    } catch {
      // Ignore cleanup failures if admin delete RLS migration 009 has not been run yet
    }
  }

  if (deliveredIds.length > 0) {
    try {
      await client
        .from('push_subscriptions')
        .update({ last_notified_at: new Date().toISOString() })
        .in('id', deliveredIds);
    } catch {
      // Ignore timestamp update failures if admin update RLS migration 009 has not been run yet
    }
  }

  try {
    await client.from('push_notification_logs').insert({
      notification_type: logMeta.notificationType,
      title: logMeta.summaryTitle.slice(0, 160),
      body: logMeta.summaryBody.slice(0, 500),
      target_url: sanitizeTargetPath(logMeta.summaryUrl),
      sent_by: logMeta.sentBy,
      recipients_count: subscriptions.length,
      delivered_count: deliveredIds.length,
      failed_count: failedCount + expiredIds.length,
    });
  } catch {
    // Do not fail a completed Web Push delivery if log insertion fails
  }

  return {
    recipientsCount: subscriptions.length,
    deliveredCount: deliveredIds.length,
    failedCount,
    removedExpiredCount: expiredIds.length,
  };
}

export async function sendTargetedPushNotifications(
  input: SendPushPayload,
  adminUserId: string,
  authorizedClient?: SupabaseClient<Database>
): Promise<{ status: number; body: SendPushResponse | { error: string } }> {
  const clientRes = authorizedClient
    ? { client: authorizedClient, error: null }
    : getServiceRoleSupabaseClient();
  const { client, error: clientErr } = clientRes;
  if (!client) {
    return { status: 503, body: { error: clientErr || 'Server not configured.' } };
  }

  const pushReady = ensureWebPushConfigured();
  if (!pushReady.ok) {
    return { status: 503, body: { error: pushReady.error || 'VAPID not configured.' } };
  }

  let notificationType: PushNotificationType = 'custom';
  let title = '';
  let bodyText = '';
  let targetUrl = '/app';
  let tag = 'phosters-update';
  let preferenceColumn:
    | 'notify_lessons'
    | 'notify_tests'
    | 'notify_broadcasts'
    | 'notify_reminders' = 'notify_broadcasts';
  let targetStudentIds: string[] | null = null;

  if (input.type === 'lesson') {
    notificationType = 'lesson';
    preferenceColumn = 'notify_lessons';
    const { data: lesson } = await client
      .from('lessons')
      .select('id, title, topic_id, is_published')
      .eq('id', input.lessonId)
      .maybeSingle();

    if (!lesson) {
      return { status: 404, body: { error: 'Lesson not found.' } };
    }
    if (!lesson.is_published) {
      return {
        status: 400,
        body: { error: 'Publish the lesson before notifying students.' },
      };
    }

    const { data: topic } = await client
      .from('topics')
      .select('id, exam_id, subject_id, title, is_published')
      .eq('id', lesson.topic_id)
      .maybeSingle();

    if (!topic) {
      return { status: 404, body: { error: 'Parent topic not found.' } };
    }

    const [{ data: exam }, { data: subject }] = await Promise.all([
      client.from('exams').select('name').eq('id', topic.exam_id).maybeSingle(),
      client.from('subjects').select('name').eq('id', topic.subject_id).maybeSingle(),
    ]);

    targetStudentIds = await resolveEnrolledStudentIds(
      client,
      topic.exam_id,
      topic.subject_id
    );

    const subjectLabel = subject?.name || 'New Lecture';
    const examLabel = exam?.name || 'Phosters';
    title = `New Lecture: ${subjectLabel} (${examLabel})`;
    bodyText = `${lesson.title} is now available to watch and study.`;
    targetUrl = `/app/lessons/${lesson.id}`;
    tag = `lesson-${lesson.id}`;
  } else if (input.type === 'test') {
    notificationType = 'test';
    preferenceColumn = 'notify_tests';
    const { data: test } = await client
      .from('tests')
      .select('id, title, topic_id, lesson_id, is_published')
      .eq('id', input.testId)
      .maybeSingle();

    if (!test) {
      return { status: 404, body: { error: 'Test not found.' } };
    }
    if (!test.is_published) {
      return {
        status: 400,
        body: { error: 'Publish the test before notifying students.' },
      };
    }

    let resolvedTopicId = test.topic_id;
    if (!resolvedTopicId && test.lesson_id) {
      const { data: lesson } = await client
        .from('lessons')
        .select('topic_id')
        .eq('id', test.lesson_id)
        .maybeSingle();
      resolvedTopicId = lesson?.topic_id ?? null;
    }

    if (!resolvedTopicId) {
      return {
        status: 400,
        body: { error: 'Test is not attached to a topic or lesson.' },
      };
    }

    const { data: topic } = await client
      .from('topics')
      .select('id, exam_id, subject_id')
      .eq('id', resolvedTopicId)
      .maybeSingle();

    if (!topic) {
      return { status: 404, body: { error: 'Parent topic not found.' } };
    }

    const [{ data: exam }, { data: subject }] = await Promise.all([
      client.from('exams').select('name').eq('id', topic.exam_id).maybeSingle(),
      client.from('subjects').select('name').eq('id', topic.subject_id).maybeSingle(),
    ]);

    let enrolledIds = await resolveEnrolledStudentIds(
      client,
      topic.exam_id,
      topic.subject_id
    );

    if (input.onlyUnattempted && enrolledIds.length > 0) {
      const { data: attempts } = await client
        .from('test_attempts')
        .select('student_id')
        .eq('test_id', test.id)
        .in('student_id', enrolledIds);
      const attemptedSet = new Set((attempts ?? []).map((a) => a.student_id));
      enrolledIds = enrolledIds.filter((id) => !attemptedSet.has(id));
    }

    targetStudentIds = enrolledIds;
    const subjectLabel = subject?.name || 'Practice Test';
    const examLabel = exam?.name || 'Phosters';
    title = `Try Practice Test: ${subjectLabel} (${examLabel})`;
    bodyText = input.onlyUnattempted
      ? `You have not attempted "${test.title}" yet. Tap to start.`
      : `"${test.title}" is ready. Test your preparation now.`;
    targetUrl = `/app/tests/${test.id}`;
    tag = `test-${test.id}`;
  } else if (input.type === 'broadcast') {
    notificationType = 'broadcast';
    preferenceColumn = 'notify_broadcasts';
    const { data: ann } = await client
      .from('announcements')
      .select('id, title, message, audience_type, exam_id, subject_id, is_published')
      .eq('id', input.announcementId)
      .maybeSingle();

    if (!ann) {
      return { status: 404, body: { error: 'Announcement not found.' } };
    }
    if (!ann.is_published) {
      return {
        status: 400,
        body: { error: 'Publish the announcement before sending push notifications.' },
      };
    }

    if (ann.audience_type === 'exam' && ann.exam_id) {
      targetStudentIds = await resolveEnrolledStudentIds(client, ann.exam_id, null);
    } else if (ann.audience_type === 'exam_subject' && ann.exam_id && ann.subject_id) {
      targetStudentIds = await resolveEnrolledStudentIds(
        client,
        ann.exam_id,
        ann.subject_id
      );
      const [{ data: exam }, { data: subject }] = await Promise.all([
        client.from('exams').select('slug').eq('id', ann.exam_id).maybeSingle(),
        client.from('subjects').select('slug').eq('id', ann.subject_id).maybeSingle(),
      ]);
      if (exam?.slug && subject?.slug) {
        targetUrl = `/app/subjects/${exam.slug}/${subject.slug}`;
      }
    }

    title = ann.title;
    bodyText =
      ann.message.length > 180 ? `${ann.message.slice(0, 177).trim()}...` : ann.message;
    tag = `broadcast-${ann.id}`;
  } else {
    notificationType = 'custom';
    const cleanTitle = input.title?.trim() || '';
    const cleanBody = input.body?.trim() || '';
    if (cleanTitle.length < 2 || cleanBody.length < 2) {
      return {
        status: 400,
        body: { error: 'Notification title and message are required.' },
      };
    }

    title = cleanTitle.slice(0, 160);
    bodyText = cleanBody.slice(0, 500);
    targetUrl = sanitizeTargetPath(input.targetUrl, '/app');
    tag = `custom-${Date.now()}`;

    if (input.preferenceCategory === 'lessons') preferenceColumn = 'notify_lessons';
    else if (input.preferenceCategory === 'tests') preferenceColumn = 'notify_tests';
    else if (input.preferenceCategory === 'reminders') preferenceColumn = 'notify_reminders';
    else preferenceColumn = 'notify_broadcasts';

    if (Array.isArray(input.studentIds)) {
      targetStudentIds = input.studentIds.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      );
    }
  }

  // Resolve subscriptions
  if (targetStudentIds !== null && targetStudentIds.length === 0) {
    const delivery = await deliverToSubscriptions(
      client,
      [],
      () => ({ title, body: bodyText, url: targetUrl, tag }),
      {
        notificationType,
        summaryTitle: title,
        summaryBody: bodyText,
        summaryUrl: targetUrl,
        sentBy: adminUserId,
      }
    );

    return {
      status: 200,
      body: {
        ok: true,
        notificationType,
        ...delivery,
        message: 'No enrolled students match this audience yet.',
      },
    };
  }

  let subsQuery = client
    .from('push_subscriptions')
    .select('*')
    .eq(preferenceColumn, true);

  if (targetStudentIds !== null) {
    subsQuery = subsQuery.in('user_id', targetStudentIds);
  } else {
    // Only push to student profiles (not accidentally other admins unless targeted)
    const { data: studentProfiles } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'student');
    const studentIds = (studentProfiles ?? []).map((p) => p.id);
    if (studentIds.length === 0) {
      return {
        status: 200,
        body: {
          ok: true,
          notificationType,
          recipientsCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          removedExpiredCount: 0,
          message: 'No student accounts have push notifications enabled yet.',
        },
      };
    }
    subsQuery = subsQuery.in('user_id', studentIds);
  }

  const { data: subscriptions, error: subsErr } = await subsQuery;
  if (subsErr) {
    return { status: 500, body: { error: subsErr.message } };
  }

  const list = (subscriptions ?? []) as PushSubscriptionRecord[];
  const delivery = await deliverToSubscriptions(
    client,
    list,
    () => ({ title, body: bodyText, url: targetUrl, tag }),
    {
      notificationType,
      summaryTitle: title,
      summaryBody: bodyText,
      summaryUrl: targetUrl,
      sentBy: adminUserId,
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      notificationType,
      ...delivery,
      message:
        list.length === 0
          ? 'No subscribed student devices matched for this notification.'
          : `Delivered to ${delivery.deliveredCount} of ${delivery.recipientsCount} subscribed device(s).`,
    },
  };
}

export async function runInactivityAndTestReminders(
  input: RemindInactiveInput,
  triggeredByUserId: string | null,
  authorizedClient?: SupabaseClient<Database>,
  usingServiceRole = Boolean(getServerEnv().serviceRoleKey)
): Promise<{ status: number; body: RemindInactiveResponse | { error: string } }> {
  const clientRes = authorizedClient
    ? { client: authorizedClient, error: null }
    : getServiceRoleSupabaseClient();
  const { client, error: clientErr } = clientRes;
  if (!client) {
    return { status: 503, body: { error: clientErr || 'Server not configured.' } };
  }

  const pushReady = ensureWebPushConfigured();
  if (!pushReady.ok) {
    return { status: 503, body: { error: pushReady.error || 'VAPID not configured.' } };
  }

  const inactiveDays =
    typeof input.inactiveDays === 'number' && Number.isFinite(input.inactiveDays)
      ? Math.max(0, Math.min(90, input.inactiveDays))
      : 3;
  const cooldownHours =
    typeof input.cooldownHours === 'number' && Number.isFinite(input.cooldownHours)
      ? Math.max(0, Math.min(720, input.cooldownHours))
      : 48;
  const force = Boolean(input.force);

  let subsQuery = client
    .from('push_subscriptions')
    .select('*')
    .eq('notify_reminders', true);

  if (Array.isArray(input.studentIds) && input.studentIds.length > 0) {
    subsQuery = subsQuery.in('user_id', input.studentIds);
  }

  const { data: rawSubs, error: subsErr } = await subsQuery;
  if (subsErr) {
    return { status: 500, body: { error: subsErr.message } };
  }

  const subscriptions = (rawSubs ?? []) as PushSubscriptionRecord[];
  if (subscriptions.length === 0) {
    return {
      status: 200,
      body: {
        ok: true,
        evaluatedSubscriptions: 0,
        targetedCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        removedExpiredCount: 0,
        message: 'No devices are currently subscribed to study reminders.',
      },
    };
  }

  const userIds = Array.from(new Set(subscriptions.map((s) => s.user_id)));

  const [
    { data: profiles },
    { data: enrollments },
    { data: progress },
    { data: attempts },
    { data: publishedTopics },
    { data: publishedLessons },
    { data: publishedTests },
  ] = await Promise.all([
    client.from('profiles').select('id, role, created_at').in('id', userIds),
    client
      .from('student_exam_profiles')
      .select('id, student_id, exam_id')
      .in('student_id', userIds),
    client
      .from('student_lesson_progress')
      .select('student_id, last_opened_at, is_completed')
      .in('student_id', userIds),
    client
      .from('test_attempts')
      .select('student_id, test_id, submitted_at')
      .in('student_id', userIds),
    client
      .from('topics')
      .select('id, exam_id, subject_id')
      .eq('is_published', true),
    client
      .from('lessons')
      .select('id, topic_id')
      .eq('is_published', true),
    client
      .from('tests')
      .select('id, title, topic_id, lesson_id')
      .eq('is_published', true),
  ]);

  const authSignInMap = new Map<string, string | null>();
  if (usingServiceRole) {
    const authUsersRes = await client.auth.admin.listUsers({ perPage: 1000 });
    for (const u of authUsersRes.data?.users ?? []) {
      authSignInMap.set(u.id, u.last_sign_in_at ?? null);
    }
  } else {
    const { data: contacts } = await client.rpc('get_admin_student_contacts');
    for (const c of contacts ?? []) {
      authSignInMap.set(c.student_id, c.last_sign_in_at ?? null);
    }
  }

  const studentRoleIds = new Set(
    (profiles ?? []).filter((p) => p.role === 'student').map((p) => p.id)
  );
  const profileCreatedAt = new Map(
    (profiles ?? []).map((p) => [p.id, p.created_at])
  );

  // Resolve enrolled (exam_id, subject_id) pairs per student
  const profileIds = (enrollments ?? []).map((e) => e.id);
  const { data: enrolledSubjects } =
    profileIds.length > 0
      ? await client
          .from('student_exam_subjects')
          .select('student_exam_profile_id, subject_id')
          .in('student_exam_profile_id', profileIds)
      : { data: [] };

  const studentCourses = new Map<string, Set<string>>();
  const examProfileMap = new Map(
    (enrollments ?? []).map((e) => [e.id, { studentId: e.student_id, examId: e.exam_id }])
  );
  for (const es of enrolledSubjects ?? []) {
    const parent = examProfileMap.get(es.student_exam_profile_id);
    if (!parent) continue;
    const set = studentCourses.get(parent.studentId) ?? new Set<string>();
    set.add(`${parent.examId}:${es.subject_id}`);
    studentCourses.set(parent.studentId, set);
  }

  // Map published tests -> courseKey
  const topicCourseMap = new Map(
    (publishedTopics ?? []).map((t) => [t.id, `${t.exam_id}:${t.subject_id}`])
  );
  const lessonTopicMap = new Map(
    (publishedLessons ?? []).map((l) => [l.id, l.topic_id])
  );
  const testsWithCourse: Array<{ id: string; title: string; courseKey: string }> = [];
  for (const tst of publishedTests ?? []) {
    const resolvedTopicId =
      tst.topic_id || (tst.lesson_id ? lessonTopicMap.get(tst.lesson_id) ?? null : null);
    if (!resolvedTopicId) continue;
    const courseKey = topicCourseMap.get(resolvedTopicId);
    if (!courseKey) continue;
    testsWithCourse.push({ id: tst.id, title: tst.title, courseKey });
  }

  // Track last activity & attempted tests per student
  const lastActivityMs = new Map<string, number>();
  const bumpActivity = (studentId: string, iso: string | null | undefined) => {
    if (!iso) return;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return;
    const prev = lastActivityMs.get(studentId) ?? 0;
    if (ms > prev) lastActivityMs.set(studentId, ms);
  };

  for (const sid of userIds) {
    bumpActivity(sid, authSignInMap.get(sid));
  }
  for (const pr of progress ?? []) {
    bumpActivity(pr.student_id, pr.last_opened_at);
  }
  const attemptedTestsByStudent = new Map<string, Set<string>>();
  for (const att of attempts ?? []) {
    bumpActivity(att.student_id, att.submitted_at);
    const set = attemptedTestsByStudent.get(att.student_id) ?? new Set<string>();
    set.add(att.test_id);
    attemptedTestsByStudent.set(att.student_id, set);
  }

  const nowMs = Date.now();
  const inactiveThresholdMs = inactiveDays * 24 * 60 * 60 * 1000;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;

  const customMessages = new Map<
    string,
    { title: string; body: string; url: string; tag: string }
  >();
  const targetedSubs: PushSubscriptionRecord[] = [];

  for (const sub of subscriptions) {
    if (!studentRoleIds.has(sub.user_id)) continue;

    if (!force && cooldownMs > 0 && sub.last_notified_at) {
      const lastNotifiedMs = new Date(sub.last_notified_at).getTime();
      if (!Number.isNaN(lastNotifiedMs) && nowMs - lastNotifiedMs < cooldownMs) {
        continue;
      }
    }

    const courses = studentCourses.get(sub.user_id) ?? new Set<string>();
    const attempted = attemptedTestsByStudent.get(sub.user_id) ?? new Set<string>();
    const unattemptedTests = testsWithCourse.filter(
      (t) => courses.has(t.courseKey) && !attempted.has(t.id)
    );

    const lastActive =
      lastActivityMs.get(sub.user_id) ??
      new Date(profileCreatedAt.get(sub.user_id) || nowMs).getTime();
    const isInactive = nowMs - lastActive >= inactiveThresholdMs;

    if (!force && !isInactive && unattemptedTests.length === 0) {
      continue;
    }

    let msgTitle = 'Continue your Phosters study streak';
    let msgBody =
      'Open Phosters today to watch your next lesson and keep your exam prep on track.';
    let msgUrl = '/app';

    if (courses.size === 0) {
      msgTitle = 'Finish setting up your Phosters subjects';
      msgBody =
        'Choose your JAMB UTME or UI Post-UTME subjects to unlock lessons and practice tests.';
      msgUrl = '/app/setup-exams';
    } else if (unattemptedTests.length === 1) {
      msgTitle = `Practice Test Waiting: ${unattemptedTests[0].title}`;
      msgBody =
        'Test your understanding now and get your instant CBT score breakdown.';
      msgUrl = `/app/tests/${unattemptedTests[0].id}`;
    } else if (unattemptedTests.length > 1) {
      msgTitle = `${unattemptedTests.length} Practice Tests Ready on Phosters`;
      msgBody =
        'Sharpen your JAMB & UI Post-UTME speed by trying your pending practice tests today.';
      msgUrl = '/app/subjects';
    } else if (isInactive) {
      msgTitle = 'We saved your spot on Phosters';
      msgBody =
        'It has been a few days since your last session. Spend 15 minutes on your next lesson today.';
      msgUrl = '/app';
    }

    customMessages.set(sub.id, {
      title: msgTitle,
      body: msgBody,
      url: msgUrl,
      tag: 'phosters-study-reminder',
    });
    targetedSubs.push(sub);
  }

  const delivery = await deliverToSubscriptions(
    client,
    targetedSubs,
    (sub) =>
      customMessages.get(sub.id) ?? {
        title: 'Study Reminder from Phosters',
        body: 'Open Phosters to continue your lessons and practice tests.',
        url: '/app',
        tag: 'phosters-study-reminder',
      },
    {
      notificationType: 'inactivity_reminder',
      summaryTitle: 'Automated Study & Test Reminder',
      summaryBody: `Evaluated ${subscriptions.length} subscriptions (${targetedSubs.length} matched inactivity or unattempted test criteria).`,
      summaryUrl: '/app',
      sentBy: triggeredByUserId,
    }
  );

  return {
    status: 200,
    body: {
      ok: true,
      evaluatedSubscriptions: subscriptions.length,
      targetedCount: targetedSubs.length,
      deliveredCount: delivery.deliveredCount,
      failedCount: delivery.failedCount,
      removedExpiredCount: delivery.removedExpiredCount,
      message:
        targetedSubs.length === 0
          ? 'No subscribed students met the inactivity or pending test criteria right now.'
          : `Sent study reminders to ${delivery.deliveredCount} of ${targetedSubs.length} targeted device(s).`,
    },
  };
}
