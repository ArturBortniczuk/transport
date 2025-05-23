'use client'
import React, { useState, useEffect, Fragment } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, FileText, Download, Search, Truck, Package, MapPin, Phone, Calendar, DollarSign, User, Clipboard, ArrowRight, ChevronDown, ChevronUp, AlertCircle, Building, ShoppingBag, Weight, Mail, Hash, Clock, CheckCircle } from 'lucide-react'

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

  // Formatowanie daty z godziną
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
      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-md">
        <h4 className="font-medium text-indigo-700 mb-3 flex items-center">
          <Truck size={16} className="mr-2" />
          Powiązane transporty ({connectedTransports.length})
        </h4>
        <div className="space-y-3">
          {connectedTransports.map((ct, index) => (
            <div key={ct.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-indigo-100">
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
            <div className="text-sm text-indigo-800 mt-3 pt-3 border-t border-indigo-200 bg-white p-2 rounded">
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

      {/* Lista archiwalnych spedycji */}
      <div className="bg-white rounded-lg shadow">
        {currentItems.length > 0 ? (
          <div className="divide-y">
            {currentItems.map((transport) => {
              const statusInfo = getStatusLabel();
              const dateChanged = isDeliveryDateChanged(transport);
              const displayDate = getActualDeliveryDate(transport);
              
              return (
                <div key={transport.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div 
                    onClick={() => setExpandedRowId(expandedRowId === transport.id ? null : transport.id)}
                    className="flex justify-between items-start cursor-pointer"
                  >
                    <div className="flex items-start flex-1">
                      <div className="mr-3 mt-1">
                        <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-700">
                          <Truck size={20} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium flex items-center text-lg mb-2">
                          {getLoadingCity(transport)} 
                          <ArrowRight size={18} className="mx-2 text-gray-500" /> 
                          {getDeliveryCity(transport)}
                          {transport.clientName && (
                            <span className="ml-3 text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              {transport.clientName}
                            </span>
                          )}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="text-sm text-gray-600 flex items-center">
                            <Calendar size={14} className="mr-1 text-blue-500" />
                            <span className="font-medium">Data dostawy:</span>
                            <span className="ml-1">{formatDate(displayDate)}</span>
                          </div>
                          
                          <div className="text-sm text-gray-600 flex items-center">
                            <Hash size={14} className="mr-1 text-green-500" />
                            <span className="font-medium">Nr:</span>
                            <span className="ml-1 font-mono">{transport.orderNumber || '-'}</span>
                          </div>
                          
                          <div className="text-sm text-gray-600 flex items-center">
                            <FileText size={14} className="mr-1 text-purple-500" />
                            <span className="font-medium">MPK:</span>
                            <span className="ml-1 font-mono">{transport.mpk}</span>
                          </div>
                          
                          <div className="text-sm text-gray-600 flex items-center">
                            <User size={14} className="mr-1 text-orange-500" />
                            <span className="font-medium">Odpow.:</span>
                            <span className="ml-1">{transport.responsiblePerson || transport.createdBy || 'Brak'}</span>
                          </div>
                        </div>
                        
                        {/* Druga linia z dodatkowymi informacjami */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                          {transport.response && transport.response.deliveryPrice && (
                            <div className="text-sm flex items-center">
                              <DollarSign size={14} className="mr-1 text-green-600" />
                              <span className="bg-green-50 px-2 py-0.5 rounded font-medium text-green-700">
                                {transport.response.deliveryPrice} PLN
                              </span>
                            </div>
                          )}
                          
                          {(transport.distanceKm || transport.response?.distanceKm) && (
                            <div className="text-sm flex items-center">
                              <MapPin size={14} className="mr-1 text-blue-600" />
                              <span className="bg-blue-50 px-2 py-0.5 rounded font-medium text-blue-700">
                                {transport.distanceKm || transport.response?.distanceKm || 0} km
                              </span>
                            </div>
                          )}
                          
                          <div className="text-sm text-gray-600 flex items-center">
                            <Clock size={14} className="mr-1 text-gray-500" />
                            <span className="font-medium">Utworzono:</span>
                            <span className="ml-1">{formatDate(transport.createdAt)}</span>
                          </div>
                          
                          <div className="text-sm text-gray-600 flex items-center">
                            <CheckCircle size={14} className="mr-1 text-green-500" />
                            <span className="font-medium">Zakończono:</span>
                            <span className="ml-1">{formatDate(transport.completedAt)}</span>
                          </div>
                        </div>
                        
                        {/* Wyświetl informacje o budowach */}
                        {transport.responsibleConstructions && transport.responsibleConstructions.length > 0 && (
                          <div className="mt-2">
                            {renderResponsibleConstructions(transport)}
                          </div>
                        )}
                        
                        {/* Wyświetl informacje o towarze w skrócie */}
                        {transport.goodsDescription && (transport.goodsDescription.description || transport.goodsDescription.weight) && (
                          <div className="mt-2 flex items-center text-sm text-blue-600">
                            <ShoppingBag size={14} className="mr-1" />
                            <span className="font-medium">Towar:</span>
                            {transport.goodsDescription.description && (
                              <span className="ml-1">{transport.goodsDescription.description.substring(0, 50)}{transport.goodsDescription.description.length > 50 ? '...' : ''}</span>
                            )}
                            {transport.goodsDescription.weight && (
                              <span className="ml-2 bg-blue-50 px-2 py-0.5 rounded text-xs">
                                {transport.goodsDescription.weight}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`px-3 py-1 rounded-full text-sm flex items-center ${statusInfo.className}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </span>
                      
                      {expandedRowId === transport.id ? (
                        <button 
                          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedRowId(null)
                          }}
                        >
                          <ChevronUp size={20} />
                        </button>
                      ) : (
                        <button 
                          className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedRowId(transport.id)
                          }}
                        >
                          <ChevronDown size={20} />
                        </button>
                      )}
                      
                      {isAdmin && (
                        <button 
                          type="button"
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
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

                  {expandedRowId === transport.id && (
                    <div className="mt-6 pl-4 border-l-4 border-green-200 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        {/* Sekcja 1: Podstawowe dane zamówienia */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg shadow-sm border border-blue-200">
                          <h4 className="font-medium mb-3 pb-2 border-b border-blue-300 flex items-center text-blue-700">
                            <FileText size={18} className="mr-2" />
                            Dane zamówienia
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Numer zamówienia:</span> <span className="font-mono">{transport.orderNumber || '-'}</span></div>
                            <div><span className="font-medium">MPK:</span> <span className="font-mono">{transport.mpk}</span></div>
                            <div><span className="font-medium">Dokumenty:</span> <span>{transport.documents}</span></div>
                            {transport.clientName && (
                              <div><span className="font-medium">Nazwa klienta:</span> <span>{transport.clientName}</span></div>
                            )}
                            <div><span className="font-medium">Status:</span> 
                              <span className="ml-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                                Zakończone
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sekcja 2: Osoby i odpowiedzialność */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg shadow-sm border border-green-200">
                          <h4 className="font-medium mb-3 pb-2 border-b border-green-300 flex items-center text-green-700">
                            <User size={18} className="mr-2" />
                            Osoby odpowiedzialne
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Dodane przez:</span> <span>{transport.createdBy || 'Nie podano'}</span></div>
                            {transport.createdByEmail && (
                              <div className="flex items-center">
                                <Mail size={12} className="mr-1 text-gray-500" />
                                <span className="text-xs text-gray-600">{transport.createdByEmail}</span>
                              </div>
                            )}
                            <div><span className="font-medium">Odpowiedzialny:</span> <span>{transport.responsiblePerson || transport.createdBy || 'Nie podano'}</span></div>
                            {transport.responsibleEmail && transport.responsibleEmail !== transport.createdByEmail && (
                              <div className="flex items-center">
                                <Mail size={12} className="mr-1 text-gray-500" />
                                <span className="text-xs text-gray-600">{transport.responsibleEmail}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Informacje o budowach */}
                          {transport.responsibleConstructions && transport.responsibleConstructions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-green-300">
                              {renderResponsibleConstructions(transport)}
                            </div>
                          )}
                        </div>

                        {/* Sekcja 3: Daty i terminy */}
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow-sm border border-purple-200">
                          <h4 className="font-medium mb-3 pb-2 border-b border-purple-300 flex items-center text-purple-700">
                            <Calendar size={18} className="mr-2" />
                            Daty i terminy
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Data utworzenia:</span> <span>{formatDateTime(transport.createdAt)}</span></div>
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
                            <div><span className="font-medium">Data zakończenia:</span> <span>{formatDateTime(transport.completedAt)}</span></div>
                          </div>
                        </div>

                        {/* Sekcja 4: Informacje finansowe */}
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg shadow-sm border border-orange-200">
                          <h4 className="font-medium mb-3 pb-2 border-b border-orange-300 flex items-center text-orange-700">
                            <DollarSign size={18} className="mr-2" />
                            Informacje finansowe
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Odległość:</span> 
                              <span className="ml-1 bg-blue-50 px-2 py-0.5 rounded font-medium text-blue-700">
                                {transport.distanceKm || transport.response?.distanceKm || 0} km
                              </span>
                            </div>
                            {transport.response && transport.response.deliveryPrice && (
                              <>
                                <div><span className="font-medium">Cena transportu:</span> 
                                  <span className="ml-1 bg-green-50 px-2 py-0.5 rounded font-medium text-green-700">
                                    {transport.response.deliveryPrice} PLN
                                  </span>
                                </div>
                                <div><span className="font-medium">Cena za km:</span> 
                                  <span className="ml-1 bg-green-50 px-2 py-0.5 rounded font-medium text-green-700">
                                    {calculatePricePerKm(transport.response.deliveryPrice, transport.distanceKm || transport.response?.distanceKm)} PLN/km
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sekcja szczegółów załadunku i dostawy */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Szczegóły załadunku */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                          <h4 className="font-medium mb-3 pb-2 border-b flex items-center text-blue-700">
                            <MapPin size={18} className="mr-2" />
                            Szczegóły załadunku
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Lokalizacja:</span> <span>{transport.location}</span></div>
                            {transport.location === 'Odbiory własne' && transport.producerAddress ? (
                              <>
                                <div><span className="font-medium">Adres:</span> <span>{formatAddress(transport.producerAddress)}</span></div>
                                {transport.producerAddress.pinLocation && (
                                  <div><span className="font-medium">Pineska mapy:</span> 
                                    <a href={transport.producerAddress.pinLocation} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:underline">
                                      Zobacz lokalizację
                                    </a>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div><span className="font-medium">Adres:</span> <span>{transport.location}</span></div>
                            )}
                            <div className="flex items-center">
                              <Phone size={14} className="mr-1 text-green-500" />
                              <span className="font-medium">Kontakt:</span> 
                              <a href={`tel:${transport.loadingContact}`} className="ml-1 text-blue-500 hover:underline">
                                {transport.loadingContact}
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Szczegóły dostawy */}
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                          <h4 className="font-medium mb-3 pb-2 border-b flex items-center text-green-700">
                            <MapPin size={18} className="mr-2" />
                            Szczegóły dostawy
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Adres:</span> <span>{formatAddress(transport.delivery)}</span></div>
                            {transport.delivery?.pinLocation && (
                              <div><span className="font-medium">Pineska mapy:</span> 
                                <a href={transport.delivery.pinLocation} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:underline">
                                  Zobacz lokalizację
                                </a>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Phone size={14} className="mr-1 text-green-500" />
                              <span className="font-medium">Kontakt:</span> 
                              <a href={`tel:${transport.unloadingContact}`} className="ml-1 text-blue-500 hover:underline">
                                {transport.unloadingContact}
                              </a>
                            </div>
                          </div>
                          
                          {/* Link do Google Maps */}
                          {generateGoogleMapsLink(transport) && (
                            <div className="mt-3">
                              <a 
                                href={generateGoogleMapsLink(transport)} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md flex items-center w-fit transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MapPin size={16} className="mr-2" />
                                Zobacz trasę na Google Maps
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Informacje o towarze */}
                      {transport.goodsDescription && (
                        <div className="mb-6">
                          {renderGoodsInfo(transport)}
                        </div>
                      )}

                      {/* Uwagi */}
                      {transport.notes && (
                        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <h4 className="font-medium mb-2 text-gray-700 flex items-center">
                            <FileText size={16} className="mr-2" />
                            Uwagi do zlecenia
                          </h4>
                          <p className="text-sm text-gray-600">{transport.notes}</p>
                        </div>
                      )}

                      {/* Szczegóły realizacji */}
                      {transport.response && (
                        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                          <h4 className="font-medium mb-4 pb-2 border-b border-gray-300 flex items-center text-gray-800">
                            <Truck size={18} className="mr-2" />
                            Szczegóły realizacji transportu
                          </h4>
                          
                          {/* Renderuj informacje o powiązanych transportach */}
                          {renderConnectedTransports(transport)}
                          
                          {transport.response.completedManually ? (
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-md border border-blue-200 flex items-center">
                              <Clipboard size={18} className="mr-2" />
                              <div>
                                <div className="font-medium">Zakończone ręcznie przez administratora</div>
                                <div className="text-sm mt-1">
                                  Zakończone przez: {transport.response.completedBy} | 
                                  Data: {formatDateTime(transport.response.completedAt)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Informacje o przewoźniku */}
                              <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
                                <h5 className="text-sm font-medium mb-3 pb-1 border-b flex items-center text-blue-600">
                                  <User size={14} className="mr-1" />
                                  Dane przewoźnika
                                </h5>
                                <div className="space-y-2 text-sm">
                                  <div><span className="font-medium">Kierowca:</span> <span>{transport.response.driverName} {transport.response.driverSurname}</span></div>
                                  <div className="flex items-center">
                                    <Phone size={12} className="mr-1 text-green-500" />
                                    <span className="font-medium">Telefon:</span> 
                                    <a href={`tel:${transport.response.driverPhone}`} className="ml-1 text-blue-500 hover:underline">
                                      {transport.response.driverPhone}
                                    </a>
                                  </div>
                                  <div><span className="font-medium">Numer auta:</span> <span className="font-mono">{transport.response.vehicleNumber}</span></div>
                                </div>
                              </div>
                              
                              {/* Informacje o kosztach */}
                              <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
                                <h5 className="text-sm font-medium mb-3 pb-1 border-b flex items-center text-green-600">
                                  <DollarSign size={14} className="mr-1" />
                                  Dane finansowe
                                </h5>
                                <div className="space-y-2 text-sm">
                                  <div><span className="font-medium">Cena:</span> 
                                    <span className="ml-1 bg-green-50 px-2 py-0.5 rounded font-medium text-green-700">
                                      {transport.response.deliveryPrice} PLN
                                    </span>
                                  </div>
                                  <div><span className="font-medium">Odległość:</span> <span>{transport.distanceKm || transport.response?.distanceKm || 'N/A'} km</span></div>
                                  {(transport.distanceKm || transport.response?.distanceKm) > 0 && transport.response.deliveryPrice > 0 && (
                                    <div><span className="font-medium">Koszt za km:</span> 
                                      <span className="ml-1 bg-green-50 px-2 py-0.5 rounded font-medium text-green-700">
                                        {calculatePricePerKm(transport.response.deliveryPrice, transport.distanceKm || transport.response?.distanceKm)} PLN/km
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Informacje o realizacji */}
                              <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
                                <h5 className="text-sm font-medium mb-3 pb-1 border-b flex items-center text-purple-600">
                                  <Calendar size={14} className="mr-1" />
                                  Informacje o realizacji
                                </h5>
                                <div className="space-y-2 text-sm">
                                  <div><span className="font-medium">Data odpowiedzi:</span> <span>{formatDateTime(transport.completedAt || transport.createdAt)}</span></div>
                                  
                                  {transport.response.dateChanged && (
                                    <div className="bg-yellow-50 p-2 rounded-md border border-yellow-200">
                                      <div className="font-medium text-yellow-800 text-xs flex items-center">
                                        <AlertCircle size={12} className="mr-1" />
                                        Zmieniono datę dostawy
                                      </div>
                                      <div className="text-xs mt-1">
                                        <div>Z: <span className="line-through">{formatDate(transport.response.originalDeliveryDate)}</span></div>
                                        <div>Na: <span className="font-medium">{formatDate(transport.response.newDeliveryDate)}</span></div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {transport.response.adminNotes && (
                                    <div className="bg-gray-50 p-2 rounded border">
                                      <div className="font-medium text-xs text-gray-700">Uwagi przewoźnika:</div>
                                      <div className="text-xs mt-1">{transport.response.adminNotes}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
