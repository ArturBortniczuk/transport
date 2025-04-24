// src/app/kalendarz/hooks/useTransportOperations.js
'use client'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { getGoogleCoordinates } from '../../services/geocoding-google'
import { calculateDistance } from '../../services/calculateDistance'
import { MAGAZYNY } from '../constants'

export default function useTransportOperations(
  state,
  setters
) {
  const { 
    selectedDate, transporty, nowyTransport, 
    edytowanyTransport, userPermissions 
  } = state;
  
  const { 
    setTransporty, setNowyTransport, setEdytowanyTransport,
    setIsLoading, setError, setPrzenoszonyTransport, setNowaData
  } = setters;

  // Pobieranie transportów z API
  const fetchTransports = async () => {
    try {
      setIsLoading(true);
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

  // Funkcja do pobierania danych o opakowaniach
  const fetchPackagings = async () => {
    try {
      const response = await fetch('/api/packagings?status=pending');
      const data = await response.json();
      
      if (!data.success) {
        console.error('Błąd pobierania opakowań:', data.error);
      }
    } catch (error) {
      console.error('Błąd komunikacji z API opakowań:', error);
    }
  }

  // Dodawanie nowego transportu
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
        // Jeśli transport dotyczy odbioru opakowania, zaktualizuj opakowanie
        if (nowyTransport.packagingId) {
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
          osobaZlecajaca: '',
          emailZlecajacego: '',
          mpk: '',
          rynek: '',
          poziomZaladunku: '',
          dokumenty: '',
          trasaCykliczna: false,
          magazyn: 'bialystok',
          packagingId: null,
          connectedTransportId: null
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

  // Edycja transportu
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
          delivery_date: selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm:ss") : edytowanyTransport.delivery_date,
          packaging_id: nowyTransport.packagingId
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
          connectedTransportId: null
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

  // Oznaczanie transportu jako zakończony
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

  // Funkcja do zaplanowania odbioru opakowania
  const handlePackagingDrop = async (packaging, dateKey) => {
    console.log('Upuszczono opakowanie:', packaging, 'na datę:', dateKey);
    
    // Pokaż potwierdzenie
    if (!confirm(`Czy chcesz zaplanować odbiór opakowań od ${packaging.client_name} na dzień ${format(new Date(dateKey), 'd MMMM yyyy', { locale: pl })}?`)) {
      return; // Jeśli użytkownik anuluje, przerywamy
    }
    
    try {
      // Otwórz formularz dodawania transportu z wypełnionymi danymi opakowania
      setSelectedDate(new Date(dateKey));
      
      // Przygotuj dane do formularza
      setNowyTransport({
        miasto: packaging.city,
        kodPocztowy: packaging.postal_code,
        ulica: packaging.street || '',
        informacje: `Odbiór opakowań: ${packaging.description}`,
        status: 'aktywny',
        kierowcaId: '',
        numerWZ: '',
        nazwaKlienta: packaging.client_name,
        osobaZlecajaca: '',
        emailZlecajacego: '',
        mpk: '',
        rynek: '',
        poziomZaladunku: '',
        dokumenty: '',
        trasaCykliczna: false,
        magazyn: 'bialystok',
        packagingId: packaging.id // Dodajemy ID opakowania
      });
      
      // Oznacz opakowanie jako zaplanowane w bazie danych
      const response = await fetch('/api/packagings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: packaging.id,
          status: 'scheduled'
        })
      });
      
      if (!response.ok) {
        throw new Error('Nie udało się zaktualizować statusu opakowania');
      }
      
      // Po zakończeniu odśwież dane
      await fetchPackagings();
      
      // Przewiń stronę do formularza
      const formElement = document.getElementById('transport-form');
      if (formElement) {
        setTimeout(() => {
          formElement.scrollIntoView({ behavior: 'smooth' });
        }, 300); // Daj chwilę na renderowanie przed przewijaniem
      }
      
    } catch (error) {
      console.error('Błąd podczas planowania odbioru opakowania:', error);
      alert('Wystąpił błąd podczas planowania odbioru opakowania');
    }
  };

  // Funkcja do obsługi edycji transportu
  const handleEditTransport = (transport) => {
    setEdytowanyTransport(transport)
    setNowyTransport({
      ...transport,
      trasaCykliczna: false
    })
  }

  // Funkcja do obsługi przenoszenia transportu
  const handlePrzeniesDoPrzenoszenia = (transport) => {
    setPrzenoszonyTransport(transport)
  }

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

  // Funkcja do przenoszenia transportu
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

  // Funkcja do obsługi przenoszenia transportu poprzez drag and drop
  const handleTransportMove = (transport, newDateKey) => {
    const options = {
      id: transport.id,
      newDate: newDateKey
    };
    handlePrzenoszenieTransportu(options);
  }

  return {
    fetchTransports,
    fetchPackagings,
    handleSubmit,
    handleUpdateTransport,
    handleZakonczTransport,
    handleEditTransport,
    handlePrzeniesDoPrzenoszenia,
    handlePrzenoszenieTransportu,
    handlePackagingDrop,
    handleTransportMove,
    saveLocationToStorage
  }
}