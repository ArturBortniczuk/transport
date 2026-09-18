// src/lib/auth.js
import db from '@/database/db';
import { supabaseAdmin } from './supabaseClient';
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
 * Normalizuje nazwy ról pomiędzy Narzędziownikiem (portal) a aplikacją Transport.
 */
export function normalizeTransportRole(rawRole) {
  if (!rawRole) return 'handlowiec';
  const lower = String(rawRole).toLowerCase().trim();
  if (lower === 'admin' || lower.includes('administrator')) return 'admin';
  if (lower.includes('koordynator') || lower.includes('dyspozytor')) return 'koordynator';
  if (lower.includes('magazynier białystok') || lower.includes('magazynier bialystok') || lower === 'magazyn_bialystok') return 'magazyn_bialystok';
  if (lower.includes('magazynier zielonka') || lower === 'magazyn_zielonka') return 'magazyn_zielonka';
  if (lower.includes('magazyn')) return 'magazyn';
  if (lower.includes('kierowca')) return 'kierowca';
  if (lower.includes('handlowiec') || lower.includes('pracownik') || lower.includes('specjalista') || lower.includes('pozostałe') || lower.includes('pozostale')) return 'handlowiec';
  return lower;
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
      // 1. Pobierz użytkownika z profiles oraz z user_app_permissions bezpośrednio z Supabase
      let userRow = null;
      let userPerm = null;

      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .ilike('email', ssoEmail)
          .maybeSingle();

        if (profile) {
          userRow = profile;
          const { data: perm } = await supabaseAdmin
            .from('user_app_permissions')
            .select('*')
            .eq('user_id', profile.id)
            .eq('app_id', 'transport')
            .maybeSingle();
          userPerm = perm;
        }
      } catch (err) {
        console.error('Błąd pobierania profilu z Supabase:', err);
      }

      // 2. Fallback do widoku users jeśli profil nie został znaleziony przez maybeSingle
      let fallbackUser = null;
      if (!userRow) {
        fallbackUser = await db('users')
          .whereRaw('LOWER(email) = ?', [ssoEmail])
          .first()
          .catch(() => null);
        if (fallbackUser) userRow = fallbackUser;
      }

      // Rola w aplikacji Transport:
      // Wyłącznie z user_app_permissions (jeśli rekord istnieje i is_active)
      // Nigdy nie bierzemy profiles.role, ponieważ historycznie wszyscy pracownicy w profiles mieli role='admin'!
      const rawRole = (userPerm?.is_active && userPerm.role)
        ? userPerm.role
        : (fallbackUser?.role && fallbackUser.role !== 'admin' ? fallbackUser.role : 'pracownik');

      const normalizedRole = normalizeTransportRole(rawRole);
      const emailLower = ssoEmail.toLowerCase();
      const isSuperAdmin = emailLower === 'a.bortniczuk@grupaeltron.pl';

      // Parsuj własne uprawnienia jeśli istnieją (z user_app_permissions z Supabase)
      let customPerms = {};
      try {
        const rawPerms = userPerm?.permissions || fallbackUser?.permissions || userRow?.permissions;
        if (rawPerms) {
          customPerms = typeof rawPerms === 'string' ? JSON.parse(rawPerms) : rawPerms;
        }
      } catch (e) {}

      // Użytkownik jest administratorem TYLKO jeśli:
      // 1. Jest SuperAdminem (a.bortniczuk@grupaeltron.pl)
      // 2. Jego rola w systemie transportowym to 'admin' (lub zawiera 'administrator')
      // 3. W uprawnieniach transportu ma włączone zarządzanie użytkownikami (customPerms.admin.users === true)
      const isAdmin = isSuperAdmin ||
        normalizedRole === 'admin' ||
        customPerms?.admin?.users === true;

      // Sprawdź czy to rola magazynowa
      const isWarehouse = 
        normalizedRole === 'magazyn' ||
        normalizedRole === 'magazyn_bialystok' ||
        normalizedRole === 'magazyn_zielonka' ||
        emailLower.includes('magazyn');

      const isCoordinator = normalizedRole === 'koordynator';
      const isDriver = normalizedRole === 'kierowca' || emailLower.includes('kierowca');

      // Sprawdź obecność grup w customPerms
      const hasCustomCalendar = customPerms && customPerms.calendar !== undefined;
      const hasCustomTransport = customPerms && customPerms.transport !== undefined;
      const hasCustomRequests = customPerms && customPerms.transport_requests !== undefined;
      const hasCustomSpedycja = customPerms && customPerms.spedycja !== undefined;

      const canEditCalendar = hasCustomCalendar && customPerms.calendar?.edit !== undefined
        ? Boolean(customPerms.calendar.edit)
        : (isAdmin || isWarehouse || isCoordinator);

      const canCompleteTransport = hasCustomTransport && customPerms.transport?.markAsCompleted !== undefined
        ? Boolean(customPerms.transport.markAsCompleted)
        : (isAdmin || isWarehouse || isCoordinator || isDriver);

      let permissions = {
        calendar: { 
          view: true, 
          edit: canEditCalendar,
          reschedule: hasCustomCalendar && customPerms.calendar?.reschedule !== undefined ? Boolean(customPerms.calendar.reschedule) : canEditCalendar,
          assign_packagings: hasCustomCalendar && customPerms.calendar?.assign_packagings !== undefined ? Boolean(customPerms.calendar.assign_packagings) : canEditCalendar,
          connect_routes: hasCustomCalendar && customPerms.calendar?.connect_routes !== undefined ? Boolean(customPerms.calendar.connect_routes) : canEditCalendar
        },
        map: { view: true },
        transport: { 
          markAsCompleted: canCompleteTransport 
        },
        // Wnioski transportowe: magazynierzy i koordynatorzy mają domyślnie zatwierdzanie, handlowcy dodawanie
        transport_requests: {
          add: hasCustomRequests && customPerms.transport_requests?.add !== undefined ? Boolean(customPerms.transport_requests.add) : true,
          view_own: hasCustomRequests && customPerms.transport_requests?.view_own !== undefined ? Boolean(customPerms.transport_requests.view_own) : true,
          view_all: hasCustomRequests && customPerms.transport_requests?.view_all !== undefined ? Boolean(customPerms.transport_requests.view_all) : (isWarehouse || isAdmin || isCoordinator),
          approve: hasCustomRequests && customPerms.transport_requests?.approve !== undefined ? Boolean(customPerms.transport_requests.approve) : (isWarehouse || isAdmin || isCoordinator)
        },
        // Transport zewnętrzny (zlecenia Handlowiec -> Logistyk):
        // Magazynier i kierowca NIE odpowiadają ani nie zamykają zleceń zewnętrznych (respond: false)!
        // Handlowiec może dodawać (add: true). Logistyk / Koordynator / Admin odpowiada i zamyka (respond: true).
        spedycja: {
          view: hasCustomSpedycja && customPerms.spedycja?.view !== undefined ? Boolean(customPerms.spedycja.view) : true,
          add: hasCustomSpedycja && customPerms.spedycja?.add !== undefined ? Boolean(customPerms.spedycja.add) : (isAdmin || isCoordinator || (!isWarehouse && !isDriver)),
          respond: hasCustomSpedycja && customPerms.spedycja?.respond !== undefined ? Boolean(customPerms.spedycja.respond) : (isAdmin || isCoordinator),
          sendOrder: hasCustomSpedycja && customPerms.spedycja?.sendOrder !== undefined ? Boolean(customPerms.spedycja.sendOrder) : (isAdmin || isCoordinator),
          cmr: hasCustomSpedycja && customPerms.spedycja?.cmr !== undefined ? Boolean(customPerms.spedycja.cmr) : (isAdmin || isCoordinator),
          unmerge: hasCustomSpedycja && customPerms.spedycja?.unmerge !== undefined ? Boolean(customPerms.spedycja.unmerge) : (isAdmin || isCoordinator)
        },
        courier: {
          view: customPerms?.courier?.view !== undefined ? Boolean(customPerms.courier.view) : true,
          add: customPerms?.courier?.add !== undefined ? Boolean(customPerms.courier.add) : true
        },
        valuation: {
          calculator: customPerms?.valuation?.calculator !== undefined ? Boolean(customPerms.valuation.calculator) : true,
          history: customPerms?.valuation?.history !== undefined ? Boolean(customPerms.valuation.history) : true
        },
        coordinator: {
          view: customPerms?.coordinator?.view !== undefined ? Boolean(customPerms.coordinator.view) : (isCoordinator || isAdmin),
          import_csv: customPerms?.coordinator?.import_csv !== undefined ? Boolean(customPerms.coordinator.import_csv) : (isCoordinator || isAdmin)
        },
        cable_advices: {
          view: customPerms?.cable_advices?.view !== undefined ? Boolean(customPerms.cable_advices.view) : (isWarehouse || isAdmin),
          manage: customPerms?.cable_advices?.manage !== undefined ? Boolean(customPerms.cable_advices.manage) : (isWarehouse || isAdmin)
        },
        archive: {
          view: customPerms?.archive?.view !== undefined ? Boolean(customPerms.archive.view) : true,
          export: customPerms?.archive?.export !== undefined ? Boolean(customPerms.archive.export) : (isWarehouse || isAdmin || isCoordinator),
          delete: customPerms?.archive?.delete !== undefined ? Boolean(customPerms.archive.delete) : isAdmin
        },
        ratings: {
          view: customPerms?.ratings?.view !== undefined ? Boolean(customPerms.ratings.view) : true,
          rate: customPerms?.ratings?.rate !== undefined ? Boolean(customPerms.ratings.rate) : true
        },
        admin: {
          users: customPerms?.admin?.users !== undefined ? Boolean(customPerms.admin.users) : isAdmin,
          valuation: customPerms?.admin?.valuation !== undefined ? Boolean(customPerms.admin.valuation) : isAdmin,
          packagings: customPerms?.admin?.packagings !== undefined ? Boolean(customPerms.admin.packagings) : isAdmin,
          constructions: customPerms?.admin?.constructions !== undefined ? Boolean(customPerms.admin.constructions) : isAdmin,
          cable_advices: customPerms?.admin?.cable_advices !== undefined ? Boolean(customPerms.admin.cable_advices) : isAdmin
        }
      };

      return {
        isAuthenticated: true,
        user: {
          id: userRow?.id,
          email: ssoEmail,
          name: userRow?.name || fallbackUser?.name || ssoEmail.split('@')[0],
          position: userRow?.position || fallbackUser?.position || '',
          role: normalizedRole,
          rawRole: rawRole,
          permissions: permissions,
          mpk: userRow?.mpk || fallbackUser?.mpk || '',
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
