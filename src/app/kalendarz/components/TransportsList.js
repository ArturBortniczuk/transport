import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { KIEROWCY, POJAZDY } from '../constants';
import { useState, useEffect } from 'react';
import { Link2, ArrowRight, ArrowLeft, CheckCircle, Link } from 'lucide-react';

export default function TransportsList({
  selectedDate,
  transporty,
  userRole,
  userEmail,
  userPermissions: propUserPermissions,
  canEditCalendar: propCanEditCalendar,
  canRescheduleCalendar: propCanRescheduleCalendar,
  canConnectRoutes: propCanConnectRoutes,
  canMarkAsCompleted: propCanMarkAsCompleted,
  onZakonczTransport,
  onEditTransport,
  onPrzeniesDoPrzenoszenia,
  onConnectTransport, // Nowy prop do obsługi łączenia transportów
  filtryAktywne = {}
}) {
  if (!selectedDate) return null;

  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const transportyNaDzien = transporty[dateKey] || [];
  
  // Filtrujemy według aktywnych filtrów, ale nie filtrujemy po statusie
  const filtrowaneTransporty = transportyNaDzien.filter(transport => {
    // Sprawdź czy transport jest zrealizowany
    const isCompleted = transport.status === 'completed' || transport.status === 'zakończony';
    
    // Jeśli transport jest zrealizowany i nie chcemy pokazywać zrealizowanych, odfiltrowujemy
    if (isCompleted && !filtryAktywne.pokazZrealizowane) {
      return false;
    }
    
    const pasujeMagazyn = !filtryAktywne.magazyn || transport.zrodlo === filtryAktywne.magazyn;
    const pasujeKierowca = !filtryAktywne.kierowca || parseInt(transport.kierowcaId) === filtryAktywne.kierowca;
    const pasujePojazd = !filtryAktywne.pojazd || 
                         parseInt(transport.pojazdId) === filtryAktywne.pojazd || 
                         (!transport.pojazdId && parseInt(transport.kierowcaId) === filtryAktywne.pojazd);
    const pasujeRynek = !filtryAktywne.rynek || transport.rynek === filtryAktywne.rynek;
    
    return pasujeMagazyn && pasujeKierowca && pasujePojazd && pasujeRynek;
  });
  
  const [userPermissions, setUserPermissions] = useState(propUserPermissions || {});
  const [isLoading, setIsLoading] = useState(false);
  
  // Pobierz uprawnienia z API jeśli brak propUserPermissions
  useEffect(() => {
    if (propUserPermissions && Object.keys(propUserPermissions).length > 0) {
      setUserPermissions(propUserPermissions);
      return;
    }
    async function fetchUserPermissions() {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.isAuthenticated && data.user) {
          setUserPermissions(data.user.permissions || {});
        }
      } catch (error) {
        console.error('Błąd pobierania uprawnień użytkownika:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserPermissions();
  }, [propUserPermissions]);

  const isAdmin = userRole === 'admin' || userEmail === 'a.bortniczuk@grupaeltron.pl';
  const canEdit = propCanEditCalendar !== undefined ? propCanEditCalendar : (isAdmin || userPermissions?.calendar?.edit === true);
  const canReschedule = propCanRescheduleCalendar !== undefined ? propCanRescheduleCalendar : (isAdmin || userPermissions?.calendar?.reschedule === true);
  const canConnect = propCanConnectRoutes !== undefined ? propCanConnectRoutes : (isAdmin || userPermissions?.calendar?.connect_routes === true);
  const canMarkAsCompleted = propCanMarkAsCompleted !== undefined ? propCanMarkAsCompleted : (isAdmin || userPermissions?.transport?.markAsCompleted === true);

  // Funkcja pomocnicza do sprawdzania, czy użytkownik może edytować ten transport
  const canEditTransport = (transport) => {
    return canEdit;
  };
  
  console.log('Uprawnienia w TransportsList:', {
    canEdit,
    canMarkAsCompleted,
    userPermissions
  });

  // Funkcja pomocnicza sprawdzająca czy transport jest połączony z innym
  const isConnectedTransport = (transport) => {
    // Transport może mieć swój własny connected_transport_id
    if (transport.connected_transport_id) return true;
    
    // Lub być źródłem dla innego transportu
    return transportyNaDzien.some(t => t.connected_transport_id === transport.id);
  };
  
  // Funkcja pomocnicza znajdująca połączony transport
  const findConnectedTransport = (transport) => {
    if (transport.connected_transport_id) {
      return transportyNaDzien.find(t => t.id === transport.connected_transport_id);
    }
    
    return transportyNaDzien.find(t => t.connected_transport_id === transport.id);
  };

  // Funkcja do rozłączania transportów
  const handleDisconnectTransport = async (transportId) => {
    if (!confirm('Czy na pewno chcesz rozłączyć ten transport od powiązanej trasy?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/transports/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transportId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Transport został pomyślnie rozłączony');
        // Tutaj możemy dodać callback do odświeżenia listy transportów
        window.location.reload(); // Prosta metoda odświeżenia, ale można zastąpić lepszym rozwiązaniem
      } else {
        alert('Błąd podczas rozłączania transportu: ' + (data.error || 'Nieznany błąd'));
      }
    } catch (error) {
      console.error('Błąd podczas rozłączania transportu:', error);
      alert('Wystąpił nieoczekiwany błąd podczas rozłączania transportu');
    }
  };
  
  // Funkcja pomocnicza do znajdowania danych kierowcy
  const getDriverInfo = (driverId) => {
    const driver = KIEROWCY.find(k => k.id === parseInt(driverId));
    return driver ? driver.imie : 'Brak danych';
  };
  
  // Ulepszona funkcja z kompatybilnością wsteczną
  const getVehicleInfo = (pojazdId, kierowcaId) => {
    // Najpierw sprawdzamy, czy mamy pojazdId
    if (pojazdId) {
      const pojazd = POJAZDY.find(p => p.id === parseInt(pojazdId));
      return pojazd ? pojazd.tabliceRej : 'Brak danych';
    }
    
    // Jeśli nie mamy pojazdId, ale mamy kierowcaId, użyjmy starego mapowania
    if (kierowcaId) {
      // W starym systemie id kierowcy odpowiadało id pojazdu
      const pojazd = POJAZDY.find(p => p.id === parseInt(kierowcaId));
      return pojazd ? pojazd.tabliceRej : 'Brak danych';
    }
    
    return 'Brak danych';
  };
  
  // Sprawdź, czy transport może być połączony (nie jest już połączony i jest aktywny)
  const canBeConnected = (transport) => {
    return !isConnectedTransport(transport) && transport.status === 'active' && canEdit;
  };

  if (isLoading) {
    return (
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
        <div className="text-center text-gray-500">
          Ładowanie uprawnień...
        </div>
      </div>
    );
  }

  if (filtrowaneTransporty.length === 0) {
    return (
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
        <div className="text-center text-gray-500">
          Brak transportów na ten dzień
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4">
        <h2 className="text-xl font-bold text-white">
          Transporty na {format(selectedDate, 'd MMMM yyyy', { locale: pl })}
        </h2>
      </div>

      <div className="p-6">     
        <div className="space-y-4">
          {filtrowaneTransporty.map(transport => {
            const kierowca = KIEROWCY.find(k => k.id === parseInt(transport.kierowcaId));
            
            // Sprawdź, czy transport jest połączony
            const isConnected = isConnectedTransport(transport);
            const isSource = transportyNaDzien.some(t => t.connected_transport_id === transport.id);
            const isTarget = transport.connected_transport_id !== null;
            
            // Sprawdź czy transport jest zrealizowany
            const isCompleted = transport.status === 'completed' || transport.status === 'zakończony';
            
            // Znajdź połączony transport, jeśli istnieje
            const connectedTransport = isConnected ? findConnectedTransport(transport) : null;
            
            return (
              <div 
                key={transport.id} 
                className={`
                  border rounded-lg p-4 hover:shadow-md transition-all duration-200
                  ${isConnected ? 'border-l-4 border-blue-500' : ''}
                  ${isCompleted ? 'opacity-50 bg-gray-50' : ''}
                `}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg flex items-center">
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      ) : isConnected && (
                        <Link2 className="h-4 w-4 mr-2 text-blue-600" />
                      )}
                      {transport.miasto} ({transport.kodPocztowy})
                      
                      {isConnected && !isCompleted && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {isSource ? 'Źródło trasy' : 'Cel trasy'}
                        </span>
                      )}
                      
                      {isCompleted && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                          Zrealizowany
                        </span>
                      )}
                    </h3>
                    
                    {transport.ulica && (
                      <p className="text-gray-600">{transport.ulica}</p>
                    )}
                    
                    {/* Wyświetlanie informacji o połączonej trasie */}
                    {isConnected && connectedTransport && !isCompleted && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-800 mb-2">
                          Transport połączony z:
                        </p>
                        <div className="flex items-center">
                          {isTarget ? (
                            <>
                              <div className="flex items-center">
                                <ArrowLeft className="h-4 w-4 text-blue-600 mr-2" />
                                <div>
                                  <div className="font-medium">{connectedTransport.miasto}</div>
                                  <div className="text-xs text-gray-600">{connectedTransport.kodPocztowy}</div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center">
                                <div>
                                  <div className="font-medium">{connectedTransport.miasto}</div>
                                  <div className="text-xs text-gray-600">{connectedTransport.kodPocztowy}</div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-blue-600 mx-2" />
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Przycisk do rozłączania transportów */}
                        {canConnect && (
                          <button
                            onClick={() => handleDisconnectTransport(transport.id)}
                            className="mt-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Rozłącz transporty
                          </button>
                        )}
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-500 space-y-1 mt-3">
                      <p><strong>Klient:</strong> {transport.nazwaKlienta}</p>
                      
                      {transport.osobaZlecajaca && (
                        <p><strong>Osoba zlecająca:</strong> {transport.osobaZlecajaca}</p>
                      )}
                      
                      {transport.mpk && (
                        <p><strong>MPK:</strong> {transport.mpk}</p>
                      )}
                      
                      <p><strong>Kierowca:</strong> {getDriverInfo(transport.kierowcaId)}</p>
                      <p><strong>Pojazd:</strong> {getVehicleInfo(transport.pojazdId, transport.kierowcaId)}</p>
                      <p><strong>Magazyn:</strong> {transport.zrodlo}</p>
                      <p><strong>Odległość:</strong> {transport.odleglosc} km</p>
                      <p><strong>Poziom załadunku:</strong> {transport.poziomZaladunku}</p>
                      <div className="mt-2">
                        <strong>WZ:</strong>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {transport.numerWZ && transport.numerWZ.split(',').map((wz, index) => (
                            <span 
                              key={index}
                              className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded border border-blue-200 text-xs font-medium"
                            >
                              {wz.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                      {transport.rynek && (
                        <p><strong>Rynek:</strong> {transport.rynek}</p>
                      )}
                    </div>
                  </div>

                  {/* Przyciski akcji tylko dla aktywnych transportów */}
                  {!isCompleted && (
                    <div className="flex flex-col space-y-2">
                      {canMarkAsCompleted && (
                        <button
                          onClick={() => {
                            console.log('Kliknięto Zrealizuj dla transportu ID:', transport.id);
                            onZakonczTransport(dateKey, transport.id);
                          }}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Zrealizuj
                        </button>
                      )}
                      
                      {canEditTransport(transport) && (
                        <button
                          onClick={() => onEditTransport(transport)}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Edytuj
                        </button>
                      )}
                      {canReschedule && (
                        <button
                          onClick={() => onPrzeniesDoPrzenoszenia(transport)}
                          className="px-4 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                        >
                          Przenieś
                        </button>
                      )}
                      {/* Nowy przycisk do łączenia transportów */}
                      {canConnect && canBeConnected(transport) && onConnectTransport && (
                        <button
                          onClick={() => onConnectTransport(transport)}
                          className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                        >
                          Połącz
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

