// src/components/CreateSpeditionFromWzModal.js
'use client';
import React, { useState, useEffect } from 'react';
import { X, Truck, Calendar, MapPin, Package, User, Check, AlertCircle, Building2, ExternalLink } from 'lucide-react';

export default function CreateSpeditionFromWzModal({
  isOpen,
  onClose,
  selectedWzNumbers = [],
  selectedDocs = [],
  onCreated
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);

  const firstDoc = selectedDocs[0] || {};
  const isZielonka = (firstDoc.symbol_magazynu || '').toUpperCase().startsWith('WA') || (firstDoc.nazwa_magazynu || '').toLowerCase().includes('zielonka');

  const [formData, setFormData] = useState({
    location: isZielonka ? 'Magazyn Zielonka' : 'Magazyn Białystok',
    deliveryDate: new Date().toISOString().split('T')[0],
    clientName: firstDoc.nazwa_kontrahenta || '',
    destination_city: firstDoc.extracted_city || '',
    street: firstDoc.extracted_street || firstDoc.adres_dostawy || '',
    postal_code: firstDoc.kod_pocztowy_dostawy || firstDoc.extracted_postal_code || '',
    distance: 0,
    mpk: '',
    loadingContact: isZielonka ? '22 781 99 90' : '85 664 66 00',
    unloadingContact: firstDoc.extracted_phone || '',
    notes: '',
    goods_description: ''
  });

  const totalWeight = selectedDocs.reduce((acc, d) => acc + parseFloat(d.waga_suma || 0), 0);
  const totalTowarWeight = selectedDocs.reduce((acc, d) => acc + parseFloat(d.waga_towaru || 0), 0);
  const totalBebnyWeight = selectedDocs.reduce((acc, d) => acc + parseFloat(d.waga_bebnow || 0), 0);
  const totalDrums = selectedDocs.reduce((acc, d) => acc + parseInt(d.liczba_bebnow || 0, 10), 0);
  const missingTowarCount = selectedDocs.reduce((acc, d) => acc + parseInt(d.waga_brak_towar_count || 0, 10), 0);
  const missingBebenCount = selectedDocs.reduce((acc, d) => acc + parseInt(d.waga_brak_beben_count || 0, 10), 0);

  const formatWeight = (valKg) => {
    const num = parseFloat(valKg || 0);
    if (num <= 0) return '0 kg';
    return num >= 1000 ? `${(num / 1000).toFixed(2)} t` : `${num.toFixed(1)} kg`;
  };

  // Automatyczne wyznaczanie odległości
  const calculateDistance = async (loc, city, postal, strt) => {
    const targetCity = city || formData.destination_city;
    const targetPostal = postal || formData.postal_code;
    const targetLoc = loc || formData.location;
    const targetStrt = strt || formData.street;

    if (!targetCity && !targetPostal) return;

    setCalculatingDistance(true);
    try {
      const origin = targetLoc.toLowerCase().includes('zielonka') ? 'zielonka' : 'bialystok';
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
      console.warn('Błąd automatycznego wyliczania odległości dla spedycji:', e);
    } finally {
      setCalculatingDistance(false);
    }
  };

  // Automatyczne generowanie opisu ładunku dla spedytora
  useEffect(() => {
    if (selectedDocs.length > 0) {
      const wzList = selectedDocs.map(d => d.nr_wz).join(', ');
      const wzoList = selectedDocs.map(d => d.dokumenty_powiazane).filter(Boolean).join(', ');

      let desc = `Towary elektroinstalacyjne / kable wg WZ: ${wzList}`;
      if (wzoList) {
        desc += `\nPowiązane dokumenty opakowań: ${wzoList}`;
      }
      desc += `\nŁączna wartość towaru: ${selectedDocs.reduce((acc, d) => acc + parseFloat(d.dok_brutto || 0), 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł`;
      desc += `\nPozycji: ${selectedDocs.reduce((acc, d) => acc + parseInt(d.pozycje_count || 0, 10), 0)}`;

      if (totalTowarWeight > 0 || totalBebnyWeight > 0) {
        desc += `\n--- PARAMETRY TONAŻOWE ---`;
        if (totalTowarWeight > 0) desc += `\nWaga towaru netto: ${formatWeight(totalTowarWeight)}`;
        if (totalBebnyWeight > 0) desc += `\nWaga bębnów (tara): ${formatWeight(totalBebnyWeight)}`;
        desc += `\nŁączna szacunkowa masa brutto: ${formatWeight(totalWeight)}`;
      }

      if (totalDrums > 0) {
        desc += `\nBębny kablowe: ${totalDrums} szt. (wymagany pojazd z windą lub rozładunek wózkiem widłowym/HDS)`;
      }

      const city = firstDoc.extracted_city || '';
      const postal = firstDoc.kod_pocztowy_dostawy || firstDoc.extracted_postal_code || '';
      const strt = firstDoc.extracted_street || firstDoc.adres_dostawy || '';
      const defaultLoc = isZielonka ? 'Magazyn Zielonka' : 'Magazyn Białystok';

      setFormData(prev => ({
        ...prev,
        goods_description: desc,
        location: defaultLoc,
        clientName: prev.clientName || firstDoc.nazwa_kontrahenta || '',
        destination_city: prev.destination_city || city,
        street: prev.street || strt,
        postal_code: prev.postal_code || postal,
        unloadingContact: prev.unloadingContact || firstDoc.extracted_phone || '',
        notes: firstDoc.uwagi ? `Instrukcje z ERP:\n${firstDoc.uwagi}` : ''
      }));

      calculateDistance(defaultLoc, city, postal, strt);
    }
  }, [selectedDocs, totalWeight, totalDrums, totalTowarWeight, totalBebnyWeight]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'location') {
        calculateDistance(value, updated.destination_city, updated.postal_code, updated.street);
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/wz/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_spedycja',
          wzNumbers: selectedWzNumbers,
          ...formData
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Wystąpił błąd podczas tworzenia zlecenia spedycyjnego');
      }

      setSuccessResult(json);
      if (onCreated) {
        onCreated(json);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nowe Zlecenie Spedycyjne z WZ</h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Wybrano: <b>{selectedWzNumbers.length}</b> dokumentów • Transport zewnętrzny (Giełda spedycji)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {successResult ? (
            <div className="text-center py-10 space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Utworzono Zlecenie Spedycyjne!</h3>
                <p className="text-sm text-gray-500 mt-1 font-mono font-bold text-blue-700">
                  Numer zlecenia: {successResult.orderNumber} (ID: #{successResult.spedycjaId})
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Wszystkie wybrane dokumenty WZ zostały oznaczone jako przypisane do spedycji.
                </p>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <a
                  href="/spedycja"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xs transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Przejdź do Zleceń Spedycyjnych
                </a>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors"
                >
                  Zamknij okno
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Box podglądu wybranych WZ i wagi */}
              <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900">
                    Dokumenty WZ ({selectedDocs.length}):
                  </span>
                  <span className="font-bold text-gray-900">
                    Wartość: {selectedDocs.reduce((acc, d) => acc + parseFloat(d.dok_brutto || 0), 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {selectedDocs.map(d => (
                    <div key={d.nr_wz} className="flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-white border border-blue-200 rounded text-[11px] font-mono font-bold text-blue-800">
                        {d.nr_wz}
                      </span>
                      {d.dokumenty_powiazane && (
                        <span className="px-1.5 py-0.5 bg-purple-100 border border-purple-200 rounded text-[10px] font-mono font-semibold text-purple-800" title={`Powiązane opakowania: ${d.dokumenty_powiazane}`}>
                          ↳ {d.dokumenty_powiazane}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Badges wag i parametrów */}
                <div className="pt-2 border-t border-blue-200/60 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-950 border border-amber-300">
                    ⚖️ Masa brutto: {formatWeight(totalWeight)}
                  </span>
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-blue-100 text-blue-900">
                    Towar: {formatWeight(totalTowarWeight)}
                  </span>
                  {totalDrums > 0 && (
                    <span className="px-2.5 py-1 rounded-lg font-bold bg-purple-100 text-purple-950 border border-purple-300">
                      📦 Bębny: {totalDrums} szt. ({formatWeight(totalBebnyWeight)})
                    </span>
                  )}
                  {calculatingDistance && (
                    <span className="text-[11px] text-blue-600 animate-pulse">
                      Wyznaczanie trasy drogowej...
                    </span>
                  )}
                </div>

                {/* Ostrzeżenie o brakach wag w ERP */}
                {(missingTowarCount > 0 || missingBebenCount > 0) && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <b>Uwaga:</b> W systemie ERP nie uzupełniono wagi dla {missingTowarCount > 0 && `${missingTowarCount} pozycji towarowych`}
                      {missingTowarCount > 0 && missingBebenCount > 0 && ' oraz '}
                      {missingBebenCount > 0 && `${missingBebenCount} bębnów`}.
                      Rzeczywista masa ładunku jest wyższa!
                    </span>
                  </div>
                )}
              </div>

              {/* Formularz zlecenia */}
              <div className="space-y-4">
                {/* 1. Punkt załadunku (Magazyn) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Magazyn załadunku (Pochodzenie towaru)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, location: 'Magazyn Białystok' }))}
                      className={`py-2.5 px-4 rounded-xl border text-left text-xs transition-all ${
                        formData.location === 'Magazyn Białystok'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-600/20'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <p className="font-bold">Magazyn Białystok</p>
                      <p className="text-[11px] text-gray-500 font-normal">ul. Wysockiego 69B, 15-169 Białystok</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, location: 'Magazyn Zielonka' }))}
                      className={`py-2.5 px-4 rounded-xl border text-left text-xs transition-all ${
                        formData.location === 'Magazyn Zielonka'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-600/20'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <p className="font-bold">Magazyn Zielonka</p>
                      <p className="text-[11px] text-gray-500 font-normal">ul. Krótka 2, 05-220 Zielonka</p>
                    </button>
                  </div>
                </div>

                {/* 2. Odbiorca i miejsce dostawy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Klient / Odbiorca dostawy
                    </label>
                    <input
                      type="text"
                      name="clientName"
                      value={formData.clientName}
                      onChange={handleChange}
                      required
                      placeholder="Nazwa firmy / klienta"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Data dostawy
                    </label>
                    <input
                      type="date"
                      name="deliveryDate"
                      value={formData.deliveryDate}
                      onChange={handleChange}
                      required
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* 3. Adres dostawy */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Kod pocztowy
                    </label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      placeholder="np. 00-001"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Miejscowość docelowa
                    </label>
                    <input
                      type="text"
                      name="destination_city"
                      value={formData.destination_city}
                      onChange={handleChange}
                      required
                      placeholder="Miasto dostawy"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ulica / Plac budowy / Szczegóły rozładunku
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    placeholder="np. ul. Budowlana 10 (brama nr 2)"
                    className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                {/* 4. Kontakty i Odległość */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Kontakt rozładunek (Odbiorca)
                    </label>
                    <input
                      type="text"
                      name="unloadingContact"
                      value={formData.unloadingContact}
                      onChange={handleChange}
                      placeholder="np. 600 000 000"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Odległość drogowa (km)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="distance"
                        value={formData.distance}
                        onChange={handleChange}
                        className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">km</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      MPK / Budowa
                    </label>
                    <input
                      type="text"
                      name="mpk"
                      value={formData.mpk}
                      onChange={handleChange}
                      placeholder="np. 101-01"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* 5. Opis ładunku */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Opis ładunku dla spedytora (waga, bębny, typ towaru)
                  </label>
                  <textarea
                    rows={4}
                    name="goods_description"
                    value={formData.goods_description}
                    onChange={handleChange}
                    className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono leading-relaxed"
                  />
                </div>

                {/* 6. Uwagi dla spedycji */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Uwagi / Warunki transportu
                  </label>
                  <textarea
                    rows={2}
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="np. Wymagana winda załadowcza + wózek paletowy, wjazd tylko dla aut do 12m..."
                    className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Tworzenie zlecenia...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>Utwórz zlecenie spedycyjne ({selectedWzNumbers.length})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
