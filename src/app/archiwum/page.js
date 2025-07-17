// src/app/archiwum/page.js - WERSJA ZOPTYMALIZOWANA Z NAPRAWIONYMI BŁĘDAMI
'use client'
import React, { useState, useEffect, useMemo } from 'react'
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
  Send,
  Loader
} from 'lucide-react'

export default function ArchiwumPage() {
  const [archiwum, setArchiwum] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
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

  // OPTYMALIZACJA: Równoległe ładowanie danych
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true)
        
        const [userResponse, usersResponse, constructionsResponse, transportsResponse] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/users/list'),
          fetch('/api/constructions'),
          fetch('/api/transports?status=completed')
        ])

        if (userResponse.ok) {
          const userData = await userResponse.json()
          setCurrentUserEmail(userData.user?.email || '')
          setIsAdmin(userData.isAuthenticated && userData.user && (userData.user.isAdmin || userData.user.role === 'admin'))
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json()
          setUsers(usersData)
        }

        if (constructionsResponse.ok) {
          const constructionsData = await constructionsResponse.json()
          setConstructions(constructionsData.constructions || [])
        }
        
        if (transportsResponse.ok) {
            const data = await transportsResponse.json();
            if (data.success) {
                const sortedTransports = data.transports.sort((a, b) => new Date(b.delivery_date) - new Date(a.delivery_date));
                setArchiwum(sortedTransports);
            } else {
                setError('Nie udało się pobrać archiwum transportów');
            }
        } else {
            setError('Błąd pobierania transportów');
        }

      } catch (error) {
        console.error('Błąd inicjalizacji danych:', error)
        setError('Wystąpił błąd podczas ładowania danych')
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [])

  // OPTYMALIZACJA: Memoizacja filtrowanych danych
  const filteredArchiwum = useMemo(() => {
    if (!archiwum) return []
    
    let filtered = archiwum.filter(transport => {
      const date = new Date(transport.delivery_date)
      const transportYear = date.getFullYear()
      
      if (transportYear !== parseInt(selectedYear)) return false
      
      if (selectedMonth !== 'all') {
        const transportMonth = date.getMonth()
        if (transportMonth !== parseInt(selectedMonth)) return false
      }
      
      if (selectedWarehouse && transport.source_warehouse !== selectedWarehouse) return false
      if (selectedDriver && transport.driver_id.toString() !== selectedDriver) return false
      if (selectedRequester && transport.requester_email !== selectedRequester) return false
      
      if (selectedConstruction) {
        const selectedConstructionObj = constructions.find(c => c.id.toString() === selectedConstruction);
        if (selectedConstructionObj) {
          const matchesClientName = transport.client_name && 
            transport.client_name.toLowerCase().includes(selectedConstructionObj.name.toLowerCase());
          const matchesMpk = transport.mpk && transport.mpk === selectedConstructionObj.mpk;
          if (!matchesClientName && !matchesMpk) return false;
        }
      }
      
      return true
    })

    if (selectedRating === 'rated' || selectedRating === 'unrated') {
      filtered = filtered.filter(transport => {
        const transportRating = transportRatings[transport.id]
        if (selectedRating === 'rated') {
          return transportRating && transportRating.stats.totalRatings > 0
        } else { // unrated
          return !transportRating || transportRating.stats.totalRatings === 0
        }
      })
    }
    
    return filtered
  }, [archiwum, selectedYear, selectedMonth, selectedWarehouse, selectedDriver, selectedRequester, selectedRating, selectedConstruction, constructions, transportRatings])
  
  // Paginacja
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredArchiwum.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredArchiwum.length / itemsPerPage)

  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber)
  }

  // Efekt do ładowania ocen dla widocznych transportów
  useEffect(() => {
    const fetchRatingsForCurrentPage = async () => {
        const idsToFetch = currentItems
            .map(t => t.id)
            .filter(id => !transportRatings[id]);

        if (idsToFetch.length > 0) {
            setRatingsLoading(true);
            try {
                const ratingsPromises = idsToFetch.map(id => 
                    fetch(`/api/transport-ratings?transportId=${id}`).then(res => res.json())
                );
                const results = await Promise.all(ratingsPromises);
                
                const newRatings = {};
                results.forEach((data, index) => {
                    if (data.success) {
                        newRatings[idsToFetch[index]] = {
                            canBeRated: data.canBeRated,
                            hasUserRated: data.hasUserRated,
                            userRating: data.userRating,
                            ratings: data.ratings || [],
                            stats: data.stats || { totalRatings: 0, overallRatingPercentage: null }
                        };
                    }
                });
                setTransportRatings(prev => ({ ...prev, ...newRatings }));

            } catch (error) {
                console.error("Błąd ładowania ocen: ", error);
            } finally {
                setRatingsLoading(false);
            }
        }
    };

    if (currentItems.length > 0) {
        fetchRatingsForCurrentPage();
    }
  }, [currentPage, filteredArchiwum]);


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
        setArchiwum(prev => prev.filter(transport => transport.id !== id))
        
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
    const transportId = selectedTransport?.id;
    setShowRatingModal(false)
    setSelectedTransport(null)
    
    if (transportId) {
        setRatingsLoading(true);
        try {
            const response = await fetch(`/api/transport-ratings?transportId=${transportId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setTransportRatings(prev => ({ ...prev, [transportId]: {
                        canBeRated: data.canBeRated,
                        hasUserRated: data.hasUserRated,
                        userRating: data.userRating,
                        ratings: data.ratings || [],
                        stats: data.stats || { totalRatings: 0, overallRatingPercentage: null }
                    }}));
                }
            }
        } catch (error) {
            console.error("Błąd odświeżania oceny:", error);
        } finally {
            setRatingsLoading(false);
        }
    }
  }

  const getDriverInfo = (driverId, vehicleId) => {
    const driver = KIEROWCY.find(k => k.id === parseInt(driverId));
    if (!driver) return 'Brak danych';
    
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
        if (distance <= 75) return distance * 13;
        if (distance > 75 && distance <= 150) return distance * 8;
        return distance * 3;
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
      const summaryByMpk = filteredArchiwum.reduce((acc, transport) => {
        const mpk = transport.mpk || 'Brak MPK';
        const distance = transport.distance || 0;
        const cost = calculateTransportCost(distance);
        if (!acc[mpk]) acc[mpk] = { totalCost: 0 };
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
    const ws_main = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws_main, "Transporty");
    const ws_summary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws_summary, "Podsumowanie po MPK");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  const totalDistance = filteredArchiwum.reduce((sum, t) => sum + (t.distance || 0), 0)

  const RatingDisplay = React.memo(({ transportId }) => {
    const rating = transportRatings[transportId]
    
    if (ratingsLoading && !rating) {
        return (
            <div className="flex items-center">
                <Loader size={14} className="mr-1 animate-spin text-gray-400" />
                <span className="text-gray-400 text-sm">Ładowanie...</span>
            </div>
        )
    }

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
  })

  const RatingButtons = React.memo(({ transport }) => {
    const rating = transportRatings[transport.id]
    
    if (ratingsLoading && !rating) {
        return (
            <div className="flex items-center">
                <Loader size={14} className="mr-1 animate-spin text-gray-400" />
            </div>
        )
    }

    if (!rating) return null;

    const hasMainRating = rating.stats.totalRatings > 0
    const userHasMainRating = rating.hasUserRated
    
    return (
      <div className="flex flex-col space-y-1">
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
            ? (userHasMainRating ? 'Edytuj/Komentuj' : 'Dodaj komentarz') 
            : 'Oceń transport'
          }
        </button>
      </div>
    )
  })

  const CompleteRatingModal = ({ transport, onClose }) => {
    const [ratings, setRatings] = useState({
      driverProfessional: null, driverTasksCompleted: null, cargoComplete: null,
      cargoCorrect: null, deliveryNotified: null, deliveryOnTime: null
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

    useEffect(() => {
      const fetchComments = async () => {
        try {
          setLoadingComments(true)
          const response = await fetch(`/api/transport-comments?transportId=${transport.id}`)
          const data = await response.json()
          if (data.success) setAllComments(data.comments || [])
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
        setRatings(transportRating.userRating.ratings || {})
        setComment(transportRating.userRating.comment || '')
        setIsEditMode(false)
      } else if (!hasMainRating) {
        setIsEditMode(true)
      }
    }, [userHasRated, transportRating, hasMainRating])

    const categories = [
      { id: 'driver', title: '👨‍💼 Kierowca', criteria: [
          { key: 'driverProfessional', text: 'Kierowca zachował się profesjonalnie.' },
          { key: 'driverTasksCompleted', text: 'Kierowca zrealizował zadania.' }
      ]},
      { id: 'cargo', title: '📦 Towar', criteria: [
          { key: 'cargoComplete', text: 'Towar był kompletny.' },
          { key: 'cargoCorrect', text: 'Dostarczono właściwy towar.' }
      ]},
      { id: 'delivery', title: '🚚 Organizacja', criteria: [
          { key: 'deliveryNotified', text: 'Dostawa była awizowana.' },
          { key: 'deliveryOnTime', text: 'Towar dotarł w terminie.' }
      ]}
    ]

    const handleSubmitRating = async (e) => {
        e.preventDefault();
        if (!hasMainRating && Object.values(ratings).some(r => r === null)) {
            setError('Proszę ocenić wszystkie kryteria.');
            return;
        }

        try {
            setSubmitting(true);
            setError('');

            const positiveCount = Object.values(ratings).filter(r => r === true).length;
            const ratedCount = Object.values(ratings).filter(r => r !== null).length;
            const isPositive = ratedCount > 0 ? (positiveCount / ratedCount) >= 0.5 : true;

            const response = await fetch('/api/transport-ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transportId: transport.id,
                    isPositive: isPositive,
                    comment: comment.trim()
                })
            });

            const result = await response.json();
            if (result.success) {
                setSuccess(true);
                setIsEditMode(false);
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setError(result.error || 'Wystąpił błąd podczas zapisywania oceny.');
            }
        } catch (error) {
            console.error('Błąd wysyłania oceny:', error);
            setError('Wystąpił błąd sieci. Spróbuj ponownie.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddComment = async () => {
      if (!newComment.trim()) return
      try {
        setAddingComment(true)
        const response = await fetch('/api/transport-comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transportId: transport.id, comment: newComment.trim() })
        })
        const result = await response.json()
        if (result.success) {
          setNewComment('')
          const commentsResponse = await fetch(`/api/transport-comments?transportId=${transport.id}`)
          const commentsData = await commentsResponse.json()
          if (commentsData.success) setAllComments(commentsData.comments || [])
        } else {
          setError(result.error || 'Nie udało się dodać komentarza.')
        }
      } catch (error) {
        setError('Błąd dodawania komentarza.')
      } finally {
        setAddingComment(false)
      }
    }

    const renderRatingButton = (criteriaKey, value, label) => {
      const isSelected = ratings[criteriaKey] === value
      const disabled = hasMainRating && !isEditMode
      const baseClasses = "flex items-center justify-center px-3 py-2 rounded-md transition-colors text-sm font-medium border"
      if (disabled) {
        const readOnlyClasses = isSelected ? (value ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300") : "bg-gray-50 text-gray-400 border-gray-200"
        return <div className={`${baseClasses} ${readOnlyClasses} cursor-not-allowed`}>{value ? <ThumbsUp size={16} className="mr-1" /> : <ThumbsDown size={16} className="mr-1" />}{label}</div>
      }
      const selectedClasses = value ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"
      const unselectedClasses = "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"
      return <button type="button" onClick={() => setRatings(prev => ({ ...prev, [criteriaKey]: value }))} className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}>{value ? <ThumbsUp size={16} className="mr-1" /> : <ThumbsDown size={16} className="mr-1" />}{label}</button>
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{!hasMainRating ? 'Oceń transport' : 'Ocena i komentarze'}</h2>
                <p className="text-gray-600 mt-1">{transport.destination_city} - {transport.client_name}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            {success && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md flex items-center"><CheckCircle size={16} className="mr-2" />{userHasRated ? 'Ocena zaktualizowana!' : 'Ocena zapisana!'}</div>}
            {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md flex items-center"><AlertCircle size={16} className="mr-2" />{error}</div>}
            {hasMainRating && (
              <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold mb-4 text-blue-900">⭐ Ocena transportu: {transportRating.stats.overallRatingPercentage}%</h3>
                {userHasRated && !isEditMode && <button onClick={() => setIsEditMode(true)} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"><Edit size={16} className="mr-1" /> Edytuj ocenę</button>}
              </div>
            )}
            {(!hasMainRating || (userHasRated && isEditMode)) && (
              <form onSubmit={handleSubmitRating} className="space-y-6 mb-8">
                {categories.map(category => (
                  <div key={category.id} className="border p-6 rounded-lg">
                    <h4 className="text-lg font-semibold mb-4">{category.title}</h4>
                    {category.criteria.map(criteria => (
                      <div key={criteria.key} className="mb-4 last:mb-0">
                        <p className="text-gray-700 mb-3">{criteria.text}</p>
                        <div className="flex space-x-3">{renderRatingButton(criteria.key, true, 'Tak')}{renderRatingButton(criteria.key, false, 'Nie')}</div>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="border p-6 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Komentarz (opcjonalny)</label>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className="w-full border-gray-300 rounded-md focus:ring-blue-500" />
                </div>
                <div className="flex justify-end space-x-3">
                  {isEditMode && userHasRated && <button type="button" onClick={() => setIsEditMode(false)} className="px-4 py-2 border rounded-md">Anuluj</button>}
                  <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Zapisywanie...' : 'Zapisz'}</button>
                </div>
              </form>
            )}
            <div className="mt-8">
              <h3 className="font-semibold text-lg mb-4">💬 Komentarze ({allComments.length})</h3>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex space-x-3">
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={3} className="flex-1 border-gray-300 rounded-md" placeholder="Dodaj komentarz..." />
                  <button onClick={handleAddComment} disabled={!newComment.trim() || addingComment} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"><Send size={16} className="mr-1" />{addingComment ? '...' : 'Dodaj'}</button>
                </div>
              </div>
              {loadingComments ? <div>Ładowanie...</div> : allComments.length > 0 ? (
                <div className="space-y-4">
                  {allComments.map(c => (
                    <div key={c.id} className="border p-4 rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium">{c.commenter_email}</span>
                        <span className="text-sm text-gray-500">{format(new Date(c.created_at), 'dd.MM.yyyy HH:mm')}</span>
                      </div>
                      <p>{c.comment}</p>
                    </div>
                  ))}
                </div>
              ) : <p>Brak komentarzy.</p>}
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Archiwum Transportów</h1>
        <p className="text-gray-600">Zarządzaj zakończonymi transportami i ich ocenami</p>
      </div>
      {deleteStatus && <div className={`mb-4 p-4 rounded-lg ${deleteStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{deleteStatus.message}</div>}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Filtry</h3>
          <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="flex items-center text-blue-600 hover:text-blue-700 font-medium">
            <span>Filtry zaawansowane</span>
            <ChevronDown size={16} className={`ml-1 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rok</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Miesiąc</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
              {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Magazyn</label>
            <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
              <option value="">Wszystkie</option>
              <option value="bialystok">Białystok</option>
              <option value="zielonka">Zielonka</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status oceny</label>
            <select value={selectedRating} onChange={(e) => setSelectedRating(e.target.value)} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
              {ratingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kierowca</label>
              <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
                <option value="">Wszyscy</option>
                {KIEROWCY.map(driver => <option key={driver.id} value={driver.id}>{driver.imie}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zamówił</label>
              <select value={selectedRequester} onChange={(e) => setSelectedRequester(e.target.value)} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
                <option value="">Wszyscy</option>
                {users.map(user => <option key={user.email} value={user.email}>{user.name || user.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budowa</label>
              <select value={selectedConstruction} onChange={(e) => setSelectedConstruction(e.target.value)} className="w-full border-gray-300 rounded-md focus:ring-blue-500">
                <option value="">Wszystkie</option>
                {constructions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 flex items-center"><Truck className="h-8 w-8 text-blue-600 mr-4" /><div><p className="text-sm font-medium text-gray-600">Liczba transportów</p><p className="text-2xl font-bold">{filteredArchiwum.length}</p></div></div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center"><Route className="h-8 w-8 text-green-600 mr-4" /><div><p className="text-sm font-medium text-gray-600">Łączna odległość</p><p className="text-2xl font-bold">{totalDistance.toLocaleString()} km</p></div></div>
        <div className="bg-white rounded-lg shadow p-6 flex items-center"><Download className="h-8 w-8 text-purple-600 mr-4" /><div><p className="text-sm font-medium text-gray-600">Eksport</p><div className="flex items-center mt-1"><select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="mr-2 border-gray-300 rounded-md text-sm"><option value="xlsx">Excel</option><option value="csv">CSV</option></select><button onClick={exportData} className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">Eksportuj</button></div></div></div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miejscowość</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firma</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magazyn</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ocena</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentItems.map((transport) => (
                <React.Fragment key={transport.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{format(new Date(transport.delivery_date), 'dd.MM.yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transport.destination_city}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{transport.client_name || 'Brak'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getMagazynName(transport.source_warehouse)}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><RatingDisplay transportId={transport.id} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <RatingButtons transport={transport} />
                        <button onClick={() => setExpandedRows(p => ({...p, [transport.id]: !p[transport.id]}))} className="p-2 rounded-md hover:bg-gray-100"><Eye size={16} /></button>
                        {isAdmin && <button onClick={() => handleDeleteTransport(transport.id)} className="p-2 rounded-md hover:bg-red-100 text-red-600"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                  {expandedRows[transport.id] && (
                    <tr>
                      <td colSpan="6" className="p-4 bg-gray-50">
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-semibold mb-2">Szczegóły dostawy</h4>
                            <p><strong>Adres:</strong> {transport.street}, {transport.postal_code} {transport.destination_city}</p>
                            <p><strong>MPK:</strong> {transport.mpk || '-'}</p>
                            <p><strong>WZ:</strong> {transport.wz_number || '-'}</p>
                            <p><strong>Odległość:</strong> {transport.distance} km</p>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Dodatkowe informacje</h4>
                            <p><strong>Kierowca:</strong> {getDriverInfo(transport.driver_id, transport.vehicle_id)}</p>
                            <p><strong>Zamówił:</strong> {transport.requester_email}</p>
                            {transport.notes && <p><strong>Uwagi:</strong> {transport.notes}</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filteredArchiwum.length === 0 && <div className="text-center py-12"><Package size={48} className="mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-medium">Brak transportów</h3><p className="text-gray-500">Nie znaleziono transportów dla wybranych filtrów.</p></div>}
        </div>
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium">Poprzednie</button>
              <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium">Następne</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div><p className="text-sm text-gray-700">Pokazano <span className="font-medium">{indexOfFirstItem + 1}</span> do <span className="font-medium">{Math.min(indexOfLastItem, filteredArchiwum.length)}</span> z <span className="font-medium">{filteredArchiwum.length}</span> wyników</p></div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                  {/* NAPRAWIONA SEKCJA PAGINACJI */}
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
                    
                    if (page > totalPages || page < 1) return null;

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
                  <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16} /></button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
      {showRatingModal && <CompleteRatingModal transport={selectedTransport} onClose={handleCloseRating} />}
    </div>
  )
}
