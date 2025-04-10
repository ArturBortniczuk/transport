'use client'
import React, { useState, useEffect, Fragment } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, FileText, Download, Search } from 'lucide-react'

export default function ArchiwumSpedycjiPage() {
  const [archiwum, setArchiwum] = useState([])
  const [filteredArchiwum, setFilteredArchiwum] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [expandedRowId, setExpandedRowId] = useState(null)
  
  // Filtry
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [mpkFilter, setMpkFilter] = useState('')
  const [orderNumberFilter, setOrderNumberFilter] = useState('')
  const [mpkOptions, setMpkOptions] = useState([])
  
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
    fetchArchiveData()
  }, [])

  // Pobierz dane archiwum z API
  const fetchArchiveData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Pobierz dane z API zamiast localStorage
      const response = await fetch('/api/spedycje?status=completed')
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success) {
          console.log('Pobrane dane z API:', data.spedycje)
          setArchiwum(data.spedycje)
          
          // Zbierz unikalne wartości MPK dla filtra
          const uniqueMpks = [...new Set(data.spedycje.map(item => item.mpk).filter(Boolean))]
          setMpkOptions(uniqueMpks)
          
          applyFilters(data.spedycje, selectedYear, selectedMonth, '', '')
        } else {
          throw new Error(data.error || 'Błąd pobierania danych')
        }
      } else {
        throw new Error(`Problem z API: ${response.status}`)
      }
    } catch (error) {
      console.error('Błąd pobierania archiwum:', error)
      setError('Wystąpił błąd podczas pobierania danych')
      
      // Fallback do localStorage jako ostateczność
      try {
        const savedData = localStorage.getItem('zamowieniaSpedycja')
        if (savedData) {
          const transporty = JSON.parse(savedData)
            .filter(transport => transport.status === 'completed')
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          
          setArchiwum(transporty)
          
          // Zbierz unikalne wartości MPK dla filtra
          const uniqueMpks = [...new Set(transporty.map(item => item.mpk).filter(Boolean))]
          setMpkOptions(uniqueMpks)
          
          applyFilters(transporty, selectedYear, selectedMonth, '', '')
        }
      } catch (localStorageError) {
        console.error('Błąd fallbacku localStorage:', localStorageError)
      }
    } finally {
      setLoading(false)
    }
  }

  // Funkcja pomocnicza do określania miasta załadunku
  const getLoadingCity = (transport) => {
    if (transport.location === 'Producent' && transport.producerAddress) {
      return transport.producerAddress.city || '';
    } else if (transport.location === 'Magazyn Białystok') {
      return 'Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      return 'Zielonka';
    }
    return '';
  }
  
  // Funkcja pomocnicza do określania miasta dostawy
  const getDeliveryCity = (transport) => {
    return transport.delivery?.city || '';
  }

  // Funkcja filtrująca transporty
  const applyFilters = (transports, year, month, mpkValue, orderNumberValue) => {
    if (!transports || transports.length === 0) {
      setFilteredArchiwum([])
      return
    }
    
    const filtered = transports.filter(transport => {
      // Pobierz datę z completed_at lub created_at
      const date = new Date(transport.completedAt || transport.createdAt)
      const transportYear = date.getFullYear()
      
      // Najpierw sprawdź rok
      if (transportYear !== parseInt(year)) {
        return false
      }
      
      // Jeśli wybrany "wszystkie miesiące", nie filtruj po miesiącu
      if (month !== 'all') {
        const transportMonth = date.getMonth()
        if (transportMonth !== parseInt(month)) {
          return false
        }
      }
      
      // Filtrowanie po MPK
      if (mpkValue && (!transport.mpk || !transport.mpk.toLowerCase().includes(mpkValue.toLowerCase()))) {
        return false
      }
      
      // Filtrowanie po numerze zamówienia
      if (orderNumberValue) {
        const orderNumber = transport.orderNumber || transport.order_number || ''
        if (!orderNumber.toLowerCase().includes(orderNumberValue.toLowerCase())) {
          return false
        }
      }
      
      return true
    })
    
    setFilteredArchiwum(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  // Obsługa zmiany filtrów
  useEffect(() => {
    applyFilters(archiwum, selectedYear, selectedMonth, mpkFilter, orderNumberFilter)
  }, [selectedYear, selectedMonth, mpkFilter, orderNumberFilter, archiwum])

  // Funkcja do usuwania transportu
  const handleDeleteTransport = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć ten transport?')) {
      return
    }
    
    try {
      setDeleteStatus({ type: 'loading', message: 'Usuwanie transportu...' })
      
      // Wywołanie API do usunięcia transportu
      const response = await fetch(`/api/spedycje?id=${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Usuń transport z lokalnego stanu
        const updatedArchiwum = archiwum.filter(transport => transport.id !== id)
        setArchiwum(updatedArchiwum)
        applyFilters(updatedArchiwum, selectedYear, selectedMonth, mpkFilter, orderNumberFilter)
        
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

  // Obliczanie ceny za kilometr
  const calculatePricePerKm = (price, distance) => {
    if (!price || !distance || distance === 0) return 0;
    return (price / distance).toFixed(2);
  }
  
  // Funkcja eksportująca dane do pliku
  const exportData = () => {
    if (filteredArchiwum.length === 0) {
      alert('Brak danych do eksportu')
      return
    }
    
    // Przygotuj dane do eksportu
    const dataToExport = filteredArchiwum.map(transport => {
      const distanceKm = transport.response?.distanceKm || transport.distanceKm || 0
      const price = transport.response?.deliveryPrice || 0
      const pricePerKm = calculatePricePerKm(price, distanceKm)
      
      return {
        'Numer zamówienia': transport.orderNumber || '',
        'Data zlecenia': format(new Date(transport.createdAt), 'dd.MM.yyyy', { locale: pl }),
        'Data realizacji': transport.completedAt ? format(new Date(transport.completedAt), 'dd.MM.yyyy', { locale: pl }) : 'Brak',
        'Trasa': `${getLoadingCity(transport)} → ${getDeliveryCity(transport)}`,
        'MPK': transport.mpk || '',
        'Dokumenty': transport.documents || '',
        'Osoba dodająca': transport.createdBy || '',
        'Osoba odpowiedzialna': transport.responsiblePerson || transport.createdBy || '',
        'Przewoźnik': (transport.response?.driverName || '') + ' ' + (transport.response?.driverSurname || ''),
        'Numer auta': transport.response?.vehicleNumber || '',
        'Telefon': transport.response?.driverPhone || '',
        'Cena (PLN)': price,
        'Odległość (km)': distanceKm,
        'Cena za km (PLN/km)': pricePerKm
      }
    })
    
    // Przygotuj nazwę pliku
    const monthLabel = selectedMonth === 'all' ? 'wszystkie_miesiace' : 
                      months.find(m => m.value === selectedMonth)?.label.toLowerCase() || selectedMonth
    
    const fileName = `spedycja_${selectedYear}_${monthLabel}`
    
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
    XLSX.utils.book_append_sheet(wb, ws, 'Spedycja')
    XLSX.writeFile(wb, `${fileName}.xlsx`)
  }

  // Formatowanie daty
  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd.MM.yyyy', { locale: pl })
  }

  // Paginacja
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

  // Zmiana strony
  const paginate = (pageNumber) => setCurrentPage(pageNumber)
  
  const selectStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
  const inputStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"

  // Obsługa rozwijania wiersza
  const toggleRowExpansion = (id) => {
    if (expandedRowId === id) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(id);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg">{error}</div>
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Archiwum Spedycji
        </h1>
        <p className="text-gray-600">
          Przeglądaj i filtruj zrealizowane zlecenia spedycyjne
        </p>
      </div>

      {/* Filters Section */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Rok */}
          <div>
            <label htmlFor="yearSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Rok
            </label>
            <select
              id="yearSelect"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={selectStyles}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          {/* Miesiąc */}
          <div>
            <label htmlFor="monthSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Miesiąc
            </label>
            <select
              id="monthSelect"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={selectStyles}
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          
          {/* MPK Filter */}
          <div>
            <label htmlFor="mpkFilter" className="block text-sm font-medium text-gray-700 mb-1">
              MPK
            </label>
            <div className="relative">
              <input
                id="mpkFilter"
                type="text"
                value={mpkFilter}
                onChange={(e) => setMpkFilter(e.target.value)}
                placeholder="Filtruj po MPK"
                className={inputStyles}
                list="mpk-options"
              />
              <datalist id="mpk-options">
                {mpkOptions.map((mpk, index) => (
                  <option key={index} value={mpk} />
                ))}
              </datalist>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Numer zamówienia */}
          <div>
            <label htmlFor="orderNumberFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Numer zamówienia
            </label>
            <div className="relative">
              <input
                id="orderNumberFilter"
                type="text"
                value={orderNumberFilter}
                onChange={(e) => setOrderNumberFilter(e.target.value)}
                placeholder="Filtruj po numerze"
                className={inputStyles}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Format eksportu */}
          <div className="flex flex-col justify-end">
            <label htmlFor="exportFormat" className="block text-sm font-medium text-gray-700 mb-1">
              Format
            </label>
            <div className="flex space-x-2">
              <select
                id="exportFormat"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className={`${selectStyles} flex-grow`}
              >
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
              </select>
              <button
                onClick={exportData}
                disabled={filteredArchiwum.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                title="Eksportuj dane"
              >
                <Download size={18} className="mr-1" />
                Eksportuj
              </button>
            </div>
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

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data zlecenia
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trasa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Osoba odpowiedzialna
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Numery auta
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MPK
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cena
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PLN/km
                </th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.length > 0 ? (
                currentItems.map((transport) => (
                  <Fragment key={transport.id}>
                    <tr 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleRowExpansion(transport.id)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(transport.createdAt)}
                        {transport.completedAt && (
                          <div className="text-xs text-gray-500">
                            Zrealizowano: {formatDate(transport.completedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {transport.orderNumber || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">
                          {getLoadingCity(transport)} → {getDeliveryCity(transport)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transport.responsiblePerson || transport.createdBy || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {/* Pusta kolumna dla numerów auta - będą w szczegółach */}
                        -
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transport.mpk || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transport.response?.deliveryPrice ? `${transport.response.deliveryPrice} PLN` : 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculatePricePerKm(
                          transport.response?.deliveryPrice,
                          transport.response?.distanceKm || transport.distanceKm
                        )} PLN/km
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransport(transport.id);
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            title="Usuń transport"
                          >
                            Usuń
                          </button>
                        </td>
                      )}
                    </tr>
                    {expandedRowId === transport.id && (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 8} className="bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium mb-2">Szczegóły zlecenia</h4>
                              <p className="text-sm"><span className="font-medium">Numer zamówienia: </span>{transport.orderNumber || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Dokumenty: </span>{transport.documents || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Osoba dodająca: </span>{transport.createdBy || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Osoba odpowiedzialna: </span>{transport.responsiblePerson || transport.createdBy || 'N/A'}</p>
                              {transport.notes && (
                                <p className="text-sm"><span className="font-medium">Uwagi: </span>{transport.notes}</p>
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium mb-2">Szczegóły przewoźnika</h4>
                              <p className="text-sm"><span className="font-medium">Przewoźnik: </span>{transport.response?.driverName} {transport.response?.driverSurname}</p>
                              <p className="text-sm"><span className="font-medium">Numery auta: </span>{transport.response?.vehicleNumber || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Telefon: </span>{transport.response?.driverPhone || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Odległość: </span>{transport.response?.distanceKm || transport.distanceKm || 'N/A'} km</p>
                              {transport.response?.adminNotes && (
                                <p className="text-sm"><span className="font-medium">Uwagi przewoźnika: </span>{transport.response.adminNotes}</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center py-6">
                      <FileText size={48} className="text-gray-400 mb-2" />
                      <p className="text-gray-500">Brak transportów spedycyjnych w wybranym okresie</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination & Summary */}
        <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 flex flex-col sm:flex-row justify-between items-center">
          <div className="text-sm text-gray-700 mb-4 sm:mb-0">
            <span className="font-medium">Łącznie:</span> {filteredArchiwum.length} transportów
            {filteredArchiwum.length > 0 && (
              <>
                <span className="ml-4 font-medium">Całkowita kwota:</span> {filteredArchiwum.reduce((sum, t) => sum + (t.response?.deliveryPrice || 0), 0).toLocaleString('pl-PL')} PLN
                <span className="ml-4 font-medium">Średnia cena/km:</span> {(filteredArchiwum.reduce((sum, t) => {
                  const price = t.response?.deliveryPrice || 0;
                  const distance = t.response?.distanceKm || t.distanceKm || 0;
                  return distance > 0 ? sum + (price / distance) : sum;
                }, 0) / (filteredArchiwum.filter(t => (t.response?.distanceKm || t.distanceKm) > 0).length || 1)).toFixed(2)} PLN/km
              </>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <button
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="text-sm text-gray-700">
                Strona {currentPage} z {totalPages}
              </div>
              
              <button
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
