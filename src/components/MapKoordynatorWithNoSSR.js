'use client'
import { useEffect, useState, useRef } from 'react'

export default function MapKoordynatorWithNoSSR({ locations = [] }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef(null);
  const [google, setGoogle] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [infoWindows, setInfoWindows] = useState([]);

  // Ładowanie Google Maps API
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google && window.google.maps) {
      setGoogle(window.google);
      setIsLoaded(true);
      return;
    }

    window.initGoogleMaps = () => {
      setGoogle(window.google);
      setIsLoaded(true);
    };

    const script = document.createElement('script');
      // Upewnijmy się, że używamy klucza z Env (podobnie jak w GoogleMapWithNoSSR)
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

    // Domyślne centrum (środek Polski)
    const mapInstance = new google.maps.Map(mapRef.current, {
      center: { lat: 52.069, lng: 19.480 },
      zoom: 6,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    setMap(mapInstance);
  }, [isLoaded, google, map]);

  // Geokodowanie i dodawanie markerów
  useEffect(() => {
    if (!isLoaded || !map || !google || locations.length === 0) return;

    // Najpiew czyścimy stare markery
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());
    
    const newMarkers = [];
    const newInfoWindows = [];
    const geocoder = new google.maps.Geocoder();
    const bounds = new google.maps.LatLngBounds();
    
    let processedCount = 0;
    let successfulGeocodes = 0;

    locations.forEach((locationStr, index) => {
      // Unikamy rate-limiting dodając małe opóźnienie dla dużej liczby adresów
      setTimeout(() => {
        geocoder.geocode({ address: locationStr + ', Polska' }, (results, status) => {
          processedCount++;
          
          if (status === 'OK' && results && results[0]) {
            successfulGeocodes++;
            const position = results[0].geometry.location;
            
            const marker = new google.maps.Marker({
              position: position,
              map: map,
              title: locationStr,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#3B82F6', // Niebieski (Tailwind blue-500)
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: '#FFFFFF',
                scale: 8,
              },
              animation: google.maps.Animation.DROP
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div class="px-2 py-1 max-w-xs">
                  <h3 class="font-bold text-sm text-gray-800 border-b pb-1 mb-1">Adres z dokumentu</h3>
                  <p class="text-sm text-gray-600">${locationStr}</p>
                </div>
              `
            });

            marker.addListener('click', () => {
              // Zamknij inne okna
              newInfoWindows.forEach(iw => iw.close());
              infoWindow.open(map, marker);
            });

            bounds.extend(position);
            newMarkers.push(marker);
            newInfoWindows.push(infoWindow);
            
            // Dopasuj mapę do markerów gdy skończymy przetwarzać wszystkie, lub powiększmy ją jeśli to był chociaż 1 poprawny geocode
            if (successfulGeocodes === 1) {
               map.fitBounds(bounds);
               // Zbyt duże przybliżenie dla 1 markera - oddal my trochę
               const listener = google.maps.event.addListener(map, "idle", function() { 
                  if (map.getZoom() > 14) map.setZoom(14); 
                  google.maps.event.removeListener(listener); 
               });
            } else if (processedCount === locations.length && successfulGeocodes > 1) {
               map.fitBounds(bounds);
            }
            
          } else {
            console.warn(`Nie udało się zgeokodować adresu: ${locationStr}. Status: ${status}`);
          }
        });
      }, index * 200); // 200ms opóźnienia między zapytaniami dla bezpieczeństwa API
    });

    setMarkers(newMarkers);
    setInfoWindows(newInfoWindows);

    return () => {
      newMarkers.forEach(marker => marker.setMap(null));
      newInfoWindows.forEach(infoWindow => infoWindow.close());
    };
  }, [isLoaded, map, google, locations]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-full w-full bg-blue-50/50 rounded-xl">
        <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-500 text-sm">Ładowanie mapy Google...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-full w-full rounded-xl"
    />
  );
}
