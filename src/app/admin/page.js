'use client'
import { useState, useEffect, useMemo } from 'react'
import AdminCheck from '@/components/AdminCheck'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
  Search,
  Filter,
  Download,
  Users,
  ShieldCheck,
  Briefcase,
  AlertTriangle,
  Check,
  X,
  Building2,
  Package,
  Calendar,
  Truck,
  FileText,
  Send,
  CheckCircle2,
  Save,
  Mail,
  Zap,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  BadgeAlert,
  BadgeCheck,
  Copy,
  ExternalLink,
  Shield
} from 'lucide-react'

// Mapowanie nazw ról na czytelne etykiety
const ROLE_LABELS = {
  admin: 'Administrator',
  koordynator: 'Koordynator',
  handlowiec: 'Handlowiec',
  magazyn_zielonka: 'Magazyn Zielonka',
  magazyn_bialystok: 'Magazyn Białystok',
  magazyn: 'Magazyn',
  kierowca: 'Kierowca'
}

// Kolory badge'ów dla ról
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  koordynator: 'bg-amber-100 text-amber-800 border-amber-200',
  handlowiec: 'bg-blue-100 text-blue-800 border-blue-200',
  magazyn_zielonka: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  magazyn_bialystok: 'bg-teal-100 text-teal-800 border-teal-200',
  magazyn: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  kierowca: 'bg-slate-100 text-slate-800 border-slate-200'
}

// Generowanie kolorowych inicjałów dla avatara
function getUserInitials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// Wybór koloru avatara na podstawie imienia
function getAvatarBg(name) {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600'
  ]
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [adminAccess, setAdminAccess] = useState({
    isAdmin: false,
    packagings: false,
    constructions: false,
    cable_advices: false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toastMessage, setToastMessage] = useState(null) // { type: 'success' | 'info' | 'error', text: '' }
  const [savingUserId, setSavingUserId] = useState(null)
  const [mpkInputs, setMpkInputs] = useState({})
  const [copiedEmail, setCopiedEmail] = useState(null)

  // Filtrowanie i wyszukiwanie
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [mpkFilter, setMpkFilter] = useState('ALL') // 'ALL' | 'WITH_MPK' | 'NO_MPK'
  const [permissionFilter, setPermissionFilter] = useState('ALL')

  // Paginacja
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  useEffect(() => {
    checkPermissions()
  }, [])

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  const checkPermissions = async () => {
    try {
      const response = await fetch('/api/check-admin')
      const data = await response.json()

      setAdminAccess({
        isAdmin: data.isAdmin,
        packagings: data.isAdmin || data.permissions?.admin?.packagings,
        constructions: data.isAdmin || data.permissions?.admin?.constructions,
        cable_advices: data.isAdmin || data.permissions?.admin?.cable_advices
      })

      if (data.isAdmin) {
        fetchUsers()
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('Error checking permissions:', err)
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Problem z pobraniem danych')
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error('Nieprawidłowy format danych')
      }

      // Dodaj domyślne uprawnienia jeśli nie istnieją
      const usersWithPermissions = data.map(user => {
        let permissions = {}

        try {
          if (user.permissions && typeof user.permissions === 'string') {
            permissions = JSON.parse(user.permissions)
          } else if (user.permissions && typeof user.permissions === 'object') {
            permissions = user.permissions
          }
        } catch (e) {
          console.error('Błąd parsowania uprawnień dla użytkownika:', user.email, e)
        }

        const defaultPermissions = {
          calendar: {
            edit: user.role === 'magazyn' || user.role === 'magazyn_bialystok' || user.role === 'magazyn_zielonka'
          },
          transport: {
            markAsCompleted: user.role === 'magazyn' || user.role === 'magazyn_bialystok' || user.role === 'magazyn_zielonka'
          },
          spedycja: {
            add: false,
            respond: false,
            sendOrder: false
          },
          admin: {
            packagings: false,
            constructions: false,
            cable_advices: false
          }
        }

        return {
          ...user,
          permissions: {
            ...defaultPermissions,
            ...permissions
          }
        }
      })

      setUsers(usersWithPermissions)
    } catch (err) {
      setError('Nie udało się pobrać listy użytkowników: ' + err.message)
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = async (userId, section, permission) => {
    try {
      setSavingUserId(userId)
      showToast('Zapisywanie zmian uprawnień...', 'info')

      const user = users.find(u => u.email === userId)
      if (!user) {
        throw new Error('Nie znaleziono użytkownika')
      }

      const currentValue = user.permissions?.[section]?.[permission] === true

      const response = await fetch('/api/users/permissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          section,
          permission,
          value: !currentValue
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się zaktualizować uprawnień')
      }

      setUsers(prevUsers => prevUsers.map(u => {
        if (u.email === userId) {
          const updatedPermissions = { ...u.permissions }
          if (!updatedPermissions[section]) {
            updatedPermissions[section] = {}
          }
          updatedPermissions[section][permission] = !currentValue
          return {
            ...u,
            permissions: updatedPermissions
          }
        }
        return u
      }))

      showToast('Pomyślnie zaktualizowano uprawnienie', 'success')
    } catch (err) {
      showToast('Błąd zapisu uprawnień: ' + err.message, 'error')
      console.error('Error updating permissions:', err)
    } finally {
      setSavingUserId(null)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      setSavingUserId(userId)
      showToast('Zapisywanie nowej roli...', 'info')

      const response = await fetch('/api/users/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          role: newRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się zaktualizować roli')
      }

      setUsers(prevUsers => prevUsers.map(u => {
        if (u.email === userId) {
          return {
            ...u,
            role: newRole
          }
        }
        return u
      }))

      showToast(`Pomyślnie zmieniono rolę na: ${ROLE_LABELS[newRole] || newRole}`, 'success')
    } catch (err) {
      showToast('Błąd aktualizacji roli: ' + err.message, 'error')
      console.error('Error updating role:', err)
    } finally {
      setSavingUserId(null)
    }
  }

  const handleMpkChange = async (userId, newMpk) => {
    try {
      setSavingUserId(userId)
      showToast('Zapisywanie numeru MPK...', 'info')

      const trimmedMpk = (newMpk || '').trim()

      const response = await fetch('/api/users/mpk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          mpk: trimmedMpk
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się zaktualizować MPK')
      }

      setUsers(prevUsers => prevUsers.map(u => {
        if (u.email === userId) {
          return {
            ...u,
            mpk: trimmedMpk
          }
        }
        return u
      }))

      showToast(`Zaktualizowano MPK dla ${userId}`, 'success')
    } catch (err) {
      showToast('Błąd aktualizacji MPK: ' + err.message, 'error')
      console.error('Error updating MPK:', err)
    } finally {
      setSavingUserId(null)
    }
  }

  const copyToClipboard = (text, email) => {
    navigator.clipboard.writeText(text)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  // Obliczenia statystyk KPI
  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter(u => u.role === 'admin').length
    const handlowcy = users.filter(u => u.role === 'handlowiec' || u.role === 'koordynator').length
    const withoutMpk = users.filter(u => !u.mpk || !String(u.mpk).trim()).length
    return { total, admins, handlowcy, withoutMpk }
  }, [users])

  // Filtrowanie listy użytkowników
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // 1. Wyszukiwanie tekstowe (Imię, Email, Stanowisko, MPK)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = (user.name || '').toLowerCase().includes(q)
        const emailMatch = (user.email || '').toLowerCase().includes(q)
        const posMatch = (user.position || '').toLowerCase().includes(q)
        const mpkMatch = (user.mpk || '').toLowerCase().includes(q)
        if (!nameMatch && !emailMatch && !posMatch && !mpkMatch) {
          return false
        }
      }

      // 2. Filtr roli
      if (roleFilter !== 'ALL') {
        if (roleFilter === 'admin' && user.role !== 'admin') return false
        if (roleFilter === 'handlowiec' && user.role !== 'handlowiec') return false
        if (roleFilter === 'koordynator' && user.role !== 'koordynator') return false
        if (roleFilter === 'magazyn_zielonka' && user.role !== 'magazyn_zielonka') return false
        if (roleFilter === 'magazyn_bialystok' && user.role !== 'magazyn_bialystok') return false
        if (roleFilter === 'kierowca' && user.role !== 'kierowca') return false
      }

      // 3. Filtr statusu MPK
      if (mpkFilter === 'WITH_MPK') {
        if (!user.mpk || !String(user.mpk).trim()) return false
      } else if (mpkFilter === 'NO_MPK') {
        if (user.mpk && String(user.mpk).trim()) return false
      }

      // 4. Filtr uprawnień
      if (permissionFilter !== 'ALL') {
        const [section, key] = permissionFilter.split('.')
        if (!user.permissions?.[section]?.[key]) {
          return false
        }
      }

      return true
    })
  }, [users, searchQuery, roleFilter, mpkFilter, permissionFilter])

  // Paginacja
  const paginatedUsers = useMemo(() => {
    if (itemsPerPage === 'ALL') return filteredUsers
    const start = (currentPage - 1) * itemsPerPage
    return filteredUsers.slice(start, start + itemsPerPage)
  }, [filteredUsers, currentPage, itemsPerPage])

  const totalPages = itemsPerPage === 'ALL' ? 1 : Math.ceil(filteredUsers.length / itemsPerPage) || 1

  // Reset strony po zmianie filtrów
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter, mpkFilter, permissionFilter, itemsPerPage])

  // Eksport do pliku Excel (.xlsx)
  const exportUsersToXLSX = () => {
    try {
      const dataToExport = filteredUsers.map((u, idx) => {
        const perms = u.permissions || {}
        return {
          'Lp.': idx + 1,
          'Imię i Nazwisko': u.name || 'Brak danych',
          'Adres e-mail': u.email || '',
          'Stanowisko': u.position || '',
          'Rola systemowa': ROLE_LABELS[u.role] || u.role || 'Brak roli',
          'Numer MPK': (u.mpk && String(u.mpk).trim()) ? String(u.mpk).trim() : 'BRAK MPK',
          'Status MPK': (u.mpk && String(u.mpk).trim()) ? 'Przypisany' : 'Wymaga uzupełnienia',
          // Uprawnienia systemowe
          'Edycja Kalendarza': perms.calendar?.edit ? 'TAK' : 'NIE',
          'Zrealizowanie transportu': perms.transport?.markAsCompleted ? 'TAK' : 'NIE',
          'Dodawanie Spedycji': perms.spedycja?.add ? 'TAK' : 'NIE',
          'Odpowiadanie na Spedycje': perms.spedycja?.respond ? 'TAK' : 'NIE',
          'Wysyłanie Zlecenia': perms.spedycja?.sendOrder ? 'TAK' : 'NIE',
          // Uprawnienia administratora
          'Moduł Opakowań': perms.admin?.packagings ? 'TAK' : 'NIE',
          'Moduł Budów': perms.admin?.constructions ? 'TAK' : 'NIE',
          'Moduł Awizacji Kabli': perms.admin?.cable_advices ? 'TAK' : 'NIE'
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(dataToExport)

      // Ustalenie optymalnych szerokości kolumn
      ws['!cols'] = [
        { wch: 5 },  // Lp
        { wch: 28 }, // Imię i nazwisko
        { wch: 32 }, // Email
        { wch: 24 }, // Stanowisko
        { wch: 20 }, // Rola
        { wch: 16 }, // Numer MPK
        { wch: 20 }, // Status MPK
        { wch: 18 }, // Kalendarz
        { wch: 22 }, // Zrealizowanie
        { wch: 18 }, // Dodawanie Spedycji
        { wch: 22 }, // Odpowiadanie
        { wch: 18 }, // Wysyłanie
        { wch: 18 }, // Opakowania
        { wch: 18 }, // Budowy
        { wch: 22 }  // Awizacje kabli
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Użytkownicy')
      const today = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Uzytkownicy_Transport_${today}.xlsx`)
      showToast(`Wyeksportowano ${dataToExport.length} użytkowników do pliku Excel`, 'success')
    } catch (err) {
      console.error('Błąd podczas eksportu do Excela:', err)
      showToast('Wystąpił błąd podczas generowania pliku Excel', 'error')
    }
  }

  const isFiltered = searchQuery.trim() !== '' || roleFilter !== 'ALL' || mpkFilter !== 'ALL' || permissionFilter !== 'ALL'

  const resetFilters = () => {
    setSearchQuery('')
    setRoleFilter('ALL')
    setMpkFilter('ALL')
    setPermissionFilter('ALL')
  }

  return (
    <AdminCheck>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Pływający Toast z powiadomieniem */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : toastMessage.type === 'info'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}>
              {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              {toastMessage.type === 'info' && <Save className="w-5 h-5 flex-shrink-0 animate-spin" />}
              {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        {/* Header Panelu Administratora */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-2">
                <Shield className="w-3.5 h-3.5" />
                Panel Zarządzania
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Panel Administratora</h1>
              <p className="text-sm text-gray-500 mt-1">
                Zarządzaj uprawnieniami pracowników, numerami MPK, konfiguracją systemu i słownikami.
              </p>
            </div>

            {adminAccess.isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  onClick={exportUsersToXLSX}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-sm hover:shadow-md transition-all duration-150"
                  title="Eksportuj widoczną listę użytkowników do Excela"
                >
                  <Download className="w-4 h-4" />
                  Eksportuj do Excel (.xlsx)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Kafelki Nawigacji do Modułów Administratora */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Opakowania */}
          {adminAccess.packagings && (
            <Link
              href="/admin/packagings"
              className="group relative bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Package className="w-6 h-6" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">Opakowania</h3>
                <p className="text-xs text-gray-500 mt-1">Zarządzanie opakowaniami z Google MyMaps</p>
              </div>
            </Link>
          )}

          {/* Budowy */}
          {adminAccess.constructions && (
            <Link
              href="/admin/constructions"
              className="group relative bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Building2 className="w-6 h-6" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Budowy i MPK</h3>
                <p className="text-xs text-gray-500 mt-1">Słownik budów, adresów i przypisań MPK</p>
              </div>
            </Link>
          )}

          {/* Awizacje Kabli */}
          {adminAccess.cable_advices && (
            <Link
              href="/admin/cable-advices"
              className="group relative bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Zap className="w-6 h-6" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-amber-600 transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">Awizacje Kabli</h3>
                <p className="text-xs text-gray-500 mt-1">Słowniki dostawców, miejsc i typów zamówień</p>
              </div>
            </Link>
          )}

          {/* Ustawienia Wyceny */}
          {adminAccess.isAdmin && (
            <Link
              href="/admin/valuation"
              className="group relative bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">Ustawienia Wyceny</h3>
                <p className="text-xs text-gray-500 mt-1">Stawki km, wagi, algorytmy kosztowe</p>
              </div>
            </Link>
          )}
        </div>

        {/* Sekcja Zarządzania Użytkownikami */}
        {adminAccess.isAdmin && (
          <div id="users-section" className="space-y-6">
            {/* Karty Statystyk KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Łącznie */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                  <div className="text-xs text-gray-500 font-medium">Użytkowników w bazie</div>
                </div>
              </div>

              {/* Administratorzy */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.admins}</div>
                  <div className="text-xs text-gray-500 font-medium">Administratorów</div>
                </div>
              </div>

              {/* Handlowcy / Koordynatorzy */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.handlowcy}</div>
                  <div className="text-xs text-gray-500 font-medium">Handlowcy & Koordynatorzy</div>
                </div>
              </div>

              {/* Brak MPK - Klikalna karta z natychmiastowym filtrem */}
              <div
                onClick={() => setMpkFilter(mpkFilter === 'NO_MPK' ? 'ALL' : 'NO_MPK')}
                className={`p-4 sm:p-5 rounded-2xl border shadow-sm flex items-center gap-4 cursor-pointer transition-all ${
                  mpkFilter === 'NO_MPK'
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
                    : 'bg-white border-gray-200/80 hover:border-rose-300 hover:bg-rose-50/30'
                }`}
                title="Kliknij, aby przefiltrować użytkowników bez numeru MPK"
              >
                <div className={`p-3 rounded-xl ${stats.withoutMpk > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {stats.withoutMpk > 0 ? <AlertTriangle className="w-6 h-6" /> : <BadgeCheck className="w-6 h-6" />}
                </div>
                <div>
                  <div className={`text-2xl font-bold ${stats.withoutMpk > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {stats.withoutMpk}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {stats.withoutMpk > 0 ? 'Bez przypisanego MPK (kliknij)' : 'Wszyscy mają MPK'}
                  </div>
                </div>
              </div>
            </div>

            {/* Pasek Wyszukiwania i Filtrów */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Pole Wyszukiwania */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Wyszukaj po imieniu, nazwisku, emailu, stanowisku lub numerze MPK..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filtry Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Filtr Roli */}
                  <div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-gray-700"
                    >
                      <option value="ALL">Wszystkie role</option>
                      <option value="admin">Administrator</option>
                      <option value="koordynator">Koordynator</option>
                      <option value="handlowiec">Handlowiec</option>
                      <option value="magazyn_zielonka">Magazyn Zielonka</option>
                      <option value="magazyn_bialystok">Magazyn Białystok</option>
                      <option value="kierowca">Kierowca</option>
                    </select>
                  </div>

                  {/* Filtr MPK */}
                  <div>
                    <select
                      value={mpkFilter}
                      onChange={(e) => setMpkFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-gray-700"
                    >
                      <option value="ALL">Status MPK: Wszyscy</option>
                      <option value="WITH_MPK">Tylko z numerem MPK</option>
                      <option value="NO_MPK">⚠️ Tylko bez MPK</option>
                    </select>
                  </div>

                  {/* Filtr Uprawnień */}
                  <div>
                    <select
                      value={permissionFilter}
                      onChange={(e) => setPermissionFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-gray-700"
                    >
                      <option value="ALL">Wszystkie uprawnienia</option>
                      <option value="calendar.edit">Edycja Kalendarza</option>
                      <option value="transport.markAsCompleted">Oznaczanie jako Zrealizowane</option>
                      <option value="spedycja.add">Dodawanie Spedycji</option>
                      <option value="spedycja.respond">Odpowiadanie na Spedycje</option>
                      <option value="spedycja.sendOrder">Wysyłanie Zlecenia</option>
                      <option value="admin.packagings">Dostęp: Opakowania</option>
                      <option value="admin.constructions">Dostęp: Budowy</option>
                      <option value="admin.cable_advices">Dostęp: Awizacja Kabli</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Pasek podsumowania filtrowania i przycisk resetu */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <span>Znaleziono: <strong>{filteredUsers.length}</strong> z {users.length} użytkowników</span>
                  {isFiltered && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                      Filtry aktywne
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {isFiltered && (
                    <button
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Wyczyść filtry
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <span>Na stronę:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                      className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-indigo-500"
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value="ALL">Wszyscy</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Stan ładowania / błędu */}
            {loading ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-200/80 text-center">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 text-sm">Ładowanie listy użytkowników...</p>
              </div>
            ) : error ? (
              <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 text-rose-700 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
                <p className="font-semibold">{error}</p>
                <button
                  onClick={fetchUsers}
                  className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-medium hover:bg-rose-700 transition-colors"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-gray-200/80 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-700">Brak wyników</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                  Nie znaleziono żadnego użytkownika spełniającego wybrane kryteria wyszukiwania i filtrowania.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Zresetuj filtry
                </button>
              </div>
            ) : (
              /* Lista Kart Użytkowników */
              <div className="space-y-4">
                {paginatedUsers.map((user) => {
                  const currentMpkVal = mpkInputs[user.email] !== undefined ? mpkInputs[user.email] : (user.mpk || '')
                  const isSaving = savingUserId === user.email
                  const hasMpk = !!(user.mpk && String(user.mpk).trim())

                  return (
                    <div
                      key={user.email}
                      className="bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 p-5 lg:p-6"
                    >
                      {/* Górny wiersz: Avatar, Dane, Rola, MPK */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pb-5 border-b border-gray-100">
                        {/* Avatar i Dane Osobowe */}
                        <div className="lg:col-span-5 flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getAvatarBg(user.name)} flex items-center justify-center text-white font-bold text-base shadow-sm flex-shrink-0`}>
                            {getUserInitials(user.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-gray-900 truncate">
                                {user.name || 'Brak imienia i nazwiska'}
                              </h3>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {ROLE_LABELS[user.role] || user.role || 'Brak roli'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                              <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                              <button
                                onClick={() => copyToClipboard(user.email, user.email)}
                                className="text-gray-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                                title="Skopiuj email do schowka"
                              >
                                {copiedEmail === user.email ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                              <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{user.position || 'Brak przypisanego stanowiska'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Rola Select */}
                        <div className="lg:col-span-3">
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Rola systemowa
                          </label>
                          <select
                            value={user.role || ''}
                            onChange={(e) => handleRoleChange(user.email, e.target.value)}
                            disabled={isSaving}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-medium text-gray-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:opacity-50"
                          >
                            <option value="admin">Administrator</option>
                            <option value="koordynator">Koordynator</option>
                            <option value="handlowiec">Handlowiec</option>
                            <option value="magazyn_zielonka">Magazyn Zielonka</option>
                            <option value="magazyn_bialystok">Magazyn Białystok</option>
                            <option value="kierowca">Kierowca</option>
                          </select>
                        </div>

                        {/* Numer MPK Formularz */}
                        <div className="lg:col-span-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-gray-600">
                              Numer MPK
                            </label>
                            {hasMpk ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <BadgeCheck className="w-3 h-3" />
                                Przypisany
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Brak MPK
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={currentMpkVal}
                              onChange={(e) => setMpkInputs({ ...mpkInputs, [user.email]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleMpkChange(user.email, currentMpkVal)
                                }
                              }}
                              placeholder="np. 522-01-184"
                              disabled={isSaving}
                              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:opacity-50 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleMpkChange(user.email, currentMpkVal)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 active:scale-95 disabled:opacity-50 shadow-sm transition-all whitespace-nowrap"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Zapisz
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Dolny wiersz: Interaktywne Chipy Uprawnień */}
                      <div className="pt-4 space-y-4">
                        {/* 1. Uprawnienia systemowe i logistyka */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-indigo-500" />
                            Uprawnienia systemowe i operacyjne
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {/* Edycja Kalendarza */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'calendar', 'edit')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.calendar?.edit
                                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <Calendar className={`w-3.5 h-3.5 ${user.permissions?.calendar?.edit ? 'text-indigo-600' : 'text-gray-400'}`} />
                              <span>Edycja Kalendarza</span>
                              {user.permissions?.calendar?.edit && <Check className="w-3.5 h-3.5 text-indigo-600 ml-0.5" />}
                            </button>

                            {/* Oznaczanie jako Zrealizowane */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'transport', 'markAsCompleted')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.transport?.markAsCompleted
                                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <CheckCircle2 className={`w-3.5 h-3.5 ${user.permissions?.transport?.markAsCompleted ? 'text-indigo-600' : 'text-gray-400'}`} />
                              <span>Oznaczanie jako Zrealizowane</span>
                              {user.permissions?.transport?.markAsCompleted && <Check className="w-3.5 h-3.5 text-indigo-600 ml-0.5" />}
                            </button>

                            {/* Dodawanie Spedycji */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'spedycja', 'add')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.spedycja?.add
                                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <Truck className={`w-3.5 h-3.5 ${user.permissions?.spedycja?.add ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span>Dodawanie Spedycji</span>
                              {user.permissions?.spedycja?.add && <Check className="w-3.5 h-3.5 text-blue-600 ml-0.5" />}
                            </button>

                            {/* Odpowiadanie na Spedycje */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'spedycja', 'respond')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.spedycja?.respond
                                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <FileText className={`w-3.5 h-3.5 ${user.permissions?.spedycja?.respond ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span>Odpowiadanie na Spedycje</span>
                              {user.permissions?.spedycja?.respond && <Check className="w-3.5 h-3.5 text-blue-600 ml-0.5" />}
                            </button>

                            {/* Wysyłanie Zlecenia */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'spedycja', 'sendOrder')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.spedycja?.sendOrder
                                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <Send className={`w-3.5 h-3.5 ${user.permissions?.spedycja?.sendOrder ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span>Wysyłanie Zlecenia</span>
                              {user.permissions?.spedycja?.sendOrder && <Check className="w-3.5 h-3.5 text-blue-600 ml-0.5" />}
                            </button>
                          </div>
                        </div>

                        {/* 2. Dostęp do modułów administratora */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-emerald-500" />
                            Dostęp do modułów administratora
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {/* Opakowania */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'admin', 'packagings')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.admin?.packagings
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <Package className={`w-3.5 h-3.5 ${user.permissions?.admin?.packagings ? 'text-emerald-600' : 'text-gray-400'}`} />
                              <span>Zarządzanie Opakowaniami</span>
                              {user.permissions?.admin?.packagings && <Check className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />}
                            </button>

                            {/* Budowy */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'admin', 'constructions')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.admin?.constructions
                                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <Building2 className={`w-3.5 h-3.5 ${user.permissions?.admin?.constructions ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span>Zarządzanie Budowami</span>
                              {user.permissions?.admin?.constructions && <Check className="w-3.5 h-3.5 text-blue-600 ml-0.5" />}
                            </button>

                            {/* Awizacje Kabli */}
                            <button
                              type="button"
                              onClick={() => handlePermissionChange(user.email, 'admin', 'cable_advices')}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                                user.permissions?.admin?.cable_advices
                                  ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              <Zap className={`w-3.5 h-3.5 ${user.permissions?.admin?.cable_advices ? 'text-amber-600' : 'text-gray-400'}`} />
                              <span>Awizacja Kabli</span>
                              {user.permissions?.admin?.cable_advices && <Check className="w-3.5 h-3.5 text-amber-600 ml-0.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Dolna Paginacja */}
            {totalPages > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-gray-500">
                  Strona <span className="font-semibold text-gray-900">{currentPage}</span> z{' '}
                  <span className="font-semibold text-gray-900">{totalPages}</span> (łącznie {filteredUsers.length} pozycji)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, idx, arr) => {
                      const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1
                      return (
                        <div key={page} className="flex items-center">
                          {showEllipsisBefore && <span className="px-1.5 text-gray-400 text-xs">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[34px] h-[34px] px-2 rounded-xl text-xs font-semibold transition-all ${
                              currentPage === page
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100 border border-transparent'
                            }`}
                          >
                            {page}
                          </button>
                        </div>
                      )
                    })}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminCheck>
  )
}
