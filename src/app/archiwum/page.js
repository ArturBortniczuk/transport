// src/app/archiwum/page.js
'use client'
import { useState, useEffect } from 'react'

export default function ArchiwumPage() {
  const [archiwum, setArchiwum] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)

  useEffect(() => {
    // Sprawdź czy użytkownik jest administratorem
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/check-admin')
        const data = await response.json()
        setIsAdmin(data.isAdmin)
      } catch (error) {
        console.error('Błąd sprawdzania uprawnień administratora:', error)
        setIsAdmin(false)
      }
    }

    // Pobierz dane archiwum
    const fetchArchivedTransports = async () => {
      try {
        const response = await fetch('/api/transports?status=completed')
        const data = await response.json()
        
        if (data.success) {
          setArchiwum(data.transports)
        } else {
          setError('Nie udało się pobrać archiwum transportów')
        }
      } catch (error) {
        console.error('Błąd pobierania archiwum:', error)
        setError('Wystąpił błąd podczas pobierania danych')
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
    fetchArchivedTransports()
  }, [])

  // Funkcja do usuwania transportu
  const handleDeleteTransport = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć ten transport?')) {
      return
    }
    
    try {
      setDeleteStatus({ type: 'loading', message: 'Usuwanie transportu...' })
      
      const response = await fetch(`/api/transports/delete?id=${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Usuń transport z lokalnego stanu
        setArchiwum(archiwum.filter(transport => transport.id !== id))
        setDeleteStatus({ type: 'success', message: 'Transport został usunięty' })
        
        // Wyczyść status po 3 sekundach
        setTimeout(() => {
          setDeleteStatus(null)
        }, 3000)
      } else {
        setDeleteStatus({ type: 'error', message: data.error || 'Nie udało się usunąć transportu' })
      }
    } catch (error) {
      console.error('Błąd usuwania transportu:', error)
      setDeleteStatus({ type: 'error', message: 'Wystąpił błąd podczas usuwania transportu' })
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Ładowanie...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Archiwum Transportów</h1>
      </div>

      {deleteStatus && (
        <div className={`mb-4 p-4 rounded-lg ${
          deleteStatus.type === 'success' ? 'bg-green-100 text-green-800' : 
          deleteStatus.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {deleteStatus.message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data transportu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Miejsce docelowe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Magazyn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Odległość
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data zakończenia
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archiwum.map((transport) => (
                <tr key={transport.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transport.delivery_date).toLocaleDateString('pl')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.destination_city} ({transport.postal_code})
                    {transport.street && ` - ${transport.street}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.source_warehouse}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.distance || 'N/A'} km
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {transport.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.completed_at ? new Date(transport.completed_at).toLocaleString('pl') : 'N/A'}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteTransport(transport.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Usuń
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
