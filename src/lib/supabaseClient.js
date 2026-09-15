import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.SUPABASE_URL || '';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.SUPABASE_ANON_KEY || '';

function getCookieDomain() {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host.includes('grupaeltron.pl')) {
    return '; domain=.grupaeltron.pl';
  }
  return '';
}

export const cookieStorage = {
  getItem: (key) => {
    if (typeof document === 'undefined') return null;
    const name = key + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        try {
          return decodeURIComponent(c.substring(name.length));
        } catch {
          return c.substring(name.length);
        }
      }
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    if (typeof document === 'undefined') return;
    const domainStr = getCookieDomain();
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
    const maxAge = 60 * 60 * 24 * 30; // 30 dni
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${domainStr}${isSecure}`;
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key) => {
    if (typeof document === 'undefined') return;
    const domainStr = getCookieDomain();
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax${domainStr}`;
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

const supabaseServiceKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'eltron_auth_token',
    storage: cookieStorage
  }
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Pobiera profil i uprawnienie do modułu Transport dla bieżącej sesji
 */
export async function getTransportUserProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;

  const user = session.user;
  const userEmail = (user.email || '').toLowerCase().trim();

  // Pobierz dane profilu
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // Pobierz uprawnienie do Transportu
  const { data: perm } = await supabase
    .from('user_app_permissions')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('app_id', 'transport')
    .maybeSingle();

  const role = perm?.is_active ? perm.role : (profile?.role === 'admin' ? 'admin' : 'pracownik');
  const roleLower = (role || '').toLowerCase();
  const isAdmin = roleLower === 'admin' || profile?.role === 'admin' || userEmail === 'a.bortniczuk@grupaeltron.pl';
  const isWarehouse = 
    userEmail.includes('magazyn') || 
    roleLower.includes('magazyn') || 
    (profile?.role && profile.role.toLowerCase().includes('magazyn'));
  const isCoordinator = roleLower.includes('koordynator');
  const isDriver = roleLower.includes('kierowca') || userEmail.includes('kierowca');

  return {
    id: user.id,
    email: userEmail,
    name: profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || userEmail.split('@')[0],
    role: role,
    isAdmin: isAdmin,
    mpk: profile?.mpk || '',
    isActive: perm ? perm.is_active : true,
    permissions: {
      calendar: { 
        view: true,
        edit: isAdmin || isWarehouse || isCoordinator || ['kierownik', 'dyrektor'].includes(roleLower)
      },
      map: { view: true },
      transport: { 
        markAsCompleted: isAdmin || isWarehouse || isCoordinator || isDriver
      }
    }
  };
}

