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

  // Funkcja pomocnicza do określania nazwy firmy załadunku
  const getLoadingCompanyName = (transport) => {
    if (transport.location === 'Odbiory własne' && transport.sourceClientName) {
      return transport.sourceClientName;
    } else if (transport.location === 'Magazyn Białystok') {
      return 'Magazyn Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      return 'Magazyn Zielonka';
    }
    return transport.location || 'Nie podano';
  }

  // Funkcja pomocnicza do określania nazwy firmy rozładunku
  const getUnloadingCompanyName = (transport) => {
    return transport.clientName || 'Nie podano';
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

  // NOWA FUNKCJA: Pobieranie danych towaru z zlecenia transportowego
  const getGoodsDataFromTransportOrder = (transport) => {
    // 1. Priorytet dla nowej kolumny `goods_description`
    if (transport.goodsDescription) {
      const desc = transport.goodsDescription.description || '';
      const weight = transport.goodsDescription.weight || '';
      // Zwróć dane, jeśli którekolwiek z pól jest wypełnione
      if (desc || weight) {
          return {
              description: desc,
              weight: weight
          };
      }
    }
    
    // 2. Fallback do starszego pola `order_data`
    if (transport.order_data) {
      try {
        const orderData = typeof transport.order_data === 'string' 
          ? JSON.parse(transport.order_data) 
          : transport.order_data;
        
        // Zwróć dane, jeśli którekolwiek z pól jest wypełnione
        if (orderData.towar || orderData.waga) {
          return {
            description: orderData.towar || '',
            weight: orderData.waga || ''
          };
        }
      } catch (error) {
        console.error('Błąd parsowania order_data:', error);
      }
    }
    
    // 3. Jeśli nigdzie nie ma danych, zwróć puste wartości
    return { description: '', weight: '' };
  }
  // NOWA FUNKCJA: Pobieranie odpowiedzialnego (osoba lub budowa)
  const getResponsibleInfo = (transport) => {
    // Jeśli są odpowiedzialne budowy, zwróć pierwszą budowę
    if (transport.responsibleConstructions && transport.responsibleConstructions.length > 0) {
      const construction = transport.responsibleConstructions[0];
      return {
        name: construction.name,
        type: 'construction',
        mpk: construction.mpk || ''
      };
    }
    
    // W przeciwnym razie zwróć osobę odpowiedzialną
    return {
      name: transport.responsiblePerson || transport.createdBy || 'Brak',
      type: 'person',
      mpk: transport.mpk || ''
    };
  }

  // NOWA FUNKCJA: Pobieranie aktualnego MPK (z budowy lub transportu)
  const getCurrentMPK = (transport) => {
    // Jeśli są odpowiedzialne budowy, użyj MPK z pierwszej budowy
    if (transport.responsibleConstructions && transport.responsibleConstructions.length > 0) {
      return transport.responsibleConstructions[0].mpk || transport.mpk || '';
    }
    
    // W przeciwnym razie użyj MPK z transportu
    return transport.mpk || '';
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
      
      // Filtrowanie po MPK - użyj funkcji getCurrentMPK
      if (mpkValue) {
        const currentMPK = getCurrentMPK(transport);
        if (!currentMPK.toLowerCase().includes(mpkValue.toLowerCase())) {
          return false;
        }
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
  
// NOWA ZAAWANSOWANA FUNKCJA EKSPORTU - zastąp obecną funkcję exportData
  const exportData = () => {
    if (filteredArchiwum.length === 0) {
      alert('Brak danych do eksportu')
      return
    }
    
    // Funkcja obliczania kosztu spedycji (można dostosować własne stawki)
    const calculateSpedycjaCost = (price, distance) => {
      // Jeśli mamy cenę z odpowiedzi przewoźnika, użyj jej
      if (price && price > 0) return price;
      
      // W przeciwnym razie użyj standardowych stawek (można je dostosować)
      if (distance <= 100) {
        return distance * 15; // 15 PLN za km do 100km
      } else if (distance > 100 && distance <= 200) {
        return distance * 12; // 12 PLN za km od 100-200km
      } else {
        return distance * 10; // 10 PLN za km powyżej 200km
      }
    };

    // Przygotowanie głównych danych do eksportu
    const dataToExport = filteredArchiwum.map(transport => {
      const distanceKm = transport.response?.distanceKm || transport.distanceKm || 0
      const price = transport.response?.deliveryPrice || 0
      const calculatedCost = calculateSpedycjaCost(price, distanceKm)
      const pricePerKm = calculatePricePerKm(price || calculatedCost, distanceKm)
      const responsibleInfo = getResponsibleInfo(transport)
      const goodsData = getGoodsDataFromTransportOrder(transport)
      
      return {
        'Data zlecenia': formatDate(transport.createdAt),
        'Data realizacji': transport.completedAt ? formatDate(transport.completedAt) : 'Brak',
        'Numer zamówienia': transport.orderNumber || '',
        'Tydzień': `${format(new Date(transport.completedAt || transport.createdAt), 'yyyy')}-T${format(new Date(transport.completedAt || transport.createdAt), 'I', { locale: pl })}`,
        'Trasa': `${getLoadingCity(transport)} → ${getDeliveryCity(transport)}`,
        'Załadunek - miasto': getLoadingCity(transport),
        'Załadunek - firma': getLoadingCompanyName(transport),
        'Rozładunek - miasto': getDeliveryCity(transport),
        'Rozładunek - firma': getUnloadingCompanyName(transport),
        'MPK': getCurrentMPK(transport),
        'Dokumenty': transport.documents || '',
        'Nazwa klienta': transport.clientName || '',
        'Osoba dodająca': transport.createdBy || '',
        'Osoba odpowiedzialna': responsibleInfo.name,
        'Typ odpowiedzialnego': responsibleInfo.type === 'construction' ? 'Budowa' : 'Osoba',
        'Przewoźnik': (transport.response?.driverName || '') + ' ' + (transport.response?.driverSurname || ''),
        'Numer auta': transport.response?.vehicleNumber || '',
        'Telefon przewoźnika': transport.response?.driverPhone || '',
        'Cena rzeczywista (PLN)': price || '',
        'Cena obliczona (PLN)': calculatedCost.toFixed(2).replace('.', ','),
        'Odległość (km)': distanceKm,
        'Cena za km (PLN/km)': pricePerKm,
        'Kontakt załadunek': transport.loadingContact || '',
        'Kontakt rozładunek': transport.unloadingContact || '',
        'Opis towaru': goodsData.description,
        'Waga towaru': goodsData.weight,
        'Uwagi zlecenia': transport.notes || '',
        'Uwagi przewoźnika': transport.response?.adminNotes || '',
        'Status': transport.status === 'completed' ? 'Zakończony' : transport.status
      }
    })
    
    // Przygotuj nazwę pliku
    const monthLabel = selectedMonth === 'all' ? 
                      'wszystkie_miesiace' : 
                      months.find(m => m.value === selectedMonth)?.label.toLowerCase() || selectedMonth
    
    const fileName = `spedycja_${selectedYear}_${monthLabel}_${format(new Date(), 'yyyy-MM-dd')}`
    
    if (exportFormat === 'csv') {
      exportToCSV(dataToExport, fileName)
    } else {
      // ===== TWORZENIE WIELU ARKUSZY =====
      
      // 1. PODSUMOWANIE PO MPK
      const summaryByMpk = filteredArchiwum.reduce((acc, transport) => {
        const mpk = getCurrentMPK(transport) || 'Brak MPK';
        const distance = transport.response?.distanceKm || transport.distanceKm || 0;
        const price = transport.response?.deliveryPrice || 0;
        const cost = calculateSpedycjaCost(price, distance);
        
        if (!acc[mpk]) {
          acc[mpk] = { 
            totalCost: 0, 
            totalDistance: 0, 
            count: 0,
            totalRealPrice: 0
          };
        }
        
        acc[mpk].totalCost += cost;
        acc[mpk].totalDistance += distance;
        acc[mpk].count += 1;
        acc[mpk].totalRealPrice += (price || 0);
        
        return acc;
      }, {});

      const summaryDataMpk = Object.keys(summaryByMpk).map(mpk => ({
        'MPK': mpk,
        'Liczba transportów': summaryByMpk[mpk].count,
        'Łączna odległość (km)': summaryByMpk[mpk].totalDistance,
        'Łączny koszt obliczony (PLN)': summaryByMpk[mpk].totalCost.toFixed(2).replace('.', ','),
        'Łączna cena rzeczywista (PLN)': summaryByMpk[mpk].totalRealPrice.toFixed(2).replace('.', ','),
        'Średni koszt za transport (PLN)': (summaryByMpk[mpk].totalCost / summaryByMpk[mpk].count).toFixed(2).replace('.', ',')
      }));

      // 2. PODSUMOWANIE PO TYGODNIACH
      const summaryByWeek = filteredArchiwum.reduce((acc, transport) => {
        const weekKey = `${format(new Date(transport.completedAt || transport.createdAt), 'yyyy')}-T${format(new Date(transport.completedAt || transport.createdAt), 'I', { locale: pl })}`;
        const distance = transport.response?.distanceKm || transport.distanceKm || 0;
        const price = transport.response?.deliveryPrice || 0;
        const cost = calculateSpedycjaCost(price, distance);
        
        if (!acc[weekKey]) {
          acc[weekKey] = { 
            totalCost: 0, 
            totalDistance: 0, 
            count: 0,
            totalRealPrice: 0,
            weekStart: format(new Date(transport.completedAt || transport.createdAt), 'dd.MM.yyyy', { locale: pl })
          };
        }
        
        acc[weekKey].totalCost += cost;
        acc[weekKey].totalDistance += distance;
        acc[weekKey].count += 1;
        acc[weekKey].totalRealPrice += (price || 0);
        
        return acc;
      }, {});

      const summaryDataWeek = Object.keys(summaryByWeek)
        .sort()
        .map(week => ({
          'Tydzień': week,
          'Data początkowa': summaryByWeek[week].weekStart,
          'Liczba transportów': summaryByWeek[week].count,
          'Łączna odległość (km)': summaryByWeek[week].totalDistance,
          'Łączny koszt obliczony (PLN)': summaryByWeek[week].totalCost.toFixed(2).replace('.', ','),
          'Łączna cena rzeczywista (PLN)': summaryByWeek[week].totalRealPrice.toFixed(2).replace('.', ','),
          'Średni koszt za transport (PLN)': (summaryByWeek[week].totalCost / summaryByWeek[week].count).toFixed(2).replace('.', ',')
        }));

      // 3. PODSUMOWANIE PO PRZEWOŹNIKACH
      const summaryByCarrier = filteredArchiwum.reduce((acc, transport) => {
        const carrierName = ((transport.response?.driverName || '') + ' ' + (transport.response?.driverSurname || '')).trim() || 'Nieznany przewoźnik';
        const distance = transport.response?.distanceKm || transport.distanceKm || 0;
        const price = transport.response?.deliveryPrice || 0;
        const cost = calculateSpedycjaCost(price, distance);
        
        if (!acc[carrierName]) {
          acc[carrierName] = { 
            totalCost: 0, 
            totalDistance: 0, 
            count: 0,
            totalRealPrice: 0,
            phone: transport.response?.driverPhone || '',
            vehicle: transport.response?.vehicleNumber || ''
          };
        }
        
        acc[carrierName].totalCost += cost;
        acc[carrierName].totalDistance += distance;
        acc[carrierName].count += 1;
        acc[carrierName].totalRealPrice += (price || 0);
        
        return acc;
      }, {});

      const summaryDataCarrier = Object.keys(summaryByCarrier).map(carrier => ({
        'Przewoźnik': carrier,
        'Telefon': summaryByCarrier[carrier].phone,
        'Pojazd': summaryByCarrier[carrier].vehicle,
        'Liczba transportów': summaryByCarrier[carrier].count,
        'Łączna odległość (km)': summaryByCarrier[carrier].totalDistance,
        'Łączny koszt obliczony (PLN)': summaryByCarrier[carrier].totalCost.toFixed(2).replace('.', ','),
        'Łączna cena rzeczywista (PLN)': summaryByCarrier[carrier].totalRealPrice.toFixed(2).replace('.', ','),
        'Średni koszt za transport (PLN)': (summaryByCarrier[carrier].totalCost / summaryByCarrier[carrier].count).toFixed(2).replace('.', ',')
      }));

      // Eksport do Excel z wieloma arkuszami
      exportToXLSXWithMultipleSheets(dataToExport, summaryDataMpk, summaryDataWeek, summaryDataCarrier, fileName)
    }
  }

  // NOWA FUNKCJA - Eksport do Excel z wieloma arkuszami
  const exportToXLSXWithMultipleSheets = (mainData, summaryMpk, summaryWeek, summaryCarrier, fileName) => {
    const wb = XLSX.utils.book_new();
    
    // Arkusz 1: Wszystkie transporty
    const ws_main = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws_main, "Wszystkie transporty");
    
    // Arkusz 2: Podsumowanie po MPK
    const ws_mpk = XLSX.utils.json_to_sheet(summaryMpk);
    XLSX.utils.book_append_sheet(wb, ws_mpk, "Podsumowanie po MPK");
    
    // Arkusz 3: Podsumowanie po tygodniach
    const ws_week = XLSX.utils.json_to_sheet(summaryWeek);
    XLSX.utils.book_append_sheet(wb, ws_week, "Podsumowanie po tygodniach");
    
    // Arkusz 4: Podsumowanie po przewoźnikach
    const ws_carrier = XLSX.utils.json_to_sheet(summaryCarrier);
    XLSX.utils.book_append_sheet(wb, ws_carrier, "Podsumowanie po przewoźnikach");
    
    XLSX.writeFile(wb, `${fileName}.xlsx`);
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

  // Paginacja
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

  // Zmiana strony
  const paginate = (pageNumber) => setCurrentPage(pageNumber)
  
  const selectStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
  const inputStyles = "block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"

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
          <div className="divide-y divide-gray-200">
            {currentItems.map((transport) => {
              const dateChanged = isDeliveryDateChanged(transport);
              const displayDate = getActualDeliveryDate(transport);
              const responsibleInfo = getResponsibleInfo(transport);
              const currentMPK = getCurrentMPK(transport);
              
              return (
                <div key={transport.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div 
                    onClick={() => setExpandedRowId(expandedRowId === transport.id ? null : transport.id)}
                    className="flex justify-between items-start cursor-pointer"
                  >
                    <div className="flex-1">
                      {/* Główny nagłówek z miejscami załadunku i rozładunku */}
                      <div className="mb-3">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center mb-2">
                          <span className="flex items-center">
                            {getLoadingCity(transport).toUpperCase()}
                            <span className="ml-2 text-sm font-medium text-gray-600">
                              ({getLoadingCompanyName(transport)})
                            </span>
                          </span>
                          <ArrowRight size={20} className="mx-3 text-gray-500" /> 
                          <span className="flex items-center">
                            {getDeliveryCity(transport).toUpperCase()}
                            <span className="ml-2 text-sm font-medium text-gray-600">
                              ({getUnloadingCompanyName(transport)})
                            </span>
                          </span>
                        </h3>
                      </div>

                      {/* Informacje w trzech ramkach */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
                          <Hash size={16} className="mr-2 text-blue-600" />
                          <div>
                            <span className="text-xs font-medium text-blue-700 block">Nr zamówienia</span>
                            <span className="font-semibold text-gray-900">{transport.orderNumber || '-'}</span>
                          </div>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center">
                          <FileText size={16} className="mr-2 text-purple-600" />
                          <div>
                            <span className="text-xs font-medium text-purple-700 block">MPK</span>
                            <span className="font-semibold text-gray-900">{currentMPK}</span>
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center">
                          {responsibleInfo.type === 'construction' ? (
                            <Building size={16} className="mr-2 text-orange-600" />
                          ) : (
                            <User size={16} className="mr-2 text-orange-600" />
                          )}
                          <div>
                            <span className="text-xs font-medium text-orange-700 block">
                              {responsibleInfo.type === 'construction' ? 'Budowa' : 'Odpowiedzialny'}
                            </span>
                            <span className="font-semibold text-gray-900 text-sm">{responsibleInfo.name}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Wyświetl informacje o budowach jeśli istnieją */}
                      {transport.responsibleConstructions && transport.responsibleConstructions.length > 1 && (
                        <div className="mt-3">
                          {renderResponsibleConstructions(transport)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 ml-6">
                      {/* Przycisk rozwinięcia */}
                      <button 
                        className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {expandedRowId === transport.id ? (
                          <ChevronUp size={24} className="text-gray-600" />
                        ) : (
                          <ChevronDown size={24} className="text-gray-600" />
                        )}
                      </button>
                      
                      {/* Przycisk usuwania dla admina */}
                      {isAdmin && (
                        <button 
                          type="button"
                          className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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

                  {/* Rozwinięty widok szczegółów */}
                  {expandedRowId === transport.id && (
                    <div className="mt-8 border-t border-gray-200 pt-6">
                      {/* NOWY LAYOUT: Dwa rzędy po trzy panele */}
                      
                      {/* PIERWSZY RZĄD: Dane zamówienia, Dane przewoźnika, Dane o towarze */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {/* Panel 1: Dane zamówienia */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl shadow-sm border border-blue-200">
                          <h4 className="font-bold text-blue-700 mb-4 pb-2 border-b border-blue-300 flex items-center text-lg">
                            <FileText size={20} className="mr-2" />
                            Dane zamówienia
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Numer zamówienia:</span>
                              <div className="font-semibold text-gray-900">{transport.orderNumber || '-'}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">MPK:</span>
                              <div className="font-semibold text-gray-900">{currentMPK}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Dokumenty:</span>
                              <div className="font-semibold text-gray-900">{transport.documents}</div>
                            </div>
                            {transport.clientName && (
                              <div>
                                <span className="font-medium text-gray-700">Nazwa klienta:</span>
                                <div className="font-semibold text-gray-900">{transport.clientName}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Panel 2: Dane przewoźnika */}
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl shadow-sm border border-purple-200">
                          <h4 className="font-bold text-purple-700 mb-4 pb-2 border-b border-purple-300 flex items-center text-lg">
                            <Truck size={20} className="mr-2" />
                            Dane przewoźnika
                          </h4>
                          {transport.response && transport.response.driverName ? (
                            <div className="space-y-3 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">Kierowca:</span>
                                <div className="font-semibold text-gray-900">
                                  {transport.response.driverName} {transport.response.driverSurname}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Numer auta:</span>
                                <div className="font-semibold text-gray-900">{transport.response.vehicleNumber}</div>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">Telefon:</span>
                                <div className="font-semibold text-blue-600">
                                  <a href={`tel:${transport.response.driverPhone}`} className="hover:underline">
                                    {transport.response.driverPhone}
                                  </a>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 italic">
                              Brak danych o przewoźniku
                            </div>
                          )}
                        </div>

                        {/* Panel 3: Dane o towarze */}
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-xl shadow-sm border border-amber-200">
                          <h4 className="font-bold text-amber-700 mb-4 pb-2 border-b border-amber-300 flex items-center text-lg">
                            <ShoppingBag size={20} className="mr-2" />
                            Dane o towarze
                          </h4>
                          {(() => {
                            const goodsData = getGoodsDataFromTransportOrder(transport);
                            
                            if (!goodsData.description && !goodsData.weight) {
                              return (
                                <div className="text-sm text-gray-500 italic">
                                  Brak danych o towarze
                                </div>
                              );
                            }
                            
                            return (
                              <div className="space-y-3 text-sm">
                                {goodsData.description && (
                                  <div>
                                    <span className="font-medium text-gray-700">Rodzaj towaru:</span>
                                    <div className="font-semibold text-gray-900">{goodsData.description}</div>
                                  </div>
                                )}
                                {goodsData.weight && (
                                  <div>
                                    <span className="font-medium text-gray-700">Waga:</span>
                                    <div className="font-semibold text-gray-900 flex items-center">
                                      <Weight size={14} className="mr-1" />
                                      {goodsData.weight}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* DRUGI RZĄD: Osoby odpowiedzialne, Daty i terminy, Informacje finansowe */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Panel 4: Osoby odpowiedzialne */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl shadow-sm border border-green-200">
                          <h4 className="font-bold text-green-700 mb-4 pb-2 border-b border-green-300 flex items-center text-lg">
                            <User size={20} className="mr-2" />
                            Osoby odpowiedzialne
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Dodane przez:</span>
                              <div className="font-semibold text-gray-900">{transport.createdBy || 'Nie podano'}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Odpowiedzialny:</span>
                              <div className="font-semibold text-gray-900 flex items-center">
                                {responsibleInfo.type === 'construction' ? (
                                  <Building size={14} className="mr-1 text-green-600" />
                                ) : (
                                  <User size={14} className="mr-1 text-green-600" />
                                )}
                                {responsibleInfo.name}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {responsibleInfo.type === 'construction' ? 'Budowa' : 'Osoba'}
                              </div>
                            </div>
                            {transport.responsibleConstructions && transport.responsibleConstructions.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700">Wszystkie budowy:</span>
                                <div className="mt-1">
                                  {transport.responsibleConstructions.map(construction => (
                                    <div key={construction.id} className="bg-green-200 text-green-800 px-2 py-1 rounded text-xs font-medium inline-block mr-1 mb-1">
                                      {construction.name} ({construction.mpk})
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Panel 5: Daty i terminy */}
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl shadow-sm border border-orange-200">
                          <h4 className="font-bold text-orange-700 mb-4 pb-2 border-b border-orange-300 flex items-center text-lg">
                            <Calendar size={20} className="mr-2" />
                            Daty i terminy
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Data dostawy:</span>
                              <div className="font-semibold text-gray-900">
                                {dateChanged ? (
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-500 line-through">
                                      {formatDate(transport.deliveryDate)}
                                    </div>
                                    <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs flex items-center">
                                      <AlertCircle size={12} className="mr-1" />
                                      {formatDate(transport.response.newDeliveryDate)}
                                    </div>
                                  </div>
                                ) : (
                                  formatDate(transport.deliveryDate)
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Data utworzenia:</span>
                              <div className="font-semibold text-gray-900">{formatDate(transport.createdAt)}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Data zakończenia:</span>
                              <div className="font-semibold text-gray-900">{formatDateTime(transport.completedAt)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Panel 6: Informacje finansowe */}
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 rounded-xl shadow-sm border border-emerald-200">
                          <h4 className="font-bold text-emerald-700 mb-4 pb-2 border-b border-emerald-300 flex items-center text-lg">
                            <DollarSign size={20} className="mr-2" />
                            Informacje finansowe
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Odległość:</span>
                              <div className="font-semibold text-gray-900">
                                {transport.distanceKm || transport.response?.distanceKm || 0} km
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Cena transportu:</span>
                              <div className="font-semibold text-gray-900">
                                {transport.response?.deliveryPrice ? `${transport.response.deliveryPrice} PLN` : 'Brak danych'}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Cena za kilometr:</span>
                              <div className="font-semibold text-gray-900">
                                {transport.response?.deliveryPrice ? 
                                  `${calculatePricePerKm(transport.response.deliveryPrice, transport.distanceKm || transport.response?.distanceKm)} PLN/km` : 
                                  'Brak danych'
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Panel z miejscami załadunku i rozładunku */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Miejsce załadunku */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                          <h4 className="font-bold text-blue-700 mb-4 pb-3 border-b border-gray-200 flex items-center text-lg">
                            <MapPin size={20} className="mr-2" />
                            Miejsce załadunku
                          </h4>
                          <div className="space-y-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Nazwa firmy:</span>
                              <div className="font-semibold text-gray-900 text-base">{getLoadingCompanyName(transport)}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Adres:</span>
                              <div className="font-semibold text-gray-900">{getFullLoadingAddress(transport)}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Kontakt:</span>
                              <div className="font-semibold text-blue-600">
                                <a href={`tel:${transport.loadingContact}`} className="hover:underline flex items-center">
                                  <Phone size={14} className="mr-1" />
                                  {transport.loadingContact}
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Miejsce rozładunku */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                          <h4 className="font-bold text-green-700 mb-4 pb-3 border-b border-gray-200 flex items-center text-lg">
                            <MapPin size={20} className="mr-2" />
                            Miejsce rozładunku
                          </h4>
                          <div className="space-y-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Nazwa firmy:</span>
                              <div className="font-semibold text-gray-900 text-base">{getUnloadingCompanyName(transport)}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Adres:</span>
                              <div className="font-semibold text-gray-900">{formatAddress(transport.delivery)}</div>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Kontakt:</span>
                              <div className="font-semibold text-blue-600">
                                <a href={`tel:${transport.unloadingContact}`} className="hover:underline flex items-center">
                                  <Phone size={14} className="mr-1" />
                                  {transport.unloadingContact}
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Uwagi */}
                      {(transport.notes || transport.response?.adminNotes) && (
                        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <h4 className="font-bold text-gray-700 mb-3 flex items-center">
                            <FileText size={18} className="mr-2" />
                            Uwagi
                          </h4>
                          {transport.notes && (
                            <div className="mb-2">
                              <span className="font-medium text-gray-700">Uwagi zlecenia:</span>
                              <p className="text-gray-900 mt-1">{transport.notes}</p>
                            </div>
                          )}
                          {transport.response?.adminNotes && (
                            <div>
                              <span className="font-medium text-gray-700">Uwagi przewoźnika:</span>
                              <p className="text-gray-900 mt-1">{transport.response.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Przyciski akcji */}
                      <div className="flex justify-center space-x-4">
                        {/* Link do Google Maps */}
                        {generateGoogleMapsLink(transport) && (
                          <a 
                            href={generateGoogleMapsLink(transport)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center transition-colors font-medium text-base"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin size={18} className="mr-2" />
                            Zobacz trasę na Google Maps
                          </a>
                        )}
                        
                        {/* Przycisk CMR */}
                        <button 
                          type="button"
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center transition-colors font-medium text-base"
                          onClick={() => generateCMR(transport)}
                        >
                          <FileText size={18} className="mr-2" />
                          Generuj list przewozowy CMR
                        </button>
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


