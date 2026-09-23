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

  // Stan dla wszystkich przystanków w ustalonej kolejności trasy
  const [stops, setStops] = useState([])
  const [isLoadingTransports, setIsLoadingTransports] = useState(false)
  const [availableTransports, setAvailableTransports] = useState([])
  const [showAddPlaceForm, setShowAddPlaceForm] = useState(false)
  const [selectedTransportId, setSelectedTransportId] = useState('')
  const [placeType, setPlaceType] = useState('oba') // 'oba', 'załadunek', 'rozładunek'
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const formatAddress = (address) => {
    if (!address) return 'Brak danych';
    if (typeof address === 'string') return address;
    return `${address.street ? `${address.street}, ` : ''}${address.postalCode || ''} ${address.city || ''}`.trim() || 'Brak danych';
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

  // Automatycznie wczytaj harmonogram przystanków
  useEffect(() => {
    if (!zamowienie) return;

    // 1. Jeśli zlecenie posiada już ustaloną kolejność routeStops z formularza odpowiedzi
    if (zamowienie.response?.routeStops && zamowienie.response.routeStops.length > 0) {
      const loadedStops = zamowienie.response.routeStops.map((rs, idx) => {
        const isLoad = rs.pointType === 'loading' || rs.type === 'załadunek';
        const client = rs.clientName || (isLoad ? (rs.sourceClientName || '') : (rs.clientName || ''));
        const addrStr = rs.address?.street
          ? `${rs.address.street}, ${rs.address.postalCode || ''} ${rs.city || ''}`.trim()
          : (typeof rs.address === 'string' ? rs.address : formatAddress(rs.address || { city: rs.city }));

        return {
          id: rs.id || `stop-${idx}-${Date.now()}`,
          transportId: rs.transportId || zamowienie.id,
          orderNumber: rs.orderNumber || zamowienie.orderNumber || zamowienie.order_number || zamowienie.id,
          type: isLoad ? 'załadunek' : 'rozładunek',
          clientName: client,
          city: rs.city || '',
          address: addrStr,
          producerAddress: isLoad ? rs.address : null,
          delivery: !isLoad ? rs.address : null,
          contact: rs.contact || (isLoad ? (zamowienie.loadingContact || zamowienie.loading_contact) : (zamowienie.unloadingContact || zamowienie.unloading_contact)) || '',
          isMain: rs.isMain !== undefined ? rs.isMain : String(rs.transportId) === String(zamowienie.id)
        };
      });
      setStops(loadedStops);
      return;
    }

    // 2. Jeśli brak routeStops, stwórz domyślną listę z punktów zlecenia głównego i powiązanych
    const initialStops = [];

    // Główny załadunek
    initialStops.push({
      id: `main-load-${zamowienie.id}`,
      transportId: zamowienie.id,
      orderNumber: zamowienie.orderNumber || zamowienie.order_number || zamowienie.id,
      type: 'załadunek',
      clientName: zamowienie.source_client_name || zamowienie.sourceClientName || (zamowienie.location?.includes('Magazyn') ? zamowienie.location : 'Grupa Eltron Sp. z o.o.'),
      city: zamowienie.producerAddress?.city || (zamowienie.location === 'Odbiory własne' ? '' : zamowienie.location?.replace(/^magazyn\s+/i, '')) || '',
      address: zamowienie.location === 'Odbiory własne' ? formatAddress(zamowienie.producerAddress) : zamowienie.location,
      producerAddress: zamowienie.producerAddress,
      contact: zamowienie.loading_contact || zamowienie.loadingContact || '',
      isMain: true
    });

    // Jeśli są połączone transporty
    if (zamowienie.response?.connectedTransports && zamowienie.response.connectedTransports.length > 0) {
      zamowienie.response.connectedTransports.forEach((ct, idx) => {
        const type = ct.type || 'both';
        if (type === 'both' || type === 'loading') {
          initialStops.push({
            id: `ct-load-${ct.id || idx}`,
            transportId: ct.id,
            orderNumber: ct.orderNumber || ct.order_number || `${ct.id}`,
            type: 'załadunek',
            clientName: ct.sourceClientName || ct.source_client_name || (ct.location?.includes('Magazyn') ? ct.location : 'Grupa Eltron Sp. z o.o.'),
            city: ct.startCity || ct.producerAddress?.city || '',
            address: formatAddress(ct.producerAddress || ct.startAddress) || ct.location || 'Brak danych',
            producerAddress: ct.producerAddress || ct.startAddress,
            contact: ct.loadingContact || ct.loading_contact || '',
            isMain: false
          });
        }
      });
    }

    // Główny rozładunek
    initialStops.push({
      id: `main-unload-${zamowienie.id}`,
      transportId: zamowienie.id,
      orderNumber: zamowienie.orderNumber || zamowienie.order_number || zamowienie.id,
      type: 'rozładunek',
      clientName: zamowienie.client_name || zamowienie.clientName || '',
      city: zamowienie.delivery?.city || '',
      address: formatAddress(zamowienie.delivery),
      delivery: zamowienie.delivery,
      contact: zamowienie.unloading_contact || zamowienie.unloadingContact || '',
      isMain: true
    });

    // Rozładunki ze zleceń dołączonych
    if (zamowienie.response?.connectedTransports && zamowienie.response.connectedTransports.length > 0) {
      zamowienie.response.connectedTransports.forEach((ct, idx) => {
        const type = ct.type || 'both';
        if (type === 'both' || type === 'unloading') {
          initialStops.push({
            id: `ct-unload-${ct.id || idx}`,
            transportId: ct.id,
            orderNumber: ct.orderNumber || ct.order_number || `${ct.id}`,
            type: 'rozładunek',
            clientName: ct.clientName || ct.client_name || '',
            city: ct.endCity || ct.delivery?.city || '',
            address: formatAddress(ct.delivery || ct.endAddress),
            delivery: ct.delivery || ct.endAddress,
            contact: ct.unloadingContact || ct.unloading_contact || '',
            isMain: false
          });
        }
      });
    }

    setStops(initialStops);
  }, [zamowienie]);

  // Pobierz dostępne transporty przy pierwszym renderowaniu
  useEffect(() => {
    const fetchTransports = async () => {
      try {
        setIsLoadingTransports(true);
        const response = await fetch('/api/spedycje?status=new');
        const data = await response.json();

        if (data.success && data.spedycje) {
          const filtered = data.spedycje.filter(t =>
            String(t.id) !== String(zamowienie?.id) && (t.orderNumber || t.order_number)
          );
          setAvailableTransports(filtered);
        }
      } catch (error) {
        console.error('Błąd pobierania transportów:', error);
      } finally {
        setIsLoadingTransports(false);
      }
    };

    fetchTransports();
  }, [zamowienie?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMoveStop = (index, direction) => {
    setStops(prev => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const item = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = item;
      return updated;
    });
  };

  const handleRemoveStop = (index) => {
    setStops(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPlace = () => {
    if (!selectedTransportId) return;

    const selectedTransport = availableTransports.find(t => String(t.id) === String(selectedTransportId));
    if (!selectedTransport) return;

    const companyLoad = selectedTransport.sourceClientName || selectedTransport.source_client_name || (selectedTransport.location?.includes('Magazyn') ? selectedTransport.location : 'Grupa Eltron Sp. z o.o.');
    const companyUnload = selectedTransport.clientName || selectedTransport.client_name || '';

    const newStops = [];

    if (placeType === 'oba' || placeType === 'załadunek') {
      newStops.push({
        id: `added-load-${selectedTransport.id}-${Date.now()}`,
        type: 'załadunek',
        transportId: selectedTransport.id,
        orderNumber: selectedTransport.orderNumber || selectedTransport.order_number || '',
        clientName: companyLoad,
        city: selectedTransport.producerAddress?.city || (selectedTransport.location === 'Odbiory własne' ? '' : selectedTransport.location?.replace(/^magazyn\s+/i, '')) || '',
        address: selectedTransport.location === 'Odbiory własne'
          ? formatAddress(selectedTransport.producerAddress)
          : selectedTransport.location,
        producerAddress: selectedTransport.producerAddress,
        contact: selectedTransport.loadingContact || selectedTransport.loading_contact || '',
        isMain: false
      });
    }

    if (placeType === 'oba' || placeType === 'rozładunek') {
      newStops.push({
        id: `added-unload-${selectedTransport.id}-${Date.now()}`,
        type: 'rozładunek',
        transportId: selectedTransport.id,
        orderNumber: selectedTransport.orderNumber || selectedTransport.order_number || '',
        clientName: companyUnload,
        city: selectedTransport.delivery?.city || '',
        address: formatAddress(selectedTransport.delivery),
        delivery: selectedTransport.delivery,
        contact: selectedTransport.unloadingContact || selectedTransport.unloading_contact || '',
        isMain: false
      });
    }

    setStops(prev => [...prev, ...newStops]);
    setShowAddPlaceForm(false);
    setSelectedTransportId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        spedycjaId: zamowienie.id,
        ...formData,
        stops, // Przekazujemy wszystkie przystanki w ustalonej kolejności
        additionalPlaces: stops.filter(s => !s.isMain) // Kompatybilność wsteczna
      });
    } catch (err) {
      setError(err.message || 'Wystąpił błąd podczas wysyłania zlecenia');
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Plan całej trasy zlecenia */}
      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Plan trasy i harmonogram przystanków ({stops.length} punkty)</h3>
            <p className="text-xs text-gray-500">Wszystkie przystanki w dokładnej kolejności realizacji trasy przez przewoźnika</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPlaceForm(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-xs"
          >
            + Dodaj miejsce
          </button>
        </div>

        <div className="space-y-2">
          {stops.map((stop, index) => {
            const isLoad = stop.type === 'załadunek';
            const isFirst = index === 0;
            const isLast = index === stops.length - 1;

            return (
              <div
                key={stop.id || index}
                className={`flex items-center justify-between p-3 rounded-md border transition-all ${
                  isLoad ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white font-bold text-xs flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className={`flex-shrink-0 px-2.5 py-1 text-xs font-bold rounded uppercase tracking-wider ${
                    isLoad ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {isLoad ? 'Załadunek' : 'Rozładunek'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500 uppercase">Klient / Firma:</span>
                      <span className="text-sm font-bold text-gray-900">
                        {stop.clientName || 'Nie podano'}
                      </span>
                      <span className="text-xs font-medium text-gray-500 bg-white/80 px-2 py-0.5 rounded border border-gray-200">
                        {stop.isMain ? `Główne: ${stop.orderNumber}` : `Zlecenie: ${stop.orderNumber}`}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-semibold text-gray-700">Adres:</span> {stop.address || stop.city || 'Brak danych'}
                      {stop.contact ? ` • tel: ${stop.contact}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveStop(index, -1)}
                    disabled={isFirst}
                    className="px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold shadow-2xs"
                    title="Przesuń w górę"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStop(index, 1)}
                    disabled={isLast}
                    className="px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold shadow-2xs"
                    title="Przesuń w dół"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(index)}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 hover:bg-red-50 rounded ml-1"
                    title="Usuń przystanek"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            );
          })}
        </div>

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
