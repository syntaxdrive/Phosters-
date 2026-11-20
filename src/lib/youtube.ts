const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

export function extractYouTubeVideoId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
    return null;
  }

  let candidateId: string | null = null;

  if (host === 'youtu.be') {
    const firstSegment = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    candidateId = firstSegment;
  } else {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments[0] === 'watch' || parsed.pathname === '/watch') {
      candidateId = parsed.searchParams.get('v');
    } else if (
      segments[0] === 'embed' ||
      segments[0] === 'shorts' ||
      segments[0] === 'live'
    ) {
      candidateId = segments[1] ?? null;
    } else if (parsed.searchParams.get('v')) {
      candidateId = parsed.searchParams.get('v');
    }
  }

  if (!candidateId || !YOUTUBE_ID_REGEX.test(candidateId)) {
    return null;
  }

  return candidateId;
}

export function getSafeYouTubeEmbedUrl(rawUrl: string | null | undefined): string | null {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) return null;
  // Use privacy-enhanced embed domain with autoplay disabled for low-data mobile networks
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function isValidYouTubeUrl(rawUrl: string): boolean {
  return extractYouTubeVideoId(rawUrl) !== null;
}
