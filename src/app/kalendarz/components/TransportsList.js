import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { KIEROWCY } from '../constants';
import { useState, useEffect } from 'react';
import { Link2, ArrowRight, ArrowLeft } from 'lucide-react';

export default function TransportsList({
  selectedDate,
  transporty,
  userRole,
  onZakonczTransport,
  onEditTransport,
  onPrzeniesDoPrzenoszenia,
  filtryAktywne = {} // Domyślna wartość, jeśli nie przekazano filtrów
}) {
  if (!selectedDate) return null;

  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const transportyNaDzien = transporty[dateKey] || [];
  
  // Najpierw filtrujemy transporty aktywne
  const aktywneTransporty = transportyNaDzien.filter(t => 
    t.status === 'aktywny' || t.status === 'active'
  );
  
  // Następnie filtrujemy według aktywnych filtrów
  const filtrowaneTransporty = aktywneTransporty.filter(transport => {
    const pasujeMagazyn = !filtryAktywne.magazyn || transport.zrodlo === filtryAktywne.magazyn;
    const pasujeKierowca = !filtryAktywne.kierowca || transport.kierowcaId === filtryAktywne.kierowca;
    const pasujeRynek = !filtryAktywne.rynek || transport.rynek === filtryAktywne.rynek;
    
    return pasujeMagazyn && pasujeKierowca && pasujeRynek;
  });
  
  const [userPermissions, setUserPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Pobierz uprawnienia z API zamiast localStorage
  useEffect(() => {
    async function fetchUserPermissions() {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        console.log('Dane użytkownika z API:', data);
        if (data.isAuthenticated && data.user) {
          setUserPermissions(data.user.permissions || {});
          console.log('Pobrane uprawnienia:', data.user.permissions);
        }
      } catch (error) {
        console.error('Błąd pobierania uprawnień użytkownika:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserPermissions();
  }, []);

  const canEdit = userPermissions?.calendar?.edit === true;
  const canMarkAsCompleted = userPermissions?.transport?.markAsCompleted === true;
  
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
            
            // Znajdź połączony transport, jeśli istnieje
            const connectedTransport = isConnected ? findConnectedTransport(transport) : null;
            
            return (
              <div 
                key={transport.id} 
                className={`
                  border rounded-lg p-4 hover:shadow-md transition-all duration-200
                  ${isConnected ? 'border-l-4 border-blue-500' : ''}
                `}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg flex items-center">
                      {isConnected && (
                        <Link2 className="h-4 w-4 mr-2 text-blue-600" />
                      )}
                      {transport.miasto} ({transport.kodPocztowy})
                      
                      {isConnected && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {isSource ? 'Źródło trasy' : 'Cel trasy'}
                        </span>
                      )}
                    </h3>
                    
                    {transport.ulica && (
                      <p className="text-gray-600">{transport.ulica}</p>
                    )}
                    
                    {/* Wyświetlanie informacji o połączonej trasie */}
                    {isConnected && connectedTransport && (
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
                        {canEdit && (
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
                      
                      <p><strong>Kierowca:</strong> {kierowca?.imie} ({kierowca?.tabliceRej})</p>
                      <p><strong>Magazyn:</strong> {transport.zrodlo}</p>
                      <p><strong>Odległość:</strong> {transport.odleglosc} km</p>
                      <p><strong>Poziom załadunku:</strong> {transport.poziomZaladunku}</p>
                      <p><strong>WZ:</strong> {transport.numerWZ}</p>
                      {transport.rynek && (
                        <p><strong>Rynek:</strong> {transport.rynek}</p>
                      )}
                    </div>
                  </div>

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
                    
                    {canEdit && userRole === transport.zrodlo && (
                      <>
                        <button
                          onClick={() => onEditTransport(transport)}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => onPrzeniesDoPrzenoszenia(transport)}
                          className="px-4 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                        >
                          Przenieś
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
