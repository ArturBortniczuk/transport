// src/components/Navigation.js - ZAKTUALIZOWANY O BOCZNY ZWIJALNY PANEL (SIDEBAR) ZGODNY Z EKOSYSTEMEM ELTRON
'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ChangePassword from './ChangePassword'
import AppSwitcher from './AppSwitcher'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Truck,
  Calendar,
  Archive,
  Map,
  FileText,
  Building2,
  Package,
  Send,
  Users,
  Lock,
  LogOut,
  Star,
  Calculator,
  BarChart3,
  ListFilter,
  Shield,
  UserCheck
} from 'lucide-react'

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Navigation({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userPermissions, setUserPermissions] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)

  // Stan zwinięcia bocznego menu (Sidebar)
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Stan mobilnego drawer menu
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Odczyt zapamiętanego stanu zwinięcia sidebara z localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('transport_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // ignore
    }
  }, []);

  // Zamknięcie menu mobilnego przy zmianie trasy
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('transport_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Pobieranie danych użytkownika
  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/user');
      const data = await response.json();

      if (data.isClient || (data.user && (data.user.role === 'client' || data.user.role === 'klient'))) {
        window.location.replace('https://www.opakowania.grupaeltron.pl/dashboard');
        return;
      }

      setIsLoggedIn(data.isAuthenticated);
      if (data.isAuthenticated && data.user) {
        const rawRole = (data.user.role || '').toLowerCase().trim();
        let normalizedRole = rawRole;
        if (rawRole === 'admin' || rawRole.includes('administrator')) normalizedRole = 'admin';
        else if (rawRole.includes('koordynator') || rawRole.includes('dyspozytor')) normalizedRole = 'koordynator';
        else if (rawRole.includes('magazynier zielonka') || rawRole === 'magazyn_zielonka') normalizedRole = 'magazyn_zielonka';
        else if (rawRole.includes('magazynier białystok') || rawRole.includes('magazynier bialystok') || rawRole === 'magazyn_bialystok') normalizedRole = 'magazyn_bialystok';
        else if (rawRole.includes('magazyn')) normalizedRole = 'magazyn';
        else if (rawRole.includes('kierowca')) normalizedRole = 'kierowca';
        else if (rawRole.includes('handlowiec') || rawRole.includes('pracownik') || rawRole.includes('specjalista') || rawRole.includes('pozostałe') || rawRole.includes('pozostale')) normalizedRole = 'handlowiec';

        setUserRole(normalizedRole || null);
        setUserName(data.user.name || '');
        setUserEmail(data.user.email || '');

        const adminStatus =
          data.user.isAdmin === true ||
          data.user.isAdmin === 1 ||
          data.user.isAdmin === 't' ||
          data.user.isAdmin === 'TRUE' ||
          data.user.isAdmin === 'true' ||
          normalizedRole === 'admin';

        setIsAdmin(adminStatus);
        setUserPermissions(data.user.permissions || {});
      }
    } catch (error) {
      console.error('Błąd pobierania danych użytkownika:', error);
    }
  };

  useEffect(() => {
    fetchUserInfo();

    const intervalId = isLoggedIn
      ? setInterval(() => {
          fetchUserInfo();
        }, 60000)
      : null;

    const handleAuthChange = () => {
      fetchUserInfo();
    };

    window.addEventListener('auth-state-changed', handleAuthChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('auth-state-changed', handleAuthChange);
    };
  }, [pathname, isLoggedIn]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
      });

      setIsLoggedIn(false);
      setUserRole(null);
      setUserName('');
      setUserEmail('');
      setIsAdmin(false);
      setUserPermissions(null);

      window.dispatchEvent(new Event('auth-state-changed'));
      router.push('/login');
    } catch (error) {
      console.error('Błąd wylogowania:', error);
    }
  };

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const perms = userPermissions || {};

  // Narzędzia items:
  const narzedziaItems = [
    { name: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    ...(isAdmin || perms.ratings?.view !== false
      ? [{ name: 'Oceny', path: '/oceny', icon: Star }]
      : []
    ),
    ...(isAdmin || perms.valuation?.calculator !== false
      ? [{ name: 'Wycena transportu', path: '/wycena-transportu', icon: Calculator }]
      : []
    ),
    ...(isAdmin || perms.cable_advices?.view === true
      ? [{ name: 'Awizacje kabli', path: '/awizacje-kabli', icon: Package }]
      : []
    )
  ];

  // Transport własny items:
  const canViewAllRequests = isAdmin || perms.transport_requests?.view_all === true || perms.transport_requests?.approve === true;
  const canViewOwnRequests = !canViewAllRequests && (perms.transport_requests?.view_own !== false || perms.transport_requests?.add !== false);

  const transportWlasnyItems = [
    ...(isAdmin || perms.calendar?.view !== false
      ? [{ name: 'Kalendarz', path: '/kalendarz', icon: Calendar }]
      : []
    ),
    ...(isAdmin || perms.archive?.view !== false
      ? [{ name: 'Archiwum', path: '/archiwum', icon: Archive }]
      : []
    ),
    ...(isAdmin || perms.map?.view !== false
      ? [{ name: 'Mapa tras', path: '/mapa', icon: Map }]
      : []
    ),
    ...(canViewOwnRequests
      ? [{ name: 'Moje wnioski', path: '/moje-wnioski', icon: FileText }]
      : []
    ),
    ...(canViewAllRequests
      ? [{ name: 'Wnioski transportowe', path: '/wnioski-transportowe', icon: FileText }]
      : []
    )
  ];

  // Transport zewnętrzny items:
  const transportZewnetrznyItems = [
    ...(isAdmin || perms.spedycja?.view !== false
      ? [{ name: 'Spedycja', path: '/spedycja', icon: Send }]
      : []
    ),
    ...(isAdmin || (perms.archive_spedycji?.view !== undefined ? perms.archive_spedycji.view !== false : perms.archive?.view !== false)
      ? [{ name: 'Archiwum spedycji', path: '/archiwum-spedycji', icon: Archive }]
      : []
    )
  ];

  // Admin items:
  const hasAdminUsers = isAdmin || perms.admin?.users === true;
  const hasAdminConstructions = isAdmin || perms.admin?.constructions === true;
  const hasAdminValuation = isAdmin || perms.admin?.valuation === true;
  const hasAdminCableAdvices = isAdmin || perms.admin?.cable_advices === true;
  const hasCoordinatorView = isAdmin || perms.coordinator?.view === true || userRole === 'koordynator';

  const adminItems = [
    ...(hasAdminUsers
      ? [{ name: 'Zarządzanie użytkownikami', path: '/admin', icon: Users }]
      : []
    ),
    ...(hasAdminConstructions
      ? [{ name: 'Zarządzanie budowami', path: '/admin/constructions', icon: Building2 }]
      : []
    ),
    ...(hasAdminValuation
      ? [{ name: 'Ustawienia wyceny', path: '/admin/valuation', icon: Calculator }]
      : []
    ),
    ...(hasAdminCableAdvices
      ? [{ name: 'Słowniki awizacji kabli', path: '/admin/cable-advices', icon: Package }]
      : []
    ),
    ...(hasCoordinatorView
      ? [{ name: 'Panel koordynatora', path: '/koordynator', icon: ListFilter }]
      : []
    )
  ];

  const menuSections = [
    { id: 'narzedzia', title: 'Narzędzia', icon: BarChart3, items: narzedziaItems },
    { id: 'transport-wlasny', title: 'Transport własny', icon: Truck, items: transportWlasnyItems },
    { id: 'transport-zewnetrzny', title: 'Transport zewnętrzny', icon: Send, items: transportZewnetrznyItems },
    { id: 'panel-admin', title: 'Panel Administratora', icon: Shield, items: adminItems }
  ].filter(section => section.items.length > 0);

  // Stan rozwinięcia poszczególnych zakładek (kategorii)
  const [openSections, setOpenSections] = useState({});

  // Gdy użytkownik przechodzi między stronami, automatycznie rozwijamy zakładkę zawierającą bieżącą podstronę
  useEffect(() => {
    const activeSection = menuSections.find(section =>
      section.items.some(item => isActive(item.path))
    );
    if (activeSection) {
      setOpenSections(prev => {
        if (prev[activeSection.id]) return prev;
        return { ...prev, [activeSection.id]: true };
      });
    }
  }, [pathname]);

  const toggleSection = (sectionId) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const getRoleBadge = (role) => {
    const rawRole = (role || '').toLowerCase();
    const roleConfig = {
      admin: { label: 'Administrator', icon: Shield, gradient: 'from-purple-600 to-indigo-700' },
      koordynator: { label: 'Koordynator', icon: ListFilter, gradient: 'from-blue-600 to-cyan-700' },
      magazyn_zielonka: { label: 'Magazyn Zielonka', icon: Package, gradient: 'from-sky-600 to-blue-700' },
      magazyn_bialystok: { label: 'Magazyn Białystok', icon: Package, gradient: 'from-sky-600 to-blue-700' },
      magazyn: { label: 'Magazyn', icon: Package, gradient: 'from-sky-600 to-blue-700' },
      kierowca: { label: 'Kierowca', icon: Truck, gradient: 'from-amber-500 to-orange-600' },
      handlowiec: { label: 'Handlowiec', icon: UserCheck, gradient: 'from-indigo-500 to-blue-600' }
    };
    const config = roleConfig[rawRole] || { label: role || 'Pracownik', icon: UserCheck, gradient: 'from-slate-600 to-slate-800' };
    const Icon = config.icon;
    return (
      <div className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-gradient-to-r ${config.gradient} text-white text-[10px] font-bold shadow-xs whitespace-nowrap`}>
        <Icon className="w-2.5 h-2.5 shrink-0" />
        <span>{config.label}</span>
      </div>
    );
  };

  const getAvatarInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const isPublicPath = pathname === '/login' || pathname === '/first-change-password';

  // Renderowanie zakładek z możliwością zwijania i pokazywania zawartości dopiero po rozwinięciu
  const renderNavSection = (section, collapsedMode) => {
    const SectionIcon = section.icon;
    const isSectionActive = section.items.some(item => isActive(item.path));
    const isOpen = !!openSections[section.id];

    // Tryb zminimalizowanego paska (szerokość 80px)
    if (collapsedMode) {
      return (
        <div key={section.id} className="relative group flex justify-center py-1">
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setOpenSections(prev => ({ ...prev, [section.id]: true }));
            }}
            title={`${section.title} (${section.items.length}) - Kliknij, aby rozwinąć`}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
              isSectionActive
                ? "bg-gradient-to-tr from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/25"
                : "text-slate-500 hover:text-blue-700 hover:bg-blue-50/80 border border-transparent hover:border-blue-100"
            )}
          >
            <SectionIcon className="w-5 h-5" />
            {isSectionActive && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white ring-2 ring-blue-600" />
            )}
          </button>
        </div>
      );
    }

    // Standardowy widok: Zwinięta/rozwinięta zakładka (akordeon)
    return (
      <div
        key={section.id}
        className={cn(
          "rounded-xl border transition-all overflow-hidden",
          isOpen
            ? "border-blue-200/90 bg-white shadow-xs"
            : "border-slate-200/70 bg-white/70 hover:border-blue-200 hover:bg-white"
        )}
      >
        {/* Nagłówek zakładki (przycisk zwijania / rozwijania) */}
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={cn(
            "w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer select-none",
            isOpen
              ? "bg-gradient-to-r from-blue-50/80 to-indigo-50/50"
              : "hover:bg-slate-50/80"
          )}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                isOpen || isSectionActive
                  ? "bg-gradient-to-tr from-blue-600 to-indigo-700 text-white shadow-xs shadow-blue-500/20"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              <SectionIcon className="w-3.5 h-3.5" />
            </div>
            <span
              className={cn(
                "text-xs sm:text-[13px] tracking-tight truncate",
                isOpen || isSectionActive
                  ? "font-bold text-slate-900"
                  : "font-semibold text-slate-700"
              )}
            >
              {section.title}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 ml-2">
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors",
                isSectionActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {section.items.length}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-slate-400 transition-transform duration-200",
                isOpen && "rotate-180 text-blue-600"
              )}
            />
          </div>
        </button>

        {/* Zawartość zakładki - POKAZYWANA TYLKO PO ROZWINIĘCIU! */}
        {isOpen && (
          <div className="p-1.5 bg-slate-50/40 border-t border-slate-100 space-y-0.5">
            {section.items.map((item) => {
              const ItemIcon = item.icon;
              const itemActive = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center px-2.5 py-2 rounded-lg text-xs font-semibold transition-all group",
                    itemActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm shadow-blue-500/20 font-bold"
                      : "text-slate-600 hover:text-blue-700 hover:bg-blue-50/80"
                  )}
                >
                  <ItemIcon
                    className={cn(
                      "w-4 h-4 mr-2.5 shrink-0 transition-colors",
                      itemActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Jeśli użytkownik jest na stronie logowania lub nie jest zalogowany
  if (!isLoggedIn || isPublicPath) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
        <header className="fixed top-0 left-0 right-0 h-16 z-40 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-white border-b border-blue-950 shadow-md px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3.5 group">
            <img
              src="/logo.png"
              alt="Logo TRANSPORT"
              className="h-9 sm:h-10 w-auto object-contain shrink-0 drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/logo40.png';
              }}
            />
            <span className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase select-none">
              TRANSPORT
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <AppSwitcher dark={true} />
            <Link
              href="/login"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-950/40"
            >
              Logowanie
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full pt-16 flex flex-col">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* GÓRNY PASEK NAGŁÓWKA (HEADER) */}
      <header className="fixed top-0 left-0 right-0 h-16 z-40 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-white border-b border-blue-950 shadow-md px-4 sm:px-6 flex items-center justify-between transition-colors">
        
        {/* Lewa strona: Przycisk zwijania sidebara + Logo i Duży Tytuł TRANSPORT */}
        <div className="flex items-center space-x-3">
          
          {/* Przycisk mobile drawer */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 border border-blue-800/80 transition-all cursor-pointer lg:hidden"
            title="Otwórz menu mobilne"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Przycisk zwijania bocznego panelu dla desktopu */}
          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? "Rozwiń panel boczny" : "Zwiń panel boczny"}
            className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 border border-blue-800/80 transition-all cursor-pointer hidden lg:flex items-center justify-center shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-blue-300" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-blue-200" />
            )}
          </button>

          {/* Brand Logo & Duży napis TRANSPORT */}
          <Link href="/kalendarz" className="flex items-center space-x-3.5 cursor-pointer group">
            <img
              src="/logo.png"
              alt="Logo TRANSPORT"
              className="h-9 sm:h-10 w-auto object-contain shrink-0 drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/logo40.png';
              }}
            />
            <span className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase select-none">
              TRANSPORT
            </span>
          </Link>
        </div>

        {/* Prawa strona: Przełącznik Ekosystemu Eltron + Info Użytkownika + Akcje */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          
          {/* Przełącznik aplikacji Eltron */}
          <AppSwitcher dark={true} />

          {/* Dane zalogowanego użytkownika */}
          <div className="flex items-center space-x-3 border-l border-blue-800/80 pl-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shadow-sm shrink-0 border border-blue-400/30">
              {getAvatarInitials(userName)}
            </div>

            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-extrabold text-white truncate max-w-[160px]">
                {userName || 'Użytkownik'}
              </div>
              <div className="mt-0.5">
                {getRoleBadge(userRole)}
              </div>
            </div>

            {/* Przycisk Zmiany Hasła */}
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 border border-blue-800/80 transition-all cursor-pointer"
              title="Zmień hasło"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Przycisk Wylogowania */}
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl text-blue-200 hover:text-rose-300 hover:bg-rose-950/40 border border-blue-800/80 hover:border-rose-800/60 transition-all cursor-pointer"
              title="Wyloguj z systemu"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* LEWY BOCZNY PANEL NAWIGACJI (DESKTOP SIDEBAR) */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 z-30 bg-white/95 backdrop-blur-md border-r border-slate-200/90 shadow-xs hidden lg:flex flex-col justify-between transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        {/* Karta użytkownika na samej górze panelu (gdy rozwinięty) */}
        {!isCollapsed && (
          <div className="p-3.5 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/40">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-extrabold flex items-center justify-center text-xs shadow-sm shrink-0">
                {getAvatarInitials(userName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{userName}</div>
                <div className="text-[11px] text-slate-500 truncate">{userEmail}</div>
              </div>
            </div>
          </div>
        )}

        {/* Scrollowalna lista zakładek podzielona na zwijane kategorie */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {menuSections.map(section => renderNavSection(section, isCollapsed))}
        </nav>
      </aside>

      {/* MOBILNY DRAWER (DLA EKRANÓW < LG) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Tło przyciemniające */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Panel szuflady */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col justify-between z-50">
            <div className="p-4 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 border-b border-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src="/logo.png"
                  alt="Logo TRANSPORT"
                  className="h-8 w-auto object-contain shrink-0 drop-shadow-sm"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/logo40.png';
                  }}
                />
                <span className="text-lg font-black tracking-wider text-white uppercase">
                  TRANSPORT
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {menuSections.map(section => renderNavSection(section, false))}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-2">
              <div className="flex items-center space-x-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center text-xs">
                  {getAvatarInitials(userName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{userName}</div>
                  <div className="mt-0.5">{getRoleBadge(userRole)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileOpen(false);
                  setShowChangePassword(true);
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center space-x-2"
              >
                <Lock className="w-4 h-4 text-slate-500" />
                <span>Zmień hasło</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Wyloguj się</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GŁÓWNA ZAWARTOŚĆ STRONY (MAIN WORKSPACE) */}
      <main
        className={cn(
          "flex-1 min-w-0 transition-all duration-300 ease-in-out pt-16 flex flex-col min-h-screen",
          isLoggedIn && !isPublicPath ? (isCollapsed ? "lg:pl-20" : "lg:pl-72") : "pl-0"
        )}
      >
        <div className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </div>

        {/* Nowoczesna, czysta stopka */}
        <footer className="py-4 px-6 border-t border-slate-200/70 bg-white/60 text-center text-xs text-slate-500 font-medium">
          <p>&copy; 2025 Grupa Eltron &bull; System Zarządzania Transportem. Wszelkie prawa zastrzeżone.</p>
        </footer>
      </main>

      {/* Modal zmiany hasła */}
      {showChangePassword && (
        <ChangePassword onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}