'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { KIEROWCY } from '../kalendarz/constants'
import * as XLSX from 'xlsx'

export default function ArchiwumPage() {
  const [archiwum, setArchiwum] = useState([])
  const [filteredArchiwum, setFilteredArchiwum] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [refreshKey, setRefreshKey] = useState(0) // Dodany klucz odświeżania
  
  // Filtry
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState('all') // 'all' oznacza wszystkie miesiące
  
  // Lista dostępnych lat i miesięcy
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = [
    { value: 'all', label: 'Wszystkie miesiące' },
    { value: '0', label: 'Styczeń' },
    { value: '1', label: 'Luty' },
    { value: '2', label: 'Marzec' },
    { value: '3', label: 'Kwiecień' },
    { value: '4', label: 'Maj' },
    { value: '5', label: 'Czerwiec' },
    { value: '6', label: 'Lipiec' },
    { value: '7', label: 'Sierpień' },
    { value: '8', label: 'Wrzesień' },
    { value: '9', label: 'Październik' },
    { value: '10', label: 'Listopad' },
    { value: '11', label: 'Grudzień' }
  ]

  // Zoptymalizowana funkcja pobierania transportów
  const fetchArchivedTransports = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Dodajemy parametr nocache i timestamp, aby uniknąć problemów z cachem
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/transports?status=completed&nocache=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Błąd HTTP: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log('Pobrano transporty:', data.transports.length)
        
        // Sprawdź czy dane są tablicą
        if (!Array.isArray(data.transports)) {
          console.error('Nieprawidłowy format danych:', data.transports)
          throw new Error('Nieprawidłowy format danych')
        }
        
        // Sortuj transporty od najnowszych
        const sortedTransports = data.transports.sort((a, b) => 
          new Date(b.delivery_date) - new Date(a.delivery_date)
        )
        
        setArchiwum(sortedTransports)
        applyFilters(sortedTransports, selectedYear, selectedMonth)
      } else {
        throw new Error(data.error || 'Nie udało się pobrać archiwum transportów')
      }
    } catch (error) {
      console.error('Błąd pobierania archiwum:', error)
      setError('Wystąpił błąd podczas pobierania danych: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Sprawdzenie uprawnień i pobranie danych
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

    checkAdmin()
    fetchArchivedTransports()
  }, [refreshKey]) // Dodajemy refreshKey jako zależność

  // Funkcja filtrująca transporty na podstawie wybranego roku i miesiąca
  const applyFilters = (transports, year, month) => {
    if (!transports || !Array.isArray(transports)) {
      setFilteredArchiwum([])
      return
    }
    
    const filtered = transports.filter(transport => {
      if (!transport || !transport.delivery_date) return false
      
      try {
        const date = new Date(transport.delivery_date)
        if (isNaN(date.getTime())) return false // Sprawdź czy data jest prawidłowa
        
        const transportYear = date.getFullYear()
        
        // Najpierw sprawdź rok
        if (transportYear !== parseInt(year)) {
          return false
        }
        
        // Jeśli wybrany "wszystkie miesiące", nie filtruj po miesiącu
        if (month === 'all') {
          return true
        }
        
        // W przeciwnym razie sprawdź czy miesiąc się zgadza
        const transportMonth = date.getMonth()
        return transportMonth === parseInt(month)
      } catch (e) {
        console.error('Błąd przetwarzania daty transportu:', e, transport)
        return false
      }
    })
    
    setFilteredArchiwum(filtered)
  }

  // Obsługa zmiany filtrów
  useEffect(() => {
    applyFilters(archiwum, selectedYear, selectedMonth)
  }, [selectedYear, selectedMonth, archiwum])

  // Funkcja do usuwania transportu - poprawiona
  const handleDeleteTransport = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć ten transport?')) {
      return
    }
    
    try {
      setDeleteStatus({ type: 'loading', message: 'Usuwanie transportu...' })
      
      const response = await fetch(`/api/transports/delete?id=${id}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Błąd HTTP: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        // Usuwamy transport z lokalnego stanu
        const updatedArchiwum = archiwum.filter(transport => transport.id !== id)
        setArchiwum(updatedArchiwum)
        
        // Aktualizujemy filtrowane dane
        applyFilters(updatedArchiwum, selectedYear, selectedMonth)
        
        // Ustawiamy status i planujemy jego wyczyszczenie
        setDeleteStatus({ type: 'success', message: 'Transport został usunięty' })
        
        // Odświeżamy dane z serwera po krótkim czasie
        setTimeout(() => {
          setRefreshKey(prev => prev + 1) // Zwiększamy klucz odświeżania, co spowoduje ponowne pobranie danych
          setDeleteStatus(null)
        }, 3000)
      } else {
        throw new Error(data.error || 'Nie udało się usunąć transportu')
      }
    } catch (error) {
      console.error('Błąd usuwania transportu:', error)
      setDeleteStatus({ type: 'error', message: 'Wystąpił błąd podczas usuwania transportu: ' + error.message })
      
      // Odświeżamy dane z serwera nawet w przypadku błędu
      setTimeout(() => {
        setRefreshKey(prev => prev + 1)
      }, 3000)
    }
  }

  // Funkcja pomocnicza do znajdowania danych kierowcy
  const getDriverInfo = (driverId) => {
    if (!driverId) return 'Brak danych'
    
    const driver = KIEROWCY.find(k => k.id === parseInt(driverId))
    return driver ? `${driver.imie} (${driver.tabliceRej})` : 'Brak danych'
  }

  // Funkcja eksportująca dane do pliku
  const exportData = () => {
    if (filteredArchiwum.length === 0) {
      alert('Brak danych do eksportu')
      return
    }
    
    // Przygotuj dane do eksportu
    const dataToExport = filteredArchiwum.map(transport => {
      const driver = KIEROWCY.find(k => k.id === parseInt(transport.driver_id))
      
      return {
        'Data transportu': format(new Date(transport.delivery_date), 'dd.MM.yyyy', { locale: pl }),
        'Miasto': transport.destination_city,
        'Kod pocztowy': transport.postal_code || '',
        'Ulica': transport.street || '',
        'Numer WZ': transport.wz_number || '',
        'Magazyn': transport.source_warehouse === 'bialystok' ? 'Białystok' : 
                 transport.source_warehouse === 'zielonka' ? 'Zielonka' : 
                 transport.source_warehouse,
        'Odległość (km)': transport.distance || '',
        'Firma': transport.client_name || '',
        'MPK': transport.mpk || '',
        'Kierowca': driver ? driver.imie : '',
        'Nr rejestracyjny': driver ? driver.tabliceRej : '',
        'Status': transport.status || '',
        'Data zakończenia': transport.completed_at ? format(new Date(transport.completed_at), 'dd.MM.yyyy HH:mm', { locale: pl }) : ''
      }
    })
    
    // Przygotuj nazwę pliku
    const monthLabel = selectedMonth === 'all' ? 'wszystkie_miesiace' : 
                     months.find(m => m.value === selectedMonth)?.label.toLowerCase() || selectedMonth
    
    const fileName = `transporty_${selectedYear}_${monthLabel}`
    
    if (exportFormat === 'csv') {
      exportToCSV(dataToExport, fileName)
    } else {
      exportToXLSX(dataToExport, fileName)
    }
  }
  
  // Eksport do CSV
  const exportToCSV = (data, fileName) => {
    // Nagłówki
    const headers = Object.keys(data[0])
    
    // Convert data to CSV string
    let csvContent = headers.join(';') + '\n'
    data.forEach(item => {
      const row = headers.map(header => {
        let cell = item[header] !== undefined && item[header] !== null ? item[header] : ''
        // Jeśli komórka zawiera przecinek, średnik lub nowy wiersz, umieść ją w cudzysłowach
        if (cell.toString().includes(',') || cell.toString().includes(';') || cell.toString().includes('\n')) {
          cell = `"${cell}"`
        }
        return cell
      }).join(';')
      csvContent += row + '\n'
    })

    // Kodowanie do ISO-8859-2 dla polskich znaków w Excelu
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    
    // Tworzenie i kliknięcie tymczasowego linku do pobrania
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Eksport do XLSX
  const exportToXLSX = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transporty')
    XLSX.writeFile(wb, `${fileName}.xlsx`)
  }

  // Ręczne odświeżanie danych
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Ładowanie...</div>
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg">
          {error}
          <button 
            className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={handleRefresh}
          >
            Odśwież
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
        <h1 className="text-3xl font-bold text-gray-900">Archiwum Transportów</h1>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Przycisk odświeżania */}
          <button
            onClick={handleRefresh}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
            title="Odśwież listę transportów"
          >
            Odśwież dane
          </button>
          
          {/* Wybór roku */}
          <div>
            <label htmlFor="yearSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Rok
            </label>
            <select
              id="yearSelect"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          {/* Wybór miesiąca */}
          <div>
            <label htmlFor="monthSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Miesiąc
            </label>
            <select
              id="monthSelect"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          
          {/* Eksport danych */}
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="exportFormat" className="block text-sm font-medium text-gray-700 mb-1">
                Format
              </label>
              <select
                id="exportFormat"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <button
              onClick={exportData}
              disabled={filteredArchiwum.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Eksportuj
            </button>
          </div>
        </div>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data transportu
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Miejsce docelowe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numer WZ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Magazyn
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Odległość
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firma
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MPK
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kierowca
                </th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredArchiwum.length > 0 ? (
                filteredArchiwum.map((transport) => (
                  <tr key={transport.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(transport.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{transport.destination_city}</div>
                      <div className="text-gray-500">
                        {transport.postal_code}
                        {transport.street && `, ${transport.street}`}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transport.wz_number || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transport.source_warehouse === 'bialystok' ? 'Białystok' : 
                       transport.source_warehouse === 'zielonka' ? 'Zielonka' : 
                       transport.source_warehouse}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transport.distance || 'N/A'} km
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transport.client_name || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transport.mpk || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getDriverInfo(transport.driver_id)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                        <button
                          onClick={() => handleDeleteTransport(transport.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          title="Usuń transport"
                        >
                          Usuń
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                    Brak transportów w wybranym okresie
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Podsumowanie */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            Łącznie: <span className="font-semibold">{filteredArchiwum.length}</span> transportów
            {filteredArchiwum.length > 0 && (
              <>
                , Całkowita odległość: <span className="font-semibold">
                  {filteredArchiwum.reduce((sum, t) => sum + (t.distance || 0), 0).toLocaleString('pl-PL')}
                </span> km
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
