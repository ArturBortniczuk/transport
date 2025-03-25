'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MAGAZYNY } from '../kalendarz/constants'
import { getCoordinates } from '../services/geocoding'

// Dynamiczny import komponentu mapy aby uniknąć problemów z SSR
const SimpleMapComponent = dynamic(
  () => import('../../components/SimpleMapComponent'),
  {
    loading: () => (
      <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Ładowanie mapy...</div>
      </div>
    ),
    ssr: false  // To jest kluczowe - wyłączamy SSR dla komponentu mapy
  }
)

export default function MapaPage() {
  const [transporty, setTransporty] = useState([])
  const [mappedTransporty, setMappedTransporty] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

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
    } finally {
      setIsLoading(false);
    }
  }

  // Pobierz transporty przy ładowaniu komponentu
  useEffect(() => {
    fetchTransports();
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
        // Sprawdź czy transport ma współrzędne
        if (
          (!transport.wspolrzedne || !transport.wspolrzedne.lat) && 
          (!transport.latitude || !transport.longitude)
        ) {
          // Jeśli nie ma, spróbuj je uzyskać
          try {
            const city = transport.miasto || transport.destination_city;
            const postalCode = transport.kodPocztowy || transport.postal_code;
            const street = transport.ulica || transport.street;
            
            if (city && postalCode) {
              const coords = await getCoordinates(city, postalCode, street);
              return {
                ...transport,
                wspolrzedne: coords
              };
            }
          } catch (error) {
            console.error('Błąd geokodowania:', error);
          }
        }
        
        // Jeśli ma współrzędne w innym formacie, przekształć je
        if (!transport.wspolrzedne && transport.latitude && transport.longitude) {
          return {
            ...transport,
            wspolrzedne: {
              lat: transport.latitude,
              lng: transport.longitude
            }
          };
        }
        
        return transport;
      }));

      setMappedTransporty(processed);
    };

    processTransports();
  }, [transporty]);

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
          <SimpleMapComponent transporty={mappedTransporty} magazyny={MAGAZYNY} />
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
          </div>
        </div>

        <div className="border-t">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Aktywne transporty</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mappedTransporty.length > 0 ? (
                mappedTransporty.map((transport, index) => (
                  <div key={transport.id || index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">
                          {transport.miasto || transport.destination_city || 'Brak miasta'} 
                          {(transport.kodPocztowy || transport.postal_code) && 
                            ` (${transport.kodPocztowy || transport.postal_code})`}
                          {(transport.ulica || transport.street) && 
                            ` - ${transport.ulica || transport.street}`}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {transport.informacje || transport.notes || ''}
                        </p>
                      </div>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: MAGAZYNY[transport.zrodlo || transport.source_warehouse]?.kolor || '#888888'
                        }}
                      />
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Dostawa: {new Date(transport.dataDostawy || transport.delivery_date).toLocaleDateString('pl')}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-500 py-4">
                  Brak aktywnych transportów
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}