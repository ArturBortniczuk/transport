// src/app/archiwum/page.js
'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { KIEROWCY, RYNKI } from '../kalendarz/constants'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, FileText, Download, ThumbsUp, ThumbsDown, Compass, ChevronDown, MapPin, Truck, Building, Phone, User, Calendar, Info, ExternalLink } from 'lucide-react'
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
  const [ratingValues, setRatingValues] = useState({})
  
  // Filtry
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedRequester, setSelectedRequester] = useState('')
  const [selectedRating, setSelectedRating] = useState('all')
  const [selectedConstruction, setSelectedConstruction] = useState('')
  
  // Lista użytkowników (handlowców) do filtrowania
  const [users, setUsers] = useState([])
  const [constructions, setConstructions] = useState([])
  
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

  // Ładowanie zapisanych filtrów przy inicjalizacji
  useEffect(() => {
    const savedFilters = sessionStorage.getItem('archiveFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setSelectedYear(filters.selectedYear || new Date().getFullYear());
        setSelectedMonth(filters.selectedMonth || 'all');
        setSelectedWarehouse(filters.selectedWarehouse || '');
        setSelectedDriver(filters.selectedDriver || '');
        setSelectedRequester(filters.selectedRequester || '');
        setSelectedRating(filters.selectedRating || 'all');
        setSelectedConstruction(filters.selectedConstruction || '');
        setCurrentPage(filters.currentPage || 1);
      } catch (e) {
        console.error("Błąd przy ładowaniu zapisanych filtrów:", e);
      }
    }
  }, []);

  // Funkcja do przełączania rozwinięcia wiersza
  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Funkcja aktualizująca informację o możliwości oceny transportu i jego ocenie
  const handleCanBeRatedChange = (transportId, canBeRated, isPositive = null) => {
    setRatableTransports(prev => {
      // Jeśli wartość się nie zmieniła, nie aktualizuj stanu
      if (prev[transportId] === canBeRated) return prev
      return {
        ...prev,
        [transportId]: canBeRated
      }
    })
    
    // Zapisujemy również wartość oceny jeśli jest dostępna
    if (isPositive !== null) {
      setRatingValues(prev => ({
        ...prev,
        [transportId]: { isPositive }
      }))
    }
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

    // Pobierz listę budów do filtrowania
    const fetchConstructions = async () => {
      try {
        const response = await fetch('/api/constructions')
        if (response.ok) {
          const data = await response.json()
          setConstructions(data.constructions || [])
        }
      } catch (error) {
        console.error('Błąd pobierania budów:', error)
      }
    }

    checkAdmin()
    fetchUsers()
    fetchConstructions()
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
        applyFilters(sortedTransports, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction)
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

  const renderRatingBadge = (transportId) => {
    return (
      <TransportRatingBadge 
        transportId={transportId} 
        refreshTrigger={0} // Statyczna wartość, aby uniknąć ponownego renderowania
        onCanBeRatedChange={(canBeRated, isPositive) => handleCanBeRatedChange(transportId, canBeRated, isPositive)}
      />
    )
  }
  
  // Funkcja filtrująca transporty
  const applyFilters = (transports, year, month, warehouse, driver, requester, rating, construction) => {
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
      
      // Filtr oceny - poprawiony
      if (rating !== 'all') {
        // Sprawdzamy ocenę transportu na podstawie ratableTransports i ratingValues
        const hasRating = ratableTransports[transport.id] !== undefined && !ratableTransports[transport.id];
        
        if (rating === 'positive') {
          // Tylko pozytywne oceny
          return hasRating && ratingValues[transport.id]?.isPositive === true;
        } else if (rating === 'negative') {
          // Tylko negatywne oceny
          return hasRating && ratingValues[transport.id]?.isPositive === false;
        } else if (rating === 'unrated') {
          // Tylko nieocenione transporty
          return !hasRating || ratableTransports[transport.id];
        }
      }
      
      // Filtr budowy
      if (construction && transport.responsible_constructions) {
        try {
          const constructions = JSON.parse(transport.responsible_constructions)
          const hasConstruction = constructions.some(c => c.id.toString() === construction)
          if (!hasConstruction) {
            return false
          }
        } catch (e) {
          // Jeśli responsible_constructions nie jest JSON, sprawdź czy zawiera nazwę budowy
          if (!transport.responsible_constructions.includes(construction)) {
            return false
          }
        }
      }
      
      return true
    })
    
    setFilteredArchiwum(filtered)
  }

  // Obsługa zmiany filtrów
  useEffect(() => {
    applyFilters(archiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction)
  }, [selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction, archiwum, ratableTransports, ratingValues])

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
        applyFilters(updatedArchiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction)
        
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
        'Osoba zlecająca': transport.requester_name || '',
        'Ocena': ratingValues[transport.id] 
          ? (ratingValues[transport.id].isPositive ? 'Pozytywna' : 'Negatywna') 
          : 'Brak oceny'
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

  // Ulepszona funkcja paginacji z zapisywaniem stanu
  const paginate = (pageNumber) => {
    // Zapisujemy aktualny stan filtrów do sessionStorage
    const filterState = {
      selectedYear,
      selectedMonth,
      selectedWarehouse,
      selectedDriver,
      selectedRequester,
      selectedRating,
      selectedConstruction,
      currentPage: pageNumber
    };
    sessionStorage.setItem('archiveFilters', JSON.stringify(filterState));
    
    setCurrentPage(pageNumber);
  };

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

      {/* Filters Section - przekształcona na 2 rzędy */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Filtry</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
          {/* Pierwszy rząd filtrów */}
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
                  {kierowca.imie}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Drugi rząd filtrów */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          
          {/* Ocena */}
          <div>
            <label htmlFor="ratingSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Ocena
            </label>
            <select
              id="ratingSelect"
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className={selectStyles}
            >
              <option value="all">Wszystkie oceny</option>
              <option value="positive">Pozytywne</option>
              <option value="negative">Negatywne</option>
              <option value="unrated">Nieocenione</option>
            </select>
          </div>
          
          {/* Budowa */}
          <div>
            <label htmlFor="constructionSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Budowa
            </label>
            <select
              id="constructionSelect"
              value={selectedConstruction}
              onChange={(e) => setSelectedConstruction(e.target.value)}
              className={selectStyles}
            >
              <option value="">Wszystkie budowy</option>
              {constructions.map(construction => (
                <option key={construction.id} value={construction.id}>
                  {construction.name} ({construction.mpk})
                </option>
              ))}
            </select>
          </div>
          
          {/* Format eksportu */}
          <div>
            <label htmlFor="exportFormat" className="block text-sm font-medium text-gray-700 mb-1">
              Format eksportu
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
        </div>
        
        {/* Trzeci rząd - przycisk eksportu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          <div className="flex items-end">
            <button
              onClick={exportData}
              disabled={filteredArchiwum.length === 0}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              title="Eksportuj dane"
            >
              <Download size={18} />
              <span>Eksportuj</span>
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
                  <div className="text-gray-700 hidden md:flex items-center">
                    <Building size={16}  className={`mr-2 ${transport.source_warehouse === 'bialystok' ? 'text-red-500' : 'text-blue-500'}`}  />
                    {transport.source_warehouse === 'bialystok' ? 'Magazyn Białystok' : 
                     transport.source_warehouse === 'zielonka' ? 'Magazyn Zielonka' : 
                     transport.source_warehouse}
                  </div>
                  <div className="flex items-center mx-4 text-sm text-gray-600">
                    <Compass size={16} className="mr-1 text-green-600" />
                    {transport.distance ? `${transport.distance} km` : 'N/A'}
                  </div>
                  <div className="font-medium text-gray-900 flex items-center">
                    <MapPin size={16} className="mr-2 text-orange-500" />
                    {transport.destination_city}
                  </div>
                  <div className="text-gray-700 hidden lg:flex items-center">
                    <Truck size={16} className="mr-2 text-green-500" />
                    {getDriverInfo(transport.driver_id)}
                  </div>
                </div>
                
                {/* Dla przycisków w nagłówku karty transportu */}
                <div className="flex items-center space-x-3">
                  {renderRatingBadge(transport.id)}
                  
                  {/* Pokaż przycisk "Oceń" tylko jeśli transport może być oceniony */}
                  {ratableTransports[transport.id] !== undefined && (
                    ratableTransports[transport.id] ? (
                      <button
                        key={`rate-button-${transport.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRatingModal(transport);
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        title="Oceń transport"
                      >
                        Oceń
                      </button>
                    ) : (
                      <button
                        key={`view-button-${transport.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRatingModal(transport);
                        }}
                        className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                        title="Zobacz oceny"
                      >
                        Zobacz oceny
                      </button>
                    )
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
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Numery dokumentów</h3>
                      <p className="text-gray-900 font-medium">
                        {transport.wz_number || transport.numerWZ || 'Brak numeru'}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Odbiorca</h3>
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
                    {/* Pokaż odpowiedni przycisk w zależności od statusu oceny */}
                    {ratableTransports[transport.id] !== undefined && (
                      ratableTransports[transport.id] ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRatingModal(transport);
                          }}
                          className="px-4 py-2 mr-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center"
                          title="Oceń transport"
                        >
                          <ThumbsUp size={16} className="mr-2" />
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
                          {ratingValues[transport.id]?.isPositive ? (
                            <ThumbsUp size={16} className="mr-2" />
                            ) : (
                            <ThumbsDown size={16} className="mr-2" />
                          )}
                          Zobacz oceny
                        </button>
                      )
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
              className="p-2 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            
            {/* Wyświetlanie numerów stron */}
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Logika do wyświetlania stron wokół aktualnej strony
                let pageNum;
                if (totalPages <= 5) {
                  // Jeśli mamy 5 lub mniej stron, wyświetl wszystkie
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  // Jeśli jesteśmy blisko początku
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  // Jeśli jesteśmy blisko końca
                  pageNum = totalPages - 4 + i;
                } else {
                  // W środku - wyświetl 2 strony przed i 2 po aktualnej
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => paginate(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
