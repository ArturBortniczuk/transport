'use client'
import { useState, useEffect } from 'react'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { getGoogleCoordinates } from '../services/geocoding-google'
import { calculateDistance } from '../services/calculateDistance'
import CalendarGrid from './components/CalendarGrid'
import SimpleCalendarGrid from './components/SimpleCalendarGrid'
import TransportForm from './components/TransportForm'
import FilterPanel from './components/FilterPanel'
import TransportsList from './components/TransportsList'
import { MAGAZYNY } from './constants'

export default function KalendarzPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [transporty, setTransporty] = useState({})
  const [userRole, setUserRole] = useState(null)
  const [edytowanyTransport, setEdytowanyTransport] = useState(null)
  const [przenoszonyTransport, setPrzenoszonyTransport] = useState(null)
  const [nowaData, setNowaData] = useState('')
  const [userPermissions, setUserPermissions] = useState({})
  const [userMpk, setUserMpk] = useState('')
  const [nowyTransport, setNowyTransport] = useState({
    miasto: '',
    kodPocztowy: '',
    ulica: '',
    informacje: '',
    status: 'aktywny',
    kierowcaId: '',
    numerWZ: '',
    nazwaKlienta: '',
    osobaZlecajaca: '',
    emailZlecajacego: '',
    mpk: '',
    rynek: '',
    poziomZaladunku: '',
    dokumenty: '',
    trasaCykliczna: false,
    magazyn: 'bialystok'
  })
  const [filtryAktywne, setFiltryAktywne] = useState({
    magazyn: '',
    kierowca: '',
    rynek: '',
    pokazZrealizowane: true // Domyślnie pokazuj zrealizowane transporty
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  const [zamowienia, setZamowienia] = useState([])
  
  // Stany dla modalnego potwierdzenia
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    transport: null,
    newDate: null
  });

  // Znajdź funkcję fetchTransports i zmodyfikuj ją:
  const fetchTransports = async () => {
    try {
      setIsLoading(true);
      // Kluczowa zmiana - usunięcie parametru status=active lub zmiana na all
      const response = await fetch('/api/transports?status=all', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Problem z API: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log(`Pobrano ${data.transports?.length || 0} transportów`);
    
      if (data.success) {
        // Przekształć listę transportów na format obiektu z datami jako kluczami
        const transportsByDate = data.transports.reduce((acc, transport) => {
          // Pobieramy wszystkie transporty, nie tylko aktywne
          const dateKey = format(new Date(transport.delivery_date), 'yyyy-MM-dd')
          if (!acc[dateKey]) {
            acc[dateKey] = []
          }
          acc[dateKey].push({
            id: transport.id,
            miasto: transport.destination_city,
            kodPocztowy: transport.postal_code,
            ulica: transport.street,
            zrodlo: transport.source_warehouse,
            dataDostawy: transport.delivery_date,
            kierowcaId: transport.driver_id,
            status: transport.status,
            numerWZ: transport.wz_number,
            nazwaKlienta: transport.client_name,
            osobaZlecajaca: transport.requester_name,
            mpk: transport.mpk,
            emailZlecajacego: transport.requester_email,
            rynek: transport.market,
            poziomZaladunku: transport.loading_level,
            wspolrzedne: {
              lat: transport.latitude,
              lng: transport.longitude
            },
            odleglosc: transport.distance
          })
          return acc
        }, {})
        
        console.log('Transporty po przetworzeniu:', transportsByDate);
        setTransporty(transportsByDate);
      } else {
        setError('Nie udało się pobrać transportów');
      }
    } catch (error) {
      console.error('Błąd pobierania transportów:', error);
      setError('Wystąpił błąd podczas pobierania danych: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const role = localStorage.getItem('userRole')
    const id = localStorage.getItem('userId')
    const mpk = localStorage.getItem('userMpk')
    console.log('Ustawiam rolę, ID i MPK:', { role, id, mpk })
    setUserRole(role)
    setUserId(id)
    setUserMpk(mpk)
    
    // Ładowanie uprawnień
    try {
      const permissionsStr = localStorage.getItem('userPermissions')
      if (permissionsStr) {
        const permissions = JSON.parse(permissionsStr)
        console.log('Załadowane uprawnienia:', permissions) // Dodaj log
        setUserPermissions(permissions)
      } else {
        console.log('Brak uprawnień w localStorage')
        // Ustaw domyślne uprawnienia
        setUserPermissions({
          calendar: { edit: role === 'magazyn' },
          transport: { markAsCompleted: role === 'magazyn' }
        })
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e)
      // Ustaw domyślne uprawnienia w przypadku błędu
      setUserPermissions({
        calendar: { edit: role === 'magazyn' },
        transport: { markAsCompleted: role === 'magazyn' }
      })
    }
    
    const savedZamowienia = localStorage.getItem('zamowieniaSpedycja')
    if (savedZamowienia) {
      setZamowienia(JSON.parse(savedZamowienia))
    }
    
    // Wywołaj funkcję przy montowaniu komponentu
    fetchTransports()

    //const refreshInterval = setInterval(() => {
      //const scrollPosition = window.scrollY; // Zapisz pozycję przewijania
      //fetchTransports().then(() => {
        // Przywróć pozycję przewijania po zakończeniu pobierania
        //window.scrollTo(0, scrollPosition);
      //});
    //}, 60000);
    
    // Wyczyść interwał przy odmontowaniu komponentu
    //return () => clearInterval(refreshInterval);
  }, [])

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNowyTransport(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    console.log('Dane transportu wysyłane do API:', {
      miasto: nowyTransport.miasto,
      osobaZlecajaca: nowyTransport.osobaZlecajaca,
      mpk: nowyTransport.mpk
    });

    try {
      // Wybór magazynu
      const wybranyMagazyn = nowyTransport.magazyn || 'bialystok' // Domyślnie Białystok
      
      if (!MAGAZYNY[wybranyMagazyn]) {
        alert('Błąd: Wybierz prawidłowy magazyn')
        return
      }
    
      // Pozyskaj współrzędne miejsca docelowego za pomocą Google Geocoding API
      const coordinates = await getGoogleCoordinates(
        nowyTransport.miasto,
        nowyTransport.kodPocztowy,
        nowyTransport.ulica
      )
    
      // Oblicz odległość za pomocą Google Distance Matrix API
      const odleglosc = await calculateDistance(
        MAGAZYNY[wybranyMagazyn].lat,
        MAGAZYNY[wybranyMagazyn].lng,
        coordinates.lat,
        coordinates.lng
      )
    
      const response = await fetch('/api/transports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destination_city: nowyTransport.miasto,
          postal_code: nowyTransport.kodPocztowy,
          street: nowyTransport.ulica,
          source_warehouse: wybranyMagazyn,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          distance: odleglosc,
          driver_id: nowyTransport.kierowcaId,
          wz_number: nowyTransport.numerWZ,
          client_name: nowyTransport.nazwaKlienta,
          requester_name: nowyTransport.osobaZlecajaca, // Dodaje osobę odpowiedzialną
          requester_email: nowyTransport.emailZlecajacego,
          mpk: nowyTransport.mpk,
          market: nowyTransport.rynek,
          loading_level: nowyTransport.poziomZaladunku,
          notes: nowyTransport.informacje,
          is_cyclical: nowyTransport.trasaCykliczna ? 1 : 0,
          delivery_date: format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss"),
          status: 'active'
        })
      });
      
      const data = await response.json();
  
      if (data.success) {
        await fetchTransports()
        setNowyTransport({
          miasto: '',
          kodPocztowy: '',
          ulica: '',
          informacje: '',
          status: 'aktywny',
          kierowcaId: '',
          numerWZ: '',
          nazwaKlienta: '',
          rynek: '',
          poziomZaladunku: '',
          dokumenty: '',
          trasaCykliczna: false,
          magazyn: 'bialystok'
        })
        alert('Transport został dodany!')
      } else {
        throw new Error(data.error || 'Nie udało się dodać transportu')
      }
    } catch (error) {
      console.error('Błąd podczas dodawania transportu:', error)
      alert('Wystąpił błąd podczas dodawania transportu: ' + error.message)
    }
  }

  const handleZakonczTransport = async (dateKey, transportId) => {
    try {
      // Dodaj potwierdzenie przed oznaczenem jako zrealizowane
      if (!confirm('Czy na pewno chcesz oznaczyć ten transport jako zrealizowany? Transport zostanie zarchiwizowany.')) {
        return;
      }
      
      console.log('Rozpoczęcie procesu oznaczania transportu jako zakończony:', {
        dateKey, 
        transportId
      });
      
      // Oznacz transport jako zakończony w bazie danych
      const response = await fetch(`/api/transports`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          id: transportId,
          status: 'completed', // Zmień status na 'completed'
          completed_at: new Date().toISOString() // Ustaw datę zakończenia
        })
      });
  
      const data = await response.json();
      console.log('Odpowiedź z API po oznaczeniu transportu jako zakończony:', data);
  
      if (data.success) {
        // Zamiast usuwać transport z lokalnego stanu, aktualizujemy jego status
        setTransporty(prevTransporty => {
          const updatedTransporty = { ...prevTransporty };
          
          if (updatedTransporty[dateKey]) {
            updatedTransporty[dateKey] = updatedTransporty[dateKey].map(t => {
              if (t.id === transportId) {
                return { ...t, status: 'completed', completed_at: new Date().toISOString() };
              }
              return t;
            });
          }
          
          return updatedTransporty;
        });
        
        // Odśwież dane transportów aby upewnić się, że stan jest aktualny
        setTimeout(() => fetchTransports(), 500);
        
        alert('Transport został pomyślnie zrealizowany i zarchiwizowany!');
      } else {
        throw new Error(data.error || 'Nie udało się zakończyć transportu');
      }
    } catch (error) {
      console.error('Error completing transport:', error);
      alert('Wystąpił błąd podczas kończenia transportu: ' + error.message);
    }
  }
  
  const handleEditTransport = (transport) => {
    setEdytowanyTransport(transport)
    setNowyTransport({
      ...transport,
      trasaCykliczna: false
    })
  }
  const handleUpdateTransport = async (e) => {
    e.preventDefault()
    
    try {
      // Pozyskaj współrzędne miejsca docelowego za pomocą Google Geocoding API
      const coordinates = await getGoogleCoordinates(
        nowyTransport.miasto,
        nowyTransport.kodPocztowy,
        nowyTransport.ulica
      )
  
      // Oblicz odległość za pomocą Google Distance Matrix API
      const wybranyMagazyn = nowyTransport.zrodlo || 'bialystok'
      const odleglosc = await calculateDistance(
        MAGAZYNY[wybranyMagazyn].lat,
        MAGAZYNY[wybranyMagazyn].lng,
        coordinates.lat,
        coordinates.lng
      )
  
      const response = await fetch(`/api/transports`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: edytowanyTransport.id,
          destination_city: nowyTransport.miasto,
          postal_code: nowyTransport.kodPocztowy,
          street: nowyTransport.ulica,
          driver_id: nowyTransport.kierowcaId,
          wz_number: nowyTransport.numerWZ,
          client_name: nowyTransport.nazwaKlienta,
          market: nowyTransport.rynek,
          loading_level: nowyTransport.poziomZaladunku,
          notes: nowyTransport.informacje,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          distance: odleglosc,
          delivery_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss") : edytowanyTransport.delivery_date
        })
      })
  
      const data = await response.json()
  
      if (data.success) {
        // Automatycznie zapisz lokalizację
        saveLocationToStorage(nowyTransport);
        
        await fetchTransports()
        setEdytowanyTransport(null)
        setNowyTransport({
          miasto: '',
          kodPocztowy: '',
          ulica: '',
          informacje: '',
          dataDostawy: '',
          status: 'aktywny',
          kierowcaId: '',
          numerWZ: '',
          nazwaKlienta: '',
          rynek: '',
          poziomZaladunku: '',
          dokumenty: '',
          trasaCykliczna: false
        })
        alert('Transport został zaktualizowany!')
      } else {
        throw new Error(data.error || 'Nie udało się zaktualizować transportu')
      }
    } catch (error) {
      console.error('Błąd podczas aktualizacji transportu:', error)
      alert('Wystąpił błąd podczas aktualizacji transportu: ' + error.message)
    }
  }

  const handlePrzeniesDoPrzenoszenia = (transport) => {
    setPrzenoszonyTransport(transport)
  }

  const handlePrzenoszenieTransportu = async (options) => {
    if (!options) return;
    
    const { id, newDate } = options;
    
    try {
      const response = await fetch(`/api/transports`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          delivery_date: `${newDate}T00:00:00`
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchTransports()
        setPrzenoszonyTransport(null)
        setNowaData('')
        alert('Transport został przeniesiony!')
      } else {
        throw new Error(data.error || 'Nie udało się przenieść transportu')
      }
    } catch (error) {
      console.error('Błąd podczas przenoszenia transportu:', error)
      alert('Wystąpił błąd podczas przenoszenia transportu')
    }
  }

  // Nowa funkcja do obsługi przenoszenia transportu przez drag & drop
  const handleTransportMove = (transport, newDateKey) => {
    setConfirmModal({
      isOpen: true,
      transport,
      newDate: newDateKey
    });
  }

  // Funkcja do potwierdzenia przeniesienia transportu
  const handleConfirmMove = () => {
    const { transport, newDate } = confirmModal;
    handlePrzenoszenieTransportu({
      id: transport.id,
      newDate: newDate
    });
    setConfirmModal({ isOpen: false, transport: null, newDate: null });
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });
  
  useEffect(() => {
    const fetchUserPermissions = async () => {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.isAuthenticated && data.user) {
          setUserPermissions(data.user.permissions || {});
        }
      } catch (error) {
        console.error('Błąd pobierania uprawnień użytkownika:', error);
      }
    };
    
    fetchUserPermissions();
  }, []);
  
  // Funkcja sprawdzająca, czy użytkownik może dodawać transporty
  const canAddTransport = () => {
    console.log('Sprawdzam uprawnienia:', {
      calendarEdit: userPermissions?.calendar?.edit, 
      userRole, 
      userId
    });
    
    return userPermissions?.calendar?.edit === true && 
      userRole === 'magazyn' && 
      (userId === 'bialystok' || userId === 'zielonka');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Ładowanie...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Kalendarz Transportów - {format(currentMonth, 'LLLL yyyy', { locale: pl })}
        </h1>
        <div className="flex gap-4">
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Poprzedni miesiąc
          </button>
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Następny miesiąc
          </button>
          <a 
            href="/archiwum" 
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
          >
            Archiwum transportów
          </a>
        </div>
      </div>

      <FilterPanel 
        filtryAktywne={filtryAktywne} 
        setFiltryAktywne={setFiltryAktywne}
      />

      <SimpleCalendarGrid 
        daysInMonth={daysInMonth}
        onDateSelect={handleDateClick}
        currentMonth={currentMonth}
        transporty={transporty}
        onTransportMove={handleTransportMove}
        filtryAktywne={filtryAktywne} // Dodaj tę linię
      />
      <TransportsList
        selectedDate={selectedDate}
        transporty={transporty}
        userRole={userRole}
        onZakonczTransport={handleZakonczTransport}
        onEditTransport={handleEditTransport}
        onPrzeniesDoPrzenoszenia={handlePrzeniesDoPrzenoszenia}
        filtryAktywne={filtryAktywne} // dodaj tę linię, jeśli jej nie ma
      />

      {selectedDate && (
        <>
          <div>
            <div className="space-y-2">
              {transporty[format(selectedDate, 'yyyy-MM-dd')]?.filter(t => {
                const pasujeMagazyn = !filtryAktywne.magazyn || t.zrodlo === filtryAktywne.magazyn;
                const pasujeKierowca = !filtryAktywne.kierowca || t.kierowcaId === filtryAktywne.kierowca;
                const pasujeRynek = !filtryAktywne.rynek || t.rynek === filtryAktywne.rynek;
                return pasujeMagazyn && pasujeKierowca && pasujeRynek && t.status === 'aktywny';
              }).map(t => (
                <div key={t.id} className="border p-2 rounded">
                  {t.miasto} - {t.kodPocztowy}
                </div>
              ))}
            </div>
          </div>
          
          <TransportForm
            selectedDate={selectedDate}
            nowyTransport={nowyTransport}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            edytowanyTransport={edytowanyTransport}
            handleUpdateTransport={handleUpdateTransport}
            setEdytowanyTransport={setEdytowanyTransport}
            setNowyTransport={setNowyTransport}
            userPermissions={userPermissions}
            transporty={transporty}
          />
        </>
      )}
      {przenoszonyTransport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Przenieś transport
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 mb-4">
                  Wybierz nową datę dla transportu do {przenoszonyTransport.miasto}
                </p>
                <input
                  type="datetime-local"
                  value={nowaData}
                  onChange={(e) => setNowaData(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-center gap-4 px-4 py-3">
                <button
                  onClick={() => handlePrzenoszenieTransportu({
                    id: przenoszonyTransport.id,
                    newDate: nowaData
                  })}
                  className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Przenieś
                </button>
                <button
                  onClick={() => {
                    setPrzenoszonyTransport(null)
                    setNowaData('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia przeniesienia transportu */}
      {confirmModal.isOpen && confirmModal.transport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Przenieś transport</h3>
            <p className="text-sm text-gray-500 mb-4">
              Czy na pewno chcesz przenieść transport do {confirmModal.transport.miasto} na dzień {format(new Date(confirmModal.newDate), 'd MMMM yyyy', { locale: pl })}?
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, transport: null, newDate: null })}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirmMove}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Przenieś
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
