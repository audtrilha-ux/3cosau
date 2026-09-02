export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: string;
  colorClass: string;
  textColorClass: string;
  hasMinLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || '';
  const hasMinLength = pwd.length >= 8;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?~]/.test(pwd);

  let score = 0;
  if (pwd.length >= 6) score++;
  if (hasMinLength && (hasLower || hasUpper)) score++;
  if (hasLower && hasUpper && hasNumber) score++;
  if (hasMinLength && hasLower && hasUpper && hasNumber && hasSpecial) score++;

  let label = 'Muito Fraca';
  let colorClass = 'bg-rose-500';
  let textColorClass = 'text-rose-500';

  switch (score) {
    case 1:
      label = 'Fraca';
      colorClass = 'bg-rose-500';
      textColorClass = 'text-rose-500';
      break;
    case 2:
      label = 'Média';
      colorClass = 'bg-amber-500';
      textColorClass = 'text-amber-600';
      break;
    case 3:
      label = 'Boa';
      colorClass = 'bg-indigo-500';
      textColorClass = 'text-indigo-600';
      break;
    case 4:
      label = 'Forte / Segura';
      colorClass = 'bg-emerald-500';
      textColorClass = 'text-emerald-600';
      break;
    default:
      label = 'Muito Fraca';
      colorClass = 'bg-zinc-300';
      textColorClass = 'text-zinc-400';
      break;
  }

  const isValid = hasMinLength && ((hasLower && hasUpper && hasNumber) || score >= 3);

  return {
    score,
    label,
    colorClass,
    textColorClass,
    hasMinLength,
    hasLower,
    hasUpper,
    hasNumber,
    hasSpecial,
    isValid
  };
}
