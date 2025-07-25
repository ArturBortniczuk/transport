// src/components/Navigation.js - ZAKTUALIZOWANY Z ROZWIJANYMI KATEGORIAMI
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ChangePassword from './ChangePassword'
import { 
  ChevronDown, 
  Truck, 
  Calendar, 
  Archive, 
  Map, 
  FileText, 
  Building2, 
  Package, 
  Send,
  Users,
  Settings,
  Lock,
  LogOut,
  Menu,
  X
} from 'lucide-react'

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminAccess, setAdminAccess] = useState({
    isFullAdmin: false,
    packagings: false,
    constructions: false
  })
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  
  // Stany dla dropdown menu
  const [openDropdown, setOpenDropdown] = useState(null)
  const dropdownRefs = useRef({})
  
  const pathname = usePathname()
  const router = useRouter()

  // Funkcja pomocnicza do obsługi różnych formatów boolean
  const isTrueValue = (value) => {
    return value === true || 
           value === 1 || 
           value === 't' || 
           value === 'TRUE' || 
           value === 'true' || 
           value === 'T';
  };

  // Funkcja pobierająca dane użytkownika
  const fetchUserInfo = async () => {
    try {
      console.log('Pobieranie informacji o użytkowniku...');
      const response = await fetch('/api/user');
      const data = await response.json();
      
      console.log('Odpowiedź z API:', data);
      
      setIsLoggedIn(data.isAuthenticated);
      if (data.isAuthenticated && data.user) {
        const role = data.user.role;
        // Normalizacja roli dla zachowania wstecznej kompatybilności
        let normalizedRole = role;
        if (role === 'magazyn_bialystok') normalizedRole = 'magazyn';
        if (role === 'magazyn_zielonka') normalizedRole = 'magazyn';
        
        setUserRole(normalizedRole || null);
        setUserName(data.user.name || '');
        
        // Poprawiona obsługa wartości isAdmin
        const adminStatus = 
          data.user.isAdmin === true || 
          data.user.isAdmin === 1 || 
          data.user.isAdmin === 't' || 
          data.user.isAdmin === 'TRUE' ||
          data.user.isAdmin === 'true' ||
          data.user.role === 'admin';
        
        setIsAdmin(adminStatus);

        // Sprawdź uprawnienia administracyjne
        const permissions = data.user.permissions || {};
        const hasPackagingsAccess = permissions.admin?.packagings === true;
        const hasConstructionsAccess = permissions.admin?.constructions === true;
        
        setAdminAccess({
          isFullAdmin: adminStatus,
          packagings: adminStatus || hasPackagingsAccess,
          constructions: adminStatus || hasConstructionsAccess
        });

        console.log('Stan użytkownika ustawiony:', {
          role: normalizedRole,
          isAdmin: adminStatus,
          adminAccess: {
            isFullAdmin: adminStatus,
            packagings: adminStatus || hasPackagingsAccess,
            constructions: adminStatus || hasConstructionsAccess
          }
        });
      } else {
        // Reset state gdy użytkownik nie jest zalogowany
        setUserRole(null);
        setUserName('');
        setIsAdmin(false);
        setAdminAccess({
          isFullAdmin: false,
          packagings: false,
          constructions: false
        });
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      setIsLoggedIn(false);
      setUserRole(null);
      setUserName('');
      setIsAdmin(false);
      setAdminAccess({
        isFullAdmin: false,
        packagings: false,
        constructions: false
      });
    }
  };

  useEffect(() => {
    fetchUserInfo();
    
    // Odświeżaj co minutę tylko jeśli użytkownik jest zalogowany
    const intervalId = isLoggedIn ? 
      setInterval(() => {
        fetchUserInfo();
      }, 60000)
    : null;
      
    // Własne zdarzenie do odświeżania po zalogowaniu
    const handleAuthChange = () => {
      console.log('Wykryto zmianę stanu uwierzytelnienia');
      fetchUserInfo();
    };
    
    window.addEventListener('auth-state-changed', handleAuthChange);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('auth-state-changed', handleAuthChange);
    };
  }, [pathname]);

  // Obsługa kliknięć poza dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && dropdownRefs.current[openDropdown]) {
        if (!dropdownRefs.current[openDropdown].contains(event.target)) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
      });
      
      // Odśwież stan komponentu
      setIsLoggedIn(false);
      setUserRole(null);
      setUserName('');
      setIsAdmin(false);
      setAdminAccess({
        isFullAdmin: false,
        packagings: false,
        constructions: false
      });
      
      // Emituj zdarzenie zmiany stanu uwierzytelnienia
      window.dispatchEvent(new Event('auth-state-changed'));
      
      // Przekieruj do strony logowania
      router.push('/login');
    } catch (error) {
      console.error('Błąd wylogowania:', error);
    }
  };

  // Funkcja do przełączania dropdown
  const toggleDropdown = (dropdownName) => {
    setOpenDropdown(openDropdown === dropdownName ? null : dropdownName);
  };

  // Funkcja sprawdzająca czy ścieżka jest aktywna
  const isActive = (path) => pathname === path;
  const isDropdownActive = (paths) => paths.some(path => pathname.startsWith(path));

  // Struktura menu - definiujemy wszystkie kategorie
  const menuStructure = {
    'transport-wlasny': {
      title: 'Transport własny',
      icon: Truck,
      items: [
        { name: 'Kalendarz', path: '/kalendarz', icon: Calendar },
        { name: 'Archiwum', path: '/archiwum', icon: Archive },
        { name: 'Mapa', path: '/mapa', icon: Map },
        // Warunkowo dodajemy wnioski
        ...(userRole === 'handlowiec' 
          ? [{ name: 'Moje wnioski', path: '/moje-wnioski', icon: FileText }]
          : []
        ),
        ...(userRole === 'magazyn' || userRole?.startsWith('magazyn_') || userRole === 'admin'
          ? [{ name: 'Wnioski transportowe', path: '/wnioski-transportowe', icon: FileText }]
          : []
        )
      ]
    },
    'transport-zewnetrzny': {
      title: 'Transport zewnętrzny',
      icon: Building2,
      items: [
        { name: 'Spedycja', path: '/spedycja', icon: Send },
        { name: 'Archiwum spedycji', path: '/archiwum-spedycji', icon: Archive },
        { name: 'Kurier', path: '/kurier', icon: Package },
        { name: 'Mapa spedycji', path: '/mapa', icon: Map }
      ]
    }
  };

  // Dodaj Panel Administratora jeśli ma uprawnienia
  if (adminAccess.isFullAdmin || adminAccess.packagings || adminAccess.constructions) {
    menuStructure['panel-admin'] = {
      title: 'Panel Administratora',
      icon: Settings,
      items: [
        ...(adminAccess.isFullAdmin 
          ? [{ name: 'Zarządzanie użytkownikami', path: '/admin', icon: Users }]
          : []
        ),
        ...(adminAccess.packagings 
          ? [{ name: 'Zarządzanie opakowaniami', path: '/admin/packagings', icon: Package }]
          : []
        ),
        ...(adminAccess.constructions 
          ? [{ name: 'Zarządzanie budowami', path: '/admin/constructions', icon: Building2 }]
          : []
        )
      ]
    };
  }

  if (!isLoggedIn) {
    return (
      <nav className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <img 
                  src="/logo.png" 
                  alt="Logo TRANSPORT" 
                  className="h-10 w-auto"
                  onError={(e) => {
                    // Fallback do ikony SVG jeśli logo nie zostanie znalezione
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'block';
                  }}
                />
                <svg 
                  className="h-8 w-8 hidden" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  style={{display: 'none'}}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="font-bold text-xl">TRANSPORT</span>
              </Link>
            </div>
            <Link
              href="/login"
              className="text-blue-100 hover:text-white px-3 py-2 text-sm font-medium transition-custom"
            >
              Logowanie
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-gradient-to-r from-blue-900 to-blue-800 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <img 
                src="/logo.png" 
                alt="Logo TransportSystem" 
                className="h-10 w-auto"
                onError={(e) => {
                  // Fallback do ikony SVG jeśli logo nie zostanie znalezione
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'block';
                }}
              />
              <svg 
                className="h-8 w-8 hidden" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                style={{display: 'none'}}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-bold text-xl">TransportSystem</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
            {Object.entries(menuStructure).map(([key, category]) => (
              <div key={key} className="relative" ref={el => dropdownRefs.current[key] = el}>
                <button
                  onClick={() => toggleDropdown(key)}
                  className={`${
                    isDropdownActive(category.items.map(item => item.path))
                      ? 'text-white bg-blue-800'
                      : 'text-blue-100 hover:text-white hover:bg-blue-800'
                  } px-3 py-2 rounded-md text-sm font-medium transition-custom flex items-center space-x-1`}
                >
                  <category.icon className="w-4 h-4" />
                  <span>{category.title}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === key ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {openDropdown === key && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      {category.items.map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => setOpenDropdown(null)}
                          className={`${
                            isActive(item.path)
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          } group flex items-center px-4 py-2 text-sm transition-colors`}
                        >
                          <item.icon className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-500" />
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* User Menu */}
            <div className="relative ml-6" ref={el => dropdownRefs.current['user-menu'] = el}>
              <button
                onClick={() => toggleDropdown('user-menu')}
                className="text-blue-100 hover:text-white px-3 py-2 text-sm font-medium transition-custom flex items-center space-x-2"
              >
                <span>{userName}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === 'user-menu' ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown */}
              {openDropdown === 'user-menu' && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowChangePassword(true);
                        setOpenDropdown(null);
                      }}
                      className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Lock className="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-500" />
                      Zmień hasło
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                        setOpenDropdown(null);
                      }}
                      className="group flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 mr-3 text-red-400 group-hover:text-red-500" />
                      Wyloguj się
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-200 hover:text-white focus:outline-none p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-blue-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {Object.entries(menuStructure).map(([key, category]) => (
                <div key={key}>
                  <div className="text-blue-100 px-3 py-2 text-sm font-medium flex items-center">
                    <category.icon className="w-4 h-4 mr-2" />
                    {category.title}
                  </div>
                  <div className="ml-4 space-y-1">
                    {category.items.map((item) => (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`${
                          isActive(item.path)
                            ? 'bg-blue-700 text-white'
                            : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                        } group flex items-center px-3 py-2 rounded-md text-sm font-medium transition-custom`}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Mobile User Menu */}
              <div className="border-t border-blue-700 pt-2 mt-2">
                <div className="px-3 py-2 text-sm text-blue-100">
                  {userName}
                </div>
                <button
                  onClick={() => {
                    setShowChangePassword(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left flex items-center text-blue-100 hover:bg-blue-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-custom"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Zmień hasło
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left flex items-center text-red-300 hover:bg-red-600 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-custom"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Wyloguj się
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal zmiany hasła */}
      {showChangePassword && (
        <ChangePassword onClose={() => setShowChangePassword(false)} />
      )}
    </nav>
  );
}
