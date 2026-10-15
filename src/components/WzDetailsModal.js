// src/components/WzDetailsModal.js
'use client';
import React, { useState, useEffect } from 'react';
import { X, Package, MapPin, Calendar, Building, Phone, ExternalLink, Truck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function WzDetailsModal({ wzNumber, onClose, onAssignChange }) {
  const [currentWzNumber, setCurrentWzNumber] = useState(wzNumber);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCurrentWzNumber(wzNumber);
  }, [wzNumber]);

  useEffect(() => {
    if (!currentWzNumber) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        let res = await fetch(`/api/wz/details?nr=${encodeURIComponent(currentWzNumber)}`);
        if (!res.ok) {
          res = await fetch(`/api/wz/${encodeURIComponent(currentWzNumber)}`);
        }
        const json = await res.json();
        if (json.success) {
          setData(json);
        } else {
          setError(json.error || 'Nie udało się pobrać szczegółów');
        }
      } catch (err) {
        setError('Błąd połączenia z serwerem');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [currentWzNumber]);

  if (!wzNumber) return null;

  const doc = data?.document;
  const items = data?.items || [];
  const transport = data?.transport;
  const spedycja = data?.spedycja;

  const formatWeight = (valKg) => {
    const num = parseFloat(valKg || 0);
    if (num <= 0) return '0 kg';
    return num >= 1000 ? `${(num / 1000).toFixed(2)} t` : `${num.toFixed(1)} kg`;
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{currentWzNumber}</h2>
                {doc && (
                  <>
                    {doc.typ_dokumentu && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                        {doc.typ_dokumentu}
                      </span>
                    )}
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                      doc.status === 'przypisany' 
                        ? 'bg-purple-100 text-purple-800'
                        : doc.status === 'zrealizowany'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {doc.status === 'przypisany' ? (doc.transport_id ? 'W transporcie' : 'W spedycji') : doc.status === 'zrealizowany' ? 'Zrealizowany' : 'Do zaplanowania'}
                    </span>
                    {parseFloat(doc.waga_suma || 0) > 0 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-900 border border-amber-300" title="Łączna masa brutto (towar + bębny)">
                        ⚖️ Masa brutto: {formatWeight(doc.waga_suma)}
                      </span>
                    )}
                    {parseFloat(doc.waga_towaru || 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-blue-50 text-blue-800 border border-blue-200" title="Waga netto towarów/kabli">
                        Towar: {formatWeight(doc.waga_towaru)}
                      </span>
                    )}
                    {parseInt(doc.liczba_bebnow || 0, 10) > 0 && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-900 border border-purple-300" title="Liczba bębnów i ich waga tary">
                        📦 Bębny: {doc.liczba_bebnow} szt. ({formatWeight(doc.waga_bebnow)})
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                <span>{doc?.nazwa_magazynu} ({doc?.symbol_magazynu})</span>
                <span>•</span>
                <span>Wystawiono: {doc?.data_wystawienia ? new Date(doc.data_wystawienia).toLocaleDateString('pl-PL') : '-'}</span>
                {doc?.dokumenty_powiazane && (
                  <>
                    <span>•</span>
                    <span className="text-purple-700 font-medium">
                      Powiązane WZO/WIO: 
                      {doc.dokumenty_powiazane.split(',').map((wzoStr, i) => {
                        const cleanWzo = wzoStr.trim();
                        return (
                          <button
                            key={i}
                            onClick={() => setCurrentWzNumber(cleanWzo)}
                            className="ml-1 underline font-bold hover:text-purple-900"
                            title={`Kliknij, aby otworzyć dokument opakowań ${cleanWzo}`}
                          >
                            {cleanWzo}
                          </button>
                        );
                      })}
                    </span>
                  </>
                )}
                {currentWzNumber !== wzNumber && (
                  <button
                    onClick={() => setCurrentWzNumber(wzNumber)}
                    className="ml-2 text-blue-600 hover:underline text-[11px] font-bold"
                  >
                    ← Wróć do {wzNumber}
                  </button>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm">Ładowanie zawartości dokumentu...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : doc ? (
            <>
              {/* Ostrzeżenie o niepełnych wagach w ERP */}
              {(parseInt(doc.waga_brak_towar_count || 0, 10) > 0 || parseInt(doc.waga_brak_beben_count || 0, 10) > 0) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">⚠️ Uwaga: Wykryto brakujące wagi w kartotece ERP!</span>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">
                      W systemie ERP nie uzupełniono wagi dla: 
                      {parseInt(doc.waga_brak_towar_count || 0, 10) > 0 && <b> {doc.waga_brak_towar_count} pozycji towarowych</b>}
                      {parseInt(doc.waga_brak_towar_count || 0, 10) > 0 && parseInt(doc.waga_brak_beben_count || 0, 10) > 0 && ' oraz'}
                      {parseInt(doc.waga_brak_beben_count || 0, 10) > 0 && <b> {doc.waga_brak_beben_count} bębnów</b>}.
                      {' '}Rzeczywista masa transportu jest wyższa niż wyliczona suma!
                    </p>
                  </div>
                </div>
              )}

              {/* Podsumowanie klienta i dostawy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Odbiorca / Kontrahent</span>
                  <p className="text-sm font-bold text-gray-900">{doc.nazwa_kontrahenta || 'Brak nazwy'}</p>
                  <p className="text-xs text-gray-500">Kod klienta: {doc.kod_kontrahenta || '-'}</p>
                  {doc.nazwa_miejsca_dostawy && (
                    <p className="text-xs text-gray-600 pt-0.5">
                      <span className="text-gray-400">Miejsce: </span>{doc.nazwa_miejsca_dostawy}
                    </p>
                  )}
                  {(doc.handlowiec || doc.rynek) && (
                    <div className="pt-2 border-t border-gray-200/60 flex flex-wrap items-center justify-between gap-1 text-xs">
                      {doc.handlowiec && <span>Handlowiec: <b className="text-gray-900">{doc.handlowiec}</b></span>}
                      {doc.rynek && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold text-[10px]">Rynek: {doc.rynek}</span>}
                    </div>
                  )}
                  {doc.jednostka_lokalizacji && (
                    <p className="text-[11px] text-gray-400">
                      Jednostka: {doc.jednostka_lokalizacji}
                    </p>
                  )}
                </div>

                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 block">Adres dostawy</span>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.adres_dostawy || 'Brak bezpośredniego adresu w ERP'}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {doc.kod_pocztowy_dostawy ? <b className="text-gray-900">{doc.kod_pocztowy_dostawy} </b> : (doc.extracted_postal_code ? `${doc.extracted_postal_code} ` : '')}
                        {doc.extracted_city || ''}
                      </p>
                      {doc.extracted_phone && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                          <Phone className="w-3 h-3" />
                          <a href={`tel:${doc.extracted_phone}`} className="hover:underline font-medium">
                            {doc.extracted_phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status transportu jeśli przypisany */}
              {transport && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-purple-700" />
                    <div>
                      <h4 className="text-sm font-bold text-purple-900">Przypisano do Transportu Własnego #{transport.id}</h4>
                      <p className="text-xs text-purple-700">
                        Status transportu: {transport.status} • Trasa: {transport.source_warehouse} ➔ {transport.destination_city} • Data: {transport.delivery_date ? new Date(transport.delivery_date).toLocaleDateString('pl-PL') : '-'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="/kalendarz"
                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium transition-colors"
                  >
                    Zobacz w kalendarzu
                  </a>
                </div>
              )}

              {/* Status spedycji jeśli przypisany */}
              {spedycja && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-blue-700" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-900">Przypisano do Zlecenia Spedycyjnego #{spedycja.id} ({spedycja.order_number || ''})</h4>
                      <p className="text-xs text-blue-700">
                        Status spedycji: {spedycja.status} • Magazyn: {spedycja.location} • Klient: {spedycja.client_name} • Data: {spedycja.delivery_date ? new Date(spedycja.delivery_date).toLocaleDateString('pl-PL') : '-'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="/spedycja"
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    Zobacz w spedycji
                  </a>
                </div>
              )}

              {/* Tabela pozycji towarowych */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span>Pozycje towarowe</span>
                    <span className="text-xs font-normal text-gray-500">({items.length} pozycji)</span>
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-3">
                    <div className="flex items-center gap-1 font-semibold text-gray-700">
                      <span>Towar: <b className="text-gray-900">{formatWeight(doc.waga_towaru)}</b></span>
                      <span>+</span>
                      <span>Bębny: <b className="text-purple-700">{formatWeight(doc.waga_bebnow)}</b></span>
                      <span>=</span>
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                        {formatWeight(doc.waga_suma)}
                      </span>
                    </div>
                    <div>
                      Netto: <b className="text-gray-900 font-semibold">{parseFloat(doc.dok_netto || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</b> • 
                      Brutto: <b className="text-blue-600 font-semibold">{parseFloat(doc.dok_brutto || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</b>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-600 sticky top-0 z-10 border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold w-10 text-center">LP</th>
                          <th className="py-2.5 px-3 font-semibold">Kod towaru</th>
                          <th className="py-2.5 px-3 font-semibold">Nazwa towaru</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Ilość</th>
                          <th className="py-2.5 px-2 font-semibold text-center w-12">J.M.</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Waga towaru</th>
                          <th className="py-2.5 px-3 font-semibold">Bęben / Opakowanie</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Cena netto</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Wartość netto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.length > 0 ? (
                          items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="py-2.5 px-3 text-center text-gray-400 font-mono">{it.lp || idx + 1}</td>
                              <td className="py-2.5 px-3 font-mono text-gray-600">{it.kod_towaru || '-'}</td>
                              <td className="py-2.5 px-3 font-medium text-gray-900">
                                <div>{it.nazwa_towaru}</div>
                                {it.dokumenty_powiazane_wzo && (
                                  <div className="text-[10px] text-purple-700 font-mono mt-0.5">
                                    ↳ Zlecenie: {it.dokumenty_powiazane_wzo}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900">{it.ilosc}</td>
                              <td className="py-2.5 px-2 text-center text-gray-500">{it.jednostka_miary}</td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {parseFloat(it.waga_pozycji || 0) > 0 ? (
                                  <span className="font-semibold text-gray-800">
                                    {parseFloat(it.waga_pozycji).toFixed(1)} kg
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-medium text-[11px]" title="Brak uzupełnionej wagi w ERP">
                                    ⚠️ brak w ERP
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {it.cecha_bebna ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                      📦 {it.cecha_bebna}
                                    </span>
                                    {it.linked_drums && it.linked_drums.length > 0 ? (
                                      <div className="mt-1 space-y-0.5">
                                        {it.linked_drums.map((ld, i) => (
                                          <div key={i} className="text-[10px] text-purple-950 bg-purple-50/80 rounded px-1.5 py-0.5 border border-purple-100">
                                            <span className="font-semibold">{ld.nazwa_towaru}</span>
                                            <span className="text-gray-500"> (Dok: <button onClick={() => setCurrentWzNumber(ld.nr_wz)} className="underline font-bold text-purple-800 hover:text-purple-950">{ld.nr_wz}</button>)</span>
                                            <span className="block font-medium">
                                              Waga tary: {parseFloat(ld.waga_pozycji || 0) > 0 ? (
                                                <b className="text-purple-900">{parseFloat(ld.waga_pozycji).toFixed(0)} kg</b>
                                              ) : (
                                                <span className="text-amber-600 font-bold">⚠️ brak wagi bębna w ERP</span>
                                              )}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">{parseFloat(it.cena_jed_netto || 0).toFixed(2)} zł</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{parseFloat(it.wartosc_netto || 0).toFixed(2)} zł</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="9" className="py-6 text-center text-gray-400">
                              Brak pozycji towarowych w bazie
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Uwagi z ERP */}
              {doc.uwagi && (
                <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 block mb-1">
                    Uwagi / Instrukcje dostawy z ERP
                  </span>
                  <p className="text-xs text-amber-950 whitespace-pre-line leading-relaxed font-mono">
                    {doc.uwagi}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl font-medium transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
