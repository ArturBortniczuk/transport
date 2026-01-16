'use client'
import React, { useState, useEffect, Fragment } from 'react'
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { generateCMR } from '@/lib/utils/generateCMR'
import { ChevronLeft, ChevronRight, FileText, Download, Search, Truck, Package, MapPin, Phone, Calendar, DollarSign, User, Clipboard, ArrowRight, ChevronDown, ChevronUp, AlertCircle, Building, ShoppingBag, Weight, Mail, Hash, Clock, CheckCircle, Printer, Link as LinkIcon, Bot } from 'lucide-react'

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
  const [selectedWeek, setSelectedWeek] = useState('all')
  const [weeksInMonth, setWeeksInMonth] = useState([])
  const [mpkFilter, setMpkFilter] = useState('')
  const [orderNumberFilter, setOrderNumberFilter] = useState('')
  const [marketFilter, setMarketFilter] = useState('')
  const [mpkOptions, setMpkOptions] = useState([])
  const [marketOptions, setMarketOptions] = useState([])

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

  // useEffect do obliczania tygodni w wybranym miesiącu
  useEffect(() => {
    if (selectedMonth !== 'all') {
      const monthDate = new Date(selectedYear, selectedMonth);
      const firstDayOfMonth = startOfMonth(monthDate);
      const lastDayOfMonth = endOfMonth(monthDate);
      const weeks = eachWeekOfInterval({
        start: firstDayOfMonth,
        end: lastDayOfMonth,
      }, { weekStartsOn: 1 }).map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        return {
          start: weekStart,
          end: weekEnd,
          label: `${format(weekStart, 'dd.MM')} - ${format(weekEnd, 'dd.MM')}`
        };
      });
      setWeeksInMonth(weeks);
    } else {
      setWeeksInMonth([]);
    }
    setSelectedWeek('all');
  }, [selectedYear, selectedMonth]);

  // FUNKCJA: Automatyczne określanie rynku na podstawie MPK
  const getMarketFromMPK = (mpk) => {
    if (!mpk) return 'Nie określono';

    // Budowy (format: 501-XX-XX/XXXX)
    if (mpk.match(/^501-/)) {
      return 'Budowy';
    }

    // Centra elektryczne (522-03-XXX)
    if (mpk.match(/^522-03-/)) {
      return 'Centra elektryczne';
    }

    // Rynki (format: 522-XX-XXX)
    if (mpk.match(/^522-02-/)) return 'Rynek Podlaski';
    if (mpk.match(/^522-04-/)) return 'Rynek Lubelski';
    if (mpk.match(/^522-05-/)) return 'Rynek Mazowiecki';
    if (mpk.match(/^522-06-/)) return 'Rynek Pomorski';
    if (mpk.match(/^522-07-/)) return 'Rynek Małopolski';
    if (mpk.match(/^522-08-/)) return 'Rynek Dolnośląski';
    if (mpk.match(/^522-09-/)) return 'Rynek Wielkopolski';
    if (mpk.match(/^522-11-/)) return 'Rynek Śląski';

    // Jeśli nie pasuje do żadnego wzorca
    return 'Inne';
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

      const response = await fetch('/api/spedycje?status=completed')

      if (response.ok) {
        const data = await response.json()

        if (data.success) {
          console.log('Pobrane dane z API:', data.spedycje)
          setArchiwum(data.spedycje)

          // Zbierz unikalne wartości MPK dla filtra
          const uniqueMpks = [...new Set(data.spedycje.map(item => item.mpk).filter(Boolean))]
          setMpkOptions(uniqueMpks)

          // Zbierz unikalne wartości rynków (na podstawie MPK)
          const uniqueMarkets = [...new Set(data.spedycje
            .map(item => getMarketFromMPK(getCurrentMPK(item)))
            .filter(market => market !== 'Nie określono')
          )].sort()
          setMarketOptions(uniqueMarkets)

          applyFilters(data.spedycje, selectedYear, selectedMonth, selectedWeek, '', '', '')
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

          const uniqueMpks = [...new Set(transporty.map(item => item.mpk).filter(Boolean))]
          setMpkOptions(uniqueMpks)

          // Zbierz unikalne wartości rynków (na podstawie MPK)
          const uniqueMarkets = [...new Set(transporty
            .map(item => getMarketFromMPK(getCurrentMPK(item)))
            .filter(market => market !== 'Nie określono')
          )].sort()
          setMarketOptions(uniqueMarkets)

          applyFilters(transporty, selectedYear, selectedMonth, selectedWeek, '', '', '')
        }
      } catch (localStorageError) {
        console.error('Błąd fallbacku localStorage:', localStorageError)
      }
    } finally {
      setLoading(false)
    }
  }

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

  const getUnloadingCompanyName = (transport) => {
    return transport.clientName || 'Nie podano';
  }

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

  const getDeliveryCity = (transport) => {
    return transport.delivery?.city || 'Nie podano';
  }

  const getGoodsDataFromTransportOrder = (transport) => {
    if (transport.goodsDescription) {
      const desc = transport.goodsDescription.description || '';
      const weight = transport.goodsDescription.weight || '';
      if (desc || weight) {
        return {
          description: desc,
          weight: weight
        };
      }
    }

    if (transport.order_data) {
      try {
        const orderData = typeof transport.order_data === 'string'
          ? JSON.parse(transport.order_data)
          : transport.order_data;

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

    return { description: '', weight: '' };
  }

  const getResponsibleInfo = (transport) => {
    if (transport.responsibleConstructions && transport.responsibleConstructions.length > 0) {
      const construction = transport.responsibleConstructions[0];
      return {
        name: construction.name,
        type: 'construction',
        mpk: construction.mpk || ''
      };
    }

    return {
      name: transport.responsiblePerson || transport.createdBy || 'Brak',
      type: 'person',
      mpk: transport.mpk || ''
    };
  }

  const getCurrentMPK = (transport) => {
    if (transport.responsibleConstructions && transport.responsibleConstructions.length > 0) {
      return transport.responsibleConstructions[0].mpk || transport.mpk || '';
    }

    return transport.mpk || '';
  }

  const formatAddress = (address) => {
    if (!address) return 'Brak danych';
    const parts = [];
    if (address.city) parts.push(address.city);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.street) parts.push(address.street);
    return parts.join(', ') || 'Brak danych';
  }

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

  const applyFilters = (transports, year, month, week, mpkValue, orderNumberValue, marketValue) => {
    if (!transports || transports.length === 0) {
      setFilteredArchiwum([])
      return
    }

    const filtered = transports.filter(transport => {
      const date = new Date(transport.completedAt || transport.createdAt)
      const transportYear = date.getFullYear()

      if (transportYear !== parseInt(year)) {
        return false
      }

      if (month !== 'all') {
        const transportMonth = date.getMonth()
        if (transportMonth !== parseInt(month)) {
          return false
        }
      }

      if (month !== 'all' && week !== 'all') {
        const selectedWeekObj = JSON.parse(week);
        const startDate = new Date(selectedWeekObj.start);
        const endDate = new Date(selectedWeekObj.end);
        if (date < startDate || date > endDate) {
          return false;
        }
      }

      if (mpkValue) {
        const currentMPK = getCurrentMPK(transport);
        if (!currentMPK.toLowerCase().includes(mpkValue.toLowerCase())) {
          return false;
        }
      }

      if (orderNumberValue) {
        const orderNumber = transport.orderNumber || transport.order_number || ''
        if (!orderNumber.toLowerCase().includes(orderNumberValue.toLowerCase())) {
          return false
        }
      }

      if (marketValue) {
        const transportMarket = transport.market || '';
        if (transportMarket !== marketValue) {
          return false;
        }
      }

      return true
    })

    setFilteredArchiwum(filtered)
    setCurrentPage(1)
  }

  useEffect(() => {
    applyFilters(archiwum, selectedYear, selectedMonth, selectedWeek, mpkFilter, orderNumberFilter, marketFilter)
  }, [selectedYear, selectedMonth, selectedWeek, mpkFilter, orderNumberFilter, marketFilter, archiwum])

  const handleDeleteTransport = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć ten transport?')) {
      return
    }

    try {
      setDeleteStatus({ type: 'loading', message: 'Usuwanie transportu...' })

      const response = await fetch(`/api/spedycje?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        const updatedArchiwum = archiwum.filter(transport => transport.id !== id)
        setArchiwum(updatedArchiwum)
        applyFilters(updatedArchiwum, selectedYear, selectedMonth, selectedWeek, mpkFilter, orderNumberFilter, marketFilter)

        setDeleteStatus({ type: 'success', message: 'Transport został usunięty' })

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

  const calculatePricePerKm = (price, distance) => {
    if (!price || !distance || distance === 0) return 0;
    return (price / distance).toFixed(2);
  }

  const exportData = () => {
    if (filteredArchiwum.length === 0) {
      alert('Brak danych do eksportu')
      return
    }

    const calculateSpedycjaCost = (price, distance) => {
      if (price && price > 0) return price;

      if (distance <= 100) {
        return distance * 15;
      } else if (distance > 100 && distance <= 200) {
        return distance * 12;
      } else {
        return distance * 10;
      }
    };

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
        'Rynek': getMarketFromMPK(getCurrentMPK(transport)),
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

    const monthLabel = selectedMonth === 'all' ?
      'wszystkie_miesiace' :
      months.find(m => m.value === selectedMonth)?.label.toLowerCase() || selectedMonth

    const fileName = `spedycja_${selectedYear}_${monthLabel}_${format(new Date(), 'yyyy-MM-dd')}`

    if (exportFormat === 'csv') {
      exportToCSV(dataToExport, fileName)
    } else {
      // PODSUMOWANIE PO MPK
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

      // PODSUMOWANIE PO TYGODNIACH
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

      // PODSUMOWANIE PO PRZEWOŹNIKACH
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

      exportToXLSXWithMultipleSheets(dataToExport, summaryDataMpk, summaryDataWeek, summaryDataCarrier, fileName, filteredArchiwum)
    }
  }

  const exportToXLSXWithMultipleSheets = (mainData, summaryMpk, summaryWeek, summaryCarrier, fileName, rawData) => {
    const wb = XLSX.utils.book_new();

    const ws_main = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws_main, "Wszystkie transporty");

    const ws_mpk = XLSX.utils.json_to_sheet(summaryMpk);
    XLSX.utils.book_append_sheet(wb, ws_mpk, "Podsumowanie po MPK");

    const ws_week = XLSX.utils.json_to_sheet(summaryWeek);
    XLSX.utils.book_append_sheet(wb, ws_week, "Podsumowanie po tygodniach");

    const ws_carrier = XLSX.utils.json_to_sheet(summaryCarrier);
    XLSX.utils.book_append_sheet(wb, ws_carrier, "Podsumowanie po przewoźnikach");

    // Arkusze z podziałem na rynki (teraz na podstawie MPK)
    const markets = [...new Set(rawData.map(t => getMarketFromMPK(getCurrentMPK(t))).filter(m => m !== 'Nie określono'))].sort();

    markets.forEach(market => {
      const marketData = mainData.filter(row => row['Rynek'] === market);

      if (marketData.length > 0) {
        const ws_market = XLSX.utils.json_to_sheet(marketData);
        const sheetName = market.length > 28 ? market.substring(0, 28) + '...' : market;
        XLSX.utils.book_append_sheet(wb, ws_market, sheetName);
      }
    });

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  const generateGoogleMapsLink = (transport) => {
    let origin = '';
    let destination = '';

    if (transport.location === 'Odbiory własne' && transport.producerAddress) {
      const addr = transport.producerAddress;
      origin = `${addr.city},${addr.postalCode},${addr.street || ''}`;
    } else if (transport.location === 'Magazyn Białystok') {
      origin = 'Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      origin = 'Zielonka';
    }

    if (transport.delivery) {
      const addr = transport.delivery;
      destination = `${addr.city},${addr.postalCode},${addr.street || ''}`;
    }

    if (!origin || !destination) return '';

    origin = encodeURIComponent(origin);
    destination = encodeURIComponent(destination);

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  };

  const exportToCSV = (data, fileName) => {
    const headers = Object.keys(data[0])

    let csvContent = headers.join(';') + '\n'
    data.forEach(item => {
      const row = headers.map(header => {
        let cell = item[header] !== undefined && item[header] !== null ? item[header] : ''
        if (cell.toString().includes(',') || cell.toString().includes(';') || cell.toString().includes('\n')) {
          cell = `"${cell}"`
        }
        return cell
      }).join(';')
      csvContent += row + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Brak daty';
    try {
      return format(new Date(dateString), 'dd.MM.yyyy', { locale: pl });
    } catch (error) {
      console.error("Błąd formatowania daty:", error, dateString);
      return 'Nieprawidłowa data';
    }
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Brak daty';
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: pl });
    } catch (error) {
      console.error("Błąd formatowania daty:", error, dateString);
      return 'Nieprawidłowa data';
    }
  }

  const isDeliveryDateChanged = (transport) => {
    return transport.response &&
      transport.response.dateChanged === true &&
      transport.response.newDeliveryDate;
  }

  const getActualDeliveryDate = (transport) => {
    if (isDeliveryDateChanged(transport)) {
      return transport.response.newDeliveryDate;
    }
    return transport.deliveryDate;
  }

  // FUNKCJA: Sprawdza czy odpowiedź została wygenerowana automatycznie
  const isAutoGeneratedResponse = (transport) => {
    return transport.response && transport.response.autoGenerated === true;
  };

  // NOWA FUNKCJA: Oblicza całkowitą trasę dla połączonych transportów
  const calculateConnectedRoute = (mainTransport) => {
    if (!isAutoGeneratedResponse(mainTransport)) {
      return null;
    }

    const connectedTransports = mainTransport.response?.connectedTransports || [];
    if (connectedTransports.length === 0) {
      return null;
    }

    // Zbierz wszystkie punkty trasy w odpowiedniej kolejności
    const routePoints = [];

    // Posortuj połączone transporty według kolejności
    const sortedTransports = [...connectedTransports].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Dodaj punkty z połączonych transportów
    sortedTransports.forEach(ct => {
      if (ct.route) {
        const [start, end] = ct.route.split(' → ');
        // Dodaj punkt startowy jeśli jeszcze go nie ma
        if (start && !routePoints.includes(start)) {
          routePoints.push(start);
        }
      }
    });

    // Dodaj punkt głównego transportu (załadunek) jeśli jeszcze go nie ma
    const mainStart = getLoadingCity(mainTransport);
    if (mainStart && !routePoints.includes(mainStart)) {
      routePoints.push(mainStart);
    }

    // Dodaj punkt docelowy (zawsze na końcu)
    const mainEnd = getDeliveryCity(mainTransport);
    if (mainEnd && !routePoints.includes(mainEnd)) {
      routePoints.push(mainEnd);
    }

    // Oblicz całkowitą odległość
    let totalDistance = 0;

    // Dodaj odległość głównego transportu
    totalDistance += mainTransport.distanceKm || 0;

    // Dodaj odległości z połączonych transportów
    sortedTransports.forEach(ct => {
      const originalTransportDistance = ct.distanceKm || 50;
      totalDistance += originalTransportDistance;
    });

    return {
      route: routePoints.join(' → '),
      totalDistance: totalDistance,
      connectedCount: connectedTransports.length
    };
  };

  // Renderuje info o powiązanych transportach
  const renderConnectedTransports = (transport) => {
    if (!transport.response || !transport.response.connectedTransports ||
      !transport.response.connectedTransports.length) return null;

    const connectedTransports = transport.response.connectedTransports;
    const connectedRoute = calculateConnectedRoute(transport);

    return (
      <div className="mt-6 mb-6">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          <h4 className="font-medium text-indigo-700 mb-4 flex items-center text-lg">
            <LinkIcon size={20} className="mr-2" />
            Transport połączony
          </h4>

          {/* Pokaż pełną trasę */}
          {connectedRoute && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-indigo-200 shadow-sm">
              <div className="text-base font-medium text-indigo-800 break-words">
                Trasa połączona: {connectedRoute.route}
              </div>
              <div className="text-sm text-indigo-600 mt-2 flex items-center">
                <span className="font-medium mr-1">Łączna odległość:</span> {connectedRoute.totalDistance} km
                <span className="mx-2">•</span>
                <span className="font-medium mr-1">Liczba transportów:</span> {connectedRoute.connectedCount + 1}
              </div>
            </div>
          )}

          <div className="text-sm font-medium text-indigo-700 mb-3">Transporty w tej trasie:</div>
          <div className="space-y-3">
            {connectedTransports.map((ct, index) => (
              <div key={ct.id} className="bg-white p-3 rounded-md border border-indigo-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {index + 1}. {ct.orderNumber || ct.id} {ct.route && `(${ct.route})`}
                  </div>
                  <div className="text-xs text-indigo-600 mt-1">
                    {ct.type === 'loading' ? 'Załadunek' : 'Rozładunek'} •
                    <span className="ml-1">MPK: {ct.mpk}</span> •
                    <span className="ml-1">{ct.responsiblePerson || 'Brak'}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Pokaż główny transport */}
            <div className="bg-indigo-100 p-3 rounded-md border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="flex-1">
                <div className="font-medium text-indigo-900">
                  {connectedTransports.length + 1}. {transport.orderNumber || transport.id} (główny transport)
                </div>
                <div className="text-xs text-indigo-700 mt-1">
                  {getLoadingCity(transport)} → {getDeliveryCity(transport)} •
                  <span className="ml-1">MPK: {getCurrentMPK(transport)}</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-0 text-xs font-semibold px-2 py-1 bg-indigo-200 text-indigo-800 rounded">
                Główny
              </div>
            </div>
          </div>

          {transport.response.deliveryPrice && (
            <div className="mt-4 pt-4 border-t border-indigo-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-indigo-800 font-medium mb-1">Całkowity koszt transportu:</div>
                <div className="text-lg font-bold text-indigo-900">{transport.response.deliveryPrice} PLN</div>
              </div>
              {transport.response.costPerTransport && (
                <div>
                  <div className="text-sm text-indigo-800 font-medium mb-1">Koszt na transport:</div>
                  <div className="text-lg font-bold text-indigo-900">{transport.response.costPerTransport} PLN</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // FUNKCJA POMOCNICZA: Pobiera trasę dla wyświetlenia w nagłówku
  const getDisplayRoute = (transport) => {
    const connectedRoute = calculateConnectedRoute(transport);

    if (connectedRoute) {
      return {
        text: connectedRoute.route,
        distance: connectedRoute.totalDistance,
        isConnected: true
      };
    }

    // Dla normalnych transportów
    return {
      text: `${getLoadingCity(transport)} → ${getDeliveryCity(transport)}`,
      distance: transport.distanceKm || transport.response?.distanceKm || 0,
      isConnected: false
    };
  };

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

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

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

      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
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

          <div>
            <label htmlFor="weekSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Tydzień
            </label>
            <select
              id="weekSelect"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className={selectStyles}
              disabled={selectedMonth === 'all'}
            >
              <option value="all">Wszystkie tygodnie</option>
              {weeksInMonth.map((week, index) => (
                <option key={index} value={JSON.stringify(week)}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="marketFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Rynek
            </label>
            <select
              id="marketFilter"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className={selectStyles}
            >
              <option value="">Wszystkie rynki</option>
              {marketOptions.map((market, index) => (
                <option key={index} value={market}>{market}</option>
              ))}
            </select>
          </div>

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

          <div>
            <label htmlFor="orderNumberFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Nr zamówienia
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
        <div className={`mb-4 p-4 rounded-lg ${deleteStatus.type === 'success' ? 'bg-green-100 text-green-800' :
          deleteStatus.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
          {deleteStatus.message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {currentItems.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {currentItems.map((transport) => {
              const dateChanged = isDeliveryDateChanged(transport);
              const displayDate = getActualDeliveryDate(transport);
              const responsibleInfo = getResponsibleInfo(transport);
              const currentMPK = getCurrentMPK(transport);
              const displayRoute = getDisplayRoute(transport);

              return (
                <div key={transport.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div
                    onClick={() => setExpandedRowId(expandedRowId === transport.id ? null : transport.id)}
                    className="flex justify-between items-start cursor-pointer"
                  >
                    <div className="flex-1">
                      <div className="mb-3">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center mb-2">
                          <span className={`flex items-center ${displayRoute.isConnected ? "text-blue-700" : ""}`}>
                            {displayRoute.text.toUpperCase()}
                          </span>

                          {displayRoute.isConnected && (
                            <span className="ml-3 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm font-medium flex items-center">
                              <LinkIcon size={14} className="mr-1" />
                              Połączone
                            </span>
                          )}
                        </h3>
                        {/* Wyświetlanie firm pod spodem jeśli to nie jest trasa połączona, albo w uproszczonej formie */}
                        {!displayRoute.isConnected && (
                          <div className="flex items-center text-sm text-gray-500 mb-2">
                            <span>{getLoadingCompanyName(transport)}</span>
                            <ArrowRight size={14} className="mx-2" />
                            <span>{getUnloadingCompanyName(transport)}</span>
                          </div>
                        )}
                      </div>

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

                      {transport.responsibleConstructions && transport.responsibleConstructions.length > 1 && (
                        <div className="mt-3">
                          {renderResponsibleConstructions(transport)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 ml-6">
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

                  {expandedRowId === transport.id && (
                    <div className="mt-8 border-t border-gray-200 pt-6">

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

                            {isAutoGeneratedResponse(transport) ? (
                              // WIDOK DLA TRANSPORTÓW POŁĄCZONYCH
                              <>
                                <div>
                                  <span className="font-medium text-gray-700">Cena całkowita (trasa):</span>
                                  <div className="font-semibold text-indigo-700">
                                    {transport.response?.deliveryPrice ? `${transport.response.deliveryPrice} PLN` : 'Brak danych'}
                                  </div>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Koszt tego zlecenia:</span>
                                  <div className="font-semibold text-gray-900">
                                    {transport.response?.costPerTransport ? `${transport.response.costPerTransport} PLN` : 'Brak danych'}
                                  </div>
                                </div>
                              </>
                            ) : (
                              // STANDARDOWY WIDOK
                              <>
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
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

                      {/* Informacje o powiązanych transportach na dole */}
                      {renderConnectedTransports(transport)}

                      <div className="flex justify-center space-x-4">
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