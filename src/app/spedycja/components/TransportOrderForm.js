// src/app/spedycja/components/TransportOrderForm.js
'use client'
import { useState, useEffect } from 'react'

export default function TransportOrderForm({ onSubmit, onCancel, zamowienie }) {
  const [formData, setFormData] = useState({
    towar: '',
    terminPlatnosci: '14 dni',
    waga: '',
    dataZaladunku: '',
    dataRozladunku: '',
    emailOdbiorcy: ''
  })

  // Stan dla dodatkowych miejsc
  const [additionalPlaces, setAdditionalPlaces] = useState([])
  const [isLoadingTransports, setIsLoadingTransports] = useState(false)
  const [availableTransports, setAvailableTransports] = useState([])
  const [showAddPlaceForm, setShowAddPlaceForm] = useState(false)
  const [selectedTransportId, setSelectedTransportId] = useState('')
  const [placeType, setPlaceType] = useState('oba') // 'oba' (Załadunek i Rozładunek), 'załadunek' lub 'rozładunek'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const formatAddress = (address) => {
    if (!address) return 'Brak danych';
    if (typeof address === 'string') return address;
    return `${address.postalCode || ''} ${address.city || ''}, ${address.street || ''}`.trim() || 'Brak danych';
  };

  const getTransportStartCity = (transport) => {
    if (!transport) return 'Brak';
    if (transport.location === 'Odbiory własne' || transport.location === 'Producent') {
      const company = transport.sourceClientName || transport.source_client_name;
      const city = transport.producerAddress?.city;
      if (company && city) return `${company} (${city})`;
      if (company) return company;
      if (city) return city;
      return 'Odbiory własne';
    }
    return transport.location ? transport.location.replace('Magazyn ', '') : 'Brak';
  };

  const getTransportRoute = (transport) => {
    const start = getTransportStartCity(transport);
    const end = transport.delivery?.city || transport.endCity || 'Brak danych';
    return `${start} → ${end}`;
  };

  // Automatycznie wczytaj połączone transporty, jeśli zlecenie już je posiada
  useEffect(() => {
    if (zamowienie?.response?.connectedTransports && zamowienie.response.connectedTransports.length > 0) {
      const initialPlaces = [];
      zamowienie.response.connectedTransports.forEach(ct => {
        const ctType = ct.type || 'both';
        const startStr = ct.startCity || getTransportStartCity(ct);
        const endStr = ct.endCity || ct.delivery?.city || 'Brak danych';
        const routeStr = ct.route || `${startStr} → ${endStr}`;
        const company = ct.sourceClientName || ct.source_client_name || '';

        if (ctType === 'both' || ctType === 'loading') {
          initialPlaces.push({
            type: 'załadunek',
            transportId: ct.id,
            orderNumber: ct.orderNumber || ct.order_number || `${ct.id}`,
            route: routeStr,
            location: ct.location || 'Odbiory własne',
            sourceClientName: company,
            producerAddress: ct.producerAddress || ct.startAddress,
            address: (ct.location === 'Odbiory własne' || !ct.location?.includes('Magazyn'))
              ? (company ? `${company}, ${formatAddress(ct.producerAddress || ct.startAddress)}` : formatAddress(ct.producerAddress || ct.startAddress))
              : ct.location,
            contact: ct.loadingContact || ct.loading_contact
          });
        }

        if (ctType === 'both' || ctType === 'unloading') {
          initialPlaces.push({
            type: 'rozładunek',
            transportId: ct.id,
            orderNumber: ct.orderNumber || ct.order_number || `${ct.id}`,
            route: routeStr,
            delivery: ct.delivery || ct.endAddress,
            address: ct.delivery || ct.endAddress,
            contact: ct.unloadingContact || ct.unloading_contact
          });
        }
      });
      setAdditionalPlaces(initialPlaces);
    }
  }, [zamowienie]);

  // Pobierz dostępne transporty przy pierwszym renderowaniu
  useEffect(() => {
    const fetchTransports = async () => {
      try {
        setIsLoadingTransports(true)
        const response = await fetch('/api/spedycje?status=new')
        const data = await response.json()

        if (data.success && data.spedycje) {
          // Filtrujemy tylko transporty, które mają numer zamówienia i nie są tym samym transportem
          const filtered = data.spedycje.filter(t =>
            String(t.id) !== String(zamowienie?.id) && (t.orderNumber || t.order_number)
          )
          setAvailableTransports(filtered)
        }
      } catch (error) {
        console.error('Błąd pobierania transportów:', error)
      } finally {
        setIsLoadingTransports(false)
      }
    }

    fetchTransports()
  }, [zamowienie.id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        spedycjaId: zamowienie.id,
        ...formData,
        additionalPlaces // Przekazujemy dodatkowe miejsca
      })
    } catch (err) {
      setError(err.message || 'Wystąpił błąd podczas wysyłania zlecenia')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddPlace = () => {
    if (!selectedTransportId) return

    const selectedTransport = availableTransports.find(t => String(t.id) === String(selectedTransportId))
    if (!selectedTransport) return

    const isOdbiorWlasny = selectedTransport.location === 'Odbiory własne' || selectedTransport.location === 'Producent';
    const company = selectedTransport.sourceClientName || selectedTransport.source_client_name || '';

    const newPlaces = [];

    if (placeType === 'oba' || placeType === 'załadunek') {
      newPlaces.push({
        type: 'załadunek',
        transportId: selectedTransport.id,
        orderNumber: selectedTransport.orderNumber || selectedTransport.order_number || '',
        route: getTransportRoute(selectedTransport),
        location: selectedTransport.location,
        sourceClientName: company,
        producerAddress: selectedTransport.producerAddress,
        address: isOdbiorWlasny
          ? (company ? `${company}, ${formatAddress(selectedTransport.producerAddress)}` : formatAddress(selectedTransport.producerAddress))
          : selectedTransport.location,
        contact: selectedTransport.loadingContact || selectedTransport.loading_contact
      });
    }

    if (placeType === 'oba' || placeType === 'rozładunek') {
      newPlaces.push({
        type: 'rozładunek',
        transportId: selectedTransport.id,
        orderNumber: selectedTransport.orderNumber || selectedTransport.order_number || '',
        route: getTransportRoute(selectedTransport),
        delivery: selectedTransport.delivery,
        address: selectedTransport.delivery,
        contact: selectedTransport.unloadingContact || selectedTransport.unloading_contact
      });
    }

    setAdditionalPlaces(prev => [...prev, ...newPlaces])
    setShowAddPlaceForm(false)
    setSelectedTransportId('')
  }

  const removeAdditionalPlace = (index) => {
    setAdditionalPlaces(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Stwórz zlecenie transportowe</h2>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
        >
          Anuluj
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Rodzaj towaru</label>
          <input
            name="towar"
            type="text"
            value={formData.towar}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Waga towaru</label>
          <div className="flex items-center gap-2">
            <input
              name="waga"
              type="number"
              min="0"
              step="any"
              value={formData.waga}
              onChange={handleChange}
              className="flex-1 p-2 border rounded-md bg-white"
              required
              placeholder="np. 2500"
            />
            <span className="font-medium text-gray-700">kg</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Data załadunku</label>
          <input
            name="dataZaladunku"
            type="datetime-local"
            value={formData.dataZaladunku}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Data rozładunku</label>
          <input
            name="dataRozladunku"
            type="datetime-local"
            value={formData.dataRozladunku}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Termin płatności</label>
          <select
            name="terminPlatnosci"
            value={formData.terminPlatnosci}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          >
            <option value="7 dni">7 dni</option>
            <option value="14 dni">14 dni</option>
            <option value="21 dni">21 dni</option>
            <option value="30 dni">30 dni</option>
            <option value="60 dni">60 dni</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email odbiorcy</label>
          <input
            name="emailOdbiorcy"
            type="email"
            value={formData.emailOdbiorcy}
            onChange={handleChange}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>
      </div>

      {/* Sekcja dodatkowych miejsc */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-medium">Dodatkowe miejsca załadunku/rozładunku</h3>
          <button
            type="button"
            onClick={() => setShowAddPlaceForm(true)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Dodaj miejsce
          </button>
        </div>

        {additionalPlaces.length > 0 ? (
          <div className="space-y-3">
            {additionalPlaces.map((place, index) => (
              <div key={index} className="flex justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <div className="font-medium">
                    {place.type === 'załadunek' ? 'Miejsce załadunku' : 'Miejsce rozładunku'} {index + 1}
                  </div>
                  <div className="text-sm text-gray-600">
                    {place.route} ({place.orderNumber})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAdditionalPlace(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">Brak dodatkowych miejsc</p>
        )}

        {/* Formularz dodawania miejsca */}
        {showAddPlaceForm && (
          <div className="mt-3 p-4 border border-blue-200 rounded-md bg-blue-50">
            <h4 className="font-medium mb-2">Dodaj nowe miejsce</h4>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Wybierz zlecenie</label>
                <select
                  value={selectedTransportId}
                  onChange={(e) => setSelectedTransportId(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  disabled={isLoadingTransports}
                >
                  <option value="">Wybierz zlecenie</option>
                  {availableTransports.map(transport => (
                    <option key={transport.id} value={transport.id}>
                      {transport.orderNumber || transport.order_number || transport.id} ({getTransportRoute(transport)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Typ miejsca</label>
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md border ${placeType === 'oba' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setPlaceType('oba')}
                  >
                    Załadunek i Rozładunek
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md border ${placeType === 'załadunek' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setPlaceType('załadunek')}
                  >
                    Tylko Załadunek
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md border ${placeType === 'rozładunek' ? 'bg-green-600 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setPlaceType('rozładunek')}
                  >
                    Tylko Rozładunek
                  </button>
                </div>
              </div>
              <div className="flex items-end">
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 bg-green-500 text-white rounded-md hover:bg-green-600"
                    onClick={handleAddPlace}
                    disabled={!selectedTransportId}
                  >
                    Dodaj
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    onClick={() => setShowAddPlaceForm(false)}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Informacje o zamówieniu */}
      <div className="mt-4 bg-gray-50 p-4 rounded-md">
        <h3 className="font-medium mb-2">Informacje o zleceniu</h3>
        <p className="text-sm"><span className="font-medium">ID zlecenia:</span> {zamowienie.id}</p>
        <p className="text-sm"><span className="font-medium">Nr zlecenia:</span> {zamowienie.orderNumber || zamowienie.order_number || zamowienie.id}</p>
        <p className="text-sm"><span className="font-medium">Trasa:</span> {getTransportRoute(zamowienie)}</p>
        <p className="text-sm"><span className="font-medium">MPK:</span> {zamowienie.mpk}</p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Wysyłanie...' : 'Wyślij zlecenie'}
        </button>
      </div>
    </form>
  )
}
