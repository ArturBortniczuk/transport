'use client'
import { useState, useEffect } from 'react'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { DragDropContext } from '@hello-pangea/dnd'
import { getGoogleCoordinates } from '../services/geocoding-google'
import { calculateDistance } from '../services/calculateDistance'
import CalendarGrid from './components/CalendarGrid'
import SimpleCalendarGrid from './components/SimpleCalendarGrid'
import TransportForm from './components/TransportForm'
import FilterPanel from './components/FilterPanel'
import TransportsList from './components/TransportsList'
import PackagingsList from './components/PackagingsList'
import { wyslijPowiadomienieOdbioruBebnow } from '@/utils/smsNotifications'
import { MAGAZYNY } from './constants'
import { KIEROWCY } from './constants'

// Komponent do naprawy kilometrów
function FixDistances() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);

  const runFix = async (dryRun = false) => {
    if (isRunning) return;
    
    if (!dryRun && !confirm('Czy na pewno chcesz przeliczyć kilometry? To zaktualizuje bazę danych.')) {
      return;
    }
    
    setIsRunning(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/transports/fix-distances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        alert(dryRun ? 'Test zakończony' : 'Kilometry zostały przeliczone!');
      } else {
        alert('Błąd: ' + data.error);
      }
    } catch (error) {
      alert('Wystąpił błąd: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow border mt-8">
      <h3 className="text-lg font-semibold mb-4">Naprawa kilometrów transportów</h3>
      
      <p className="text-gray-600 mb-4">
        Przelicz kilometry dla wszystkich transportów - każdy transport będzie miał 
        odległość liczoną od swojego magazynu do miejsca docelowego.
      </p>
      
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => runFix(true)}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isRunning ? 'Przetwarzanie...' : 'Test (bez zapisu)'}
        </button>
        
        <button
          onClick={() => runFix(false)}
          disabled={isRunning}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          {isRunning ? 'Przetwarzanie...' : 'Wykonaj naprawę'}
        </button>
      </div>

      {results && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Wyniki:</h4>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{results.total}</div>
              <div className="text-sm text-gray-500">Łącznie</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{results.updated}</div>
              <div className="text-sm text-gray-500">Zaktualizowane</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{results.skipped}</div>
              <div className="text-sm text-gray-500">Pominięte</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{results.errors}</div>
              <div className="text-sm text-gray-500">Błędy</div>
            </div>
          </div>
          
          {results.changes.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-medium">Zobacz szczegóły zmian</summary>
              <div className="mt-2 max-h-60 overflow-y-auto">
                {results.changes.slice(0, 20).map((change, i) => (
                  <div key={i} className="text-sm py-1 border-b">
                    <strong>ID {change.id}</strong> ({change.city}): 
                    {change.oldDistance}km → <span className="text-green-600">{change.newDistance}km</span>
                    {change.difference !== 0 && (
                      <span className={change.difference > 0 ? 'text-red-500' : 'text-green-500'}>
                        {' '}({change.difference > 0 ? '+' : ''}{change.difference}km)
                      </span>
                    )}
                  </div>
                ))}
                {results.changes.length > 20 && (
                  <div className="text-sm text-gray-500 py-2">
                    ... i {results.changes.length - 20} więcej
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}


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
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [connectingTransport, setConnectingTransport] = useState(null)
  const [showConnectModal, setShowConnectModal] = useState(false)
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
    magazyn: 'bialystok',
    packagingId: null
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
  const [defaultMagazyn, setDefaultMagazyn] = useState('bialystok')
  
  // Stany dla modalnego potwierdzenia
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    transport: null,
    newDate: null
  });

  // Główna funkcja obsługująca przeciąganie dla całej aplikacji
  const handleMainDragEnd = (result) => {
    console.log('Main DragEnd Result:', result);
    
    // Jeśli upuszczono poza celem lub brak miejsca docelowego
    if (!result.destination) {
      return;
    }
    
    const { source, destination, draggableId } = result;
    
    // Jeśli przeciągnięto opakowanie na datę w kalendarzu
    if (source.droppableId === 'packagings-list' && 
        destination.droppableId.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log('Przeciągnięto opakowanie na datę:', destination.droppableId);
      
      // Znajdź opakowanie po ID
      fetch('/api/packagings?status=pending')
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const packaging = (data.packagings || []).find(p => p.id.toString() === draggableId);
            if (packaging) {
              handlePackagingDrop(packaging, destination.droppableId);
            } else {
              console.error('Nie znaleziono opakowania o ID:', draggableId);
            }
          } else {
            console.error('Błąd pobierania opakowań:', data.error);
          }
        })
        .catch(error => console.error('Błąd pobierania opakowania:', error));
    } 
    // Jeśli przeciągnięto transport między datami w kalendarzu
    else if (destination.droppableId.match(/^\d{4}-\d{2}-\d{2}$/) && 
             source.droppableId.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log('Przeciągnięto transport między datami:', source.droppableId, '->', destination.droppableId);
      
      // Pobierz transport
      const sourceDate = source.droppableId;
      const sourceTransports = transporty[sourceDate] || [];
      const transport = sourceTransports.find(t => t.id.toString() === draggableId);
      
      if (transport) {
        // Sprawdź, czy transport jest częścią połączonej trasy
        const isConnected = sourceTransports.some(t => 
          t.connected_transport_id === transport.id || 
          transport.connected_transport_id === t.id
        );
        
        if (isConnected) {
          // Jeśli to połączony transport, najpierw zapytaj użytkownika, czy chce przenieść wszystkie
          if (confirm("Ten transport jest częścią połączonej trasy. Czy chcesz przenieść wszystkie połączone transporty?")) {
            // Znajdź wszystkie powiązane transporty
            const connectedTransport = sourceTransports.find(t => 
              t.connected_transport_id === transport.id || 
              transport.connected_transport_id === t.id
            );
            
            if (connectedTransport) {
              // Przenieś główny transport
              handleTransportMove(transport, destination.droppableId);
              
              // Przenieś połączony transport
              setTimeout(() => {
                handleTransportMove(connectedTransport, destination.droppableId);
              }, 100);
            } else {
              // Jeśli nie znaleziono połączonego transportu, przenieś tylko ten
              handleTransportMove(transport, destination.droppableId);
            }
          } else if (confirm("Czy chcesz rozłączyć transport przed przeniesieniem?")) {
            // Rozłącz transport i przenieś tylko ten
            fetch('/api/transports/disconnect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                transportId: transport.id
              })
            }).then(response => response.json())
              .then(data => {
                if (data.success) {
                  // Przeniesienie po rozłączeniu
                  handleTransportMove(transport, destination.droppableId);
                } else {
                  alert("Nie udało się rozłączyć transportu: " + (data.error || "Nieznany błąd"));
                }
              })
              .catch(error => {
                console.error("Błąd podczas rozłączania transportu:", error);
                alert("Wystąpił błąd podczas rozłączania transportu");
              });
          }
        } else {
          // Jeśli to pojedynczy transport, po prostu go przenieś
          handleTransportMove(transport, destination.droppableId);
        }
      } else {
        console.error('Nie znaleziono transportu o ID:', draggableId);
      }
    }
  };

  const handleConnectTransport = (transport) => {
    setConnectingTransport(transport);
    setShowConnectModal(true);
  };
  
  // Funkcja do faktycznego łączenia transportów
  const handleConfirmConnect = async (sourceTransport, targetTransport) => {
    try {
      // Upewnij się, że kierowcy obu transportów są tacy sami
      if (sourceTransport.kierowcaId !== targetTransport.kierowcaId) {
        if (!confirm('Transporty mają różnych kierowców. Czy na pewno chcesz je połączyć?')) {
          return;
        }
      }
      
      // Wywołaj API do połączenia transportów
      const response = await fetch('/api/transports/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceTransportId: sourceTransport.id,
          targetTransportId: targetTransport.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Transporty zostały połączone!');
        setShowConnectModal(false);
        setConnectingTransport(null);
        
        // Odświeżenie danych
        await fetchTransports();
      } else {
        throw new Error(data.error || 'Nie udało się połączyć transportów');
      }
    } catch (error) {
      console.error('Błąd podczas łączenia transportów:', error);
      alert('Wystąpił błąd podczas łączenia transportów: ' + error.message);
    }
  };

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
            pojazdId: transport.vehicle_id, // Dodane nowe pole
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
            odleglosc: transport.distance,
            packagingId: transport.packaging_id,
            connected_transport_id: transport.connected_transport_id
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
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.isAuthenticated && data.user) {
          setUserRole(data.user.role);
          setUserId(data.user.email);
          setUserEmail(data.user.email);
          setUserMpk(data.user.mpk || '');
          setUserPermissions(data.user.permissions || {});
          setUserName(data.user.name || data.user.email);
          
          // Dodane: zapisz dane użytkownika do localStorage
          localStorage.setItem('userName', data.user.name || data.user.email);
          localStorage.setItem('userEmail', data.user.email);
          
          console.log('Pobrane dane użytkownika z API:', {
            role: data.user.role,
            permissions: data.user.permissions
          });
        }
      } catch (error) {
        console.error('Błąd pobierania danych użytkownika:', error);
        setError('Wystąpił błąd podczas pobierania danych użytkownika.');
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchUserData();
  
    const savedZamowienia = localStorage.getItem('zamowieniaSpedycja');
    if (savedZamowienia) {
      setZamowienia(JSON.parse(savedZamowienia));
    }
  
    fetchTransports();
  }, []);

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
      let odleglosc = 0;
      
      if (nowyTransport.connectedTransportId) {
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        const sourceTransports = transporty[dateKey] || [];
        const sourceTransport = sourceTransports.find(t => t.id === parseInt(nowyTransport.connectedTransportId));
      
        if (sourceTransport?.wspolrzedne) {
          odleglosc = await calculateDistance(
            sourceTransport.wspolrzedne.lat,
            sourceTransport.wspolrzedne.lng,
            coordinates.lat,
            coordinates.lng
          );
        } else {
          odleglosc = await calculateDistance(
            MAGAZYNY[wybranyMagazyn].lat,
            MAGAZYNY[wybranyMagazyn].lng,
            coordinates.lat,
            coordinates.lng
          );
        }
      } else {
        odleglosc = await calculateDistance(
          MAGAZYNY[wybranyMagazyn].lat,
          MAGAZYNY[wybranyMagazyn].lng,
          coordinates.lat,
          coordinates.lng
        );
      }
    
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
          vehicle_id: nowyTransport.pojazdId, // Dodane nowe pole
          wz_number: nowyTransport.numerWZ,
          client_name: nowyTransport.nazwaKlienta,
          requester_name: nowyTransport.osobaZlecajaca,
          requester_email: nowyTransport.emailZlecajacego,
          mpk: nowyTransport.mpk,
          market: nowyTransport.rynek,
          loading_level: nowyTransport.poziomZaladunku,
          notes: nowyTransport.informacje,
          is_cyclical: nowyTransport.trasaCykliczna ? 1 : 0,
          delivery_date: format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss"),
          status: 'active',
          packaging_id: nowyTransport.packagingId,
          connected_transport_id: nowyTransport.connectedTransportId
        })
      });
      
      const data = await response.json();
  
      if (data.success) {
        // Jeśli transport dotyczy odbioru opakowania (bębnów)
        if (nowyTransport.packagingId) {
          console.log('Transport ma packagingId:', nowyTransport.packagingId);
          
          // Pobierz dane opakowania
          try {
            console.log('Próbuję pobrać dane opakowania...');
            const packagingResponse = await fetch(`/api/packagings/${nowyTransport.packagingId}`);
            const packagingData = await packagingResponse.json();
            
            console.log('Odpowiedź API packagings:', packagingData);
            
            if (packagingResponse.ok && packagingData.success) {
              console.log('Pobrano dane opakowania pomyślnie');
              // Wyślij powiadomienie SMS o odbiorze bębnów
              const transportData = {
                delivery_date: format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss"),
                source_warehouse: wybranyMagazyn,
                client_name: nowyTransport.nazwaKlienta
              };
              
              console.log('Przygotowane dane transportu do SMS:', transportData);
              
              // Wywołaj funkcję do wysyłania SMS
              try {
                console.log('Próbuję wysłać SMS...');
                const smsResult = await wyslijPowiadomienieOdbioruBebnow(transportData, packagingData.packaging);
                console.log('Wynik wysłania SMS:', smsResult);
              } catch (innerSmsError) {
                console.error('Wewnętrzny błąd wysyłania SMS:', innerSmsError);
              }
            } else {
              console.error('Nie udało się pobrać danych opakowania:', packagingData.error || 'Nieznany błąd');
            }
          } catch (smsError) {
            console.error('Błąd podczas wysyłania powiadomienia SMS:', smsError);
            // Nie przerywaj dalszego przetwarzania w przypadku błędu SMS
          }
  
          // Aktualizujemy opakowanie, aby usunąć referencję do transportu
          await fetch('/api/packagings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: nowyTransport.packagingId,
              transport_id: data.id,
              status: 'scheduled'
            })
          });
        }
        
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
          magazyn: defaultMagazyn,
          packagingId: null
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
      
      // Znajdź transport aby sprawdzić czy ma powiązane opakowanie
      const transportNaDzien = transporty[dateKey] || [];
      const transport = transportNaDzien.find(t => t.id === transportId);
      const packagingId = transport?.packagingId;
      
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
        // Jeśli transport miał powiązane opakowanie, oznacz je jako odebrane
        if (packagingId) {
          await fetch('/api/packagings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: packagingId,
              status: 'completed'
            })
          });
        }
        
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
      let odleglosc = 0;
      const wybranyMagazyn = nowyTransport.zrodlo || 'bialystok';
      
      if (nowyTransport.connected_transport_id) {
        // To jest transport połączony z innym
        const dateKey = format(selectedDate || new Date(edytowanyTransport.dataDostawy), 'yyyy-MM-dd');
        const sourceTransports = transporty[dateKey] || [];
        const sourceTransport = sourceTransports.find(t => t.id === parseInt(nowyTransport.connected_transport_id));
        
        if (sourceTransport?.wspolrzedne) {
          // Obliczamy odległość od poprzedniego przystanku
          odleglosc = await calculateDistance(
            sourceTransport.wspolrzedne.lat,
            sourceTransport.wspolrzedne.lng,
            coordinates.lat,
            coordinates.lng
          );
        } else {
          // Jeśli nie udało się znaleźć transportu źródłowego, obliczamy standardowo
          odleglosc = await calculateDistance(
            MAGAZYNY[wybranyMagazyn].lat,
            MAGAZYNY[wybranyMagazyn].lng,
            coordinates.lat,
            coordinates.lng
          );
        }
      } else {
        // Standardowe obliczanie odległości od magazynu
        odleglosc = await calculateDistance(
          MAGAZYNY[wybranyMagazyn].lat,
          MAGAZYNY[wybranyMagazyn].lng,
          coordinates.lat,
          coordinates.lng
        );
      }
  
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
          delivery_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss") : edytowanyTransport.delivery_date,
          packaging_id: nowyTransport.packagingId,
          connected_transport_id: nowyTransport.connected_transport_id
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
          trasaCykliczna: false,
          packagingId: null,
          magazyn: defaultMagazyn
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

  // Funkcja do obsługi upuszczenia opakowania na datę
  const handlePackagingDrop = async (packaging, dateKey) => {
    // Sprawdź, czy dateKey jest poprawne
    console.log("Upuszczono opakowanie na datę:", dateKey, "Opakowanie:", packaging);
    
    // Jeśli dateKey nie wygląda jak data, przerwij
    if (!dateKey || !dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error("Nieprawidłowy format daty:", dateKey);
      return;
    }
    
    try {
      // Pokaż potwierdzenie
      if (!confirm(`Czy chcesz zaplanować odbiór opakowań od ${packaging.client_name} na dzień ${format(new Date(dateKey), 'd MMMM yyyy', { locale: pl })}?`)) {
        return;
      }
      
      // Otwórz formularz dodawania transportu z wypełnionymi danymi opakowania
      setSelectedDate(new Date(dateKey));
      
      // Przygotuj dane do formularza
      setNowyTransport({
        miasto: packaging.city,
        kodPocztowy: packaging.postal_code || '',
        ulica: packaging.street || '',
        informacje: `Odbiór opakowań: ${packaging.description}`,
        status: 'aktywny',
        kierowcaId: '',
        numerWZ: '',
        nazwaKlienta: packaging.client_name,
        osobaZlecajaca: userName || '',
        emailZlecajacego: userEmail || '',
        mpk: '',
        rynek: '',
        poziomZaladunku: '',
        dokumenty: '',
        trasaCykliczna: false,
        magazyn: defaultMagazyn || 'bialystok',
        packagingId: packaging.id // Dodajemy ID opakowania
      });
      
      // Wstrzymuj się z oznaczeniem opakowania jako zaplanowane, 
      // dopóki użytkownik nie zatwierdzi faktycznego transportu
      // Informacja dla użytkownika
      alert(`Zaplanowano wstępnie odbiór opakowań od ${packaging.client_name}. Teraz wybierz kierowcę i uzupełnij pozostałe dane transportu.`);
      
    } catch (error) {
      console.error('Błąd podczas planowania odbioru opakowania:', error);
      alert('Wystąpił błąd podczas planowania odbioru opakowania');
    }
  };

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
     
     const isMagazynRole = userRole === 'magazyn' || 
                          userRole?.startsWith('magazyn_') ||
                          userRole === 'magazyn_bialystok' ||
                          userRole === 'magazyn_zielonka';
     
     // Użytkownicy z rolą magazynu lub admini mają uprawnienia
     return userPermissions?.calendar?.edit === true || userRole === 'admin';
   };
  
   // Funkcja do zapisywania lokalizacji w localStorage
   const saveLocationToStorage = (transportData) => {
     if (!transportData.miasto || !transportData.kodPocztowy) {
       return;
     }
     
     try {
       // Pobierz aktualną listę zapisanych lokalizacji
       const savedLocations = localStorage.getItem('savedLocations');
       let locations = [];
       
       if (savedLocations) {
         locations = JSON.parse(savedLocations);
       }
       
       // Sprawdź czy lokalizacja już istnieje
       const locationExists = locations.some(loc => 
         loc.miasto === transportData.miasto && 
         loc.kodPocztowy === transportData.kodPocztowy && 
         loc.ulica === transportData.ulica
       );
       
       // Jeśli nie istnieje, dodaj ją
       if (!locationExists) {
         locations.push({
           miasto: transportData.miasto,
           kodPocztowy: transportData.kodPocztowy,
           ulica: transportData.ulica || '',
           nazwaKlienta: transportData.nazwaKlienta || ''
         });
         
         localStorage.setItem('savedLocations', JSON.stringify(locations));
       }
     } catch (error) {
       console.error('Błąd zapisywania lokalizacji:', error);
     }
   };
  
   if (isLoading) {
     return <div className="flex justify-center items-center h-64">Ładowanie...</div>
   }
  
   if (error) {
     return <div className="text-red-500 text-center p-4">{error}</div>
   }
  
   return (
     <DragDropContext onDragEnd={handleMainDragEnd}>
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
  
         {/* Dodajemy komponent do wyświetlania opakowań do odbioru - bez onDragEnd */}
         <PackagingsList />
  
         <SimpleCalendarGrid 
           daysInMonth={daysInMonth}
           onDateSelect={handleDateClick}
           currentMonth={currentMonth}
           transporty={transporty}
           filtryAktywne={filtryAktywne}
         />
         
         <TransportsList
           selectedDate={selectedDate}
           transporty={transporty}
           userRole={userRole}
           userEmail={userEmail}
           onZakonczTransport={handleZakonczTransport}
           onEditTransport={handleEditTransport}
           onPrzeniesDoPrzenoszenia={handlePrzeniesDoPrzenoszenia}
           onConnectTransport={handleConnectTransport}
           filtryAktywne={filtryAktywne}
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
               currentUserEmail={userEmail}
               userName={userName || localStorage.getItem('userName') || userEmail}
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
         
         {/* Modal wyboru transportu do połączenia */}
         {showConnectModal && connectingTransport && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="bg-white rounded-lg p-6 max-w-md w-full">
               <h3 className="text-lg font-medium text-gray-900 mb-4">Połącz transport</h3>
               <p className="text-sm text-gray-500 mb-4">
                 Wybierz transport, który chcesz połączyć z transportem do {connectingTransport.miasto}
               </p>
               
               <div className="max-h-64 overflow-y-auto mb-4">
                 {Object.entries(transporty).map(([dateKey, transportsOnDay]) => {
                   const filteredTransports = transportsOnDay.filter(t => 
                     t.id !== connectingTransport.id && 
                     t.status === 'active' &&
                     !t.connected_transport_id &&
                     !transportsOnDay.some(ot => ot.connected_transport_id === t.id)
                   );
                   
                   if (filteredTransports.length === 0) return null;
                   
                   return (
                     <div key={dateKey} className="mb-2">
                       <h4 className="font-medium text-sm text-gray-700">
                         {format(new Date(dateKey), 'd MMMM yyyy', { locale: pl })}
                       </h4>
                       {filteredTransports.map(transport => (
                         <div 
                           key={transport.id}
                           className="p-2 border rounded mt-1 cursor-pointer hover:bg-blue-50"
                           onClick={() => handleConfirmConnect(connectingTransport, transport)}
                         >
                           <div className="font-medium">{transport.miasto}</div>
                           <div className="text-sm text-gray-600">
                             {transport.kodPocztowy} - {transport.ulica || 'brak ulicy'}
                           </div>
                           <div className="text-xs text-gray-500">
                             Kierowca: {transport.kierowcaId 
                               ? KIEROWCY.find(k => k.id === parseInt(transport.kierowcaId))?.imie || 'Nieznany'
                               : 'Nie przypisano'}
                           </div>
                         </div>
                       ))}
                     </div>
                   );
                 })}
               </div>
               
               <div className="flex justify-end gap-3">
                 <button
                   type="button"
                   onClick={() => {
                     setShowConnectModal(false);
                     setConnectingTransport(null);
                   }}
                   className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                 >
                   Anuluj
                 </button>
               </div>
             </div>
           </div>
         )}
         {(userRole === 'admin' || userRole === 'super_admin') && <FixDistances />}
       </div>
     </DragDropContext>
   )
}
