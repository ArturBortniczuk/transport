'use client'
import React, { useState, useEffect, Fragment } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { generateCMR } from '@/lib/utils/generateCMR'
import { ChevronLeft, ChevronRight, FileText, Download, Search, Truck, Package, MapPin, Phone, Calendar, DollarSign, User, Clipboard, ArrowRight, ChevronDown, ChevronUp, AlertCircle, Building, ShoppingBag, Weight, Mail, Hash, Clock, CheckCircle, Printer } from 'lucide-react'

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

  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2",
    success: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-2"
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
    if (transport.location === 'Odbiory własne' && transport.producerAddress) {
      return transport.producerAddress.city || 'Odbiory własne';
    } else if (transport.location === 'Magazyn Białystok') {
      return 'Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      return 'Zielonka';
    }
    return transport.location || 'Nie podano';
  }
  
  // Funkcja pomocnicza do określania miasta dostawy
  const getDeliveryCity = (transport) => {
    return transport.delivery?.city || 'Nie podano';
  }

  // Funkcja pomocnicza do formatowania adresu
  const formatAddress = (address) => {
    if (!address) return 'Brak danych';
    const parts = [];
    if (address.city) parts.push(address.city);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.street) parts.push(address.street);
    return parts.join(', ') || 'Brak danych';
  }

  // Funkcja pomocnicza do pełnego adresu załadunku
  const getFullLoadingAddress = (transport) => {
    if (transport.location === 'Odbiory własne' && transport.producerAddress) {
      return formatAddress(transport.producerAddress);
    } else if (transport.location === 'Magazyn Białystok') {
      return 'Grupa Eltron Sp. z o.o., ul. Wysockiego 69B, 15-169 Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      return 'Grupa Eltron Sp. z o.o., ul. Krótka 2, 05-220 Zielonka';
    }
    return transport.location || 'Nie podano';
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
        'Data zlecenia': formatDate(transport.createdAt),
        'Data realizacji': transport.completedAt ? formatDate(transport.completedAt) : 'Brak',
        'Trasa': `${getLoadingCity(transport)} → ${getDeliveryCity(transport)}`,
        'MPK': transport.mpk || '',
        'Dokumenty': transport.documents || '',
        'Nazwa klienta': transport.clientName || '',
        'Osoba dodająca': transport.createdBy || '',
        'Osoba odpowiedzialna': transport.responsiblePerson || transport.createdBy || '',
        'Przewoźnik': (transport.response?.driverName || '') + ' ' + (transport.response?.driverSurname || ''),
        'Numer auta': transport.response?.vehicleNumber || '',
        'Telefon': transport.response?.driverPhone || '',
        'Cena (PLN)': price,
        'Odległość (km)': distanceKm,
        'Cena za km (PLN/km)': pricePerKm,
        'Kontakt załadunek': transport.loadingContact || '',
        'Kontakt rozładunek': transport.unloadingContact || '',
        'Opis towaru': transport.goodsDescription?.description || '',
        'Waga towaru': transport.goodsDescription?.weight || '',
        'Uwagi': transport.notes || '',
        'Uwagi przewoźnika': transport.response?.adminNotes || ''
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

  // Funkcja do generowania linku do Google Maps
  const generateGoogleMapsLink = (transport) => {
    // Pobierz dane źródłowe i docelowe
    let origin = '';
    let destination = '';
    
    // Ustal miejsce załadunku
    if (transport.location === 'Odbiory własne' && transport.producerAddress) {
      const addr = transport.producerAddress;
      origin = `${addr.city},${addr.postalCode},${addr.street || ''}`;
    } else if (transport.location === 'Magazyn Białystok') {
      origin = 'Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      origin = 'Zielonka';
    }
    
    // Ustal miejsce dostawy
    if (transport.delivery) {
      const addr = transport.delivery;
      destination = `${addr.city},${addr.postalCode},${addr.street || ''}`;
    }
    
    // Jeśli brakuje któregoś z punktów, zwróć pusty string
    if (!origin || !destination) return '';
    
    // Kodowanie URI komponentów
    origin = encodeURIComponent(origin);
    destination = encodeURIComponent(destination);
    
    // Zwróć link do Google Maps
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  };

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
    if (!dateString) return 'Brak daty';
    try {
      return format(new Date(dateString), 'dd.MM.yyyy', { locale: pl });
    } catch (error) {
      console.error("Błąd formatowania daty:", error, dateString);
      return 'Nieprawidłowa data';
    }
  }

  // Formatowanie daty i czasu w jednej linii
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Brak daty';
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: pl });
    } catch (error) {
      console.error("Błąd formatowania daty:", error, dateString);
      return 'Nieprawidłowa data';
    }
  }

  // Funkcja sprawdzająca czy data dostawy została zmieniona
  const isDeliveryDateChanged = (transport) => {
    return transport.response && 
           transport.response.dateChanged === true && 
           transport.response.newDeliveryDate;
  }

  // Funkcja pobierająca aktualną datę dostawy (oryginalną lub zmienioną)
  const getActualDeliveryDate = (transport) => {
    if (isDeliveryDateChanged(transport)) {
      return transport.response.newDeliveryDate;
    }
    return transport.deliveryDate;
  }

  // Renderuje info o odpowiedzialnych budowach
  const renderResponsibleConstructions = (transport) => {
    if (!transport.responsibleConstructions || !transport.responsibleConstructions.length) return null;
    
    return (
      <div className="mt-3">
        <div className="font-medium text-sm text-green-700 mb-2 flex items-center">
          <Building size={14} className="mr-1" />
          Odpowiedzialne budowy:
        </div>
        <div className="flex flex-wrap gap-2">
          {transport.responsibleConstructions.map(construction => (
            <div key={construction.id} className="bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs flex items-center border border-green-200">
              <Building size={12} className="mr-1" />
              {construction.name}
              <span className="ml-1 text-green-600 font-medium">({construction.mpk})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Renderuje info o towarze
  const renderGoodsInfo = (transport) => {
    if (!transport.goodsDescription) return null;
    
    return (
      <div className="mt-3 bg-blue-50 p-3 rounded-md border border-blue-200">
        <div className="flex items-center text-blue-700 font-medium mb-2">
          <ShoppingBag size={16} className="mr-2" />
          Informacje o towarze
        </div>
        {transport.goodsDescription.description && (
          <div className="text-sm mb-2">
            <span className="font-medium">Opis:</span> {transport.goodsDescription.description}
          </div>
        )}
        {transport.goodsDescription.weight && (
          <div className="text-sm flex items-center">
            <Weight size={12} className="mr-1" />
            <span className="font-medium">Waga:</span> {transport.goodsDescription.weight}
          </div>
        )}
      </div>
    );
  };

  // Renderuje info o powiązanych transportach
  const renderConnectedTransports = (transport) => {
    if (!transport.response || !transport.response.connectedTransports || 
        !transport.response.connectedTransports.length) return null;
    
    const connectedTransports = transport.response.connectedTransports;
    
    return (
      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <h4 className="font-medium text-indigo-700 mb-3 flex items-center">
          <Truck size={16} className="mr-2" />
          Powiązane transporty ({connectedTransports.length})
        </h4>
        <div className="space-y-3">
          {connectedTransports.map((ct, index) => (
            <div key={ct.id} className="flex justify-between items-center text-sm bg-white p-3 rounded border border-indigo-100 shadow-sm">
              <div className="flex-1">
                <div className="font-medium">
                  {index+1}. {ct.orderNumber || ct.id} {ct.route && `(${ct.route})`}
                </div>
                <div className="text-xs text-indigo-700 flex items-center mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    ct.type === 'loading' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {ct.type === 'loading' ? 'Załadunek' : 'Rozładunek'}
                  </span>
                  <span className="ml-2">MPK: {ct.mpk}</span>
                  <span className="ml-2">{ct.responsiblePerson || 'Brak'}</span>
                </div>
              </div>
            </div>
          ))}
          
          {transport.response.costPerTransport && (
            <div className="text-sm text-indigo-800 mt-3 pt-3 border-t border-indigo-200 bg-white p-3 rounded shadow-sm">
              <span className="font-medium">Koszt per transport:</span> 
              <span className="ml-1 font-bold">{transport.response.costPerTransport} PLN</span>
              <span className="text-xs text-gray-500 ml-2">
                (całkowity koszt: {transport.response.deliveryPrice} PLN)
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Paginacja
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

  // Zmiana strony
  const paginate = (pageNumber) => setCurrentPage(pageNumber)
  
  const selectStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
  const inputStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"

  // Określanie statusu zamówienia
  const getStatusLabel = () => {
    return { 
      label: 'Zakończone', 
      className: 'bg-green-100 text-green-800 border border-green-300',
      icon: <CheckCircle size={16} className="mr-1" />
    };
  }

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
          Archiwum Spedycji
        </h1>
        <p className="text-gray-600">
          Przeglądaj i filtruj zrealizowane zlecenia spedycyjne z pełnymi informacjami
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

      {/* Lista archiwalnych spedycji - NOWY POPRAWIONY WYGLĄD */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {currentItems.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {currentItems.map((transport) => {
              const statusInfo = getStatusLabel();
              const dateChanged = isDeliveryDateChanged(transport);
              const displayDate = getActualDeliveryDate(transport);
              
              return (
                <div key={transport.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <div 
                    onClick={() => setExpandedRowId(expandedRowId === transport.id ? null : transport.id)}
                    className="p-6 cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                      {/* LEWA STRONA - Główne informacje */}
                      <div className="flex-1 min-w-0">
                        {/* Nagłówek z trasą */}
                        <div className="flex items-center mb-3">
                          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 mr-4 flex-shrink-0">
                            <Truck size={20} />
                          </div>
                          <div className="flex items-center flex-wrap min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 mr-2">
                              {getLoadingCity(transport)}
                            </h3>
                            <ArrowRight size={18} className="mx-2 text-gray-400 flex-shrink-0" />
                            <h3 className="text-lg font-semibold text-gray-900 mr-3">
                              {getDeliveryCity(transport)}
                            </h3>
                            {transport.clientName && (
                              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                                {transport.clientName}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* NOWA SIATKA - tylko kluczowe informacje */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 ml-14">
                          {/* Data dostawy */}
                          <div className="flex items-center text-sm">
                            <Calendar size={16} className="mr-2 text-blue-500 flex-shrink-0" />
                            <div>
                              <div className="text-gray-500 text-xs">Data dostawy</div>
                              <div className="font-medium text-gray-900">
                                {formatDate(displayDate)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Numer zamówienia */}
                          <div className="flex items-center text-sm">
                            <Hash size={16} className="mr-2 text-green-500 flex-shrink-0" />
                            <div>
                              <div className="text-gray-500 text-xs">Nr zamówienia</div>
                              <div className="font-medium text-gray-900">
                                {transport.orderNumber || '-'}
                              </div>
                            </div>
                          </div>
                          
                          {/* MPK */}
                          <div className="flex items-center text-sm">
                            <FileText size={16} className="mr-2 text-purple-500 flex-shrink-0" />
                            <div>
                              <div className="text-gray-500 text-xs">MPK</div>
                              <div className="font-medium text-gray-900">
                                {transport.mpk}
                              </div>
                            </div>
                          </div>
                          
                          {/* Kto dodał */}
                          <div className="flex items-center text-sm">
                            <User size={16} className="mr-2 text-indigo-500 flex-shrink-0" />
                            <div>
                              <div className="text-gray-500 text-xs">Dodane przez</div>
                              <div className="font-medium text-gray-900 truncate">
                                {transport.createdBy || 'Brak'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Odpowiedzialna osoba */}
                          <div className="flex items-center text-sm">
                            <User size={16} className="mr-2 text-orange-500 flex-shrink-0" />
                            <div>
                              <div className="text-gray-500 text-xs">Odpowiedzialny</div>
                              <div className="font-medium text-gray-900 truncate">
                                {transport.responsiblePerson || transport.createdBy || 'Brak'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Odległość i cena */}
                          <div className="flex items-center text-sm">
                            <div className="mr-2 flex-shrink-0">
                              <MapPin size={16} className="text-blue-600" />
                            </div>
                            <div>
                              <div className="text-gray-500 text-xs">Odległość / Cena</div>
                              <div className="font-medium text-gray-900">
                                {transport.distanceKm || transport.response?.distanceKm || 0} km
                                {transport.response?.deliveryPrice && (
                                  <span className="text-green-600 ml-1">
                                    / {transport.response.deliveryPrice} PLN
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Budowy - jeśli istnieją */}
                        {transport.responsibleConstructions && transport.responsibleConstructions.length > 0 && (
                          <div className="mt-3 ml-14">
                            <div className="flex flex-wrap gap-2">
                              {transport.responsibleConstructions.map(construction => (
                                <div key={construction.id} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs flex items-center border border-green-200">
                                  <Building size={12} className="mr-1" />
                                  {construction.name}
                                  <span className="ml-1 text-green-600 font-medium">({construction.mpk})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* PRAWA STRONA - Akcje i status */}
                      <div className="flex items-center space-x-3 ml-6 flex-shrink-0">
                        {/* Status */}
                        <span className={`px-3 py-1 rounded-full text-sm flex items-center ${statusInfo.className}`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                        
                        {/* PRZYCISK CMR - widoczny w widoku zwiniętym */}
                        {transport.response && !transport.response.completedManually && (
                          <button 
                            type="button"
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm font-medium shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateCMR(transport);
                            }}
                            title="Generuj CMR"
                          >
                            <Printer size={14} />
                            CMR
                          </button>
                        )}
                        
                        {/* Przycisk rozwijania */}
                        <button 
                          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedRowId(expandedRowId === transport.id ? null : transport.id)
                          }}
                        >
                          {expandedRowId === transport.id ? (
                            <ChevronUp size={20} className="text-gray-600" />
                          ) : (
                            <ChevronDown size={20} className="text-gray-600" />
                          )}
                        </button>
                        
                        {/* Przycisk usuwania dla admina */}
                        {isAdmin && (
                          <button 
                            type="button"
                            className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransport(transport.id);
                            }}
                          >
                            Usuń
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ROZSZERZONA SEKCJA - uproszczona */}
                  {expandedRowId === transport.id && (
                    <div className="px-6 pb-6 bg-gray-50 border-t border-gray-100">
                      <div className="mt-4 space-y-6">
                        
                        {/* SEKCJA INFORMACJI FINANSOWYCH - większa i ładniejsza */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 shadow-sm">
                          <h4 className="font-semibold mb-4 text-green-800 flex items-center text-lg">
                            <DollarSign size={20} className="mr-2" />
                            Informacje finansowe
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                              <div className="text-sm text-gray-600 mb-1">Odległość</div>
                              <div className="text-2xl font-bold text-gray-900">
                                {transport.distanceKm || transport.response?.distanceKm || 0} 
                                <span className="text-lg text-gray-600 ml-1">km</span>
                              </div>
                            </div>
                            
                            {transport.response?.deliveryPrice && (
                              <>
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                                  <div className="text-sm text-gray-600 mb-1">Cena transportu</div>
                                  <div className="text-2xl font-bold text-green-600">
                                    {transport.response.deliveryPrice}
                                    <span className="text-lg text-gray-600 ml-1">PLN</span>
                                  </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                                  <div className="text-sm text-gray-600 mb-1">Cena za km</div>
                                  <div className="text-2xl font-bold text-blue-600">
                                    {calculatePricePerKm(transport.response.deliveryPrice, transport.distanceKm || transport.response?.distanceKm)}
                                    <span className="text-lg text-gray-600 ml-1">PLN/km</span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Szczegóły załadunku i dostawy */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Szczegóły załadunku */}
                          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h4 className="font-medium mb-4 pb-2 border-b flex items-center text-blue-700">
                              <MapPin size={18} className="mr-2" />
                              Szczegóły załadunku
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div><span className="font-medium text-gray-700">Lokalizacja:</span> <span className="text-gray-900">{transport.location}</span></div>
                              {transport.clientName && transport.location === 'Odbiory własne' && (
                                <div><span className="font-medium text-gray-700">Nazwa firmy:</span> <span className="text-gray-900">{transport.clientName}</span></div>
                              )}
                              <div><span className="font-medium text-gray-700">Adres:</span> <span className="text-gray-900">{getFullLoadingAddress(transport)}</span></div>
                              {transport.location === 'Odbiory własne' && transport.producerAddress?.pinLocation && (
                                <div><span className="font-medium text-gray-700">Pineska mapy:</span> 
                                  <a href={transport.producerAddress.pinLocation} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                                    Zobacz lokalizację
                                  </a>
                                </div>
                              )}
                              <div className="flex items-center">
                                <Phone size={14} className="mr-1 text-green-500" />
                                <span className="font-medium text-gray-700">Kontakt:</span> 
                                <a href={`tel:${transport.loadingContact}`} className="ml-1 text-blue-600 hover:underline">
                                  {transport.loadingContact}
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* Szczegóły dostawy */}
                          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h4 className="font-medium mb-4 pb-2 border-b flex items-center text-green-700">
                              <MapPin size={18} className="mr-2" />
                              Szczegóły dostawy
                            </h4>
                            <div className="space-y-3 text-sm">
                              {transport.clientName && (
                                <div><span className="font-medium text-gray-700">Nazwa firmy:</span> <span className="text-gray-900">{transport.clientName}</span></div>
                              )}
                              <div><span className="font-medium text-gray-700">Adres:</span> <span className="text-gray-900">{formatAddress(transport.delivery)}</span></div>
                              {transport.delivery?.pinLocation && (
                                <div><span className="font-medium text-gray-700">Pineska mapy:</span> 
                                  <a href={transport.delivery.pinLocation} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
                                    Zobacz lokalizację
                                  </a>
                                </div>
                              )}
                              <div className="flex items-center">
                                <Phone size={14} className="mr-1 text-green-500" />
                                <span className="font-medium text-gray-700">Kontakt:</span> 
                                <a href={`tel:${transport.unloadingContact}`} className="ml-1 text-blue-600 hover:underline">
                                  {transport.unloadingContact}
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Link do Google Maps i CMR */}
                        <div className="flex justify-center space-x-4">
                          {generateGoogleMapsLink(transport) && (
                            <a 
                              href={generateGoogleMapsLink(transport)} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-6 py-3 rounded-lg flex items-center transition-colors font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MapPin size={18} className="mr-2" />
                              Zobacz trasę na Google Maps
                            </a>
                          )}
                          
                          {/* Przycisk CMR obok Google Maps */}
                          {transport.response && !transport.response.completedManually && (
                            <button 
                              type="button"
                              className="bg-green-50 hover:bg-green-100 text-green-700 px-6 py-3 rounded-lg flex items-center transition-colors font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateCMR(transport);
                              }}
                            >
                              <FileText size={18} className="mr-2" />
                              Generuj CMR
                            </button>
                          )}
                        </div>

                        {/* Informacje o towarze */}
                        {transport.goodsDescription && (
                          <div>
                            {renderGoodsInfo(transport)}
                          </div>
                        )}

                        {/* Uwagi */}
                        {transport.notes && (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-medium mb-2 text-gray-700 flex items-center">
                              <FileText size={16} className="mr-2" />
                              Uwagi do zlecenia
                            </h4>
                            <p className="text-sm text-gray-600">{transport.notes}</p>
                          </div>
                        )}

                        {/* Informacje o przewoźniku i realizacji */}
                        {transport.response && (
                          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h4 className="font-medium mb-4 pb-2 border-b text-gray-800 flex items-center">
                              <Truck size={18} className="mr-2" />
                              Informacje o realizacji
                            </h4>
                            
                            {/* Renderuj informacje o powiązanych transportach */}
                            {renderConnectedTransports(transport)}
                            
                            {!transport.response.completedManually ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                {/* Informacje o przewoźniku */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <h5 className="text-sm font-medium mb-3 text-blue-600 flex items-center">
                                    <Truck size={14} className="mr-1" />
                                    Dane kierowcy
                                  </h5>
                                  <div className="space-y-2 text-sm">
                                    <div><span className="font-medium">Kierowca:</span> <span>{transport.response.driverName} {transport.response.driverSurname}</span></div>
                                    <div><span className="font-medium">Numer auta:</span> <span>{transport.response.vehicleNumber}</span></div>
                                    <div className="flex items-center">
                                      <Phone size={12} className="mr-1 text-green-500" />
                                      <span className="font-medium">Telefon:</span> 
                                      <a href={`tel:${transport.response.driverPhone}`} className="ml-1 text-blue-600 hover:underline">
                                        {transport.response.driverPhone}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Daty i terminy */}
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <h5 className="text-sm font-medium mb-3 text-orange-600 flex items-center">
                                    <Calendar size={14} className="mr-1" />
                                    Daty i terminy
                                  </h5>
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <span className="font-medium">Data dostawy:</span>
                                      {dateChanged ? (
                                        <div className="mt-1">
                                          <div className="text-xs text-gray-500 line-through">{formatDate(transport.deliveryDate)}</div>
                                          <div className="bg-yellow-50 px-2 py-1 rounded text-yellow-700 flex items-center">
                                            <AlertCircle size={12} className="mr-1" />
                                            {formatDate(transport.response.newDeliveryDate)}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="ml-1">{formatDate(transport.deliveryDate)}</span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-medium">Data zakończenia:</span>
                                      <span className="ml-1">{formatDateTime(transport.completedAt)}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Uwagi przewoźnika */}
                                {transport.response.adminNotes && (
                                  <div className="bg-gray-50 p-4 rounded-lg">
                                    <h5 className="text-sm font-medium mb-3 text-purple-600 flex items-center">
                                      <FileText size={14} className="mr-1" />
                                      Uwagi przewoźnika
                                    </h5>
                                    <div className="text-sm text-gray-600">
                                      {transport.response.adminNotes}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center justify-center py-6">
              <FileText size={48} className="text-gray-400 mb-2" />
              <p className="text-gray-500">Brak transportów spedycyjnych w wybranym okresie</p>
            </div>
          </div>
        )}

        {/* Pagination & Summary */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex flex-col sm:flex-row justify-between items-center">
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
