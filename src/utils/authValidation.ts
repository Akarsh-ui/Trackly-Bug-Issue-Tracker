export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 8;

const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?: [A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

export function normalizeFullName(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function validateFullName(raw: string): string | null {
  const normalized = normalizeFullName(raw);
  if (!normalized) {
    return 'Full name is required.';
  }
  if (normalized.length < NAME_MIN_LENGTH) {
    return `Full name must be at least ${NAME_MIN_LENGTH} characters.`;
  }
  if (normalized.length > NAME_MAX_LENGTH) {
    return `Full name cannot exceed ${NAME_MAX_LENGTH} characters.`;
  }
  if (!NAME_PATTERN.test(normalized)) {
    return 'Full name may only contain alphabetic characters and spaces.';
  }
  return null;
}

export function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export function validateEmail(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return 'Email address is required.';
  }
  if (/\s/.test(trimmed)) {
    return 'Email address cannot contain spaces.';
  }

  const atParts = trimmed.split('@');
  if (atParts.length !== 2) {
    return 'Email address must contain exactly one @ symbol.';
  }

  const [localPart, domain] = atParts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !LOCAL_PART_PATTERN.test(localPart)
  ) {
    return 'Enter a valid email username before the @ symbol.';
  }

  if (
    !domain ||
    domain.length > 253 ||
    domain.includes('..') ||
    !DOMAIN_PATTERN.test(domain)
  ) {
    return 'Enter a valid email domain with an extension (for example, company.com).';
  }

  return null;
}

export function validatePassword(raw: string): string | null {
  const password = String(raw || '');
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character.';
  }
  return null;
}

export function validateOptionalDueDate(raw?: string | null): string | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return 'Please enter a valid due date.';
  }
  const year = new Date(parsed).getUTCFullYear();
  if (year < 2000 || year > 2100) {
    return 'Due date year must be between 2000 and 2100.';
  }
  return null;
}
