// src/app/admin/page.js
'use client'
import { useState, useEffect } from 'react'
import AdminCheck from '@/components/AdminCheck'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [importStatus, setImportStatus] = useState('')
  const [savingUserId, setSavingUserId] = useState(null) // Dodane do śledzenia, który użytkownik jest zapisywany

  useEffect(() => {
    fetchUsers()
  }, [])

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
          {/* Karta zarządzania użytkownikami */}
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
          
          {/* Karta archiwum transportów */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <h3 className="ml-4 text-lg font-medium">Archiwum transportów</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Przeglądaj, eksportuj i zarządzaj archiwum zrealizowanych transportów.
              </p>
              <a>
                href="/archiwum"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Przejdź do archiwum
              </a>
            </div>
          </div>
          
          {/* Karta zarządzania budowami */}
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
              
                href="/admin/constructions"
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Przejdź do zarządzania
              </a>
            </div>
          </div>
        </div>
        
        {/* Sekcja zarządzania uprawnieniami użytkowników */}
        <div id="users-section" className="bg-white rounded-lg shadow overflow-hidden mt-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Zarządzanie uprawnieniami użytkowników</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Imię i Nazwisko
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stanowisko
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rola
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Edycja Kalendarza
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Oznaczanie jako Zrealizowane
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.email} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.position}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block">
                          <select
                            value={user.role || ''}
                            onChange={(e) => handleRoleChange(user.email, e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            disabled={savingUserId === user.email}
                          >
                            <option value="admin">Administrator</option>
                            <option value="handlowiec">Handlowiec</option>
                            <option value="magazyn_zielonka">Magazyn Zielonka</option>
                            <option value="magazyn_bialystok">Magazyn Białystok</option>
                            <option value="magazyn">Magazyn (stare)</option>
                          </select>
                          {savingUserId === user.email && (
                            <span className="ml-2 text-xs text-blue-500">Zapisywanie...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block">
                          <input
                            type="checkbox"
                            checked={user.permissions?.calendar?.edit || false}
                            onChange={() => handlePermissionChange(user.email, 'calendar', 'edit')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={savingUserId === user.email}
                          />
                          {savingUserId === user.email && (
                            <span className="ml-2 text-xs text-blue-500">Zapisywanie...</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block">
                          <input
                            type="checkbox"
                            checked={user.permissions?.transport?.markAsCompleted || false}
                            onChange={() => handlePermissionChange(user.email, 'transport', 'markAsCompleted')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            disabled={savingUserId === user.email}
                          />
                          {savingUserId === user.email && (
                            <span className="ml-2 text-xs text-blue-500">Zapisywanie...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
      </div>
    </AdminCheck>
  )
}
