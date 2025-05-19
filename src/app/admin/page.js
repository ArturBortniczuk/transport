'use client'
import { useState, useEffect } from 'react'
import AdminCheck from '@/components/AdminCheck'
import Link from 'next/link'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [adminAccess, setAdminAccess] = useState({
    isAdmin: false,
    packagings: false,
    constructions: false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [importStatus, setImportStatus] = useState('')
  const [savingUserId, setSavingUserId] = useState(null) // Dodane do śledzenia, który użytkownik jest zapisywany

  useEffect(() => {
    checkPermissions()
  }, [])

  const checkPermissions = async () => {
    try {
      const response = await fetch('/api/check-admin');
      const data = await response.json();
      
      setAdminAccess({
        isAdmin: data.isAdmin,
        packagings: data.isAdmin || data.permissions?.admin?.packagings,
        constructions: data.isAdmin || data.permissions?.admin?.constructions
      });
      
      // Ładuj użytkowników tylko jeśli ma uprawnienia administratora
      if (data.isAdmin) {
        fetchUsers();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Problem z pobraniem danych')
      }
      
      const data = await response.json()
      console.log('Pobrane dane użytkowników:', data);
      
      if (!Array.isArray(data)) {
        throw new Error('Nieprawidłowy format danych')
      }
      
      // Dodaj domyślne uprawnienia jeśli nie istnieją
      const usersWithPermissions = data.map(user => {
        let permissions = {};
        
        try {
          if (user.permissions && typeof user.permissions === 'string') {
            permissions = JSON.parse(user.permissions);
          }
        } catch (e) {
          console.error('Błąd parsowania uprawnień dla użytkownika:', user.email, e);
        }
        
        // Ustaw domyślne uprawnienia, jeśli nie istnieją
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
            constructions: false
          }
        };
        
        // Połącz istniejące uprawnienia z domyślnymi
        return {
          ...user,
          permissions: {
            ...defaultPermissions,
            ...permissions
          }
        };
      });
      
      console.log('Użytkownicy z uprawnieniami:', usersWithPermissions);
      setUsers(usersWithPermissions);
    } catch (err) {
      setError('Nie udało się pobrać listy użytkowników: ' + err.message)
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = async (userId, section, permission) => {
    try {
      setSavingUserId(userId); // Ustaw ID użytkownika, którego uprawnienia są zapisywane
      setImportStatus('Zapisywanie zmian...');
      
      const user = users.find(u => u.email === userId);
      if (!user) {
        throw new Error('Nie znaleziono użytkownika');
      }
  
      // Bezpieczne sprawdzenie wartości uprawnienia
      const currentValue = user.permissions?.[section]?.[permission] === true;
      
      console.log('Zmiana uprawnienia:', {
        userId,
        section,
        permission,
        from: currentValue,
        to: !currentValue
      });
      
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
      });
  
      const data = await response.json();
      console.log('Odpowiedź serwera:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się zaktualizować uprawnień');
      }
  
      // Aktualizuj stan lokalnie
      setUsers(users.map(user => {
        if (user.email === userId) {
          // Aktualizuj tylko konkretne uprawnienie
          const updatedPermissions = { ...user.permissions };
          
          if (!updatedPermissions[section]) {
            updatedPermissions[section] = {};
          }
          
          updatedPermissions[section][permission] = !currentValue;
          
          return {
            ...user,
            permissions: updatedPermissions
          };
        }
        return user;
      }));
  
      setImportStatus('Pomyślnie zaktualizowano uprawnienia');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (err) {
      setError('Nie udało się zaktualizować uprawnień: ' + err.message);
      console.error('Error updating permissions:', err);
    } finally {
      setSavingUserId(null); // Resetuj ID zapisywanego użytkownika
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setSavingUserId(userId);
      setImportStatus('Zapisywanie zmian...');
      
      const response = await fetch('/api/users/role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          role: newRole
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się zaktualizować roli');
      }

      // Aktualizuj stan lokalnie
      setUsers(users.map(user => {
        if (user.email === userId) {
          return {
            ...user,
            role: newRole
          };
        }
        return user;
      }));

      setImportStatus('Pomyślnie zaktualizowano rolę');
      setTimeout(() => setImportStatus(''), 3000);
    } catch (err) {
      setError('Nie udało się zaktualizować roli: ' + err.message);
      console.error('Error updating role:', err);
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <AdminCheck>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel Administratora</h1>
        </div>
        
        {/* Karty funkcji administratora */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {/* Karta zarządzania użytkownikami - tylko dla pełnego admina */}
          {adminAccess.isAdmin && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium">Zarządzanie użytkownikami</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Zarządzaj uprawnieniami użytkowników, przypisuj role i kontroluj dostęp do funkcji systemu.
                </p>
                <button
                  onClick={() => window.location.href = '#users-section'}
                  className="w-full inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Przejdź do zarządzania
                </button>
              </div>
            </div>
          )}
          
          {/* Karta zarządzania opakowaniami - dla admina i użytkowników z uprawnieniami */}
          {adminAccess.packagings && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 p-3 rounded-full">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium">Zarządzanie opakowaniami</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Synchronizuj, przeglądaj i zarządzaj opakowaniami do odbioru z Google MyMaps.
                </p>
                <Link
                  href="/admin/packagings"
                  className="w-full inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Przejdź do zarządzania
                </Link>
              </div>
            </div>
          )}
          
          {/* Karta zarządzania budowami - dla admina i użytkowników z uprawnieniami */}
          {adminAccess.constructions && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium">Zarządzanie budowami</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Dodawaj, edytuj i usuwaj budowy dla transportów. Zarządzaj ich nazwami i numerami MPK.
                </p>
                <Link
                  href="/admin/constructions"
                  className="w-full inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Przejdź do zarządzania
                </Link>
              </div>
            </div>
          )}
        </div>
        
        {/* Sekcja zarządzania uprawnieniami użytkowników - widoczna tylko gdy jest admin */}
        {adminAccess.isAdmin && (
          <div id="users-section" className="bg-white rounded-lg shadow overflow-hidden mt-8">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Zarządzanie uprawnieniami użytkowników</h2>
              
              {users.map((user) => (
                <div key={user.email} className="mb-6 border p-4 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Dane osobowe i rola */}
                    <div>
                      <h3 className="font-medium text-lg">{user.name}</h3>
                      <p className="text-gray-600">{user.email}</p>
                      <p className="text-gray-500 text-sm">{user.position}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                      <select
                        value={user.role || ''}
                        onChange={(e) => handleRoleChange(user.email, e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        disabled={savingUserId === user.email}
                      >
                        <option value="admin">Administrator</option>
                        <option value="handlowiec">Handlowiec</option>
                        <option value="magazyn_zielonka">Magazyn Zielonka</option>
                        <option value="magazyn_bialystok">Magazyn Białystok</option>
                      </select>
                      {savingUserId === user.email && (
                        <span className="ml-2 text-xs text-blue-500">Zapisywanie...</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-end">
                      {savingUserId === user.email ? (
                        <span className="text-blue-500 bg-blue-50 px-3 py-1 rounded-full text-sm">
                          Zapisywanie zmian...
                        </span>
                      ) : (
                        user.is_admin && (
                          <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">
                            Administrator
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  
                  {/* Uprawnienia - układ w formie checkboxów w rzędzie */}
                  <div className="bg-gray-50 p-4 rounded-md mb-3">
                    <h4 className="font-medium mb-3">Uprawnienia systemowe</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Edycja Kalendarza */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`calendar-edit-${user.email}`}
                          checked={user.permissions?.calendar?.edit || false}
                          onChange={() => handlePermissionChange(user.email, 'calendar', 'edit')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`calendar-edit-${user.email}`} className="text-sm text-gray-700">
                          Edycja Kalendarza
                        </label>
                      </div>
                      
                      {/* Oznaczanie jako Zrealizowane */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`transport-complete-${user.email}`}
                          checked={user.permissions?.transport?.markAsCompleted || false}
                          onChange={() => handlePermissionChange(user.email, 'transport', 'markAsCompleted')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`transport-complete-${user.email}`} className="text-sm text-gray-700">
                          Oznaczanie jako Zrealizowane
                        </label>
                      </div>
                      
                      {/* Dodawanie Spedycji */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`spedycja-add-${user.email}`}
                          checked={user.permissions?.spedycja?.add || false}
                          onChange={() => handlePermissionChange(user.email, 'spedycja', 'add')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`spedycja-add-${user.email}`} className="text-sm text-gray-700">
                          Dodawanie Spedycji
                        </label>
                      </div>
                      
                      {/* Odpowiadanie na Spedycje */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`spedycja-respond-${user.email}`}
                          checked={user.permissions?.spedycja?.respond || false}
                          onChange={() => handlePermissionChange(user.email, 'spedycja', 'respond')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`spedycja-respond-${user.email}`} className="text-sm text-gray-700">
                          Odpowiadanie na Spedycje
                        </label>
                      </div>
                      
                      {/* Wysyłanie Zlecenia */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`spedycja-send-${user.email}`}
                          checked={user.permissions?.spedycja?.sendOrder || false}
                          onChange={() => handlePermissionChange(user.email, 'spedycja', 'sendOrder')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`spedycja-send-${user.email}`} className="text-sm text-gray-700">
                          Wysyłanie Zlecenia
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Nowa sekcja uprawnień administratora */}
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="font-medium mb-3">Uprawnienia administratora</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Uprawnienia do modułu Opakowań */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`admin-packagings-${user.email}`}
                          checked={user.permissions?.admin?.packagings || false}
                          onChange={() => handlePermissionChange(user.email, 'admin', 'packagings')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`admin-packagings-${user.email}`} className="text-sm text-gray-700">
                          Zarządzanie Opakowaniami
                        </label>
                      </div>
                      
                      {/* Uprawnienia do modułu Budów */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`admin-constructions-${user.email}`}
                          checked={user.permissions?.admin?.constructions || false}
                          onChange={() => handlePermissionChange(user.email, 'admin', 'constructions')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          disabled={savingUserId === user.email}
                        />
                        <label htmlFor={`admin-constructions-${user.email}`} className="text-sm text-gray-700">
                          Zarządzanie Budowami
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {importStatus && (
                <div className={`mt-4 p-4 rounded-md ${
                  importStatus.includes('sukces') || importStatus.includes('Pomyślnie') 
                  ? 'bg-green-50 text-green-700' 
                  : importStatus.includes('Zapisywanie')
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-red-50 text-red-700'
                }`}>
                  {importStatus}
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-4 rounded-md bg-red-50 text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminCheck>
  )
}
