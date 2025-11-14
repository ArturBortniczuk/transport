// src/components/Header.js
'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Package, Calendar, Archive, Settings, Bell, User, 
  LogOut, Menu, X, Bug, Shield, Activity, BarChart3,
  Truck, Building, Mail, Phone
} from 'lucide-react'

// Import komponentu diagnostycznego
let SystemDiagnostics
try {
  SystemDiagnostics = require('./SystemDiagnostics').default
} catch (error) {
  console.warn('SystemDiagnostics component not found')
  SystemDiagnostics = ({ show, onClose }) => show ? (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Diagnostyka</h3>
        <p className="mb-4">Komponent diagnostyczny w przygotowaniu...</p>
        <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded">
          Zamknij
        </button>
      </div>
    </div>
  ) : null
}

export default function Header() {
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [systemStatus, setSystemStatus] = useState('unknown')

  useEffect(() => {
    fetchUserInfo()
    checkSystemStatus()
  }, [])

  const fetchUserInfo = async () => {
    try {
      // ZMIANA: Użyj /api/user zamiast /api/auth/session
      const response = await fetch('/api/user', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Sprawdź czy użytkownik jest zalogowany
        if (data.isAuthenticated && data.user) {
          setUser(data.user)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
      setUser(null)
    }
  }

  const checkSystemStatus = async () => {
    try {
      // Quick system health check
      const response = await fetch('/api/kurier/stats', {
        credentials: 'include'
      })
      
      setSystemStatus(response.ok ? 'healthy' : 'warning')
    } catch (error) {
      setSystemStatus('error')
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const navigationItems = [
    {
      name: 'Kalendarz',
      href: '/kalendarz',
      icon: Calendar,
      active: pathname?.startsWith('/kalendarz')
    },
    {
      name: 'Kurier DHL',
      href: '/kurier',
      icon: Package,
      active: pathname?.startsWith('/kurier')
    },
    {
      name: 'Archiwum',
      href: '/archiwum',
      icon: Archive,
      active: pathname?.startsWith('/archiwum')
    },
    {
      name: 'Statystyki',
      href: '/statystyki',
      icon: BarChart3,
      active: pathname?.startsWith('/statystyki')
    }
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <Shield className="w-4 h-4" />
      case 'warning':
        return <Activity className="w-4 h-4" />
      case 'error':
        return <Bug className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Truck className="w-8 h-8 text-blue-600 mr-2" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Transport Manager
                  </h1>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    System Zarządzania Transportem
                  </p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    item.active
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center space-x-3">
              {/* System Status */}
              <button
                onClick={() => setShowDiagnostics(true)}
                className={`flex items-center px-2 py-1 rounded text-xs ${getStatusColor(systemStatus)}`}
                title="Diagnostyka systemu"
              >
                {getStatusIcon(systemStatus)}
                <span className="ml-1 hidden sm:inline">
                  {systemStatus === 'healthy' ? 'System OK' : 
                   systemStatus === 'warning' ? 'Ostrzeżenia' : 
                   systemStatus === 'error' ? 'Błędy' : 'Status'}
                </span>
              </button>

              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <User className="w-5 h-5" />
                  {user && (
                    <span className="hidden sm:block text-sm font-medium">
                      {user.name || user.email}
                    </span>
                  )}
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {user && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">
                            {user.name || 'Użytkownik'}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.role && (
                            <p className="text-xs text-blue-600 capitalize">
                              {user.role}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <Link
                        href="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Profil
                      </Link>
                      
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Ustawienia
                      </Link>
                      
                      <button
                        onClick={() => setShowDiagnostics(true)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Bug className="w-4 h-4 mr-2" />
                        Diagnostyka
                      </button>
                      
                      <div className="border-t border-gray-100">
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Wyloguj
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                    item.active
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => setShowMobileMenu(false)}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Click outside to close menus */}
      {(showUserMenu || showMobileMenu) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowUserMenu(false)
            setShowMobileMenu(false)
          }}
        />
      )}

      {/* Diagnostics Modal */}
      <SystemDiagnostics
        show={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
      />
    </>
  )
}
