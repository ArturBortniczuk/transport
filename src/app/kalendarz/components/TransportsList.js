import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { KIEROWCY } from '../constants';
import { useState, useEffect } from 'react';

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
            
            return (
              <div 
                key={transport.id} 
                className="border rounded-lg p-4 hover:shadow-md transition-all duration-200"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">
                      {transport.miasto} ({transport.kodPocztowy})
                    </h3>
                    {transport.ulica && (
                      <p className="text-gray-600">{transport.ulica}</p>
                    )}
                    <div className="text-sm text-gray-500 space-y-1">
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