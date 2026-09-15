// src/lib/auth.js
import db from '@/database/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Sprawdza czy ciąg znaków jest hashem bcrypt
 */
export function isBcryptHash(str) {
  return typeof str === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(str);
}

/**
 * Bezpieczne hashowanie hasła (bcrypt)
 */
export async function hashPassword(plainPassword) {
  if (!plainPassword) return '';
  return await bcrypt.hash(plainPassword, 10);
}

/**
 * Hybrydowa weryfikacja hasła:
 * 1. Jeśli w bazie jest hash bcrypt -> bcrypt.compare()
 * 2. Jeśli w bazie jest czysty tekst (dla kompatybilności wstecznej) -> bezpośrednie porównanie
 */
export async function verifyPassword(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) return false;
  
  if (isBcryptHash(storedPassword)) {
    return await bcrypt.compare(plainPassword, storedPassword);
  }
  
  // Wsteczna kompatybilność z hasłami czystotekstowymi
  return plainPassword === storedPassword;
}

/**
 * Generowanie kryptograficznie bezpiecznego tokenu sesji
 */
export function generateSessionToken() {
  return crypto.randomUUID();
}

/**
 * Weryfikacja tokenu sesji w bazie danych lub z ciasteczka SSO
 * @param {string|Request} tokenOrRequest
 * @returns {Promise<string|null>} email użytkownika lub null
 */
export async function validateSession(tokenOrRequest) {
  if (!tokenOrRequest) {
    return null;
  }

  // Jeśli przekazano obiekt Request (Next.js)
  if (typeof tokenOrRequest === 'object' && (tokenOrRequest.cookies || tokenOrRequest.headers)) {
    const sessionUser = await getSessionUser(tokenOrRequest);
    return sessionUser?.isAuthenticated ? sessionUser.user?.email : null;
  }

  // Jeśli przekazano string (np. email, JWT lub string ciasteczka)
  if (typeof tokenOrRequest === 'string') {
    const str = tokenOrRequest.trim();
    if (str.includes('@') && !str.includes('{') && !str.includes('[')) {
      return str.toLowerCase();
    }
    const extracted = extractEmailFromCookie(str);
    if (extracted) return extracted;
  }

  return null;
}

export function extractEmailFromCookie(cookieValue) {
  if (!cookieValue) return null;
  try {
    let raw = cookieValue;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.includes('@') && !trimmed.includes('{') && !trimmed.includes('[')) {
        return trimmed.toLowerCase();
      }
      if (trimmed.startsWith('base64-')) {
        raw = Buffer.from(trimmed.slice(7), 'base64').toString('utf-8');
      } else if (trimmed.startsWith('sso_')) {
        raw = Buffer.from(trimmed.slice(4), 'base64').toString('utf-8');
      }
    }
    let data = null;
    try {
      data = JSON.parse(decodeURIComponent(raw));
    } catch {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }
    if (data?.user?.email) return data.user.email.toLowerCase().trim();
    if (data?.email) return data.email.toLowerCase().trim();
    
    const token = data?.access_token || (Array.isArray(data) ? data[0] : (typeof data === 'string' ? data : null));
    if (token && typeof token === 'string') {
      if (token.startsWith('sso_')) {
        const decoded = JSON.parse(Buffer.from(token.slice(4), 'base64').toString('utf-8'));
        if (decoded?.email) return decoded.email.toLowerCase().trim();
      }
      if (token.includes('.')) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload?.email) return payload.email.toLowerCase().trim();
        }
      }
    }
  } catch (e) {
    console.warn('Error extracting email from cookie:', e.message);
  }
  return null;
}

/**
 * Pobiera dane zalogowanego użytkownika na podstawie ciasteczka Supabase SSO (eltron_auth_token)
 * lub ciasteczka authToken / userEmail.
 * @param {Request} request
 * @returns {Promise<{ isAuthenticated: boolean, user: object|null }>}
 */
export async function getSessionUser(request) {
  try {
    // 1. Sprawdź ciasteczka Supabase SSO oraz tokeny
    const ssoCookie = 
      request.cookies.get('eltron_auth_token')?.value || 
      request.cookies.get('sb-vwnjmcxwqrfykeexocqi-auth-token')?.value ||
      request.cookies.get('sb-access-token')?.value ||
      request.cookies.get('authToken')?.value;

    let ssoEmail = extractEmailFromCookie(ssoCookie);
    if (!ssoEmail) {
      const userEmailCookie = request.cookies.get('userEmail')?.value;
      if (userEmailCookie && userEmailCookie.includes('@')) {
        ssoEmail = userEmailCookie.toLowerCase().trim();
      }
    }

    if (ssoEmail) {
      // Pobierz użytkownika z profiles oraz z users (dla uprawnień i MPK)
      let userRow = await db('profiles')
        .whereRaw('LOWER(email) = ?', [ssoEmail])
        .first()
        .catch(() => null);

      let neonUser = await db('users')
        .whereRaw('LOWER(email) = ?', [ssoEmail])
        .first()
        .catch(() => null);

      let userPerm = null;
      if (userRow) {
        userPerm = await db('user_app_permissions')
          .where({ user_id: userRow.id, app_id: 'transport' })
          .first()
          .catch(() => null);
      }

      if (!userRow && neonUser) {
        userRow = neonUser;
      }

      const rawRole = userPerm?.is_active ? userPerm.role : (neonUser?.role || userRow?.role || 'pracownik');
      const roleLower = (rawRole || '').toLowerCase();
      const emailLower = ssoEmail.toLowerCase();
      const isSuperAdmin = emailLower === 'a.bortniczuk@grupaeltron.pl';
      const isAdmin = isSuperAdmin || roleLower === 'admin' || userRow?.is_admin === true || neonUser?.is_admin === true;

      // Sprawdź czy to rola magazynowa
      const isWarehouse = 
        emailLower.includes('magazyn') ||
        roleLower.includes('magazyn') ||
        (userRow?.role && userRow.role.toLowerCase().includes('magazyn')) ||
        (neonUser?.role && neonUser.role.toLowerCase().includes('magazyn')) ||
        (neonUser?.position && neonUser.position.toLowerCase().includes('magazyn'));

      const isCoordinator = roleLower.includes('koordynator') || (neonUser?.role && neonUser.role.toLowerCase().includes('koordynator'));
      const isDriver = roleLower.includes('kierowca') || emailLower.includes('kierowca');

      // Parsuj własne uprawnienia jeśli istnieją
      let customPerms = {};
      try {
        const rawPerms = neonUser?.permissions || userRow?.permissions;
        if (rawPerms) {
          customPerms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
        }
      } catch (e) {}

      const canEditCalendar = isAdmin || isWarehouse || isCoordinator || ['kierownik', 'dyrektor'].includes(roleLower) || customPerms?.calendar?.edit === true;
      const canCompleteTransport = isAdmin || isWarehouse || isCoordinator || isDriver || customPerms?.transport?.markAsCompleted === true;

      let permissions = {
        calendar: { 
          view: true, 
          edit: canEditCalendar 
        },
        map: { view: true },
        transport: { 
          markAsCompleted: canCompleteTransport 
        },
        spedycja: {
          view: true,
          sendOrder: customPerms?.spedycja?.sendOrder ?? true,
          edit: customPerms?.spedycja?.edit ?? true,
          add: customPerms?.spedycja?.add ?? true,
          respond: customPerms?.spedycja?.respond ?? true
        },
        admin: {
          packagings: isAdmin || customPerms?.admin?.packagings === true,
          constructions: isAdmin || customPerms?.admin?.constructions === true
        }
      };

      if (customPerms?.calendar) permissions.calendar = { ...permissions.calendar, ...customPerms.calendar };
      if (customPerms?.transport) permissions.transport = { ...permissions.transport, ...customPerms.transport };
      if (customPerms?.spedycja) permissions.spedycja = { ...permissions.spedycja, ...customPerms.spedycja };
      if (customPerms?.admin) permissions.admin = { ...permissions.admin, ...customPerms.admin };

      if (isWarehouse || isAdmin || isCoordinator) {
        permissions.calendar.edit = true;
        permissions.transport.markAsCompleted = true;
      }

      return {
        isAuthenticated: true,
        user: {
          email: ssoEmail,
          name: userRow?.name || neonUser?.name || ssoEmail.split('@')[0],
          position: userRow?.position || neonUser?.position || '',
          role: rawRole,
          permissions: permissions,
          mpk: userRow?.mpk || neonUser?.mpk || '',
          isAdmin: isAdmin
        }
      };
    }


    return { isAuthenticated: false, user: null };
  } catch (error) {
    console.error('Błąd getSessionUser:', error);
    return { isAuthenticated: false, user: null };
  }
}
