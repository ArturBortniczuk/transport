// src/components/CreateTransportFromWzModal.js
'use client';
import React, { useState, useEffect } from 'react';
import { X, Truck, Calendar, MapPin, Package, User, Check, AlertCircle } from 'lucide-react';
import { KIEROWCY, POJAZDY, POZIOMY_ZALADUNKU, RYNKI } from '../app/kalendarz/constants';

const ERP_RYNEK_MAP = {
  'BID': 'Podlaski',
  'BIH': 'Podlaski',
  'LAH': 'Podlaski',
  'BUDL': 'Podlaski',
  'SOS': 'Podlaski',
  'DII': 'Podlaski',
  'CTR': 'Podlaski',
  'WAH': 'Mazowiecki',
  'POZ': 'Wielkopolski',
  'KAT': 'Śląski',
  'LUB': 'Lubelski',
  'WRO': 'Dolnośląski',
  'GDA': 'Pomorski',
  'KRA': 'Małopolski'
};

function mapErpRynek(rawRynek, isZielonka) {
  if (!rawRynek) return isZielonka ? 'Mazowiecki' : 'Podlaski';
  const upper = String(rawRynek).toUpperCase().trim();
  if (ERP_RYNEK_MAP[upper]) return ERP_RYNEK_MAP[upper];
  if (RYNKI.includes(rawRynek)) return rawRynek;
  return isZielonka ? 'Mazowiecki' : 'Podlaski';
}

export default function CreateTransportFromWzModal({
  selectedDocs = [],
  onClose,
  onSuccess
}) {
  const [loading, setLoading] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [error, setError] = useState(null);

  // Domyślne wartości z pierwszego zaznaczonego dokumentu
  const firstDoc = selectedDocs[0] || {};
  const isZielonka = selectedDocs.some(d => d.symbol_magazynu?.includes('WAH') || d.nazwa_magazynu?.toLowerCase().includes('zielonka'));

  const [formData, setFormData] = useState({
    source_warehouse: isZielonka ? 'zielonka' : 'bialystok',
    destination_city: firstDoc.extracted_city || '',
    postal_code: firstDoc.kod_pocztowy_dostawy || firstDoc.extracted_postal_code || '',
    street: firstDoc.extracted_street || firstDoc.adres_dostawy || '',
    client_name: firstDoc.nazwa_kontrahenta || '',
    delivery_date: new Date().toISOString().split('T')[0],
    driver_id: '',
    vehicle_id: '',
    loading_level: '50%',
    market: mapErpRynek(firstDoc.rynek, isZielonka),
    distance: '',
    notes: '',
    goods_description: ''
  });

  // Automatyczne wyznaczanie odległości
  const calculateDistance = async (wh, city, postal, strt) => {
    const targetCity = city || formData.destination_city;
    const targetPostal = postal || formData.postal_code;
    const targetWh = wh || formData.source_warehouse;
    const targetStrt = strt || formData.street;

    if (!targetCity && !targetPostal) return;

    setCalculatingDistance(true);
    try {
      const origin = targetWh === 'zielonka' ? 'zielonka' : 'bialystok';
      const dest = [targetStrt, targetPostal, targetCity].filter(Boolean).join(', ');
      const res = await fetch(`/api/distance?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.totalDistanceKm) {
          setFormData(prev => ({ ...prev, distance: json.totalDistanceKm }));
        } else if (json.rows?.[0]?.elements?.[0]?.distance?.value) {
          const km = Math.round(json.rows[0].elements[0].distance.value / 1000);
          setFormData(prev => ({ ...prev, distance: km }));
        }
      }
    } catch (e) {
      console.warn('Błąd automatycznego wyliczania odległości:', e);
    } finally {
      setCalculatingDistance(false);
    }
  };

  // Automatyczne generowanie podsumowania ładunku z wybranych WZ
  useEffect(() => {
    if (selectedDocs.length > 0) {
      const wzList = selectedDocs.map(d => d.nr_wz).join(', ');
      const desc = `Dokumenty WZ: ${wzList}\nŁączna wartość: ${selectedDocs.reduce((acc, d) => acc + parseFloat(d.dok_brutto || 0), 0).toFixed(2)} zł\nŁącznie pozycji: ${selectedDocs.reduce((acc, d) => acc + parseInt(d.pozycje_count || 0, 10), 0)} poz.`;
      
      const city = firstDoc.extracted_city || '';
      const postal = firstDoc.kod_pocztowy_dostawy || firstDoc.extracted_postal_code || '';
      const strt = firstDoc.extracted_street || firstDoc.adres_dostawy || '';
      const wh = isZielonka ? 'zielonka' : 'bialystok';
      const mappedMarket = mapErpRynek(firstDoc.rynek, isZielonka);

      setFormData(prev => ({
        ...prev,
        goods_description: desc,
        client_name: prev.client_name || firstDoc.nazwa_kontrahenta || '',
        destination_city: prev.destination_city || city,
        street: prev.street || strt,
        postal_code: prev.postal_code || postal,
        market: mappedMarket,
        notes: firstDoc.uwagi ? `Instrukcje z WZ:\n${firstDoc.uwagi}` : ''
      }));

      // Przelicz odległość
      calculateDistance(wh, city, postal, strt);
    }
  }, [selectedDocs]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Jeśli zmieniono magazyn, zaktualizuj też domyślny rynek jeśli nie był ręcznie zmieniony
      if (name === 'source_warehouse') {
        calculateDistance(value, updated.destination_city, updated.postal_code, updated.street);
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wz/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_transport',
          wzNumbers: selectedDocs.map(d => d.nr_wz),
          ...formData
        })
      });

      const json = await res.json();
      if (json.success) {
        if (onSuccess) onSuccess(json.transportId);
        onClose();
      } else {
        setError(json.error || 'Wystąpił błąd podczas tworzenia transportu');
      }
    } catch (err) {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-blue-50/70 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Planowanie transportu własnego</h2>
              <p className="text-xs text-blue-800">
                Wybrano <b>{selectedDocs.length}</b> dokumentów WZ do przypisania
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Podgląd wybranych WZ */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Załączane dokumenty WZ:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectedDocs.map(d => (
                <span key={d.nr_wz} className="bg-white border border-gray-300 text-gray-800 text-xs font-mono px-2 py-0.5 rounded-md shadow-2xs">
                  {d.nr_wz}
                </span>
              ))}
            </div>
            {(firstDoc.handlowiec || firstDoc.rynek) && (
              <div className="mt-2 pt-2 border-t border-gray-200/80 flex flex-wrap items-center justify-between text-[11px] text-gray-500">
                {firstDoc.handlowiec && <span>Handlowiec: <b className="text-gray-800">{firstDoc.handlowiec}</b></span>}
                {firstDoc.rynek && <span>Rynek ERP: <b className="text-blue-700">{firstDoc.rynek}</b></span>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Magazyn źródłowy */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Magazyn wyjazdowy *</label>
              <select
                name="source_warehouse"
                value={formData.source_warehouse}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                <option value="bialystok">Magazyn Białystok</option>
                <option value="zielonka">Magazyn Zielonka</option>
              </select>
            </div>

            {/* Data dostawy */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Planowana data dostawy *</label>
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Klient i lokalizacja */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nazwa klienta / Budowa *</label>
              <input
                type="text"
                name="client_name"
                value={formData.client_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Miasto docelowe *</label>
              <input
                type="text"
                name="destination_city"
                value={formData.destination_city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ulica i numer</label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kod pocztowy</label>
              <input
                type="text"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                placeholder="np. 03-876"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Rynek i Odległość */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Rynek / Region *
              </label>
              <select
                name="market"
                value={formData.market}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                required
              >
                {RYNKI.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {firstDoc.rynek && (
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Kod ERP: <b className="text-gray-700">{firstDoc.rynek}</b> → rynek: <b className="text-blue-700">{formData.market}</b>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Odległość z magazynu (km)
                </label>
                {calculatingDistance && (
                  <span className="text-[11px] text-blue-600 animate-pulse font-medium">
                    obliczanie...
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  placeholder="np. 98"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-20"
                />
                <button
                  type="button"
                  onClick={() => calculateDistance(formData.source_warehouse, formData.destination_city, formData.postal_code, formData.street)}
                  disabled={calculatingDistance}
                  className="absolute right-1 px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors"
                >
                  Przelicz
                </button>
              </div>
            </div>
          </div>

          {/* Kierowca, pojazd i załadunek */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kierowca</label>
              <select
                name="driver_id"
                value={formData.driver_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Do ustalenia --</option>
                {KIEROWCY.map(k => (
                  <option key={k.id} value={k.id}>{k.imie}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pojazd</label>
              <select
                name="vehicle_id"
                value={formData.vehicle_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Do ustalenia --</option>
                {POJAZDY.map(p => (
                  <option key={p.id} value={p.id}>{p.tabliceRej} ({p.model})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Poziom załadunku</label>
              <select
                name="loading_level"
                value={formData.loading_level}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {POZIOMY_ZALADUNKU.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Specyfikacja towarów */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Specyfikacja ładunku (dla kierowcy / magazynu)
            </label>
            <textarea
              name="goods_description"
              rows={3}
              value={formData.goods_description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Uwagi */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Uwagi do trasy / kontakt
            </label>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleChange}
              placeholder="np. telefon do kierownika budowy, godziny rozładunku..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-medium transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Utwórz i przypisz do transportu</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
