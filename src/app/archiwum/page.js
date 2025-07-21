// src/app/archiwum/page.js - KOMPLETNA WERSJA Z NAPRAWIONYM SYSTEMEM OCEN I KOMENTARZY
'use client'
import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { KIEROWCY, POJAZDY } from '../kalendarz/constants'
import * as XLSX from 'xlsx'
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Star, 
  ChevronDown, 
  MapPin, 
  Truck, 
  Building, 
  User, 
  Calendar, 
  Trash2,
  Package,
  Route,
  Eye,
  FileText,
  Hash,
  MessageSquare,
  Edit,
  ThumbsUp,
  ThumbsDown,
  X,
  CheckCircle,
  AlertCircle,
  Plus,
  Send
} from 'lucide-react'

export default function ArchiwumPage() {
  const [archiwum, setArchiwum] = useState([])
  const [filteredArchiwum, setFilteredArchiwum] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [selectedTransport, setSelectedTransport] = useState(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [expandedRows, setExpandedRows] = useState({})
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [transportRatings, setTransportRatings] = useState({})

  // Filtry
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedRequester, setSelectedRequester] = useState('')
  const [selectedRating, setSelectedRating] = useState('all')
  const [selectedConstruction, setSelectedConstruction] = useState('')
  
  // Lista użytkowników i budów
  const [users, setUsers] = useState([])
  const [constructions, setConstructions] = useState([])

  // Lista lat i miesięcy
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = [
    { value: 'all', label: 'Wszystkie miesiące' },
    { value: 0, label: 'Styczeń' },
    { value: 1, label: 'Luty' },
    { value: 2, label: 'Marzec' },
    { value: 3, label: 'Kwiecień' },
    { value: 4, label: 'Maj' },
    { value: 5, label: 'Czerwiec' },
    { value: 6, label: 'Lipiec' },
    { value: 7, label: 'Sierpień' },
    { value: 8, label: 'Wrzesień' },
    { value: 9, label: 'Październik' },
    { value: 10, label: 'Listopad' },
    { value: 11, label: 'Grudzień' }
  ]

  const ratingOptions = [
    { value: 'all', label: 'Wszystkie transporty' },
    { value: 'rated', label: 'Tylko ocenione' },
    { value: 'unrated', label: 'Tylko nieocenione' }
  ]

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/user')
        if (response.ok) {
          const data = await response.json()
          setIsAdmin(data.isAuthenticated && data.user && (data.user.isAdmin || data.user.role === 'admin'))
          setCurrentUserEmail(data.user?.email || '')
        }
      } catch (error) {
        console.error('Błąd sprawdzania uprawnień:', error)
      }
    }

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

  const fetchArchivedTransports = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transports?status=completed')
      const data = await response.json()
      
      if (data.success) {
        const sortedTransports = data.transports.sort((a, b) => 
          new Date(b.delivery_date) - new Date(a.delivery_date)
        )
        setArchiwum(sortedTransports)
        
        // Pobierz oceny dla wszystkich transportów
        await fetchAllRatings(sortedTransports)
        
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

  const fetchAllRatings = async (transports) => {
      if (!transports || transports.length === 0) {
        setTransportRatings({});
        return;
      }
  
      try {
        const transportIds = transports.map(t => t.id);
        
        const response = await fetch('/api/transport-ratings-bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transportIds }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          setTransportRatings(data.ratings);
        } else {
          console.error("Błąd podczas masowego pobierania ocen:", data.error);
          setTransportRatings({});
        }
      } catch (error) {
        console.error('Błąd wywołania API do masowego pobierania ocen:', error);
        setTransportRatings({});
      }
    };
  
  const applyFilters = async (transports, year, month, warehouse, driver, requester, rating, construction) => {
    if (!transports) return
    
    let filtered = transports.filter(transport => {
      const date = new Date(transport.delivery_date)
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
      
      if (warehouse && transport.source_warehouse !== warehouse) {
        return false
      }
      
      if (driver && transport.driver_id.toString() !== driver) {
        return false
      }
      
      if (requester && transport.requester_email !== requester) {
        return false
      }
      
      if (construction) {
        const selectedConstruction = constructions.find(c => c.id.toString() === construction);
        if (selectedConstruction) {
          const matchesClientName = transport.client_name && 
            transport.client_name.toLowerCase().includes(selectedConstruction.name.toLowerCase());
          const matchesMpk = transport.mpk && transport.mpk === selectedConstruction.mpk;
          
          if (!matchesClientName && !matchesMpk) {
            return false;
          }
        }
      }
      
      return true
    })

    // Filtrowanie po ocenach
    if (rating === 'rated' || rating === 'unrated') {
      filtered = filtered.filter(transport => {
        const transportRating = transportRatings[transport.id]
        if (rating === 'rated') {
          return transportRating && transportRating.stats.totalRatings > 0
        } else {
          return !transportRating || transportRating.stats.totalRatings === 0
        }
      })
    }
    
    setFilteredArchiwum(filtered)
  }

  useEffect(() => {
    applyFilters(archiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction)
  }, [selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction, archiwum, constructions, transportRatings])

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
        const updatedArchiwum = archiwum.filter(transport => transport.id !== id)
        setArchiwum(updatedArchiwum)
        applyFilters(updatedArchiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction)
        
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

  const handleOpenRatingModal = (transport) => {
    setSelectedTransport(transport)
    setShowRatingModal(true)
  }

  const handleCloseRating = async () => {
    setShowRatingModal(false);
    setSelectedTransport(null);
    
    // Zamiast przeładowywać wszystko, odświeżamy tylko oceny
    if (archiwum.length > 0) {
      await fetchAllRatings(archiwum);
    }
  };

  const getDriverInfo = (driverId, vehicleId) => {
    const driver = KIEROWCY.find(k => k.id === parseInt(driverId));
    if (!driver) return 'Brak danych';
    
    // Użyj vehicle_id jeśli jest dostępne, w przeciwnym razie wróć do starej logiki
    const vehicle = POJAZDY.find(p => p.id === parseInt(vehicleId || driverId));
    const vehicleInfo = vehicle ? vehicle.tabliceRej : 'Brak pojazdu';
    
    return `${driver.imie} (${vehicleInfo})`;
  };

  const getMagazynName = (warehouse) => {
    switch(warehouse) {
      case 'bialystok': return 'Białystok'
      case 'zielonka': return 'Zielonka'
      default: return warehouse || 'Nieznany'
    }
  }

  const exportData = () => {
    if (filteredArchiwum.length === 0) {
      alert('Brak danych do eksportu')
      return
    }
    
    const calculateTransportCost = (distance) => {
        if (distance <= 75) {
          return distance * 13;
        } else if (distance > 75 && distance <= 150) {
          return distance * 8;
        } else { // distance > 150
          return distance * 3;
        }
    };

    const dataToExport = filteredArchiwum.map(transport => {
      const driver = KIEROWCY.find(k => k.id === parseInt(transport.driver_id))
      const rating = transportRatings[transport.id]
      const handlowiec = users.find(u => u.email === transport.requester_email);
      const distanceKm = transport.distance || 0;
      const calculatedCost = calculateTransportCost(distanceKm);
      
      return {
        'Data transportu': format(new Date(transport.delivery_date), 'dd.MM.yyyy', { locale: pl }),
        'Miasto': transport.destination_city,
        'Kod pocztowy': transport.postal_code || '',
        'Ulica': transport.street || '',
        'Magazyn': getMagazynName(transport.source_warehouse),
        'Odległość (km)': distanceKm,
        'Koszt transportu (PLN)': calculatedCost.toFixed(2).replace('.', ','),
        'Firma': transport.client_name || '',
        'MPK': transport.mpk || '',
        'Handlowiec': handlowiec ? handlowiec.name : (transport.requester_name || ''),
        'Nr WZ': transport.wz_number || '',
        'Kierowca': driver ? driver.imie : '',
        'Nr rejestracyjny': driver ? POJAZDY.find(p => p.id === parseInt(transport.vehicle_id || transport.driver_id))?.tabliceRej || '' : '',
        'Zamówił': transport.requester_email || '',
        'Ocena (%)': rating?.stats.overallRatingPercentage !== null ? `${rating.stats.overallRatingPercentage}%` : 'Brak oceny',
        'Liczba ocen': rating?.stats.totalRatings || 0,
        'Uwagi': transport.notes || ''
      }
    })
    
    const fileName = `archiwum_transportow_${format(new Date(), 'yyyy-MM-dd')}`
    
    if (exportFormat === 'csv') {
      exportToCSV(dataToExport, fileName)
    } else {
      // Przygotowanie danych do podsumowania
      const summaryByMpk = filteredArchiwum.reduce((acc, transport) => {
        const mpk = transport.mpk || 'Brak MPK';
        const distance = transport.distance || 0;
        const cost = calculateTransportCost(distance);
        
        if (!acc[mpk]) {
          acc[mpk] = { totalCost: 0 };
        }
        
        acc[mpk].totalCost += cost;
        
        return acc;
      }, {});

      const summaryData = Object.keys(summaryByMpk).map(mpk => ({
        'MPK': mpk,
        'Łączny koszt (PLN)': summaryByMpk[mpk].totalCost.toFixed(2).replace('.', ',')
      }));

      exportToXLSXWithSummary(dataToExport, summaryData, fileName)
    }
  }

  const exportToCSV = (data, fileName) => {
    const headers = Object.keys(data[0])
    let csvContent = headers.join(';') + '\n'
    
    data.forEach(item => {
      const row = headers.map(header => {
        let cell = item[header] ? item[header] : ''
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

  const exportToXLSXWithSummary = (mainData, summaryData, fileName) => {
    const wb = XLSX.utils.book_new();
    
    // Arkusz z transportami
    const ws_main = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws_main, "Transporty");
    
    // Arkusz z podsumowaniem
    const ws_summary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws_summary, "Podsumowanie po MPK");
    
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  // Paginacja
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber)
  }

  // Statystyki
  const totalDistance = filteredArchiwum.reduce((sum, t) => sum + (t.distance || 0), 0)

  // Komponent wyświetlający ocenę transportu
  const RatingDisplay = ({ transportId }) => {
    const rating = transportRatings[transportId]
    
    if (!rating || rating.stats.totalRatings === 0) {
      return (
        <span className="text-gray-400 text-sm flex items-center">
          <Star size={14} className="mr-1" />
          Brak oceny
        </span>
      )
    }

    const getColorClass = (percentage) => {
      if (percentage >= 80) return 'bg-green-500 text-white'
      if (percentage >= 60) return 'bg-yellow-500 text-white'
      if (percentage >= 40) return 'bg-orange-500 text-white'
      return 'bg-red-500 text-white'
    }

    return (
      <div className="flex items-center">
        <div className={`flex items-center px-2 py-1 rounded-md text-sm font-medium ${getColorClass(rating.stats.overallRatingPercentage)}`}>
          <Star size={14} className="mr-1 fill-current" />
          {rating.stats.overallRatingPercentage}%
        </div>
        <span className="text-xs text-gray-500 ml-1">
          ({rating.stats.totalRatings})
        </span>
      </div>
    )
  }

  // Komponent przycisków oceny - UPROSZCZONA WERSJA
  const RatingButtons = ({ transport }) => {
    const rating = transportRatings[transport.id]
    
    if (!rating) {
      return (
        <span className="text-gray-400 text-sm">
          Ładowanie...
        </span>
      )
    }

    const hasMainRating = rating.stats.totalRatings > 0
    const userHasMainRating = rating.hasUserRated
    
    return (
      <div className="flex flex-col space-y-1">
        {/* Jeden przycisk dla wszystkich akcji */}
        <button
          onClick={() => handleOpenRatingModal(transport)}
          className={`flex items-center px-3 py-1 rounded-md hover:opacity-80 transition-colors text-sm ${
            hasMainRating 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}
        >
          <MessageSquare size={14} className="mr-1" />
          {hasMainRating 
            ? (userHasMainRating ? 'Edytuj ocenę/komentarz' : 'Dodaj komentarz') 
            : 'Oceń transport'
          }
        </button>
      </div>
    )
  }

  // Kompletny modal oceny z komentarzami - NAPRAWIONA WERSJA
  const CompleteRatingModal = ({ transport, onClose }) => {
    const [ratings, setRatings] = useState({
      driverProfessional: null,
      driverTasksCompleted: null,
      cargoComplete: null,
      cargoCorrect: null,
      deliveryNotified: null,
      deliveryOnTime: null
    })
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [addingComment, setAddingComment] = useState(false)
    const [allComments, setAllComments] = useState([])
    const [loadingComments, setLoadingComments] = useState(true)
    
    const transportRating = transportRatings[transport.id]
    const hasMainRating = transportRating?.stats.totalRatings > 0
    const userHasRated = transportRating?.hasUserRated

    // Pobierz komentarze przy ładowaniu
    useEffect(() => {
      const fetchComments = async () => {
        try {
          setLoadingComments(true)
          const response = await fetch(`/api/transport-comments?transportId=${transport.id}`)
          const data = await response.json()
          
          if (data.success) {
            setAllComments(data.comments || [])
          }
        } catch (error) {
          console.error('Błąd pobierania komentarzy:', error)
        } finally {
          setLoadingComments(false)
        }
      }
      
      fetchComments()
    }, [transport.id])

    useEffect(() => {
      if (userHasRated && transportRating?.userRating) {
        setRatings(transportRating.userRating.ratings)
        setComment(transportRating.userRating.comment || '')
        setIsEditMode(false)
      } else if (!hasMainRating) {
        setIsEditMode(true)
      }
    }, [userHasRated, transportRating, hasMainRating])

    const categories = [
      {
        id: 'driver',
        title: '👨‍💼 Kierowca',
        criteria: [
          {
            key: 'driverProfessional',
            text: 'Kierowca zachował się profesjonalnie wobec klienta.'
          },
          {
            key: 'driverTasksCompleted',
            text: 'Kierowca zrealizował wszystkie ustalone zadania.'
          }
        ]
      },
      {
        id: 'cargo',
        title: '📦 Towar',
        criteria: [
          {
            key: 'cargoComplete',
            text: 'Towar był kompletny i zgodny z zamówieniem.'
          },
          {
            key: 'cargoCorrect',
            text: 'Nie doszło do pomyłki – klient dostał właściwy towar.'
          }
        ]
      },
      {
        id: 'delivery',
        title: '🚚 Organizacja dostawy',
        criteria: [
          {
            key: 'deliveryNotified',
            text: 'Dostawa została wcześniej awizowana u klienta.'
          },
          {
            key: 'deliveryOnTime',
            text: 'Towar dotarł w ustalonym terminie.'
          }
        ]
      }
    ]

    const handleSubmitRating = async (e) => {
      e.preventDefault()
      
      if (!hasMainRating) {
        const allRated = Object.values(ratings).every(rating => rating !== null)
        if (!allRated) {
          setError('Oceń wszystkie kryteria przed wysłaniem')
          return
        }
      }
      
      try {
        setSubmitting(true)
        setError('')
        
        // ZMIANA TUTAJ: Zmieniono URL na poprawny dla szczegółowych ocen
        const response = await fetch('/api/transport-detailed-ratings', { // <-- POPRAWIONY URL
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transportId: transport.id,
            ratings, // Obiekt ratings jest już w poprawnym formacie
            comment: comment.trim()
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          setSuccess(true)
          setIsEditMode(false)
          
          // Odśwież dane
          await fetchAllRatings([transport]) // Ta funkcja powinna zostać zaktualizowana zgodnie z poprzednią sugestią
          
          setTimeout(() => {
            setSuccess(false)
          }, 3000)
        } else {
          setError(result.error || 'Wystąpił błąd podczas zapisywania oceny')
        }
      } catch (error) {
        console.error('Błąd wysyłania oceny:', error)
        setError('Wystąpił błąd podczas wysyłania oceny')
      } finally {
        setSubmitting(false)
      }
    }

    const handleAddComment = async () => {
      if (!newComment.trim()) return
      
      try {
        setAddingComment(true)
        setError('')
        
        const response = await fetch('/api/transport-comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transportId: transport.id,
            comment: newComment.trim()
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          setNewComment('')
          // Odśwież komentarze
          const commentsResponse = await fetch(`/api/transport-comments?transportId=${transport.id}`)
          const commentsData = await commentsResponse.json()
          if (commentsData.success) {
            setAllComments(commentsData.comments || [])
          }
        } else {
          setError(result.error || 'Nie udało się dodać komentarza')
        }
      } catch (error) {
        console.error('Błąd dodawania komentarza:', error)
        setError('Wystąpił błąd podczas dodawania komentarza')
      } finally {
        setAddingComment(false)
      }
    }

    const renderRatingButton = (criteriaKey, value, label) => {
      const isSelected = ratings[criteriaKey] === value
      const disabled = hasMainRating && !isEditMode
      
      const baseClasses = "flex items-center justify-center px-3 py-2 rounded-md transition-colors text-sm font-medium border"
      
      if (disabled) {
        const readOnlyClasses = isSelected 
          ? (value ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300")
          : "bg-gray-50 text-gray-400 border-gray-200"
        
        return (
          <div className={`${baseClasses} ${readOnlyClasses} cursor-not-allowed`}>
            {value ? <ThumbsUp size={16} className="mr-1" /> : <ThumbsDown size={16} className="mr-1" />}
            {label}
          </div>
        )
      }
      
      const selectedClasses = value 
        ? "bg-green-100 text-green-700 border-green-300"
        : "bg-red-100 text-red-700 border-red-300"
      const unselectedClasses = "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"
      
      return (
        <button
          type="button"
          onClick={() => setRatings(prev => ({ ...prev, [criteriaKey]: value }))}
          className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
        >
          {value ? <ThumbsUp size={16} className="mr-1" /> : <ThumbsDown size={16} className="mr-1" />}
          {label}
        </button>
      )
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {!hasMainRating 
                    ? 'Oceń transport' 
                    : 'Ocena i komentarze transportu'
                  }
                </h2>
                <p className="text-gray-600 mt-1">
                  {transport.destination_city} - {transport.client_name} ({getMagazynName(transport.source_warehouse)})
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Komunikaty */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md flex items-center">
                <CheckCircle size={16} className="mr-2" />
                {userHasRated ? 'Ocena została zaktualizowana!' : 'Ocena została zapisana!'}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md flex items-center">
                <AlertCircle size={16} className="mr-2" />
                {error}
              </div>
            )}

            {/* SEKCJA OCENY - wyświetlana na górze */}
            {hasMainRating && (
              <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold mb-4 text-blue-900">
                  ⭐ Ocena transportu: {transportRating.stats.overallRatingPercentage}%
                </h3>
                
                {/* Wyświetl główną ocenę (pierwszą) */}
                {transportRating.ratings && transportRating.ratings[0] && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {categories.map(category => (
                      <div key={category.id} className="bg-white p-4 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">{category.title}</h4>
                        {category.criteria.map(criteria => {
                          const ratingValue = transportRating.ratings[0].ratings[criteria.key]
                          if (ratingValue === null || ratingValue === undefined) return null
                          
                          return (
                            <div key={criteria.key} className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600 text-xs">{criteria.text}</span>
                              <div className="flex items-center">
                                {ratingValue ? (
                                  <ThumbsUp size={12} className="text-green-600" />
                                ) : (
                                  <ThumbsDown size={12} className="text-red-600" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Przycisk edycji dla twórcy oceny */}
                {userHasRated && !isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Edit size={16} className="mr-1" />
                    Edytuj swoją ocenę
                  </button>
                )}
              </div>
           )}

           {/* Formularz oceny - tylko dla edycji lub nowych ocen */}
           {(!hasMainRating || (userHasRated && isEditMode)) && (
             <div className="mb-8 p-6 border border-gray-200 rounded-lg">
               <h3 className="text-lg font-semibold mb-4">
                 {userHasRated ? 'Edytuj swoją ocenę' : 'Oceń transport'}
               </h3>
               
               <form onSubmit={handleSubmitRating} className="space-y-6">
                 {categories.map(category => (
                   <div key={category.id} className="border border-gray-200 rounded-lg p-6">
                     <h4 className="text-lg font-semibold mb-4">{category.title}</h4>
                     
                     {category.criteria.map(criteria => (
                       <div key={criteria.key} className="mb-4 last:mb-0">
                         <p className="text-gray-700 mb-3">{criteria.text}</p>
                         <div className="flex space-x-3">
                           {renderRatingButton(criteria.key, true, 'Tak')}
                           {renderRatingButton(criteria.key, false, 'Nie')}
                         </div>
                       </div>
                     ))}
                   </div>
                 ))}

                 {/* Komentarz do oceny */}
                 <div className="border border-gray-200 rounded-lg p-6">
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     Komentarz do oceny (opcjonalny)
                   </label>
                   <textarea
                     value={comment}
                     onChange={(e) => setComment(e.target.value)}
                     rows={4}
                     className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                     placeholder="Opisz szczegóły transportu, problemy lub pozytywne aspekty..."
                   />
                 </div>
                 
                 {/* Przyciski akcji */}
                 <div className="flex justify-end space-x-3">
                   {isEditMode && userHasRated && (
                     <button
                       type="button"
                       onClick={() => {
                         setIsEditMode(false)
                         if (transportRating?.userRating) {
                           setRatings(transportRating.userRating.ratings)
                           setComment(transportRating.userRating.comment || '')
                         }
                       }}
                       className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                     >
                       Anuluj
                     </button>
                   )}
                   <button
                     type="submit"
                     disabled={submitting}
                     className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                   >
                     {submitting ? 'Zapisywanie...' : (userHasRated ? 'Zapisz zmiany' : 'Zapisz ocenę')}
                   </button>
                 </div>
               </form>
             </div>
           )}

           {/* SEKCJA KOMENTARZY - wyświetlana na dole */}
           <div className="mt-8">
             <h3 className="font-semibold text-lg mb-4">
               💬 Komentarze ({allComments.length})
             </h3>
             
             {/* Formularz dodawania komentarza - dostępny dla wszystkich */}
             <div className="mb-6 p-4 bg-gray-50 rounded-lg">
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 Dodaj komentarz do transportu
               </label>
               <div className="flex space-x-3">
                 <textarea
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   rows={3}
                   className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="Napisz swój komentarz do tego transportu..."
                 />
                 <button
                   onClick={handleAddComment}
                   disabled={!newComment.trim() || addingComment}
                   className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                 >
                   <Send size={16} className="mr-1" />
                   {addingComment ? 'Dodawanie...' : 'Dodaj'}
                 </button>
               </div>
             </div>

             {/* Lista komentarzy */}
             {loadingComments ? (
               <div className="text-center py-4">
                 <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
               </div>
             ) : allComments.length > 0 ? (
               <div className="space-y-4">
                 {allComments.map((comment) => (
                   <div key={comment.id} className="border border-gray-200 rounded-md p-4 bg-white">
                     <div className="flex justify-between items-start mb-2">
                       <span className="text-sm font-medium text-gray-900">
                         {comment.commenter_email}
                       </span>
                       <span className="text-sm text-gray-500">
                         {new Date(comment.created_at).toLocaleDateString('pl-PL', {
                           year: 'numeric',
                           month: 'long',
                           day: 'numeric',
                           hour: '2-digit',
                           minute: '2-digit'
                         })}
                       </span>
                     </div>
                     <p className="text-gray-700">{comment.comment}</p>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-8 text-gray-500">
                 <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
                 <p>Brak komentarzy do tego transportu.</p>
                 <p className="text-sm mt-1">Bądź pierwszy i dodaj komentarz!</p>
               </div>
             )}
           </div>
          </div>
        </div>
      </div>
    )
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Archiwum Transportów
        </h1>
        <p className="text-gray-600">
          Zarządzaj zakończonymi transportami i ich ocenami
        </p>
      </div>

      {/* Status usuwania */}
      {deleteStatus && (
        <div className={`mb-4 p-4 rounded-lg ${
          deleteStatus.type === 'loading' ? 'bg-blue-50 text-blue-700' :
          deleteStatus.type === 'success' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          {deleteStatus.message}
        </div>
      )}

      {/* Panel filtrów */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Filtry</h3>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <span>Filtry zaawansowane</span>
            <ChevronDown 
              size={16} 
              className={`ml-1 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} 
            />
          </button>
        </div>

        {/* Podstawowe filtry */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rok
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Miesiąc
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Magazyn
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wszystkie magazyny</option>
              <option value="bialystok">Białystok</option>
              <option value="zielonka">Zielonka</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status oceny
            </label>
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ratingOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zaawansowane filtry */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kierowca
              </label>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wszyscy kierowcy</option>
                {KIEROWCY.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.imie}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zamówił
              </label>
              <select
                value={selectedRequester}
                onChange={(e) => setSelectedRequester(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wszyscy użytkownicy</option>
                {users.map(user => (
                  <option key={user.email} value={user.email}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budowa
              </label>
              <select
                value={selectedConstruction}
                onChange={(e) => setSelectedConstruction(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wszystkie budowy</option>
                {constructions.map(construction => (
                  <option key={construction.id} value={construction.id}>
                    {construction.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Liczba transportów</p>
              <p className="text-2xl font-bold text-gray-900">{filteredArchiwum.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Route className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Łączna odległość</p>
              <p className="text-2xl font-bold text-gray-900">{totalDistance.toLocaleString()} km</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Download className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Eksport danych</p>
              <div className="flex items-center mt-2">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="mr-2 border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="xlsx">Excel</option>
                  <option value="csv">CSV</option>
                </select>
                <button
                  onClick={exportData}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                >
                  Eksportuj
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista transportów */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Miejscowość
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Firma
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Magazyn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ocena
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.map((transport) => {
                return (
                  <React.Fragment key={transport.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(transport.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {transport.destination_city}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {transport.client_name || 'Brak nazwy'}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getMagazynName(transport.source_warehouse)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <RatingDisplay transportId={transport.id} />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <RatingButtons transport={transport} />
                          
                          <button
                            onClick={() => setExpandedRows(prev => ({
                              ...prev,
                              [transport.id]: !prev[transport.id]
                            }))}
                            className="flex items-center px-2 py-1 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors text-sm"
                          >
                            <Eye size={14} className="mr-1" />
                            {expandedRows[transport.id] ? 'Ukryj' : 'Szczegóły'}
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteTransport(transport.id)}
                              className="flex items-center px-2 py-1 text-red-600 hover:text-red-900 rounded-md hover:bg-red-100 transition-colors text-sm"
                            >
                              <Trash2 size={14} className="mr-1" />
                              Usuń
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedRows[transport.id] && (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Szczegóły dostawy</h4>
                              <div className="space-y-2 text-sm">
                                {transport.street && (
                                  <div className="flex items-center">
                                    <MapPin size={14} className="text-gray-400 mr-2" />
                                    <span className="text-gray-600">Adres:</span>
                                    <span className="ml-1">{transport.street}</span>
                                  </div>
                                )}
                                {transport.postal_code && (
                                  <div className="flex items-center">
                                    <span className="text-gray-600 ml-6">Kod:</span>
                                    <span className="ml-1">{transport.postal_code}</span>
                                  </div>
                                )}
                                {transport.mpk && (
                                  <div className="flex items-center">
                                    <Hash size={14} className="text-gray-400 mr-2" />
                                    <span className="text-gray-600">MPK:</span>
                                    <span className="ml-1">{transport.mpk}</span>
                                  </div>
                                )}
                                {transport.wz_number && (
                                  <div className="flex items-center">
                                    <FileText size={14} className="text-gray-400 mr-2" />
                                    <span className="text-gray-600">WZ:</span>
                                    <span className="ml-1">{transport.wz_number}</span>
                                  </div>
                                )}
                                {transport.distance && (
                                  <div className="flex items-center">
                                    <Route size={14} className="text-gray-400 mr-2" />
                                    <span className="text-gray-600">Odległość:</span>
                                    <span className="ml-1">{transport.distance} km</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Dodatkowe informacje</h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center">
                                  <User size={14} className="text-gray-400 mr-2" />
                                  <span className="text-gray-600">Kierowca:</span>
                                  <span className="ml-1">{getDriverInfo(transport.driver_id, transport.vehicle_id)}</span>
                                </div>
                                {transport.requester_email && (
                                  <div className="flex items-center">
                                    <span className="text-gray-600">Zamówił:</span>
                                    <span className="ml-1">{transport.requester_email}</span>
                                  </div>
                                )}
                                {transport.notes && (
                                  <div className="flex items-start">
                                    <MessageSquare size={14} className="text-gray-400 mr-2 mt-1" />
                                    <div>
                                      <span className="text-gray-600">Uwagi:</span>
                                      <p className="mt-1 text-gray-900">{transport.notes}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>

          {/* Brak wyników */}
          {filteredArchiwum.length === 0 && (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Brak transportów</h3>
              <p className="text-gray-500">
                Nie znaleziono transportów spełniających wybrane kryteria.
              </p>
            </div>
          )}
        </div>

        {/* Paginacja */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Poprzednie
              </button>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Następne
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Pokazano <span className="font-medium">{indexOfFirstItem + 1}</span> do{' '}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, filteredArchiwum.length)}
                  </span>{' '}
                  z <span className="font-medium">{filteredArchiwum.length}</span> wyników
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => paginate(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal oceny transportu */}
      {showRatingModal && selectedTransport && (
        <CompleteRatingModal 
          transport={selectedTransport} 
          onClose={handleCloseRating} 
        />
      )}
    </div>
  )
}
