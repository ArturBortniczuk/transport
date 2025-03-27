'use client'
import { useEffect, useState, useRef } from 'react'

export default function GoogleMapComponent({ transporty = [], magazyny = {} }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [infoWindows, setInfoWindows] = useState([]);

  // Logowanie danych wejściowych
  useEffect(() => {
    console.log("GoogleMapComponent: Otrzymane transporty:", transporty);
    console.log("GoogleMapComponent: Otrzymane magazyny:", magazyny);
  }, [transporty, magazyny]);

  // Załaduj Google Maps API
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google && window.google.maps) {
      setGoogleMapsLoaded(true);
      return;
    }

    // Funkcja wywoływana po załadowaniu Google Maps API
    window.initGoogleMaps = () => {
      setGoogleMapsLoaded(true);
    };

    // Dodaj skrypt Google Maps do strony
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      window.initGoogleMaps = null;
      // Usuń skrypt jeśli komponent zostanie odmontowany przed załadowaniem
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Inicjalizacja mapy
  useEffect(() => {
    if (!googleMapsLoaded || !mapRef.current || mapLoaded) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 52.7, lng: 22 },
      zoom: 7,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    setMapLoaded(true);
    return () => {
      // Czyszczenie zasobów mapy jeśli potrzebne
    };
  }, [googleMapsLoaded, mapLoaded]);

  // Funkcja do określania źródła transportu (magazynu)
  const getTransportSource = (transport) => {
    // Sprawdź wszystkie możliwe pola źródła
    return transport.zrodlo || 
           transport.source_warehouse || 
           (transport.latitude > 53 ? 'bialystok' : 'zielonka'); // Domyślnie na podstawie położenia
  };

  // Dodawanie markerów
  useEffect(() => {
    if (!mapLoaded || !window.google || !window.google.maps) return;

    // Funkcja tworząca marker magazynu
    const createWarehouseMarker = (key, magazyn) => {
      console.log(`Dodaję marker magazynu ${key}:`, magazyn);
      
      const marker = new window.google.maps.Marker({
        position: { lat: magazyn.lat, lng: magazyn.lng },
        map: new window.google.maps.Map(mapRef.current),
        title: magazyn.nazwa,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: magazyn.kolor,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: 12,
        },
        label: {
          text: 'M',
          color: '#FFFFFF',
          fontSize: '10px',
          fontWeight: 'bold'
        },
        zIndex: 10
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div class="text-center"><b>${magazyn.nazwa}</b></div>`
      });

      marker.addListener('click', () => {
        infoWindow.open({
          anchor: marker,
          map: new window.google.maps.Map(mapRef.current),
        });
      });

      return { marker, infoWindow };
    };

    // Funkcja tworząca marker transportu
    const createTransportMarker = (transport, index) => {
      // Normalizacja danych transportu
      const wspolrzedne = {
        lat: transport.wspolrzedne?.lat || transport.latitude,
        lng: transport.wspolrzedne?.lng || transport.longitude
      };
      
      if (!wspolrzedne.lat || !wspolrzedne.lng) {
        console.warn(`Transport ${index} nie ma współrzędnych:`, transport);
        return null;
      }
      
      const sourceKey = getTransportSource(transport);
      const magazyn = magazyny[sourceKey];
      console.log(`Transport ${index} źródło: ${sourceKey}, magazyn:`, magazyn);
      
      const kolor = magazyn?.kolor || '#888888';
      
      const marker = new window.google.maps.Marker({
        position: { lat: wspolrzedne.lat, lng: wspolrzedne.lng },
        map: new window.google.maps.Map(mapRef.current),
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: kolor,
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#FFFFFF',
          scale: 8,
        },
        zIndex: 5
      });

      const miasto = transport.miasto || transport.destination_city || '';
      const kodPocztowy = transport.kodPocztowy || transport.postal_code || '';
      const ulica = transport.ulica || transport.street || '';
      const odleglosc = transport.odleglosc || transport.distance || 0;
      const magazynNazwa = magazyn?.nazwa || sourceKey || '';
      
      const infoWindowContent = `
        <div>
          <b>${miasto}</b>
          <br />
          ${kodPocztowy}
          ${ulica ? `<br />${ulica}` : ''}
          <br />
          <small>Magazyn: ${magazynNazwa}</small>
          <br />
          <small>Odległość: ${odleglosc} km</small>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: infoWindowContent
      });

      marker.addListener('click', () => {
        infoWindow.open({
          anchor: marker,
          map: new window.google.maps.Map(mapRef.current),
        });
      });

      return { marker, infoWindow };
    };

    // Usuń stare markery
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());

    // Dodaj markery magazynów
    const newMarkers = [];
    const newInfoWindows = [];

    // Dodaj markery magazynów
    Object.entries(magazyny).forEach(([key, magazyn]) => {
      const { marker, infoWindow } = createWarehouseMarker(key, magazyn);
      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    // Dodaj markery transportów
    transporty.forEach((transport, index) => {
      const result = createTransportMarker(transport, index);
      if (result) {
        newMarkers.push(result.marker);
        newInfoWindows.push(result.infoWindow);
      }
    });

    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);

    return () => {
      // Czyszczenie markerów przy odmontowaniu
      newMarkers.forEach(marker => marker.setMap(null));
      newInfoWindows.forEach(infoWindow => infoWindow.close());
    };
  }, [mapLoaded, transporty, magazyny]);

  return (
    <div>
      <div
        ref={mapRef}
        style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
      />
    </div>
  );
}
