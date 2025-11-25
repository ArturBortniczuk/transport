// src/app/oceny/page.js - NAPRAWIONA WERSJA z właściwym Badge dla spedycji
'use client'
import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Star, Filter, ChevronDown, Calendar, AlertCircle } from 'lucide-react'
import CompleteRatingModal from '@/components/CompleteRatingModal'
import SpeditionRatingModal from '@/components/SpeditionRatingModal'
import TransportDetailedRatingBadge from '@/components/TransportRatingBadge'
import { KIEROWCY } from '@/app/kalendarz/constants'

// Mapowanie kodu MPK na rynek
const getMarketFromMPK = (mpk) => {
  if (!mpk) return null
  
  if (mpk.match(/^522-02-/)) return 'Rynek Podlaski'
  if (mpk.match(/^522-04-/)) return 'Rynek Lubelski'
  if (mpk.match(/^522-05-/)) return 'Rynek Mazowiecki'
  if (mpk.match(/^522-06-/)) return 'Rynek Pomorski'
  if (mpk.match(/^522-07-/)) return 'Rynek Małopolski'
  if (mpk.match(/^522-08-/)) return 'Rynek Dolnośląski'
  if (mpk.match(/^522-09-/)) return 'Rynek Wielkopolski'
  if (mpk.match(/^522-11-/)) return 'Rynek Śląski'
  
  return null
}

export default function OcenyPage() {
  const [activeTab, setActiveTab] = useState('wlasny')
  const [transports, setTransports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [users, setUsers] = useState([])
  
  // Filtry
  const [dateRange, setDateRange] = useState('week')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedRequester, setSelectedRequester] = useState('')
  const [selectedMarket, setSelectedMarket] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [transportTypeFilter, setTransportTypeFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  
  // Modal
  const [selectedTransport, setSelectedTransport] = useState(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [refreshBadges, setRefreshBadges] = useState(0)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    const today = new Date()
    let start, end
    
    switch(dateRange) {
      case 'week':
        start = startOfWeek(today, { locale: pl })
        end = endOfWeek(today, { locale: pl })
        break
      case 'month':
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case 'year':
        start = startOfYear(today)
        end = endOfYear(today)
        break
      default:
        return
    }
    
    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }, [dateRange])

  useEffect(() => {
    if (startDate && endDate) {
      fetchTransports()
    }
  }, [activeTab, startDate, endDate])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      
      let usersData = []
      
      if (Array.isArray(data)) {
        usersData = data
      } else if (data.success && Array.isArray(data.users)) {
        usersData = data.users
      } else {
        console.error('❌ Nieprawidłowy format danych użytkowników')
        return
      }
      
      const usersWithMarket = usersData.map(user => ({
        ...user,
        market: getMarketFromMPK(user.mpk)
      }))
      
      setUsers(usersWithMarket)
      
    } catch (error) {
      console.error('Błąd pobierania użytkowników:', error)
    }
  }

  const fetchTransports = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        type: activeTab,
        startDate,
        endDate
      })
      
      const response = await fetch(`/api/oceny-transportow?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()
      
      if (data.success) {
        setTransports(data.transports)
      } else {
        setError(data.error)
      }
    } catch (error) {
      console.error('❌ OCENY: Błąd:', error)
      setError('Wystąpił błąd podczas pobierania danych')
    } finally {
      setLoading(false)
    }
  }

  const uniqueMarkets = useMemo(() => {
    const markets = [...new Set(users.map(u => u.market).filter(Boolean))].sort()
    return markets
  }, [users])

  const filteredTransports = transports.filter(transport => {
    // Filtr osoby odpowiedzialnej
    if (selectedRequester) {
      const email = activeTab === 'wlasny' 
        ? transport.requester_email 
        : transport.responsible_email
      if (email !== selectedRequester) {
        return false
      }
    }
    
    // Filtr rynku
    if (selectedMarket) {
      const email = activeTab === 'wlasny' 
        ? transport.requester_email 
        : transport.responsible_email
      const user = users.find(u => u.email === email)
      if (!user || user.market !== selectedMarket) {
        return false
      }
    }
    
    // Filtr klienta
    if (selectedClient && !transport.client_name?.toLowerCase().includes(selectedClient.toLowerCase())) {
      return false
    }
    
    // Filtr magazynu
    if (selectedWarehouse) {
      const warehouse = activeTab === 'wlasny' 
        ? transport.source_warehouse 
        : (transport.location === 'Magazyn Białystok' ? 'bialystok' : 
           transport.location === 'Magazyn Zielonka' ? 'zielonka' : null)
      if (warehouse !== selectedWarehouse) {
        return false
      }
    }
    
    // Filtr miasta
    if (selectedCity) {
      const city = activeTab === 'wlasny' 
        ? transport.destination_city 
        : transport.delivery?.city
      if (!city?.toLowerCase().includes(selectedCity.toLowerCase())) {
        return false
      }
    }
    
    // Filtr typu transportu
    if (transportTypeFilter !== 'all') {
      const constructionRegex = /^\d{3}-\d{2}-\d{2}\/\d{4}$/
      const mpkToCheck = transport.mpk
      const isConstruction = constructionRegex.test(mpkToCheck)

      if (transportTypeFilter === 'budownictwo' && !isConstruction) {
        return false
      }
      if (transportTypeFilter === 'handel' && isConstruction) {
        return false
      }
    }
    
    // Filtr ocen
    if (ratingFilter !== 'all') {
      if (ratingFilter === 'rated' && !transport.has_rating) {
        return false
      }
      if (ratingFilter === 'negative') {
        if (!transport.has_rating) return false
        if (transport.rating_percentage === null || transport.rating_percentage === 100) return false
      }
    }
    
    return true
  })

  const handleOpenRatingModal = (transport) => {
    setSelectedTransport(transport)
    setShowRatingModal(true)
  }

  const handleCloseRatingModal = () => {
    setShowRatingModal(false)
    setSelectedTransport(null)
    setRefreshBadges(prev => prev + 1)
    setTimeout(() => {
      fetchTransports()
    }, 500)
  }

  const getMagazynName = (warehouse) => {
    switch(warehouse) {
      case 'bialystok': return 'Białystok'
      case 'zielonka': return 'Zielonka'
      default: return warehouse || 'Nieznany'
    }
  }

  const getDriverName = (driverId) => {
    if (!driverId) return 'Brak kierowcy'
    const driver = KIEROWCY.find(k => k.id === parseInt(driverId))
    return driver ? driver.imie : 'Nieznany kierowca'
  }

  const getUsersByMarket = (marketName) => {
    return users.filter(u => u.market === marketName)
  }

  if (loading && transports.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Star className="w-6 h-6 mr-2 text-yellow-500" />
            Oceny Transportów
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Ukryj filtry' : 'Pokaż filtry'}
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="flex space-x-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('wlasny')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'wlasny'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transport Własny
          </button>
          <button
            onClick={() => setActiveTab('spedycyjny')}
            className={`px-6 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'spedycyjny'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transport Spedycyjny
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline w-4 h-4 mr-1" />
                Zakres dat
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Bieżący tydzień</option>
                <option value="month">Bieżący miesiąc</option>
                <option value="year">Bieżący rok</option>
                <option value="custom">Niestandardowy</option>
              </select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data od</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rynek</label>
              <select
                value={selectedMarket}
                onChange={(e) => {
                  setSelectedMarket(e.target.value)
                  setSelectedRequester('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wszystkie rynki</option>
                {uniqueMarkets.map(market => (
                  <option key={market} value={market}>{market}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Osoba odpowiedzialna</label>
              <select
                value={selectedRequester}
                onChange={(e) => setSelectedRequester(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wszystkie osoby</option>
                {selectedMarket ? (
                  getUsersByMarket(selectedMarket).map(user => (
                    <option key={user.email} value={user.email}>
                      {user.name}
                    </option>
                  ))
                ) : (
                  uniqueMarkets.map(market => (
                    <optgroup key={market} label={market}>
                      {getUsersByMarket(market).map(user => (
                        <option key={user.email} value={user.email}>
                          {user.name}
                        </option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Magazyn</label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Wszystkie magazyny</option>
                <option value="bialystok">Białystok</option>
                <option value="zielonka">Zielonka</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Miasto</label>
              <input
                type="text"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                placeholder="Wpisz miasto..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Klient</label>
              <input
                type="text"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                placeholder="Wpisz nazwę klienta..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ transportu</label>
              <select
                value={transportTypeFilter}
                onChange={(e) => setTransportTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Wszystkie</option>
                <option value="handel">Handel</option>
                <option value="budownictwo">Budownictwo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status oceny</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Wszystkie</option>
                <option value="rated">Tylko ocenione</option>
                <option value="negative">Tylko negatywne</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedRequester('')
                  setSelectedMarket('')
                  setSelectedClient('')
                  setSelectedWarehouse('')
                  setSelectedCity('')
                  setTransportTypeFilter('all')
                  setRatingFilter('all')
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Resetuj filtry
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Znaleziono transportów</div>
            <div className="text-2xl font-bold text-blue-900">{filteredTransports.length}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Z oceną</div>
            <div className="text-2xl font-bold text-green-900">
              {filteredTransports.filter(t => t.has_rating).length}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-600 font-medium">Do oceny</div>
            <div className="text-2xl font-bold text-yellow-900">
              {filteredTransports.filter(t => !t.has_rating).length}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md flex items-center">
            <AlertCircle size={20} className="mr-2" />
            {error}
          </div>
        )}

        {filteredTransports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Star className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Brak transportów do oceny</p>
            <p className="text-sm mt-2">Spróbuj zmienić filtry lub zakres dat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'wlasny' ? (
              <TransportWlasnyTable 
                transports={filteredTransports}
                onRate={handleOpenRatingModal}
                getMagazynName={getMagazynName}
                getDriverName={getDriverName}
                refreshBadges={refreshBadges}
              />
            ) : (
              <TransportSpedycyjnyTable 
                transports={filteredTransports}
                onRate={handleOpenRatingModal}
                getMagazynName={getMagazynName}
                refreshBadges={refreshBadges}
              />
            )}
          </div>
        )}
      </div>

      {showRatingModal && selectedTransport && (
        activeTab === 'wlasny' ? (
          <CompleteRatingModal
            transport={selectedTransport}
            onClose={handleCloseRatingModal}
            onSuccess={fetchTransports}
            getMagazynName={getMagazynName}
          />
        ) : (
          <SpeditionRatingModal
            transport={selectedTransport}
            onClose={handleCloseRatingModal}
            onSuccess={fetchTransports}
          />
        )
      )}
    </div>
  )
}

function TransportWlasnyTable({ transports, onRate, getMagazynName, getDriverName, refreshBadges }) {
  const safeFormatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      return format(date, 'dd.MM.yyyy', { locale: pl })
    } catch (error) {
      return '-'
    }
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magazyn</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miasto</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod pocztowy</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ulica</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Odległość</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nr dokumentów</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Klient</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uwagi</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Osoba odp.</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MPK</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kierowca</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ocena</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akcje</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {transports.map((transport) => (
          <tr key={transport.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {safeFormatDate(transport.delivery_date)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {getMagazynName(transport.source_warehouse)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {transport.destination_city}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {transport.postal_code}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {transport.street}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {transport.distance ? `${transport.distance} km` : '-'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              <div className="max-w-[150px] truncate" title={transport.wz_number || '-'}>
                {transport.wz_number || '-'}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              <div className="max-w-xs truncate" title={transport.client_name || '-'}>
                {transport.client_name || '-'}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">
              <div className="max-w-xs truncate" title={transport.notes || '-'}>
                {transport.notes || '-'}
              </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {transport.requester_name || transport.requester_email || '-'}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {transport.mpk || '-'}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
              {getDriverName(transport.driver_id)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm">
              <TransportDetailedRatingBadge 
                key={`rating-${transport.id}-${refreshBadges}`}
                transportId={transport.id}
                type="transport"
                refreshTrigger={refreshBadges} 
              />
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm">
              {transport.has_rating ? (
                <button
                  onClick={() => onRate(transport)}
                  className="flex items-center text-green-600 hover:text-green-700 transition-colors"
                >
                  <Star className="w-4 h-4 mr-1 fill-current" />
                  <span className="underline">Zobacz ocenę</span>
                </button>
              ) : (
                <button
                  onClick={() => onRate(transport)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                >
                  Oceń
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TransportSpedycyjnyTable({ transports, onRate, getMagazynName, refreshBadges }) {
  const safeFormatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      return format(date, 'dd.MM.yyyy', { locale: pl })
    } catch (error) {
      return '-'
    }
  }

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nr zamówienia</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Klient</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data dostawy</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Magazyn</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Osoba odp.</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dystans</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miasto załadunku</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miasto dostawy</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cena</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PLN/km</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Towar</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opis towaru</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ocena</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Akcje</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {transports.map((transport) => {
          const pricePerKm = transport.response?.deliveryPrice && transport.response?.distanceKm 
            ? (transport.response.deliveryPrice / transport.response.distanceKm).toFixed(2) 
            : '-'

          return (
            <tr key={transport.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {safeFormatDate(transport.created_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.order_number || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <div className="max-w-xs truncate" title={transport.client_name || '-'}>
                  {transport.client_name || '-'}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {safeFormatDate(transport.delivery_date)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.location === 'Magazyn Białystok' ? 'Białystok' : 
                 transport.location === 'Magazyn Zielonka' ? 'Zielonka' : 
                 transport.producerAddress?.city || '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.responsible_name || transport.responsible_email || '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.response?.distanceKm ? `${transport.response.distanceKm} km` : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.location === 'Magazyn Białystok' ? 'Białystok' : 
                 transport.location === 'Magazyn Zielonka' ? 'Zielonka' : 
                 transport.producerAddress?.city || '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.delivery?.city || '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {transport.response?.deliveryPrice ? `${transport.response.deliveryPrice} zł` : '-'}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {pricePerKm !== '-' ? `${pricePerKm} zł` : '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <div className="max-w-[150px] truncate" title={transport.documents || '-'}>
                  {transport.documents || '-'}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <div className="max-w-xs truncate" title={
                  typeof transport.goods_description === 'object' 
                    ? transport.goods_description?.description || '-'
                    : transport.goods_description || '-'
                }>
                  {typeof transport.goods_description === 'object' 
                    ? transport.goods_description?.description || '-'
                    : transport.goods_description || '-'}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                <TransportDetailedRatingBadge 
                  key={`rating-${transport.id}-${refreshBadges}`}
                  transportId={transport.id}
                  type="spedition"
                  refreshTrigger={refreshBadges} 
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm">
                {transport.has_rating ? (
                  <button
                    onClick={() => onRate(transport)}
                    className="flex items-center text-green-600 hover:text-green-700 transition-colors"
                  >
                    <Star className="w-4 h-4 mr-1 fill-current" />
                    <span className="underline">Zobacz ocenę</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onRate(transport)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                  >
                    Oceń
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}