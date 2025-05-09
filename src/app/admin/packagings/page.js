'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import AdminCheck from '@/components/AdminCheck'
import { Package, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'

export default function AdminPackagingsPage() {
  const [packagings, setPackagings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all') // all, pending, scheduled, completed
  
  // Pobierz opakowania
  const fetchPackagings = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Pobierz wszystkie opakowania, bez filtrowania po statusie w API
      const response = await fetch('/api/packagings', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Problem z API: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setPackagings(data.packagings || [])
      } else {
        throw new Error(data.error || 'Błąd podczas pobierania opakowań')
      }
    } catch (error) {
      console.error('Błąd podczas pobierania opakowań:', error)
      setError('Wystąpił błąd podczas pobierania danych: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Pobierz opakowania przy montowaniu komponentu
  useEffect(() => {
    fetchPackagings()
  }, [])
  
  // Funkcja do usuwania opakowania
  const handleDeletePackaging = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć to opakowanie?')) {
      return
    }
    
    try {
      setDeleteStatus({ type: 'loading', message: 'Usuwanie opakowania...' })
      
      const response = await fetch(`/api/packagings/delete?id=${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Usuń opakowanie z lokalnego stanu
        setPackagings(packagings.filter(pkg => pkg.id !== id))
        
        setDeleteStatus({ type: 'success', message: 'Opakowanie zostało usunięte' })
        
        // Wyczyść status po 3 sekundach
        setTimeout(() => {
          setDeleteStatus(null)
        }, 3000)
      } else {
        setDeleteStatus({ 
          type: 'error', 
          message: data.error || 'Nie udało się usunąć opakowania' 
        })
      }
    } catch (error) {
      console.error('Błąd usuwania opakowania:', error)
      setDeleteStatus({ 
        type: 'error', 
        message: 'Wystąpił błąd podczas usuwania opakowania: ' + error.message 
      })
    }
  }
  
  // Filtruj opakowania na podstawie wybranego statusu
  const filteredPackagings = filterStatus === 'all'
    ? packagings
    : packagings.filter(pkg => pkg.status === filterStatus)
  
  // Status jako badge
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Oczekujące</span>
      case 'scheduled':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Zaplanowane</span>
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Zrealizowane</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">Nieznany</span>
    }
  }
  
  return (
    <AdminCheck>
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Zarządzanie Opakowaniami
          </h1>
          <p className="text-gray-600">
            Administrowanie opakowaniami do odbioru
          </p>
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
        
        {/* Filtrowanie */}
        <div className="mb-4 flex items-center space-x-4">
          <div className="font-medium text-gray-700">Filtruj:</div>
          <button
            className={`px-3 py-1.5 rounded-md ${filterStatus === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}
            onClick={() => setFilterStatus('all')}
          >
            Wszystkie
          </button>
          <button
            className={`px-3 py-1.5 rounded-md ${filterStatus === 'pending' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800'}`}
            onClick={() => setFilterStatus('pending')}
          >
            Oczekujące
          </button>
          <button
            className={`px-3 py-1.5 rounded-md ${filterStatus === 'scheduled' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}
            onClick={() => setFilterStatus('scheduled')}
          >
            Zaplanowane
          </button>
          <button
            className={`px-3 py-1.5 rounded-md ${filterStatus === 'completed' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'}`}
            onClick={() => setFilterStatus('completed')}
          >
            Zrealizowane
          </button>
          
          <button
            className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            onClick={fetchPackagings}
          >
            <RefreshCw size={16} className="mr-2" />
            Odśwież
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg flex items-center justify-center">
            <AlertTriangle className="mr-2" />
            {error}
          </div>
        ) : filteredPackagings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg">Brak opakowań do wyświetlenia</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Klient
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lokalizacja
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dodano
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPackagings.map((packaging) => (
                  <tr key={packaging.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {packaging.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {packaging.client_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {packaging.city}
                      </div>
                      <div className="text-sm text-gray-500">
                        {packaging.postal_code} {packaging.street}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(packaging.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {packaging.created_at ? format(new Date(packaging.created_at), 'dd.MM.yyyy HH:mm', { locale: pl }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeletePackaging(packaging.id)}
                        className="text-red-600 hover:text-red-900 flex items-center ml-auto"
                        title="Usuń opakowanie"
                      >
                        <Trash2 size={16} className="mr-1" />
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
    </AdminCheck>
  )
}
