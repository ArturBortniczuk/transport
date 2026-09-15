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
 * Weryfikacja tokenu sesji w bazie danych
 * @param {string} authToken
 * @returns {Promise<string|null>} email użytkownika lub null
 */
export async function validateSession(authToken) {
  if (!authToken) {
    return null;
  }

  try {
    const session = await db('sessions')
      .where('token', authToken)
      .whereRaw('expires_at > NOW()')
      .select('user_id')
      .first();

    return session?.user_id || null;
  } catch (error) {
    console.error('Błąd walidacji sesji:', error);
    return null;
  }
}

/**
 * Pobiera dane zalogowanego użytkownika na podstawie ciasteczka z żądania Next.js
/**
 * Pobiera dane zalogowanego użytkownika na podstawie ciasteczka Supabase SSO (eltron_auth_token)
 * lub legacy ciasteczka authToken.
 * @param {Request} request
 * @returns {Promise<{ isAuthenticated: boolean, user: object|null }>}
 */
export async function getSessionUser(request) {
  try {
    // 1. Sprawdź ciasteczko Supabase SSO (eltron_auth_token)
    const eltronAuthCookie = request.cookies.get('eltron_auth_token')?.value;
    if (eltronAuthCookie) {
      try {
        let tokenData = null;
        try {
          tokenData = JSON.parse(decodeURIComponent(eltronAuthCookie));
        } catch {
          tokenData = JSON.parse(eltronAuthCookie);
        }

        const accessToken = tokenData?.access_token || (Array.isArray(tokenData) ? tokenData[0] : null);
        const email = (tokenData?.user?.email || '').toLowerCase().trim();

        if (email) {
          // Pobierz użytkownika i uprawnienia z bazy (lub Supabase)
          let userRow = await db('profiles')
            .whereRaw('LOWER(email) = ?', [email])
            .first()
            .catch(() => null);

          let userPerm = null;
          if (userRow) {
            userPerm = await db('user_app_permissions')
              .where({ user_id: userRow.id, app_id: 'transport' })
              .first()
              .catch(() => null);
          }

          // Jeśli brak w profiles, sprawdź legacy users
          if (!userRow) {
            userRow = await db('users')
              .whereRaw('LOWER(email) = ?', [email])
              .first()
              .catch(() => null);
          }

          const role = userPerm?.is_active ? userPerm.role : (userRow?.role || 'pracownik');
          const isSuperAdmin = email === 'a.bortniczuk@grupaeltron.pl';
          const isAdmin = isSuperAdmin || role === 'admin' || userRow?.is_admin === true || userRow?.role === 'admin';

          let permissions = {
            calendar: { 
              view: true,
              edit: ['admin', 'koordynator', 'magazyn', 'magazyn_bialystok', 'magazyn_zielonka'].includes(role) || isAdmin
            },
            map: { view: true },
            transport: { 
              markAsCompleted: ['admin', 'koordynator', 'magazyn', 'magazyn_bialystok', 'magazyn_zielonka', 'kierowca'].includes(role) || isAdmin
            }
          };

          return {
            isAuthenticated: true,
            user: {
              email: email,
              name: userRow?.name || tokenData?.user?.user_metadata?.full_name || email.split('@')[0],
              position: userRow?.position || '',
              role: role,
              permissions: permissions,
              mpk: userRow?.mpk || '',
              isAdmin: isAdmin
            }
          };
        }
      } catch (supabaseTokenErr) {
        console.warn('Błąd parsowania tokenu Supabase SSO:', supabaseTokenErr.message);
      }
    }

    // 2. Fallback: Legacy token sesji (authToken)
    const authToken = request.cookies.get('authToken')?.value;
    if (!authToken) {
      return { isAuthenticated: false, user: null };
    }

    const userId = await validateSession(authToken);
    if (!userId) {
      return { isAuthenticated: false, user: null };
    }

    const user = await db('users')
      .where('email', userId)
      .select('email', 'name', 'position', 'role', 'permissions', 'mpk', 'is_admin')
      .first();

    if (!user) {
      return { isAuthenticated: false, user: null };
    }

    let permissions = {};
    try {
      if (user.permissions && typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions);
      } else if (typeof user.permissions === 'object') {
        permissions = user.permissions;
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień w getSessionUser:', e);
      permissions = {};
    }

    const isAdmin = Boolean(
      user.is_admin === true ||
      user.is_admin === 1 ||
      user.is_admin === 't' ||
      user.is_admin === 'TRUE' ||
      user.is_admin === 'true' ||
      user.role === 'admin'
    );

    return {
      isAuthenticated: true,
      user: {
        email: user.email,
        name: user.name,
        position: user.position,
        role: user.role,
        permissions: permissions,
        mpk: user.mpk || '',
        isAdmin: isAdmin
      }
    };
  } catch (error) {
    console.error('Błąd getSessionUser:', error);
    return { isAuthenticated: false, user: null };
  }
}

