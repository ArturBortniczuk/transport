/**
 * Prosty system cachowania w pamięci
 * Używany do zmniejszenia liczby zapytań do bazy danych
 */

// Mapa przechowująca dane w cache
const cache = new Map();

/**
 * Pobiera dane z cache
 * @param {string} key - Klucz cache
 * @returns {any|null} - Wartość z cache lub null jeśli brak lub wygasł
 */
export function getFromCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  // Sprawdź czy cache nie wygasł
  if (item.expiry < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}

/**
 * Zapisuje dane w cache
 * @param {string} key - Klucz cache
 * @param {any} value - Wartość do zapisania
 * @param {number} ttlSeconds - Czas życia w sekundach (domyślnie 60s)
 */
export function setInCache(key, value, ttlSeconds = 60) {
  cache.set(key, {
    value,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}

/**
 * Usuwa dane z cache
 * @param {string} key - Klucz cache
 */
export function removeFromCache(key) {
  cache.delete(key);
}

/**
 * Czyści cały cache
 */
export function clearCache() {
  // Wyczyść cały cache
  cache.clear();
  
  // Dodatkowo usuń nieaktualne wpisy
  const now = Date.now();
  cache.forEach((item, key) => {
    if (item.expiry < now) {
      cache.delete(key);
    }
  });
  
  // Usuń wszystkie wpisy związane z transportami
  cache.forEach((item, key) => {
    if (key.includes('transports')) {
      cache.delete(key);
    }
  });
  
  console.log('Cache został wyczyszczony');
}

/**
 * Zwraca statystyki cache
 * @returns {Object} - Obiekt ze statystykami
 */
export function getCacheStats() {
  let validItems = 0;
  let expiredItems = 0;
  
  cache.forEach(item => {
    if (item.expiry >= Date.now()) {
      validItems++;
    } else {
      expiredItems++;
    }
  });
  
  return {
    totalItems: cache.size,
    validItems,
    expiredItems
  };
}
