'use client'
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'

// Ten komponent renderuje się tylko po stronie klienta
export default function GoogleMapWithNoSSR({ transporty = [], magazyny = {} }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef(null);
  const [google, setGoogle] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [infoWindows, setInfoWindows] = useState([]);

  // Dodajmy log dla debugowania
  console.log("Transporty przekazane do mapy:", transporty);

  // Ładowanie Google Maps API
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google && window.google.maps) {
      setGoogle(window.google);
      setIsLoaded(true);
      return;
    }

    // Funkcja wywoływana po załadowaniu Google Maps API
    window.initGoogleMaps = () => {
      setGoogle(window.google);
      setIsLoaded(true);
    };

    // Dodaj skrypt Google Maps do strony
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      window.initGoogleMaps = null;
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Inicjalizacja mapy
  useEffect(() => {
    if (!isLoaded || !google || !mapRef.current || map) return;

    const mapInstance = new google.maps.Map(mapRef.current, {
      center: { lat: 52.7, lng: 22 },
      zoom: 7,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    setMap(mapInstance);
  }, [isLoaded, google, map]);

  // Funkcja do określania źródła transportu (magazynu)
  const getTransportSource = (transport) => {
    return transport.zrodlo || 
           transport.source_warehouse || 
           (transport.latitude > 53 ? 'bialystok' : 'zielonka'); // Domyślnie na podstawie położenia
  };

  // Dodawanie markerów
  useEffect(() => {
    if (!isLoaded || !map || !google) return;

    // Usuń stare markery
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());

    const newMarkers = [];
    const newInfoWindows = [];

    // Dodaj markery magazynów
    Object.entries(magazyny).forEach(([key, magazyn]) => {
      console.log(`Dodaję marker magazynu ${key}:`, magazyn);
      
      const marker = new google.maps.Marker({
        position: { lat: magazyn.lat, lng: magazyn.lng },
        map: map,
        title: magazyn.nazwa,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
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

      const infoWindow = new google.maps.InfoWindow({
        content: `<div class="text-center"><b>${magazyn.nazwa}</b></div>`
      });

      marker.addListener('click', () => {
        infoWindow.open({
          anchor: marker,
          map: map,
        });
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    // Dodaj markery transportów
    transporty.forEach((transport, index) => {
      // Normalizacja danych transportu
      const wspolrzedne = {
        lat: transport.wspolrzedne?.lat || transport.latitude,
        lng: transport.wspolrzedne?.lng || transport.longitude
      };
      
      if (!wspolrzedne.lat || !wspolrzedne.lng) {
        console.warn(`Transport ${index} nie ma współrzędnych:`, transport);
        return;
      }
      
      const sourceKey = getTransportSource(transport);
      const magazyn = magazyny[sourceKey];
      console.log(`Transport ${index} źródło: ${sourceKey}, magazyn:`, magazyn);
      
      const kolor = magazyn?.kolor || '#888888';
      
      const marker = new google.maps.Marker({
        position: { lat: wspolrzedne.lat, lng: wspolrzedne.lng },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
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

      const infoWindow = new google.maps.InfoWindow({
        content: infoWindowContent
      });

      marker.addListener('click', () => {
        infoWindow.open({
          anchor: marker,
          map: map,
        });
      });

      newMarkers.push(marker);
      newInfoWindows.push(infoWindow);
    });

    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);

    return () => {
      newMarkers.forEach(marker => marker.setMap(null));
      newInfoWindows.forEach(infoWindow => infoWindow.close());
    };
  }, [isLoaded, map, google, transporty, magazyny]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-[500px] bg-gray-100">
        <p className="text-gray-500">Ładowanie mapy Google...</p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
    />
  );
}
