/**
 * Shared password-strength policy.
 *
 * Used by both signup and change-password so the two flows can never drift
 * apart (previously change-password only enforced a length >= 8 check while
 * signup required 12+ chars with full complexity).
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Length requirement
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  // Complexity requirements
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  // Check against common passwords
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'shadow', 'superman', 'qazwsx',
    'michael', 'football', 'welcome', 'jesus', 'ninja',
    'mustang', 'password1', 'admin', 'admin123', 'picard'
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password');
  }

  // Check for sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('Password contains sequential characters');
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password contains too many repeated characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Basic email-format validation. Intentionally permissive (RFC-perfect email
 * validation is not worth the complexity) but rejects obviously malformed
 * addresses so we never create accounts with unusable emails.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  // Single @, non-empty local part, domain with at least one dot and no spaces.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
