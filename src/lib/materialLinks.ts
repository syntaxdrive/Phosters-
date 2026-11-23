import type { MaterialFileType } from '../types/database';
import { getOfflineMaterial, putOfflineMaterial, buildMaterialKey } from './offlineDb';

const APPROVED_MATERIAL_HOSTS = new Set(['raw.githubusercontent.com']);
const MAX_BLOB_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25 MB safety limit for mobile browser memory

export function validateMaterialUrl(rawUrl: string): { valid: boolean; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Material URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Enter a valid HTTPS file URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Material links must use HTTPS.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'github.com' || host === 'www.github.com') {
    return {
      valid: false,
      error: 'Use the direct raw file URL (raw.githubusercontent.com), not a repository page link.',
    };
  }

  if (!APPROVED_MATERIAL_HOSTS.has(host)) {
    return {
      valid: false,
      error: 'Material links must point to an approved direct file host (raw.githubusercontent.com).',
    };
  }

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  if (pathSegments.length < 4) {
    return {
      valid: false,
      error: 'The raw file URL is incomplete.',
    };
  }

  return { valid: true };
}

export function isSafeExternalHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function extractFilenameFromUrl(rawUrl: string, fallbackTitle: string, fileType: MaterialFileType): string {
  try {
    const parsed = new URL(rawUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment);
    }
  } catch {
    // Fallback below
  }
  const safeBase = fallbackTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'phosters-material';
  if (fileType === 'pdf') return `${safeBase}.pdf`;
  if (fileType === 'zip') return `${safeBase}.zip`;
  return safeBase;
}

export type MaterialAccessResult = {
  method: 'offline-cache' | 'blob-download' | 'opened-direct';
  error?: string;
};

function triggerBlobDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
}

/**
 * Downloads and stores a study material Blob inside IndexedDB for offline access.
 */
export async function saveMaterialForOffline(
  userId: string,
  rawUrl: string,
  title: string,
  fileType: MaterialFileType
): Promise<{ sizeBytes: number; error: string | null }> {
  const check = validateMaterialUrl(rawUrl);
  if (!check.valid) {
    return { sizeBytes: 0, error: check.error || 'Invalid material link.' };
  }

  const existing = await getOfflineMaterial(userId, rawUrl);
  if (existing) {
    return { sizeBytes: existing.sizeBytes, error: null };
  }

  try {
    const response = await fetch(rawUrl, { method: 'GET', mode: 'cors' });
    if (!response.ok) {
      return {
        sizeBytes: 0,
        error: `Could not fetch "${title}" for offline storage (HTTP ${response.status}).`,
      };
    }

    const blob = await response.blob();
    if (blob.size > MAX_BLOB_DOWNLOAD_BYTES) {
      return {
        sizeBytes: 0,
        error: `"${title}" is larger than 25 MB and cannot be saved inside browser offline storage.`,
      };
    }

    await putOfflineMaterial({
      key: buildMaterialKey(userId, rawUrl),
      userId,
      url: rawUrl,
      title,
      fileType,
      blob,
      sizeBytes: blob.size,
      savedAt: Date.now(),
    });

    return { sizeBytes: blob.size, error: null };
  } catch {
    return {
      sizeBytes: 0,
      error: `Unable to cache "${title}" offline right now. Check your internet connection.`,
    };
  }
}

/**
 * Serves from IndexedDB offline cache first if saved on device, otherwise performs
 * a direct CORS fetch-to-Blob download (and caches it for future offline access).
 */
export async function accessMaterialFile(
  rawUrl: string,
  title: string,
  fileType: MaterialFileType,
  options?: { userId?: string }
): Promise<MaterialAccessResult> {
  const check = validateMaterialUrl(rawUrl);
  if (!check.valid) {
    return { method: 'opened-direct', error: check.error || 'Invalid material link.' };
  }

  const filename = extractFilenameFromUrl(rawUrl, title, fileType);

  if (options?.userId) {
    const cached = await getOfflineMaterial(options.userId, rawUrl);
    if (cached) {
      triggerBlobDownload(cached.blob, filename);
      return { method: 'offline-cache' };
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      method: 'opened-direct',
      error: 'You are offline and this study file was not saved offline yet. Save the lesson while connected.',
    };
  }

  try {
    const response = await fetch(rawUrl, { method: 'GET', mode: 'cors' });
    if (!response.ok) {
      if (response.status === 404) {
        return {
          method: 'opened-direct',
          error: 'This study file could not be found. Please ask your tutor or admin to update the link.',
        };
      }
      return {
        method: 'opened-direct',
        error: 'Unable to fetch this file right now. Check your network and try again.',
      };
    }

    const contentLengthHeader = response.headers.get('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;

    if (contentLength > MAX_BLOB_DOWNLOAD_BYTES) {
      triggerDirectAnchorOpen(rawUrl, filename);
      return { method: 'opened-direct' };
    }

    const blob = await response.blob();
    if (blob.size > MAX_BLOB_DOWNLOAD_BYTES) {
      triggerDirectAnchorOpen(rawUrl, filename);
      return { method: 'opened-direct' };
    }

    if (options?.userId) {
      void putOfflineMaterial({
        key: buildMaterialKey(options.userId, rawUrl),
        userId: options.userId,
        url: rawUrl,
        title,
        fileType,
        blob,
        sizeBytes: blob.size,
        savedAt: Date.now(),
      });
    }

    triggerBlobDownload(blob, filename);
    return { method: 'blob-download' };
  } catch {
    triggerDirectAnchorOpen(rawUrl, filename);
    return { method: 'opened-direct' };
  }
}

function triggerDirectAnchorOpen(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
