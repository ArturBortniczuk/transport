'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MAGAZYNY } from '../kalendarz/constants'
import { getGoogleCoordinates } from '../services/geocoding-google'

// Dynamiczny import komponentu mapy Google (bez SSR)
const GoogleMapWithNoSSR = dynamic(
  () => import('../../components/GoogleMapWithNoSSR'),
  { ssr: false }
)

export default function MapaPage() {
  const [transporty, setTransporty] = useState([])
  const [spedycje, setSpedycje] = useState([])
  const [mappedTransporty, setMappedTransporty] = useState([])
  const [mappedSpedycje, setMappedSpedycje] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Stany dla filtrów
  const [showTransporty, setShowTransporty] = useState(true)
  const [showSpedycje, setShowSpedycje] = useState(true)
  const [selectedDay, setSelectedDay] = useState('all')
  const [selectedMagazyn, setSelectedMagazyn] = useState('all')
  const [hiddenItems, setHiddenItems] = useState([])

  // Pobierz transporty z API
  const fetchTransports = async () => {
    try {
      setIsLoading(true);
      // Spróbuj pobrać dane z API
      const response = await fetch('/api/transports')
      const data = await response.json()
      
      if (data.success) {
        // Przekształć dane w format odpowiedni dla komponentu mapy
        if (Array.isArray(data.transports)) {
          setTransporty(data.transports);
        } else {
          // Jeśli mamy obiekt z datami jako klucze
          const allTransports = [];
          Object.values(data.transports).forEach(transportsForDate => {
            if (Array.isArray(transportsForDate)) {
              allTransports.push(...transportsForDate);
            }
          });
          setTransporty(allTransports);
        }
      } else {
        setError(data.error || 'Błąd pobierania danych');
      }
    } catch (error) {
      console.error('Błąd pobierania transportów z API:', error)
      setError('Wystąpił problem podczas pobierania danych');
    }
  }
  
  // Pobierz spedycje z API
  const fetchSpedycje = async () => {
    try {
      // Pobierz dane z API
      const response = await fetch('/api/spedycje?status=new');
      const data = await response.json();
      
      if (data.success) {
        console.log('Pobrane dane spedycji:', data.spedycje);
        setSpedycje(data.spedycje);
      } else {
        console.error('Błąd pobierania spedycji:', data.error);
      }
    } catch (error) {
      console.error('Błąd pobierania spedycji z API:', error);
      // Nie ustawiamy błędu globalnego, aby nie blokować wyświetlenia transportów
    }
  }

  // Pobierz transporty i spedycje przy ładowaniu komponentu
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTransports(), fetchSpedycje()]);
      setIsLoading(false);
    };
    
    fetchData();
  }, []);

  // Przekształć transporty do formatu odpowiedniego dla mapy
  useEffect(() => {
    const processTransports = async () => {
      if (!transporty.length) {
        setMappedTransporty([]);
        return;
      }

      // Filtruj tylko aktywne transporty
      const activeTransports = transporty.filter(t => 
        t.status === 'aktywny' || t.status === 'active'
      );

      // Mapuj dane transportowe i dodaj współrzędne jeśli ich brakuje
      const processed = await Promise.all(activeTransports.map(async (transport) => {
        // Przygotuj punkt startowy
        let originPoint = {};
        if (transport.source_warehouse === 'bialystok' || 
            transport.zrodlo === 'bialystok' || 
            (transport.latitude && transport.latitude > 53)) {
          originPoint = {
            lat: MAGAZYNY.bialystok.lat,
            lng: MAGAZYNY.bialystok.lng,
            name: 'Magazyn Białystok'
          };
        } else {
          originPoint = {
            lat: MAGAZYNY.zielonka.lat,
            lng: MAGAZYNY.zielonka.lng,
            name: 'Magazyn Zielonka'
          };
        }
        
        // Przygotuj punkt docelowy
        let destinationPoint = {};
        
        // Sprawdź czy transport ma współrzędne
        if ((!transport.wspolrzedne || !transport.wspolrzedne.lat) && (!transport.latitude || !transport.longitude)) {
          // Jeśli nie ma, spróbuj je uzyskać używając Google Geocoding
          try {
            const city = transport.miasto || transport.destination_city;
            const postalCode = transport.kodPocztowy || transport.postal_code;
            const street = transport.ulica || transport.street;
            
            if (city && postalCode) {
              const coords = await getGoogleCoordinates(city, postalCode, street);
              destinationPoint = {
                ...coords,
                name: `${city}, ${postalCode}${street ? `, ${street}` : ''}`
              };
            } else {
              console.warn('Brak danych miasta lub kodu pocztowego:', transport);
              return null;
            }
          } catch (error) {
            console.error('Błąd geokodowania:', error);
            return null;
          }
        } else {
          // Jeśli ma współrzędne, użyj ich
          destinationPoint = {
            lat: transport.wspolrzedne?.lat || transport.latitude,
            lng: transport.wspolrzedne?.lng || transport.longitude,
            name: `${transport.miasto || transport.destination_city || 'Nieznane miejsce'}, ${transport.kodPocztowy || transport.postal_code || ''}${(transport.ulica || transport.street) ? `, ${transport.ulica || transport.street}` : ''}`
          };
        }
        
        // Ustal dzień dostawy
        let dayOfWeek = 'nieznany';
        if (transport.dataDostawy || transport.delivery_date) {
          const deliveryDate = new Date(transport.dataDostawy || transport.delivery_date);
          dayOfWeek = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'][deliveryDate.getDay()];
        }
        
        // Ustal źródłowy magazyn
        const zrodloId = transport.source_warehouse || transport.zrodlo || 
                         (destinationPoint.lat && destinationPoint.lat > 53 ? 'bialystok' : 'zielonka');
        
        return {
          ...transport,
          id: transport.id || `transport-${Math.random().toString(36).substr(2, 9)}`,
          origin: originPoint,
          destination: destinationPoint,
          dayOfWeek,
          typ: 'transport',
          zrodloId,
          displayName: `${transport.miasto || transport.destination_city || 'Nieznane miejsce'} - Transport`
        };
      }));

      setMappedTransporty(processed.filter(Boolean)); // Filtrujemy null
    };

    processTransports();
  }, [transporty]);
  
  // Przekształć spedycje do formatu odpowiedniego dla mapy
  useEffect(() => {
    const processSpedycje = async () => {
      if (!spedycje.length) {
        setMappedSpedycje([]);
        return;
      }

      // Mapuj dane spedycji
      const processed = await Promise.all(spedycje.map(async (spedycja) => {
        // Przygotuj punkt startowy
        let originPoint = {};
        if (spedycja.location === 'Producent' && spedycja.producerAddress) {
          // Jeśli punkt startowy to producent, potrzebujemy geokodować jego adres
          try {
            const producerCity = spedycja.producerAddress.city;
            const producerPostalCode = spedycja.producerAddress.postalCode;
            const producerStreet = spedycja.producerAddress.street || '';
            
            if (producerCity && producerPostalCode) {
              const coords = await getGoogleCoordinates(producerCity, producerPostalCode, producerStreet);
              originPoint = {
                ...coords,
                name: `${producerCity}, ${producerPostalCode}${producerStreet ? `, ${producerStreet}` : ''} (Producent)`
              };
            } else {
              console.warn('Brak danych producenta:', spedycja);
              return null; // Brak danych producenta
            }
          } catch (error) {
            console.error('Błąd geokodowania producenta:', error);
            return null;
          }
        } else if (spedycja.location === 'Magazyn Białystok') {
          originPoint = {
            lat: MAGAZYNY.bialystok.lat,
            lng: MAGAZYNY.bialystok.lng,
            name: 'Magazyn Białystok'
          };
        } else {
          // Domyślnie Magazyn Zielonka
          originPoint = {
            lat: MAGAZYNY.zielonka.lat,
            lng: MAGAZYNY.zielonka.lng,
            name: 'Magazyn Zielonka'
          };
        }
        
        // Przygotuj punkt docelowy
        let destinationPoint = {};
        if (spedycja.delivery && spedycja.delivery.city && spedycja.delivery.postalCode) {
          try {
            const deliveryCity = spedycja.delivery.city;
            const deliveryPostalCode = spedycja.delivery.postalCode;
            const deliveryStreet = spedycja.delivery.street || '';
            
            const coords = await getGoogleCoordinates(deliveryCity, deliveryPostalCode, deliveryStreet);
            destinationPoint = {
              ...coords,
              name: `${deliveryCity}, ${deliveryPostalCode}${deliveryStreet ? `, ${deliveryStreet}` : ''}`
            };
          } catch (error) {
            console.error('Błąd geokodowania dostawy:', error);
            return null;
          }
        } else {
          console.warn('Brak danych dostawy:', spedycja);
          return null; // Brak danych dostawy
        }
        
        // Przygotuj punkty dodatkowe (jeśli są)
        let additionalPoints = [];
        if (spedycja.additionalPlaces && Array.isArray(spedycja.additionalPlaces) && spedycja.additionalPlaces.length > 0) {
          // Przetworzymy to później gdy będziemy mieć dane dodatkowych miejsc
          // Na razie zostawiamy puste
        }
        
        // Ustal dzień dostawy
        let dayOfWeek = 'nieznany';
        if (spedycja.deliveryDate || spedycja.dataRozladunku) {
          const deliveryDate = new Date(spedycja.deliveryDate || spedycja.dataRozladunku);
          dayOfWeek = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'][deliveryDate.getDay()];
        }
        
        // Przygotuj identyfikator źródła
        let zrodloId = 'zielonka';
        if (spedycja.location === 'Magazyn Białystok') {
          zrodloId = 'bialystok';
        }
        
        return {
          ...spedycja,
          id: spedycja.id || `spedycja-${Math.random().toString(36).substr(2, 9)}`,
          origin: originPoint,
          destination: destinationPoint,
          additionalPoints: additionalPoints,
          dayOfWeek,
          typ: 'spedycja',
          zrodloId,
          displayName: `${destinationPoint.name} - Spedycja`
        };
      }));

      setMappedSpedycje(processed.filter(Boolean)); // Filtrujemy null
    };

    processSpedycje();
  }, [spedycje]);

  // Łączenie i filtrowanie danych
  const filteredData = [...(showTransporty ? mappedTransporty : []), ...(showSpedycje ? mappedSpedycje : [])]
    .filter(item => !hiddenItems.includes(item.id))
    .filter(item => selectedDay === 'all' || item.dayOfWeek === selectedDay)
    .filter(item => selectedMagazyn === 'all' || item.zrodloId === selectedMagazyn);

  // Funkcja przełączająca widoczność elementu
  const toggleItemVisibility = (id) => {
    setHiddenItems(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Ładowanie danych transportów...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mapa Transportów</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4">
          {/* Panel filtrów */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Filtry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtr typu transportu */}
              <div>
                <label className="block text-sm font-medium mb-2">Typ transportu</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={showTransporty}
                      onChange={() => setShowTransporty(!showTransporty)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Transport własny</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={showSpedycje}
                      onChange={() => setShowSpedycje(!showSpedycje)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Spedycja</span>
                  </label>
                </div>
              </div>
              
              {/* Filtr dnia tygodnia */}
              <div>
                <label className="block text-sm font-medium mb-2">Dzień tygodnia</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="all">Wszystkie dni</option>
                  <option value="poniedziałek">Poniedziałek</option>
                  <option value="wtorek">Wtorek</option>
                  <option value="środa">Środa</option>
                  <option value="czwartek">Czwartek</option>
                  <option value="piątek">Piątek</option>
                  <option value="sobota">Sobota</option>
                  <option value="niedziela">Niedziela</option>
                </select>
              </div>
              
              {/* Filtr magazynu */}
              <div>
                <label className="block text-sm font-medium mb-2">Magazyn</label>
                <select
                  value={selectedMagazyn}
                  onChange={(e) => setSelectedMagazyn(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="all">Wszystkie magazyny</option>
                  <option value="bialystok">Magazyn Białystok</option>
                  <option value="zielonka">Magazyn Zielonka</option>
                </select>
              </div>
              
              {/* Resetowanie filtrów */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setShowTransporty(true);
                    setShowSpedycje(true);
                    setSelectedDay('all');
                    setSelectedMagazyn('all');
                    setHiddenItems([]);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Resetuj filtry
                </button>
              </div>
            </div>
          </div>
          
          {/* Komponent mapy */}
          <GoogleMapWithNoSSR 
            transporty={filteredData} 
            magazyny={MAGAZYNY}
          />
        </div>

        <div className="border-t p-4">
          <h3 className="text-lg font-semibold mb-2">Legenda</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(MAGAZYNY).map(([key, magazyn]) => (
              <div key={key} className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: magazyn.kolor }}
                />
                <span>{magazyn.nazwa}</span>
              </div>
            ))}
            <div className="flex items-center">
              <div 
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: "#9061F9" }}
              />
              <span>Spedycja</span>
            </div>
          </div>
        </div>

        <div className="border-t">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Aktywne transporty ({filteredData.length})</h2>
            
            {filteredData.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                Brak aktywnych transportów spełniających kryteria filtrów
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredData.map((item) => (
                  <div 
                    key={item.id} 
                    className={`border rounded-lg p-4 ${
                      item.typ === 'spedycja' ? 'border-purple-200 bg-purple-50' : 'border-blue-200 bg-blue-50'
                    }`}
                    onClick={() => toggleItemVisibility(item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">
                          {item.displayName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {item.origin.name} → {item.destination.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Dzień: {item.dayOfWeek}
                        </p>
                        {item.distanceKm && (
                          <p className="text-sm text-gray-500">
                            Odległość: {item.distanceKm} km
                          </p>
                        )}
                      </div>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: item.typ === 'spedycja' 
                            ? '#9061F9' // Fioletowy dla spedycji
                            : MAGAZYNY[item.zrodloId]?.kolor || '#888888'
                        }}
                      />
                    </div>
                    <div className="mt-2 text-sm">
                      <span className={hiddenItems.includes(item.id) ? 'text-red-500' : 'text-green-600'}>
                        {hiddenItems.includes(item.id) ? 'Kliknij, aby pokazać na mapie' : 'Kliknij, aby ukryć na mapie'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
