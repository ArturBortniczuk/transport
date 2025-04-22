'use client'
import { useState, useEffect } from 'react'
import AdminCheck from '@/components/AdminCheck'

export default function ManagePackagingsPage() {
  const [mapId, setMapId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [packagings, setPackagings] = useState([])
  const [isLoadingPackagings, setIsLoadingPackagings] = useState(false)

  // Funkcja do pobierania listy opakowań
  const fetchPackagings = async () => {
    try {
      setIsLoadingPackagings(true)
      const response = await fetch('/api/packagings')
      const data = await response.json()
      
      if (data.success) {
        setPackagings(data.packagings)
      } else {
        console.error('Błąd pobierania opakowań:', data.error)
      }
    } catch (error) {
      console.error('Błąd podczas komunikacji z API:', error)
    } finally {
      setIsLoadingPackagings(false)
    }
  }

  // Pobierz opakowania przy montowaniu komponentu
  useEffect(() => {
    fetchPackagings()
  }, [])

  // Funkcja do synchronizacji z MyMaps
  const handleSync = async () => {
    try {
      setIsLoading(true)
      setSyncResult(null)
      
      const response = await fetch('/api/packagings/sync-mymaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mapId: mapId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSyncResult({
          status: 'success',
          message: data.message,
          details: data.results
        })
        
        // Odśwież listę opakowań
        fetchPackagings()
      } else {
        setSyncResult({
          status: 'error',
          message: data.error || 'Wystąpił błąd podczas synchronizacji'
        })
      }
    } catch (error) {
      console.error('Błąd podczas synchronizacji:', error)
      setSyncResult({
        status: 'error',
        message: 'Wystąpił błąd podczas komunikacji z serwerem'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Funkcja do usuwania opakowań
  const handleDeletePackaging = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć to opakowanie?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/packagings?id=${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('Opakowanie zostało usunięte')
        fetchPackagings()
      } else {
        alert(`Błąd: ${data.error || 'Nie udało się usunąć opakowania'}`)
      }
    } catch (error) {
      console.error('Błąd podczas usuwania opakowania:', error)
      alert('Wystąpił błąd podczas komunikacji z serwerem')
    }
  }

  return (
    <AdminCheck>
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Zarządzanie opakowaniami do odbioru
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Synchronizacja z Google MyMaps</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Mapy Google MyMaps
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={mapId}
                  onChange={(e) => setMapId(e.target.value)}
                  placeholder="np. 1BpEawKzzJKMQR-HQm8BwzU0ellzB1WXM"
                  className="flex-1 rounded-l-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleSync}
                  disabled={isLoading || !mapId}
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isLoading ? 'Synchronizacja...' : 'Synchronizuj'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                ID mapy znajdziesz w URL MyMaps: https://www.google.com/maps/d/edit?mid=YOUR_MAP_ID_HERE
              </p>
            </div>
            
            {syncResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                syncResult.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <h3 className={`font-medium ${
                  syncResult.status === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {syncResult.status === 'success' ? 'Synchronizacja zakończona pomyślnie' : 'Błąd synchronizacji'}
                </h3>
                <p className={syncResult.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {syncResult.message}
                </p>
                {syncResult.details && (
                  <ul className="mt-2 list-disc list-inside text-sm">
                    <li>Dodano: {syncResult.details.added}</li>
                    <li>Zaktualizowano: {syncResult.details.updated}</li>
                    <li>Błędy: {syncResult.details.errors}</li>
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            Lista opakowań do odbioru ({packagings.length})
          </h2>
          
          {isLoadingPackagings ? (
            <div className="text-center py-4">Ładowanie opakowań...</div>
          ) : packagings.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Brak opakowań do odbioru
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adres</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {packagings.map((packaging) => (
                    <tr key={packaging.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{packaging.client_name}</div>
                        <div className="text-sm text-gray-500">{packaging.description.substring(0, 50)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>{packaging.city}, {packaging.postal_code}</div>
                        <div className="text-sm text-gray-500">{packaging.street}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          packaging.status === 'completed' ? 'bg-green-100 text-green-800' :
                          packaging.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {packaging.status === 'completed' ? 'Zrealizowane' :
                          packaging.status === 'scheduled' ? 'Zaplanowane' :
                          'Oczekujące'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeletePackaging(packaging.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={packaging.status !== 'pending'}
                        >
                          Usuń
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminCheck>
  )
}