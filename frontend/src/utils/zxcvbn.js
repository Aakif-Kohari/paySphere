export default function zxcvbn(password) {
  if (!password) {
    return { score: 0, feedback: { warning: "Password is empty", suggestions: ["Enter a password"] } };
  }

  const length = password.length;
  let score = 0;

  if (length >= 8) score++;
  if (length >= 12) score++;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (varietyCount >= 3) score++;
  if (varietyCount === 4 && length >= 10) score++;

  const commonPatterns = ['123456', 'password', 'qwerty', 'admin123', 'paysphere'];
  const lowerPassword = password.toLowerCase();
  for (const pattern of commonPatterns) {
    if (lowerPassword.includes(pattern)) {
      score = Math.max(0, score - 2);
    }
  }

  score = Math.min(Math.max(score, 0), 4);

  return {
    score,
    feedback: {
      warning: score < 3 ? "Password is too weak" : "",
      suggestions: score < 3 ? ["Use a mix of uppercase, lowercase, numbers, and symbols", "Make it longer than 12 characters"] : [],
    }
  };
}
