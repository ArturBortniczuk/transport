// src/app/wnioski-transportowe/page.js - KOMPLETNY PLIK
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

// Mapa nazw centrów dla objazdówek
const CENTRA_NAZWY = {
  lapy: 'Łapy',
  wysokie: 'Wysokie Mazowieckie',
  bielsk: 'Bielsk Podlaski',
  bialystok: 'Białystok (centrum elektryczne)'
};

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
          
          const role = data.user.role
          const permissions = data.user.permissions || {}
          
          const canManageRequests = 
            role === 'admin' ||
            role === 'magazyn' ||
            role?.startsWith('magazyn_') ||
            permissions?.transport_requests?.approve === true
          
          if (!canManageRequests) {
            setError('Brak uprawnień do zarządzania wnioskami transportowymi')
          }
        } else {
          setError('Brak autoryzacji')
        }
      } catch (err) {
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
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Wystąpił błąd podczas pobierania wniosków')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userInfo && !error) {
      fetchRequests()
    }
  }, [userInfo, error])

  // Filtrowanie wniosków
  useEffect(() => {
    let filtered = [...requests]

    // Filtr statusu
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Filtr daty
    if (dateFilter !== 'all') {
      const now = new Date()
      filtered = filtered.filter(r => {
        const createdDate = new Date(r.created_at)
        const daysDiff = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))
        
        switch(dateFilter) {
          case 'today':
            return daysDiff === 0
          case 'yesterday':
            return daysDiff === 1
          case 'week':
            return daysDiff <= 7
          default:
            return true
        }
      })
    }

    // Wyszukiwanie
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        (r.destination_city && r.destination_city.toLowerCase().includes(search)) ||
        (r.requester_name && r.requester_name.toLowerCase().includes(search)) ||
        (r.requester_email && r.requester_email.toLowerCase().includes(search)) ||
        (r.client_name && r.client_name.toLowerCase().includes(search)) ||
        (r.real_client_name && r.real_client_name.toLowerCase().includes(search)) ||
        (r.mpk && r.mpk.toLowerCase().includes(search)) ||
        (r.construction_name && r.construction_name.toLowerCase().includes(search))
      )
    }

    setFilteredRequests(filtered)
  }, [requests, statusFilter, dateFilter, searchTerm])

  // Akceptacja wniosku
  const handleApprove = async () => {
    if (!selectedRequest) return

    setProcessing(true)
    try {
      const response = await fetch('/api/transport-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action: 'approve'
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Wniosek został zaakceptowany')
        setShowApprovalModal(false)
        setSelectedRequest(null)
        fetchRequests()
      } else {
        alert('Błąd: ' + data.error)
      }
    } catch (err) {
      alert('Wystąpił błąd podczas akceptacji wniosku')
    } finally {
      setProcessing(false)
    }
  }

  // Odrzucenie wniosku
  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      alert('Podaj powód odrzucenia wniosku')
      return
    }

    setProcessing(true)
    try {
      const response = await fetch('/api/transport-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      alert('Wystąpił błąd podczas odrzucania wniosku')
    } finally {
      setProcessing(false)
    }
  }

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
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
                  ? 'Nie ma jeszcze żadnych wniosków transportowych'
                  : 'Brak wniosków spełniających kryteria filtrowania'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        Wniosek #{request.id}
                      </h3>
                      {/* Badge typu wniosku */}
                      {request.transport_type === 'delivery_route' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Objazdówka (centra elektryczne)
                        </span>
                      ) : request.transport_type === 'warehouse' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Przesunięcie międzymagazynowe
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Transport standardowy
                        </span>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {/* Szczegóły dla OBJAZDÓWEK */}
                  {request.transport_type === 'delivery_route' && (
                    <div className="grid grid-cols-1 gap-4 text-sm mb-4 bg-purple-50 p-4 rounded-lg">
                      <div>
                        <div className="flex items-start text-gray-600 mb-1">
                          <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                          <strong>Trasa objazdówki:</strong>
                        </div>
                        <div className="ml-6 text-gray-900 font-medium">
                          {(() => {
                            try {
                              const points = JSON.parse(request.route_points || '[]');
                              return points.map((point, idx) => (
                                <span key={idx} className="inline-flex items-center">
                                  {CENTRA_NAZWY[point]}
                                  {idx < points.length - 1 && (
                                    <span className="mx-2 text-purple-600">→</span>
                                  )}
                                </span>
                              ));
                            } catch (e) {
                              return 'Błąd odczytu trasy';
                            }
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <FileText className="w-4 h-4 mr-2" />
                            <strong>Dystans:</strong>
                          </div>
                          <div className="ml-6 text-gray-900 font-semibold">
                            {request.route_distance || 0} km
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center text-gray-600 mb-1">
                            <Building className="w-4 h-4 mr-2" />
                            <strong>MPK centrów:</strong>
                          </div>
                          <div className="ml-6 text-gray-900">
                            {request.route_mpks || 'Brak'}
                          </div>
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

                      {request.document_numbers && (
                        <div>
                          <div className="flex items-center text-gray-600 mb-1">
                            <FileText className="w-4 h-4 mr-2" />
                            <strong>Numery dokumentów:</strong>
                          </div>
                          <div className="ml-6 text-gray-900">
                            {request.document_numbers}
                          </div>
                        </div>
                      )}

                      {request.notes && (
                        <div>
                          <div className="flex items-start text-gray-600 mb-1">
                            <FileText className="w-4 h-4 mr-2 mt-0.5" />
                            <strong>Uwagi:</strong>
                          </div>
                          <div className="ml-6 text-gray-900">
                            {request.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Szczegóły dla przesunięć międzymagazynowych */}
                  {request.transport_type === 'warehouse' && (
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
                  )}

                  {/* Szczegóły dla standardowych transportów */}
                  {request.transport_type !== 'warehouse' && request.transport_type !== 'delivery_route' && (
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
                          <strong>MPK:</strong>
                        </div>
                        <div className="text-gray-900">{request.mpk || 'Brak danych'}</div>
                      </div>

                      <div>
                        <div className="text-gray-600 mb-1">
                          <strong>Lokalizacja:</strong>
                        </div>
                        <div className="text-gray-900">
                          {request.destination_city}
                          {request.postal_code && `, ${request.postal_code}`}
                          {request.street && `, ${request.street}`}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-600 mb-1">
                          <strong>Data dostawy:</strong>
                        </div>
                        <div className="text-gray-900">
                          {format(new Date(request.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-600 mb-1">
                          <strong>Zlecający:</strong>
                        </div>
                        <div className="text-gray-900">
                          {request.requester_name}
                          <div className="text-gray-600 text-xs">{request.requester_email}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Uzasadnienie - tylko dla standardowych i warehouse */}
                  {request.justification && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm">
                        <strong className="text-gray-700">Uzasadnienie:</strong>
                        <span className="text-gray-900 ml-2">{request.justification}</span>
                      </p>
                    </div>
                  )}

                  {/* Uwagi */}
                  {request.notes && request.transport_type !== 'delivery_route' && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm">
                        <strong className="text-gray-700">Uwagi:</strong>
                        <span className="text-gray-900 ml-2">{request.notes}</span>
                      </p>
                    </div>
                  )}

                  {/* Powód odrzucenia */}
                  {request.rejection_reason && (
                    <div className="mt-2 p-3 bg-red-50 rounded-md">
                      <p className="text-sm text-red-800">
                        <strong>Powód odrzucenia:</strong> {request.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Akcje */}
                  {request.status === 'pending' && (
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowApprovalModal(true)
                        }}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Zaakceptuj
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request)
                          setShowRejectionModal(true)
                        }}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Odrzuć
                      </button>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-500">
                    Utworzony: {format(new Date(request.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                    {request.approved_at && (
                      <span className="ml-4">
                        Przetworzony: {format(new Date(request.approved_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                        {request.approved_by && ` przez ${request.approved_by}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal akceptacji */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4">
                Zaakceptować wniosek?
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Czy na pewno chcesz zaakceptować wniosek #{selectedRequest.id}?
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="px-4 py-2 bg-green-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {processing ? 'Przetwarzanie...' : 'Zaakceptuj'}
                </button>
                <button
                  onClick={() => {
                    setShowApprovalModal(false)
                    setSelectedRequest(null)
                  }}
                  disabled={processing}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal odrzucenia */}
      {showRejectionModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-4 text-center">
                Odrzucić wniosek?
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 mb-3">
                  Podaj powód odrzucenia wniosku #{selectedRequest.id}:
                </p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  placeholder="Wpisz powód odrzucenia..."
                />
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {processing ? 'Przetwarzanie...' : 'Odrzuć wniosek'}
                </button>
                <button
                  onClick={() => {
                    setShowRejectionModal(false)
                    setSelectedRequest(null)
                    setRejectionReason('')
                  }}
                  disabled={processing}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// KONIEC PLIKU src/app/wnioski-transportowe/page.js