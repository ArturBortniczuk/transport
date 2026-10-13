/**
 * Concatenates class names together
 * @param {...string} classes - CSS class names
 * @returns {string} - Concatenated class names
 */
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
  }

/**
 * Sprawdza czy MPK jest zablokowane (np. fikcyjne / domyślne MPK 000-000-000)
 * @param {string} mpk - Numer MPK do sprawdzenia
 * @returns {boolean} - True jeśli MPK jest zablokowane (000-000-000)
 */
export function isBlockedMpk(mpk) {
  if (!mpk) return false;
  const clean = String(mpk).trim();
  return clean === '000-000-000' || clean.replace(/[^0-9]/g, '') === '000000000';
}