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
            edit: user.role === 'magazyn'
          },
          transport: {
            markAsCompleted: user.role === 'magazyn'
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

  return (
    <AdminCheck>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel Administratora</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
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