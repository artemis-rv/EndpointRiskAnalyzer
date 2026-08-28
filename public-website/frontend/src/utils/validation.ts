/**
 * utils/validation.ts
 * ───────────────────
 * Client-side form validation.
 *
 * THIS IS FOR USABILITY ONLY. It tells someone about a problem before they wait
 * for a round trip. It is not a security control and it decides nothing: the
 * backend re-validates every field and its answer is the one that counts. The
 * rules below are transcriptions of the backend's Pydantic constraints so that
 * the two agree, not a second implementation of them.
 */

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Mirrors `EmailStr` well enough to catch typos; the server does the real check. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mirrors `country_code: str = Field(min_length=2, max_length=10)`. */
const COUNTRY_CODE_RE = /^[A-Za-z]{2,10}$/;

/** Mirrors `version: pattern=r"^\d+\.\d+\.\d+.*$"`. */
const VERSION_RE = /^\d+\.\d+\.\d+.*$/;

/** Mirrors `_SHA256_RE` in backend/app/schemas/release.py. */
const SHA256_RE = /^[a-fA-F0-9]{64}$/;

export function required(value: string | null | undefined, label: string): string | undefined {
  return value && value.trim() !== '' ? undefined : `${label} is required.`;
}

export function maxLength(value: string, limit: number, label: string): string | undefined {
  return value.length > limit ? `${label} must be ${limit} characters or fewer.` : undefined;
}

export function validateEmail(value: string): string | undefined {
  const missing = required(value, 'Email address');
  if (missing) return missing;
  if (!EMAIL_RE.test(value.trim())) return 'Enter a valid email address.';
  if (value.length > 254) return 'Email address is too long.';
  return undefined;
}

export function validateCountryCode(value: string): string | undefined {
  const missing = required(value, 'Country');
  if (missing) return missing;
  if (!COUNTRY_CODE_RE.test(value.trim())) {
    return 'Use a 2-letter country code, for example GB or IN.';
  }
  return undefined;
}

export interface PasswordCheck {
  id: string;
  label: string;
  passed: boolean;
}

/**
 * Mirrors `validate_password_strength` in backend/app/core/security.py.
 * Returned as a checklist so the register form can show live progress rather
 * than a single opaque failure.
 */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: 'length', label: 'At least 12 characters', passed: password.length >= 12 },
    { id: 'max', label: 'No more than 72 characters', passed: password.length <= 72 },
    { id: 'upper', label: 'One uppercase letter', passed: /[A-Z]/.test(password) },
    { id: 'lower', label: 'One lowercase letter', passed: /[a-z]/.test(password) },
    { id: 'digit', label: 'One digit', passed: /\d/.test(password) },
    {
      id: 'special',
      label: 'One special character',
      // Character class transcribed from the backend policy string.
      passed: /[!@#$%^&*()_+\-=[\]{}|;':",./<>?\\]/.test(password),
    },
  ];
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  const failed = passwordChecks(value).filter((check) => !check.passed);
  if (failed.length === 0) return undefined;
  return 'Password does not meet all requirements.';
}

export function validateName(value: string, label: string): string | undefined {
  const missing = required(value, label);
  if (missing) return missing;
  return maxLength(value.trim(), 100, label);
}

export function validateVersion(value: string): string | undefined {
  const missing = required(value, 'Version');
  if (missing) return missing;
  if (!VERSION_RE.test(value.trim())) {
    return 'Use semantic versioning, for example 1.4.0 or 2.0.0-rc1.';
  }
  return maxLength(value.trim(), 50, 'Version');
}

export function validateChecksum(value: string): string | undefined {
  const missing = required(value, 'SHA-256 checksum');
  if (missing) return missing;
  if (!SHA256_RE.test(value.trim())) {
    return 'A SHA-256 checksum is exactly 64 hexadecimal characters.';
  }
  return undefined;
}

export function validateFileSize(value: string): string | undefined {
  const missing = required(value, 'File size');
  if (missing) return missing;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 'File size must be a whole number of bytes, at least 1.';
  }
  return undefined;
}

export function validateRating(value: number | null): string | undefined {
  if (value === null) return 'Choose a rating from 1 to 5.';
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return 'Rating must be between 1 and 5.';
  }
  return undefined;
}

/** True when no key in the object holds a message. */
export function isClean<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).every((value) => value === undefined);
}
