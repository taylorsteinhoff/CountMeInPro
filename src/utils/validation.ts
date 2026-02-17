/** Returns true if the string contains an @ and is non-empty. */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.includes('@');
}

/** Returns true if password is at least 6 characters. */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Returns true if the phone number, after stripping non-digits,
 * has at least 10 digits.
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * Rates password strength:
 *  weak   – fewer than 8 characters
 *  medium – 8+ chars with some variety (uppercase, number, or special char)
 *  strong – 8+ chars with 2 or more variety types
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return 'weak';
  const hasUpper   = /[A-Z]/.test(password);
  const hasNumber  = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const variety    = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (variety >= 2) return 'strong';
  return 'medium';
}
