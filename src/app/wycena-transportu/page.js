'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Calculator, MapPin, Truck, Calendar, Scale, Ruler, Building2,
    ArrowRight, Search, FileText, Send
} from 'lucide-react';

export default function WycenaTransportu() {
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
        // Load Google Maps API if not already present
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
    }, []);

    const initAutocomplete = () => {
        if (!window.google) return;

        if (sourceInputRef.current) {
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

        if (destinationInputRef.current) {
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

        // Jeśli wybieramy magazyn z listy
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
        if (!formData.sourceCity || !formData.destinationCity) {
            setError('Wprowadź miasto początkowe i docelowe');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            // 1. Oblicz odległość przez Google Maps
            const distanceKm = await calculateDistance(formData.sourceCity, formData.destinationCity);

            // 2. Wyślij zapytanie do naszego API
            const response = await fetch('/api/wycena-transportu/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData, // sourceCity, destinationCity, weight, length, deliveryDate
                    deliveryDateStr: formData.deliveryDate,
                    distanceKm
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
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <Calculator className="mr-3 h-8 w-8 text-blue-600" />
                    Wycena Transportu
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formularz - lewa kolumna */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md border border-gray-100 h-max">
                    <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">Parametry trasy</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                <FileText className="w-4 h-4 mr-2" /> Rodzaj palety (Geodis)
                            </label>
                            <select
                                name="palletType"
                                value={formData.palletType}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Transport własny / Spedycja dużego auta</option>
                                <option value="0.6x0.8">Półpaleta (0.6x0.8m) - do 300kg</option>
                                <option value="1.2x0.8">Paleta Euro (1.2x0.8m) - do 1200kg</option>
                                <option value="1.2x1.2">Paleta Przemysłowa (1.2x1.2m) - do 1200kg</option>
                                <option value="ponadgabaryt">Ponadgabaryt (do 1.8x1.8m) - do 1200kg</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 items-center flex mb-1">
                                <Calendar className="w-4 h-4 mr-2" /> Planowana data
                            </label>
                            <input
                                type="date"
                                name="deliveryDate"
                                value={formData.deliveryDate}
                                onChange={handleChange}
                                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition duration-150 flex items-center justify-center disabled:bg-blue-300"
                        >
                            {loading ? 'Obliczanie...' : <><Search className="w-5 h-5 mr-2" /> Oblicz koszt</>}
                        </button>
                    </form>
                </div>

                {/* Wyniki - prawa kolumna */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Wynik wyceny */}
                    {result ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Karta transportu własnego */}
                            <div className="bg-white p-6 rounded-xl shadow-md border border-green-100 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Truck className="w-32 h-32" />
                                </div>
                                <h2 className="text-xl font-semibold mb-4 text-gray-800">Transport Własny</h2>

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
                                        {result.estimatedCost.toLocaleString('pl-PL')} PLN
                                    </div>
                                    <div className="text-sm text-gray-500">Szacowany koszt dla Twojej floty</div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Uwzględnione założenia do wyceny:</h3>
                                    <ul className="space-y-2">
                                        {result.breakdown.map((item, idx) => (
                                            <li key={idx} className="flex items-center text-sm">
                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 min-w-[6px]"></span>
                                                <span className="text-gray-600">{item.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Karta Kuriera Geodis - Pojawi się tylko jeśli wybrano rodzaj palety i wyliczono cenę */}
                            {result.geodisCost ? (
                                <div className="bg-white p-6 rounded-xl shadow-md border border-orange-100 overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <Send className="w-32 h-32" />
                                    </div>
                                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Kurier (Geodis)</h2>

                                    <div className="flex items-center justify-center text-sm md:text-base mb-6 bg-orange-50 p-4 rounded-lg border border-orange-100">
                                        <span className="font-medium text-orange-800 flex items-center">
                                            <Scale className="w-4 h-4 mr-2" />
                                            {result.searchParams.palletType} do {result.searchParams.weight} kg
                                        </span>
                                    </div>

                                    <div className="mb-6">
                                        <div className="text-4xl font-bold text-orange-600 mb-1">
                                            {result.geodisCost.totalPrice.toFixed(2).replace('.', ',')} PLN
                                        </div>
                                        <div className="text-sm text-gray-500">Całkowity koszt netto z dopłatami</div>
                                    </div>

                                    <div className="border-t border-orange-100 pt-4">
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">Składniki taryfy Geodis:</h3>
                                        <ul className="space-y-2">
                                            <li className="flex justify-between text-sm">
                                                <span className="text-gray-600 flex items-center"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2 min-w-[6px]"></span> Baza tabelaryczna</span>
                                                <span className="font-medium">{result.geodisCost.basePrice.toFixed(2)} PLN</span>
                                            </li>
                                            <li className="flex justify-between text-sm">
                                                <span className="text-gray-600 flex items-center"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2 min-w-[6px]"></span> Opłata paliwowa (28%)</span>
                                                <span className="font-medium">+ {result.geodisCost.fuelSurcharge.toFixed(2)} PLN</span>
                                            </li>
                                            {result.geodisCost.isSeasonal && (
                                                <li className="flex justify-between text-sm text-orange-700">
                                                    <span className="flex items-center"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2 min-w-[6px]"></span> Opłata sezonowa (7.8%)</span>
                                                    <span className="font-bold">+ {result.geodisCost.seasonalSurcharge.toFixed(2)} PLN</span>
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-gray-400">
                                    <Package className="w-12 h-12 mb-4 text-gray-300" />
                                    <p className="text-sm text-center">Wybierz "Rodzaj palety" i wagę poniżej 1200kg, aby sprawdzić cennik kurierski.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-gray-400 h-full min-h-[400px]">
                            <Calculator className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-lg">Wprowadź dane z lewej strony, aby uzyskać wycenę.</p>
                        </div>
                    )}

                    {/* Historia transportów */}
                    {result && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Transport Własny Miejsca */}
                            <div className="bg-white p-5 rounded-lg shadow border border-gray-100">
                                <h3 className="text-lg font-medium mb-4 flex items-center text-blue-800">
                                    <Truck className="w-5 h-5 mr-2" /> Podobne Trasowo (Własne)
                                </h3>
                                {result.history.ownTransports.length > 0 ? (
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

                            {/* Spedycje odległość */}
                            <div className="bg-white p-5 rounded-lg shadow border border-gray-100">
                                <h3 className="text-lg font-medium mb-4 flex items-center text-purple-800">
                                    <Send className="w-5 h-5 mr-2" /> Szacunkowe Spedycje (na dystans +-20%)
                                </h3>
                                {result.history.speditions.length > 0 ? (
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
                    )}
                </div>
            </div>
        </div>
    );
}
