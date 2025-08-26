// src/app/wnioski-transportowe/page.js
'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { 
  Filter,
  Calendar, 
  MapPin, 
  User, 
  Phone, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  Check,
  X,
  Eye,
  AlertCircle,
  Building,
  Mail
} from 'lucide-react'

export default function WnioskiTransportowePage() {
  const [requests, setRequests] = useState([])
  const [filteredRequests, setFilteredRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState('bialystok') // NOWY STAN
  
  // Filtry
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Pobierz dane użytkownika
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user')
        const data = await response.json()
        
        if (data.isAuthenticated && data.user) {
          setUserInfo(data.user)
          
          // Sprawdź czy użytkownik ma uprawnienia do zarządzania wnioskami
          const role = data.user.role
          const permissions = data.user.permissions || {}
          
          const canManageRequests = 
            role === 'admin' ||
            role === 'magazyn' ||
            role?.startsWith('magazyn_') ||
            permissions?.transport_requests?.approve === true

          if (!canManageRequests) {
            setError('Brak uprawnień do zarządzania wnioskami transportowymi')
            return
          }
        } else {
          setError('Brak autoryzacji')
        }
      } catch (err) {
        console.error('Błąd pobierania danych użytkownika:', err)
        setError('Błąd pobierania danych użytkownika')
      }
    }

    fetchUserInfo()
  }, [])

  // Pobierz wnioski
  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transport-requests')
      const data = await response.json()

      if (data.success) {
        setRequests(data.requests)
        setFilteredRequests(data.requests)
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error('Błąd pobierania wniosków:', err)
      setError('Wystąpił błąd podczas pobierania wniosków')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userInfo) {
      fetchRequests()
    }
  }, [userInfo])

  // Filtrowanie wniosków
  useEffect(() => {
    let filtered = [...requests]

    // Filtr po statusie
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter)
    }

    // Filtr po dacie
    if (dateFilter !== 'all') {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)

      filtered = filtered.filter(req => {
        const reqDate = new Date(req.created_at)
        switch (dateFilter) {
          case 'today':
            return reqDate.toDateString() === today.toDateString()
          case 'yesterday':
            return reqDate.toDateString() === yesterday.toDateString()
          case 'week':
            return reqDate >= weekAgo
          default:
            return true
        }
      })
    }

    // Wyszukiwanie tekstowe
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(req =>
        req.destination_city?.toLowerCase().includes(term) ||
        req.requester_name.toLowerCase().includes(term) ||
        req.client_name?.toLowerCase().includes(term) ||
        req.real_client_name?.toLowerCase().includes(term) ||
        req.construction_name?.toLowerCase().includes(term) ||
        req.mpk?.toLowerCase().includes(term) ||
        req.justification.toLowerCase().includes(term) ||
        // Pola dla przesunięć międzymagazynowych
        req.goods_description?.toLowerCase().includes(term) ||
        req.document_numbers?.toLowerCase().includes(term) ||
        (req.transport_direction === 'zielonka_bialystok' && 'zielonka białystok'.includes(term)) ||
        (req.transport_direction === 'bialystok_zielonka' && 'białystok zielonka'.includes(term))
      )
    }

    setFilteredRequests(filtered)
  }, [requests, statusFilter, dateFilter, searchTerm])

  // ZAKTUALIZOWANA FUNKCJA AKCEPTACJI z magazynem
  const handleApprove = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const response = await fetch('/api/transport-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: 'approve',
          source_warehouse: selectedWarehouse // Dodajemy wybrany magazyn
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`Wniosek został zaakceptowany i dodany do kalendarza magazynu ${selectedWarehouse === 'bialystok' ? 'Białystok' : 'Zielonka'}!`)
        setShowApprovalModal(false)
        setSelectedRequest(null)
        setSelectedWarehouse('bialystok') // Reset wyboru
        fetchRequests()
      } else {
        alert('Błąd: ' + data.error)
      }
    } catch (err) {
      console.error('Błąd akceptacji wniosku:', err)
      alert('Wystąpił błąd podczas akceptacji wniosku')
    } finally {
      setProcessing(false)
    }
  }

  // Odrzucenie wniosku
  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) return

    setProcessing(true)
    try {
      const response = await fetch('/api/transport-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: 'reject',
          rejection_reason: rejectionReason
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Wniosek został odrzucony')
        setShowRejectionModal(false)
        setSelectedRequest(null)
        setRejectionReason('')
        fetchRequests()
      } else {
        alert('Błąd: ' + data.error)
      }
    } catch (err) {
      console.error('Błąd odrzucania wniosku:', err)
      alert('Wystąpił błąd podczas odrzucania wniosku')
    } finally {
      setProcessing(false)
    }
  }

  // Funkcja do formatowania statusu
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Oczekuje
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Zaakceptowany
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Odrzucony
          </span>
        )
      default:
        return status
    }
  }

  // Funkcja do obliczania priorytetu (pilność na podstawie daty dostawy)
  const getPriorityBadge = (deliveryDate) => {
    const today = new Date()
    const delivery = new Date(deliveryDate)
    const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24))

    if (diffDays <= 1) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Pilne
        </span>
      )
    } else if (diffDays <= 3) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Ważne
        </span>
      )
    }
    return null
  }

  // Funkcja do mapowania ID rynku na nazwę
  const getMarketName = (marketId) => {
    const markets = ['', 'Podlaski', 'Mazowiecki', 'Małopolski', 'Wielkopolski', 'Dolnośląski', 'Śląski', 'Lubelski', 'Pomorski'];
    return markets[marketId] || 'Nieznany';
  }

  if (loading && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Nagłówek */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Wnioski transportowe</h1>
          <p className="mt-2 text-gray-600">Zarządzaj wnioskami o transport własny</p>
        </div>

        {/* Filtry i wyszukiwanie */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Wyszukiwanie */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wyszukaj
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Miasto, zlecający, klient, MPK..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Filtr statusu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">Wszystkie</option>
                <option value="pending">Oczekujące</option>
                <option value="approved">Zaakceptowane</option>
                <option value="rejected">Odrzucone</option>
              </select>
            </div>

            {/* Filtr daty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data złożenia
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">Wszystkie</option>
                <option value="today">Dzisiaj</option>
                <option value="yesterday">Wczoraj</option>
                <option value="week">Ostatni tydzień</option>
              </select>
            </div>
          </div>

          {/* Statystyki */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{requests.length}</div>
              <div className="text-sm text-blue-600">Wszystkich</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {requests.filter(r => r.status === 'pending').length}
              </div>
              <div className="text-sm text-yellow-600">Oczekuje</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {requests.filter(r => r.status === 'approved').length}
              </div>
              <div className="text-sm text-green-600">Zaakceptowane</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {requests.filter(r => r.status === 'rejected').length}
              </div>
              <div className="text-sm text-red-600">Odrzucone</div>
            </div>
          </div>
        </div>

        {/* Lista wniosków */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Wnioski transportowe ({filteredRequests.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Ładowanie wniosków...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="mt-2 text-gray-600">
                {requests.length === 0 
                  ? 'Nie ma żadnych wniosków transportowych'
                  : 'Brak wniosków spełniających kryteria wyszukiwania'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-medium text-gray-900">
                            Wniosek #{request.id}
                          </h3>
                          {/* Typ wniosku */}
                          {request.transport_type === 'warehouse' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Przesunięcie międzymagazynowe
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Transport standardowy
                            </span>
                          )}
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.delivery_date)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(request.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                        </div>
                      </div>

                      {/* Informacje podstawowe - różne w zależności od typu */}
                      {request.transport_type === 'warehouse' ? (
                        // Informacje dla przesunięć międzymagazynowych
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4 bg-green-50 p-4 rounded-lg">
                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <MapPin className="w-4 h-4 mr-2" />
                              <strong>Kierunek transportu:</strong>
                            </div>
                            <div className="ml-6 text-gray-900 font-medium">
                              {request.transport_direction === 'zielonka_bialystok' ? 'Zielonka → Białystok' : 
                               request.transport_direction === 'bialystok_zielonka' ? 'Białystok → Zielonka' : 
                               request.transport_direction}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <Calendar className="w-4 h-4 mr-2" />
                              <strong>Data transportu:</strong>
                            </div>
                            <div className="ml-6 text-gray-900">
                              {format(new Date(request.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <User className="w-4 h-4 mr-2" />
                              <strong>Zlecający:</strong>
                            </div>
                            <div className="ml-6 text-gray-900">
                              {request.requester_name}
                              <div className="text-gray-600 flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {request.requester_email}
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-3">
                            <div className="flex items-start text-gray-600 mb-1">
                              <FileText className="w-4 h-4 mr-2 mt-0.5" />
                              <strong>Transportowane towary:</strong>
                            </div>
                            <div className="ml-6 text-gray-900 bg-white p-2 rounded border">
                              {request.goods_description}
                            </div>
                          </div>

                          {request.document_numbers && (
                            <div className="md:col-span-3">
                              <div className="flex items-center text-gray-600 mb-1">
                                <FileText className="w-4 h-4 mr-2" />
                                <strong>Numery dokumentów:</strong>
                              </div>
                              <div className="ml-6 text-gray-900">
                                {request.document_numbers}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Informacje dla standardowych transportów
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <MapPin className="w-4 h-4 mr-2" />
                              <strong>Trasa:</strong>
                            </div>
                            <div className="ml-6 text-gray-900">
                              {request.destination_city}
                              {request.postal_code && `, ${request.postal_code}`}
                              {request.street && (
                                <div className="text-gray-600">{request.street}</div>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <Calendar className="w-4 h-4 mr-2" />
                              <strong>Data dostawy:</strong>
                            </div>
                            <div className="ml-6 text-gray-900">
                              {format(new Date(request.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <User className="w-4 h-4 mr-2" />
                              <strong>Zlecający:</strong>
                            </div>
                            <div className="ml-6 text-gray-900">
                              {request.requester_name}
                              <div className="text-gray-600 flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {request.requester_email}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Szczegółowe informacje z wniosku - tylko dla standardowych transportów */}
                      {request.transport_type !== 'warehouse' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4 bg-blue-50 p-4 rounded-lg">
                          <div>
                            <div className="text-gray-600 mb-1">
                              <strong>Handlowiec/Budowa:</strong>
                            </div>
                            <div className="text-gray-900">{request.client_name || 'Brak danych'}</div>
                          </div>

                          <div>
                            <div className="text-gray-600 mb-1">
                              <strong>Rzeczywisty klient:</strong>
                            </div>
                            <div className="text-gray-900">{request.real_client_name || 'Brak danych'}</div>
                          </div>

                          <div>
                            <div className="text-gray-600 mb-1">
                              <strong>Numery WZ:</strong>
                            </div>
                            <div className="text-gray-900">{request.wz_numbers || 'Brak danych'}</div>
                          </div>

                          <div>
                            <div className="text-gray-600 mb-1">
                              <strong>Rynek:</strong>
                            </div>
                            <div className="text-gray-900">
                              {request.market_id ? getMarketName(request.market_id) : 'Brak danych'}
                            </div>
                          </div>

                          <div>
                            <div className="text-gray-600 mb-1">
                              <strong>Budowa:</strong>
                            </div>
                            <div className="text-gray-900">{request.construction_name || 'Brak danych'}</div>
                          </div>

                          <div>
                            <div className="text-gray-600 mb-1">
                              <strong>MPK:</strong>
                            </div>
                            <div className="text-gray-900">{request.mpk || 'Brak danych'}</div>
                          </div>
                        </div>
                      )}

                      {/* Dodatkowe informacje - tylko dla standardowych transportów */}
                      {request.transport_type !== 'warehouse' && request.contact_person && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <div className="flex items-center text-gray-600 mb-1">
                              <User className="w-4 h-4 mr-2" />
                              <strong>Kontakt:</strong>
                            </div>
                            <div className="ml-6 text-gray-900">
                              {request.contact_person}
                              {request.contact_phone && (
                                <div className="text-gray-600 flex items-center">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {request.contact_phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Uzasadnienie */}
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">Uzasadnienie:</div>
                        <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                          {request.justification}
                        </div>
                      </div>

                      {/* Uwagi */}
                      {request.notes && (
                        <div className="mb-4">
                          <div className="text-sm font-medium text-gray-700 mb-2">Dodatkowe uwagi:</div>
                          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                            {request.notes}
                          </div>
                        </div>
                      )}

                      {/* Powód odrzucenia */}
                      {request.rejection_reason && (
                        <div className="mb-4">
                          <div className="text-sm font-medium text-red-700 mb-2">Powód odrzucenia:</div>
                          <div className="text-sm text-red-800 bg-red-50 p-3 rounded-md">
                            {request.rejection_reason}
                          </div>
                        </div>
                      )}

                      {/* Info o przetworzeniu */}
                      {request.approved_at && (
                        <div className="text-xs text-gray-500">
                          {request.status === 'approved' ? 'Zaakceptowany' : 'Przetworzony'}: {format(new Date(request.approved_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                          {request.approved_by && ` przez ${request.approved_by}`}
                          {request.transport_id && (
                            <span className="ml-2 text-blue-600">
                              (Transport #{request.transport_id})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Akcje */}
                    {request.status === 'pending' && (
                      <div className="ml-6 flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowApprovalModal(true)
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                          title="Zaakceptuj wniosek"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Akceptuj
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequest(request)
                            setShowRejectionModal(true)
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                          title="Odrzuć wniosek"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Odrzuć
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ZAKTUALIZOWANY MODAL AKCEPTACJI z wyborem magazynu */}
        {showApprovalModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Potwierdź akceptację wniosku
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Czy na pewno chcesz zaakceptować wniosek #{selectedRequest.id}?
                Po akceptacji zostanie automatycznie utworzony transport w kalendarzu.
              </p>
              
              {/* UJEDNOLICONY WYBÓR MAGAZYNU dla wszystkich typów */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Magazyn realizujący transport *
                </label>
                  {selectedRequest.transport_type === 'warehouse' ? (
                    // Radio buttons dla przesunięć międzymagazynowych
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="warehouse_choice"
                          value={selectedRequest.transport_direction === 'zielonka_bialystok' ? 'zielonka' : 'bialystok'}
                          checked={selectedWarehouse === (selectedRequest.transport_direction === 'zielonka_bialystok' ? 'zielonka' : 'bialystok')}
                          onChange={(e) => setSelectedWarehouse(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">
                          {selectedRequest.transport_direction === 'zielonka_bialystok' 
                            ? 'Magazyn Zielonka (jedzie do Białegostoku)' 
                            : 'Magazyn Białystok (jedzie do Zielonki)'}
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="warehouse_choice"
                          value={selectedRequest.transport_direction === 'zielonka_bialystok' ? 'bialystok' : 'zielonka'}
                          checked={selectedWarehouse === (selectedRequest.transport_direction === 'zielonka_bialystok' ? 'bialystok' : 'zielonka')}
                          onChange={(e) => setSelectedWarehouse(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">
                          {selectedRequest.transport_direction === 'zielonka_bialystok' 
                            ? 'Magazyn Białystok (jedzie do Zielonki)' 
                            : 'Magazyn Zielonka (jedzie do Białegostoku)'}
                        </span>
                      </label>
                    </div>
                  ) : (
                    // Select dla standardowych transportów
                    <select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="bialystok">Magazyn Białystok</option>
                      <option value="zielonka">Magazyn Zielonka</option>
                    </select>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedRequest.transport_type === 'warehouse' 
                      ? 'Wybierz magazyn, który będzie realizował przesunięcie międzymagazynowe'
                      : 'Wybierz magazyn, z którego będzie realizowany transport'
                    }
                  </p>
                </div>
              
              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <div className="text-sm">
                  {selectedRequest.transport_type === 'warehouse' ? (
                    <>
                      <strong>Typ:</strong> Przesunięcie międzymagazynowe
                      <br />
                      <strong>Kierunek:</strong> {selectedRequest.transport_direction === 'zielonka_bialystok' ? 'Zielonka → Białystok' : 'Białystok → Zielonka'}
                      <br />
                      <strong>Data:</strong> {format(new Date(selectedRequest.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                      <br />
                      <strong>Towary:</strong> {selectedRequest.goods_description}
                      <br />
                      <strong>Zlecający:</strong> {selectedRequest.requester_name}
                    </>
                  ) : (
                    <>
                      <strong>Typ:</strong> Transport standardowy
                      <br />
                      <strong>Trasa:</strong> {selectedRequest.destination_city}
                      <br />
                      <strong>Data:</strong> {format(new Date(selectedRequest.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                      <br />
                      <strong>Zlecający:</strong> {selectedRequest.requester_name}
                      <br />
                      <strong>Magazyn:</strong> <span className="font-medium text-blue-600">
                        {selectedWarehouse === 'bialystok' ? 'Białystok' : 'Zielonka'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowApprovalModal(false)
                    setSelectedRequest(null)
                    setSelectedWarehouse('bialystok') // Reset przy anulowaniu
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={processing}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  disabled={processing}
                >
                  {processing ? 'Przetwarzanie...' : 'Akceptuj'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal odrzucenia */}
        {showRejectionModal && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Odrzuć wniosek #{selectedRequest.id}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Podaj powód odrzucenia wniosku:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                placeholder="Wpisz powód odrzucenia..."
              />
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectionModal(false)
                    setSelectedRequest(null)
                    setRejectionReason('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled={processing}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  disabled={processing || !rejectionReason.trim()}
                >
                  {processing ? 'Przetwarzanie...' : 'Odrzuć wniosek'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
