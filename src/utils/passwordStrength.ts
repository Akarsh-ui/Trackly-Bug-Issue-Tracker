export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  isValid: boolean;
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    hasLongLength: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const value = password || '';
  const minLength = value.length >= 8;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(value);
  const hasLongLength = value.length >= 12;

  const isValid =
    minLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  if (value.length === 0) {
    return {
      score: 0,
      label: 'Empty',
      isValid: false,
      checks: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecialChar: false,
        hasLongLength: false,
      },
    };
  }

  let score: 1 | 2 | 3 | 4 = 1;
  const baseMetCount = [
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  ].filter(Boolean).length;
  if (isValid) {
    score = value.length >= 12 ? 4 : 3;
  } else if (baseMetCount >= 3) {
    score = 2;
  }

  const labelMap: Record<1 | 2 | 3 | 4, PasswordStrengthResult['label']> = {
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  return {
    score,
    label: labelMap[score],
    isValid,
    checks: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      hasLongLength,
    },
  };
}
