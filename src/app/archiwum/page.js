// src/app/archiwum/page.js
'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { KIEROWCY, RYNKI } from '../kalendarz/constants'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, FileText, Download, Star, ChevronDown, MapPin, Truck, Building, Phone, User, Calendar, Info, ExternalLink } from 'lucide-react'
import TransportRating from '@/components/TransportRating'
import TransportRatingBadge from '@/components/TransportRatingBadge'

export default function ArchiwumPage() {
  const [archiwum, setArchiwum] = useState([])
  const [filteredArchiwum, setFilteredArchiwum] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [selectedTransport, setSelectedTransport] = useState(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [expandedRows, setExpandedRows] = useState({})
  const [ratableTransports, setRatableTransports] = useState({})
  
  // Filtry
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedRequester, setSelectedRequester] = useState('')
  
  // Lista użytkowników (handlowców) do filtrowania
  const [users, setUsers] = useState([])
  
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

  // Funkcja do przełączania rozwinięcia wiersza
  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Funkcja aktualizująca informację o możliwości oceny transportu
  const handleCanBeRatedChange = (transportId, canBeRated) => {
    setRatableTransports(prev => ({
      ...prev,
      [transportId]: canBeRated
    }))
  }

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
    
    // Pobierz listę użytkowników (handlowców)
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users/list')
        if (response.ok) {
          const data = await response.json()
          setUsers(data)
        }
      } catch (error) {
        console.error('Błąd pobierania użytkowników:', error)
      }
    }

    checkAdmin()
    fetchUsers()
    fetchArchivedTransports()
  }, [])

  // Pobierz dane archiwum z API
  const fetchArchivedTransports = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transports?status=completed')
      const data = await response.json()
      
      if (data.success) {
        // Sortuj transporty od najnowszych
        const sortedTransports = data.transports.sort((a, b) => 
          new Date(b.delivery_date) - new Date(a.delivery_date)
        )
        setArchiwum(sortedTransports)
        applyFilters(sortedTransports, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester)
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

  // Funkcja filtrująca transporty
  const applyFilters = (transports, year, month, warehouse, driver, requester) => {
    if (!transports) return
    
    const filtered = transports.filter(transport => {
      const date = new Date(transport.delivery_date)
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
      
      // Filtr magazynu
      if (warehouse && transport.source_warehouse !== warehouse) {
        return false
      }
      
      // Filtr kierowcy
      if (driver && transport.driver_id.toString() !== driver) {
        return false
      }
      
      // Filtr osoby zlecającej
      if (requester && transport.requester_email !== requester) {
        return false
      }
      
      return true
    })
    
    setFilteredArchiwum(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }

  // Obsługa zmiany filtrów
  useEffect(() => {
    applyFilters(archiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester)
  }, [selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, archiwum])

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
        const updatedArchiwum = archiwum.filter(transport => transport.id !== id)
        setArchiwum(updatedArchiwum)
        applyFilters(updatedArchiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester)
        
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

  // Funkcja do otwierania modalu ocen
  const handleOpenRatingModal = (transport) => {
    setSelectedTransport(transport)
    setShowRatingModal(true)
  }

  // Funkcja pomocnicza do znajdowania danych kierowcy
  const getDriverInfo = (driverId) => {
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
        'Magazyn': transport.source_warehouse === 'bialystok' ? 'Białystok' : 
                 transport.source_warehouse === 'zielonka' ? 'Zielonka' : 
                 transport.source_warehouse,
        'Odległość (km)': transport.distance || '',
        'Firma': transport.client_name || '',
        'MPK': transport.mpk || '',
        'Kierowca': driver ? driver.imie : '',
        'Nr rejestracyjny': driver ? driver.tabliceRej : '',
        'Status': transport.status || '',
        'Data zakończenia': transport.completed_at ? format(new Date(transport.completed_at), 'dd.MM.yyyy HH:mm', { locale: pl }) : '',
        'Osoba zlecająca': transport.requester_name || ''
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

  // Paginacja
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

  // Zmiana strony
  const paginate = (pageNumber) => setCurrentPage(pageNumber)
  
  const selectStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"

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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Archiwum Transportów
        </h1>
        <p className="text-gray-600">
          Przeglądaj, filtruj i oceniaj zrealizowane transporty
        </p>
      </div>

      {/* Filters Section */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
          
          {/* Magazyn */}
          <div>
            <label htmlFor="warehouseSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Magazyn
            </label>
            <select
              id="warehouseSelect"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className={selectStyles}
            >
              <option value="">Wszystkie magazyny</option>
              <option value="bialystok">Magazyn Białystok</option>
              <option value="zielonka">Magazyn Zielonka</option>
            </select>
          </div>
          
          {/* Kierowca */}
          <div>
            <label htmlFor="driverSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Kierowca
            </label>
            <select
              id="driverSelect"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className={selectStyles}
            >
              <option value="">Wszyscy kierowcy</option>
              {KIEROWCY.map(kierowca => (
                <option key={kierowca.id} value={kierowca.id}>
                  {kierowca.imie} ({kierowca.tabliceRej})
                </option>
              ))}
            </select>
          </div>
          
          {/* Osoba zlecająca */}
          <div>
            <label htmlFor="requesterSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Osoba zlecająca
            </label>
            <select
              id="requesterSelect"
              value={selectedRequester}
              onChange={(e) => setSelectedRequester(e.target.value)}
              className={selectStyles}
            >
              <option value="">Wszyscy zlecający</option>
              {users.map(user => (
                <option key={user.email} value={user.email}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Format eksportu i przycisk */}
          <div className="flex items-end">
            <div className="w-2/3 mr-2">
              <label htmlFor="exportFormat" className="block text-sm font-medium text-gray-700 mb-1">
                Format
              </label>
              <select
                id="exportFormat"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className={selectStyles}
              >
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <button
              onClick={exportData}
              disabled={filteredArchiwum.length === 0}
              className="w-1/3 h-10 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Eksportuj dane"
            >
              <Download size={18} />
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

      {/* Lista transportów */}
      <div className="space-y-4">
        {currentItems.length > 0 ? (
          currentItems.map((transport) => (
            <div key={transport.id} className="bg-white shadow rounded-lg overflow-hidden">
              {/* Nagłówek karty transportu */}
              <div 
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                onClick={() => toggleRowExpand(transport.id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-gray-700 flex items-center">
                    <Calendar size={16} className="mr-2" />
                    {format(new Date(transport.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                  </div>
                  <div className="font-medium text-gray-900 flex items-center">
                    <MapPin size={16} className="mr-2 text-red-500" />
                    {transport.destination_city}
                  </div>
                  <div className="text-gray-700 hidden md:flex items-center">
                    <Building size={16} className="mr-2 text-blue-500" />
                    {transport.source_warehouse === 'bialystok' ? 'Magazyn Białystok' : 
                     transport.source_warehouse === 'zielonka' ? 'Magazyn Zielonka' : 
                     transport.source_warehouse}
                  </div>
                  <div className="text-gray-700 hidden lg:flex items-center">
                    <Truck size={16} className="mr-2 text-green-500" />
                    {getDriverInfo(transport.driver_id)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <TransportRatingBadge 
                    transportId={transport.id} 
                    onCanBeRatedChange={(canBeRated) => handleCanBeRatedChange(transport.id, canBeRated)}
                  />
                  
                  {/* Pokaż przycisk "Oceń" tylko jeśli transport może być oceniony */}
                  {ratableTransports[transport.id] && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRatingModal(transport);
                      }}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                      title="Oceń transport"
                    >
                      Oceń
                    </button>
                  )}
                  
                  {/* Pokaż przycisk "Zobacz oceny" jeśli transport nie może być oceniony */}
                  {!ratableTransports[transport.id] && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRatingModal(transport);
                      }}
                      className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                      title="Zobacz oceny"
                    >
                      Zobacz oceny
                    </button>
                  )}
                  
                  <ChevronDown 
                    size={20} 
                    className={`text-gray-500 transition-transform ${expandedRows[transport.id] ? 'rotate-180' : ''}`} 
                  />
                </div>
              </div>
              
              {/* Szczegóły transportu - widoczne po rozwinięciu */}
              {expandedRows[transport.id] && (
                <div className="p-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Miejsce docelowe</h3>
                      <p className="text-gray-900">{transport.destination_city}</p>
                      <p className="text-gray-700 text-sm">
                        {transport.postal_code}{transport.street && `, ${transport.street}`}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Magazyn</h3>
                      <p className="text-gray-900">
                        {transport.source_warehouse === 'bialystok' ? 'Białystok' : 
                        transport.source_warehouse === 'zielonka' ? 'Zielonka' : 
                        transport.source_warehouse}
                      </p>
                      <p className="text-gray-700 text-sm">
                        Odległość: {transport.distance || 'N/A'} km
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Firma</h3>
                      <p className="text-gray-900">{transport.client_name || 'N/A'}</p>
                      <p className="text-gray-700 text-sm">
                        MPK: {transport.mpk || 'N/A'}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Kierowca</h3>
                      <p className="text-gray-900">{getDriverInfo(transport.driver_id)}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Osoba zlecająca</h3>
                      <p className="text-gray-900">{transport.requester_name || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Data zakończenia</h3>
                      <p className="text-gray-900">
                        {transport.completed_at 
                          ? format(new Date(transport.completed_at), 'dd.MM.yyyy HH:mm', { locale: pl })
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Przyciski akcji */}
                  <div className="mt-4 flex justify-end">
                    {/* Pokaż przycisk "Oceń transport" tylko jeśli transport może być oceniony */}
                    {ratableTransports[transport.id] ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRatingModal(transport);
                        }}
                        className="px-4 py-2 mr-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center"
                        title="Oceń transport"
                      >
                        <Star size={16} className="mr-2" />
                        Oceń transport
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRatingModal(transport);
                        }}
                        className="px-4 py-2 mr-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 flex items-center"
                        title="Zobacz oceny"
                      >
                        <Star size={16} className="mr-2" />
                        Zobacz oceny
                      </button>
                    )}
                    
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTransport(transport.id);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        title="Usuń transport"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex flex-col items-center justify-center py-10">
              <FileText size={48} className="text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">Brak transportów w wybranym okresie</p>
              <p className="text-gray-400 mt-2">Spróbuj zmienić kryteria filtrowania</p>
            </div>
          </div>
        )}
      </div>
        
      {/* Pagination & Summary */}
      <div className="mt-6 bg-white rounded-lg shadow px-4 py-4 flex flex-col sm:flex-row justify-between items-center">
        <div className="text-sm text-gray-700 mb-4 sm:mb-0">
          <span className="font-medium">Łącznie:</span> {filteredArchiwum.length} transportów
          {filteredArchiwum.length > 0 && (
            <span className="ml-2">
              <span className="font-medium">Całkowita odległość:</span> {filteredArchiwum.reduce((sum, t) => sum + (t.distance || 0), 0).toLocaleString('pl-PL')} km
            </span>
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
              className="p-2 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50
              disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Modal oceniania transportu */}
      {showRatingModal && selectedTransport && (
        <TransportRating
          transportId={selectedTransport.id}
          onClose={() => {
            setShowRatingModal(false);
            setSelectedTransport(null);
            // Odświeżenie listy transportów po zamknięciu modalu ocen
            fetchArchivedTransports();
          }}
        />
      )}
    </div>
  )
}
