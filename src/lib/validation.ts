export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Enter your full name.';
  }
  if (trimmed.length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  if (trimmed.length > 100) {
    return 'Full name must be 100 characters or fewer.';
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Enter your email address.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Enter a valid email address.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Enter a password.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  return null;
}

export function validateOptionalPhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = trimmed.replace(/[\s()-]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleaned)) {
    return 'Enter a valid phone number (for example, 08012345678 or +2348012345678).';
  }
  return null;
}

export function normalizeOptionalPhone(phone?: string): string | null {
  const trimmed = phone?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
