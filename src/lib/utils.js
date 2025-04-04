/**
 * Concatenates class names together
 * @param {...string} classes - CSS class names
 * @returns {string} - Concatenated class names
 */
export function cn(...classes) {
    return classes.filter(Boolean).join(' ');
  }