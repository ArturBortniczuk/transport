'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Calculator, MapPin, Truck, Calendar, Scale, Ruler, Building2,
    ArrowRight, Search, FileText, Send, Package
} from 'lucide-react';

export default function WycenaTransportu() {
    const [transportMode, setTransportMode] = useState('wlasny'); // 'wlasny' lub 'kurier'
    const [formData, setFormData] = useState({
        sourceWarehouse: '',
        sourceCity: '',
        destinationCity: '',
        weight: '',
        length: '',
        palletType: '',
        deliveryDate: ''
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Google Maps autocompletes
    const sourceInputRef = useRef(null);
    const destinationInputRef = useRef(null);
    const autocompleteSource = useRef(null);
    const autocompleteDest = useRef(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && !window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = initAutocomplete;
            document.head.appendChild(script);
        } else if (window.google) {
            initAutocomplete();
        }
    }, [transportMode]); // Re-init on mode change because refs might be unmounted

    const initAutocomplete = () => {
        if (!window.google) return;

        if (sourceInputRef.current && !autocompleteSource.current) {
            autocompleteSource.current = new window.google.maps.places.Autocomplete(sourceInputRef.current, {
                types: ['(cities)'],
                componentRestrictions: { country: ['pl', 'de', 'cz', 'sk', 'lt'] }
            });

            autocompleteSource.current.addListener('place_changed', () => {
                const place = autocompleteSource.current.getPlace();
                if (place.name) {
                    setFormData(prev => ({ ...prev, sourceCity: place.name, sourceWarehouse: '' }));
                }
            });
        }

        if (destinationInputRef.current && !autocompleteDest.current) {
            autocompleteDest.current = new window.google.maps.places.Autocomplete(destinationInputRef.current, {
                types: ['(cities)'],
                componentRestrictions: { country: ['pl', 'de', 'cz', 'sk', 'lt'] }
            });

            autocompleteDest.current.addListener('place_changed', () => {
                const place = autocompleteDest.current.getPlace();
                if (place.name) {
                    setFormData(prev => ({ ...prev, destinationCity: place.name }));
                }
            });
        }
    };

    const calculateDistance = async (origin, destination) => {
        return new Promise((resolve, reject) => {
            if (!window.google) {
                reject('Google Maps API not loaded');
                return;
            }

            const service = new window.google.maps.DistanceMatrixService();
            service.getDistanceMatrix({
                origins: [origin],
                destinations: [destination],
                travelMode: 'DRIVING'
            }, (response, status) => {
                if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
                    const distanceValue = response.rows[0].elements[0].distance.value;
                    resolve(distanceValue / 1000); // km
                } else {
                    reject('Nie udało się obliczyć trasy');
                }
            });
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'sourceWarehouse') {
            if (value === 'Białystok') {
                setFormData(prev => ({ ...prev, sourceCity: 'Białystok' }));
                if (sourceInputRef.current) sourceInputRef.current.value = 'Białystok';
            } else if (value === 'Zielonka') {
                setFormData(prev => ({ ...prev, sourceCity: 'Zielonka' }));
                if (sourceInputRef.current) sourceInputRef.current.value = 'Zielonka';
            }
        }
    };

    const handleManualSourceChange = (e) => {
        setFormData(prev => ({ ...prev, sourceCity: e.target.value, sourceWarehouse: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (transportMode === 'wlasny') {
            if (!formData.sourceCity || !formData.destinationCity) {
                setError('Wprowadź miasto początkowe i docelowe');
                return;
            }
        } else if (transportMode === 'kurier') {
            if (!formData.palletType || !formData.weight) {
                setError('Wybierz rodzaj palety i wpisz wagę ładunku.');
                return;
            }
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            let distanceKm = 0;

            if (transportMode === 'wlasny') {
                distanceKm = await calculateDistance(formData.sourceCity, formData.destinationCity);
            }

            const response = await fetch('/api/wycena-transportu/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    deliveryDateStr: formData.deliveryDate,
                    distanceKm,
                    mode: transportMode
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Błąd API');

            setResult({ ...data, distanceKm, searchParams: { ...formData } });
        } catch (err) {
            console.error(err);
            setError('Wystąpił błąd podczas wyceny transportu: ' + err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center mb-4 md:mb-0">
                    <Calculator className="mr-3 h-8 w-8 text-blue-600" />
                    Wycena Transportu
                </h1>

                {/* Przełącznik Trybów */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => { setTransportMode('wlasny'); setResult(null); setError(''); }}
                        className={`flex items-center px-4 py-2 rounded-md transition-colors ${transportMode === 'wlasny' ? 'bg-white shadow text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        <Truck className="w-4 h-4 mr-2" /> Własny / Spedycja
                    </button>
                    <button
                        onClick={() => { setTransportMode('kurier'); setResult(null); setError(''); }}
                        className={`flex items-center px-4 py-2 rounded-md transition-colors ${transportMode === 'kurier' ? 'bg-white shadow text-orange-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        <Package className="w-4 h-4 mr-2" /> Kurier (Geodis)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formularz - lewa kolumna */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md border border-gray-100 h-max">
                    <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">Parametry transportu</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Pola dla Transportu Własnego */}
                        {transportMode === 'wlasny' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                        <Building2 className="w-4 h-4 mr-2" /> Start (Baza)
                                    </label>
                                    <select
                                        name="sourceWarehouse"
                                        value={formData.sourceWarehouse}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-2"
                                    >
                                        <option value="">Wybierz magazyn, lub wpisz miasto poniżej...</option>
                                        <option value="Białystok">Magazyn Białystok (15-169 ul. Wysockiego 69B)</option>
                                        <option value="Zielonka">Magazyn Zielonka (05-220 Zielonka ul. Krótka 4)</option>
                                    </select>
                                    <input
                                        ref={sourceInputRef}
                                        type="text"
                                        value={formData.sourceCity}
                                        onChange={handleManualSourceChange}
                                        placeholder="Miasto początkowe"
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                        <MapPin className="w-4 h-4 mr-2" /> Cel
                                    </label>
                                    <input
                                        ref={destinationInputRef}
                                        type="text"
                                        value={formData.destinationCity}
                                        onChange={(e) => setFormData(p => ({ ...p, destinationCity: e.target.value }))}
                                        placeholder="Miasto docelowe"
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                            <Scale className="w-4 h-4 mr-2" /> Waga (kg)
                                        </label>
                                        <input
                                            type="number"
                                            name="weight"
                                            max="24000"
                                            value={formData.weight}
                                            onChange={handleChange}
                                            placeholder="np. 1500"
                                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                            <Ruler className="w-4 h-4 mr-2" /> Długość (m)
                                        </label>
                                        <input
                                            type="number"
                                            name="length"
                                            max="13.6"
                                            step="0.1"
                                            value={formData.length}
                                            onChange={handleChange}
                                            placeholder="np. 5.5"
                                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Pola dla Kuriera */}
                        {transportMode === 'kurier' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                        <FileText className="w-4 h-4 mr-2" /> Rodzaj palety (Geodis)
                                    </label>
                                    <select
                                        name="palletType"
                                        value={formData.palletType}
                                        onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500"
                                    >
                                        <option value="">Wybierz rodzaj palety...</option>
                                        <option value="0.6x0.8">Półpaleta (0.6x0.8m) - do 300kg</option>
                                        <option value="1.2x0.8">Paleta Euro (1.2x0.8m) - do 1200kg</option>
                                        <option value="1.2x1.2">Paleta Przemysłowa (1.2x1.2m) - do 1200kg</option>
                                        <option value="ponadgabaryt">Ponadgabaryt (do 1.8x1.8m) - do 1200kg</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                        <Scale className="w-4 h-4 mr-2" /> Waga rzeczywista (kg)
                                    </label>
                                    <input
                                        type="number"
                                        name="weight"
                                        max="1200"
                                        value={formData.weight}
                                        onChange={handleChange}
                                        placeholder="Max 1200 kg"
                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Dla kuriera maksymalna waga palety to 1200 kg.</p>
                                </div>
                            </>
                        )}

                        {/* Wspólne pola */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                <Calendar className="w-4 h-4 mr-2" /> Planowana data
                            </label>
                            <input
                                type="date"
                                name="deliveryDate"
                                value={formData.deliveryDate}
                                onChange={handleChange}
                                className={`w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-${transportMode === 'kurier' ? 'orange' : 'blue'}-500 focus:border-${transportMode === 'kurier' ? 'orange' : 'blue'}-500`}
                            />
                        </div>

                        {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white font-medium py-3 px-4 rounded-md transition duration-150 flex items-center justify-center disabled:opacity-50 ${transportMode === 'kurier' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {loading ? 'Obliczanie...' : <><Search className="w-5 h-5 mr-2" /> Oblicz koszt</>}
                        </button>
                    </form>
                </div>

                {/* Wyniki - prawa kolumna */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Wynik wyceny */}
                    {result ? (
                        <>
                            {result.mode === 'wlasny' && (
                                <>
                                    <div className="bg-white p-6 rounded-xl shadow-md border border-green-100 overflow-hidden relative mb-6">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                            <Truck className="w-32 h-32" />
                                        </div>
                                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Wynik Kalkulacji: Transport Własny</h2>

                                        <div className="flex items-center text-sm md:text-base text-gray-600 mb-6 bg-gray-50 p-4 rounded-lg">
                                            <span className="font-semibold">{result.searchParams.sourceCity.substring(0, 15)}</span>
                                            <ArrowRight className="mx-2 text-blue-500 flex-shrink-0" />
                                            <span className="font-semibold truncate">{result.searchParams.destinationCity}</span>
                                            <span className="ml-auto text-xs md:text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded-full whitespace-nowrap">
                                                ~ {Math.round(result.distanceKm)} km
                                            </span>
                                        </div>

                                        <div className="mb-6">
                                            <div className="text-4xl font-bold text-green-600 mb-1">
                                                {result.estimatedCost?.toLocaleString('pl-PL')} PLN
                                            </div>
                                            <div className="text-sm text-gray-500">Szacowany koszt transportu dla Twojej floty</div>
                                        </div>

                                        <div className="border-t pt-4">
                                            <h3 className="text-sm font-medium text-gray-700 mb-3">Uwzględnione założenia do wyceny:</h3>
                                            <ul className="space-y-2">
                                                {result.breakdown?.map((item, idx) => (
                                                    <li key={idx} className="flex items-center text-sm">
                                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 min-w-[6px]"></span>
                                                        <span className="text-gray-600">{item.name}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-5 rounded-lg shadow border border-gray-100">
                                            <h3 className="text-lg font-medium mb-4 flex items-center text-blue-800">
                                                <Truck className="w-5 h-5 mr-2" /> Podobne Trasowo (Własne)
                                            </h3>
                                            {result.history?.ownTransports?.length > 0 ? (
                                                <ul className="space-y-3">
                                                    {result.history.ownTransports.map(t => (
                                                        <li key={t.id} className="p-3 bg-gray-50 rounded text-sm border-l-4 border-blue-400 flex flex-col">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-medium mr-2 truncate" title={t.destination_city}>{t.destination_city}</span>
                                                                {t.distance_km && <span className="flex-shrink-0 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">~ {t.distance_km} km</span>}
                                                            </div>
                                                            <div className="text-gray-500 text-xs mb-1">Data: {new Date(t.completed_at || t.delivery_date).toLocaleDateString()}</div>
                                                            {t.client_name && <div className="text-xs text-gray-400 truncate">Klient: {t.client_name}</div>}
                                                            {t.estimatedCost && <div className="font-semibold text-blue-600 mt-1 text-right">{t.estimatedCost} PLN</div>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-500">Brak historycznych transportów na tej trasie.</p>
                                            )}
                                        </div>

                                        <div className="bg-white p-5 rounded-lg shadow border border-gray-100">
                                            <h3 className="text-lg font-medium mb-4 flex items-center text-purple-800">
                                                <Send className="w-5 h-5 mr-2" /> Szacunkowe Spedycje (+-20%)
                                            </h3>
                                            {result.history?.speditions?.length > 0 ? (
                                                <ul className="space-y-3">
                                                    {result.history.speditions.map(s => (
                                                        <li key={s.id} className="p-3 bg-gray-50 rounded text-sm border-l-4 border-purple-400 flex flex-col">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-medium mr-2" title={s.location}>
                                                                    {(() => {
                                                                        try {
                                                                            const loc = s.location_data ? (typeof s.location_data === 'string' ? JSON.parse(s.location_data) : s.location_data) : null;
                                                                            const del = s.delivery_data ? (typeof s.delivery_data === 'string' ? JSON.parse(s.delivery_data) : s.delivery_data) : null;
                                                                            const startCity = loc && loc.city ? loc.city : s.location;
                                                                            const endCity = del && del.city ? del.city : '';
                                                                            return endCity ? `${startCity} → ${endCity}` : (startCity || 'Brak danych');
                                                                        } catch (e) {
                                                                            return s.location || 'Brak danych';
                                                                        }
                                                                    })()}
                                                                </span>
                                                                <span className="flex-shrink-0 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">{s.distance_km} km</span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Data: {s.delivery_date ? new Date(s.delivery_date).toLocaleDateString() : 'Brak'}
                                                            </div>
                                                            {(() => {
                                                                try {
                                                                    if (s.response_data) {
                                                                        const data = typeof s.response_data === 'string' ? JSON.parse(s.response_data) : s.response_data;
                                                                        const cost = data.deliveryPrice || data.costPerTransport || data.responseCost || data?.responseCost?.[0] || data?.[0]?.responseCost;
                                                                        if (cost) {
                                                                            return <div className="font-semibold text-purple-600 mt-1 text-right">{cost} PLN</div>;
                                                                        }
                                                                    }
                                                                } catch (e) { }
                                                                return <div className="text-xs text-gray-400 mt-1 text-right">Brak zapisanej ceny</div>;
                                                            })()}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-500">Brak spedycji dla podobnego dystansu.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {result.mode === 'kurier' && result.geodisCost && (
                                <div className="bg-white p-8 rounded-xl shadow-md border border-orange-200 overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <Package className="w-48 h-48" />
                                    </div>
                                    <h2 className="text-2xl font-semibold mb-6 text-gray-800 border-b border-gray-100 pb-4 flex items-center">
                                        <Package className="mr-3 text-orange-500" /> Wycena Kuriera: Geodis
                                    </h2>

                                    <div className="flex items-center justify-center text-base md:text-lg font-medium mb-8 bg-orange-50 p-5 rounded-lg border border-orange-100 text-orange-800">
                                        <Scale className="w-5 h-5 mr-3" />
                                        <span>Wybrana paleta: <span className="font-bold">{result.searchParams.palletType}</span> do <span className="font-bold">{result.searchParams.weight} kg</span></span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                        <div>
                                            <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-1">Cena Netto</div>
                                            <div className="text-4xl font-bold text-gray-800 mb-1">
                                                {result.geodisCost.netPrice.toFixed(2).replace('.', ',')} <span className="text-xl text-gray-500 font-normal">PLN</span>
                                            </div>
                                        </div>
                                        <div className="md:border-l md:pl-8">
                                            <div className="text-sm text-orange-600 uppercase tracking-wide font-semibold mb-1">Cena Brutto (+23%)</div>
                                            <div className="text-4xl font-bold text-orange-600 mb-1">
                                                {result.geodisCost.grossPrice.toFixed(2).replace('.', ',')} <span className="text-xl text-orange-400 font-normal">PLN</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-6 mt-8">
                                        <h3 className="text-base font-medium text-gray-700 mb-4">Szczegóły taryfy i dopłaty:</h3>
                                        <div className="bg-gray-50 rounded-lg p-5">
                                            <ul className="space-y-3">
                                                <li className="flex justify-between text-sm items-center">
                                                    <span className="text-gray-600 flex items-center font-medium"><span className="w-2 h-2 bg-gray-400 rounded-full mr-3"></span> Stawka bazowa z tabeli</span>
                                                    <span className="font-semibold bg-white px-3 py-1 rounded border shadow-sm">{result.geodisCost.basePrice.toFixed(2)} PLN</span>
                                                </li>
                                                <li className="flex justify-between text-sm items-center">
                                                    <span className="text-gray-600 flex items-center"><span className="w-2 h-2 bg-orange-400 rounded-full mr-3"></span> Opłata paliwowa (28%)</span>
                                                    <span className="font-medium text-orange-700">+ {result.geodisCost.fuelSurcharge.toFixed(2)} PLN</span>
                                                </li>
                                                {result.geodisCost.isSeasonal ? (
                                                    <li className="flex justify-between text-sm items-center">
                                                        <span className="text-red-600 flex items-center font-medium"><span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span> Opłata sezonowa (7.8%)</span>
                                                        <span className="font-bold text-red-600">+ {result.geodisCost.seasonalSurcharge.toFixed(2)} PLN</span>
                                                    </li>
                                                ) : (
                                                    <li className="flex justify-between text-sm items-center opacity-60">
                                                        <span className="text-gray-500 flex items-center"><span className="w-2 h-2 bg-gray-300 rounded-full mr-3"></span> Opłata sezonowa (7.8%)</span>
                                                        <span className="text-gray-400">nie dotyczy</span>
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-gray-400 h-full min-h-[400px]">
                            {transportMode === 'kurier' ? (
                                <Package className="w-16 h-16 mb-4 text-gray-300" />
                            ) : (
                                <Calculator className="w-16 h-16 mb-4 text-gray-300" />
                            )}
                            <p className="text-lg text-center">
                                {transportMode === 'kurier'
                                    ? 'Wybierz rodzaj palety i wpisz wagę, aby uzyskać wycenę kuriera.'
                                    : 'Wprowadź miasta oraz parametry z lewej strony, aby uzyskać wycenę floty.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
