'use client'
import { useEffect, useState, useRef } from 'react'

export default function GoogleMapWithNoSSR({ transporty = [], magazyny = {} }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const mapRef = useRef(null);
  const [google, setGoogle] = useState(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [infoWindows, setInfoWindows] = useState([]);
  const [directionsRenderers, setDirectionsRenderers] = useState([]);

  // Logowanie danych wejściowych dla debugowania
  useEffect(() => {
    console.log("GoogleMapWithNoSSR: Otrzymane transporty:", transporty);
    console.log("GoogleMapWithNoSSR: Otrzymane magazyny:", magazyny);
  }, [transporty, magazyny]);

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

  // Czyszczenie markerów i tras
  const clearMap = () => {
    // Usuń wszystkie markery
    markers.forEach(marker => {
      if (marker) marker.setMap(null);
    });

    // Zamknij wszystkie info windows
    infoWindows.forEach(infoWindow => {
      if (infoWindow) infoWindow.close();
    });

    // Usuń wszystkie renderers tras
    directionsRenderers.forEach(renderer => {
      if (renderer) renderer.setMap(null);
    });

    setMarkers([]);
    setInfoWindows([]);
    setDirectionsRenderers([]);
  };

  // Dodawanie markerów magazynów
  useEffect(() => {
    if (!isLoaded || !map || !google) return;

    // Dodaj markery magazynów
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

    setMarkers(prev => [...prev, ...newMarkers]);
    setInfoWindows(prev => [...prev, ...newInfoWindows]);

    return () => {
      newMarkers.forEach(marker => marker.setMap(null));
      newInfoWindows.forEach(infoWindow => infoWindow.close());
    };
  }, [isLoaded, map, google, magazyny]);

  // Rysowanie tras dla transportów
  useEffect(() => {
    if (!isLoaded || !map || !google || !transporty.length) return;

    // Czyścimy poprzednie transporty
    clearMap();

    const newMarkers = [];
    const newInfoWindows = [];
    const newDirectionsRenderers = [];
    
    // Funkcja do tworzenia ikon markerów
    const createMarkerIcon = (color, isStart = false) => {
      return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 8,
      };
    };

    // Przetwórz wszystkie transporty
    const processTransporty = async () => {
      const directionsService = new google.maps.DirectionsService();

      for (const transport of transporty) {
        try {
          // Sprawdź czy transport ma wymagane dane
          if (!transport.origin || !transport.destination) {
            console.error('Transport bez punktów początkowych/końcowych:', transport);
            continue;
          }

          // Ustal kolor trasy
          let routeColor;
          if (transport.typ === 'spedycja') {
            routeColor = '#9061F9'; // Fioletowy dla spedycji
          } else {
            routeColor = magazyny[transport.zrodloId]?.kolor || '#888888';
          }

          // Przygotuj dane trasy
          const request = {
            origin: { lat: transport.origin.lat, lng: transport.origin.lng },
            destination: { lat: transport.destination.lat, lng: transport.destination.lng },
            travelMode: google.maps.TravelMode.DRIVING
          };

          // Dodaj waypoints jeśli są
          if (transport.additionalPoints && transport.additionalPoints.length > 0) {
            request.waypoints = transport.additionalPoints.map(point => ({
              location: new google.maps.LatLng(point.lat, point.lng),
              stopover: true
            }));
          }

          // Utwórz renderer dla trasy
          const directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true, // Wyłączamy domyślne markery, będziemy używać własnych
            polylineOptions: {
              strokeColor: routeColor,
              strokeWeight: 5,
              strokeOpacity: 0.7
            }
          });

          // Wywołaj API kierunków
          directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
              directionsRenderer.setDirections(result);
              newDirectionsRenderers.push(directionsRenderer);

              // Dodaj marker punktu startowego
              const startMarker = new google.maps.Marker({
                position: { lat: transport.origin.lat, lng: transport.origin.lng },
                map: map,
                icon: createMarkerIcon(routeColor, true),
                title: `Start: ${transport.origin.name}`
              });

              const startInfoWindow = new google.maps.InfoWindow({
                content: `
                  <div>
                    <h3 class="font-medium">${transport.displayName || 'Transport'}</h3>
                    <p><b>Start:</b> ${transport.origin.name}</p>
                    <p><b>Typ:</b> ${transport.typ === 'spedycja' ? 'Spedycja' : 'Transport własny'}</p>
                    <p><b>Dzień:</b> ${transport.dayOfWeek || 'Nie określono'}</p>
                  </div>
                `
              });

              startMarker.addListener('click', () => {
                startInfoWindow.open({
                  anchor: startMarker,
                  map: map
                });
              });

              newMarkers.push(startMarker);
              newInfoWindows.push(startInfoWindow);

              // Dodaj marker punktu końcowego
              const endMarker = new google.maps.Marker({
                position: { lat: transport.destination.lat, lng: transport.destination.lng },
                map: map,
                icon: createMarkerIcon(routeColor, false),
                title: `Cel: ${transport.destination.name}`
              });

              const endInfoWindow = new google.maps.InfoWindow({
                content: `
                  <div>
                    <h3 class="font-medium">${transport.displayName || 'Transport'}</h3>
                    <p><b>Cel:</b> ${transport.destination.name}</p>
                    <p><b>Typ:</b> ${transport.typ === 'spedycja' ? 'Spedycja' : 'Transport własny'}</p>
                    <p><b>Dzień:</b> ${transport.dayOfWeek || 'Nie określono'}</p>
                    ${transport.distanceKm ? `<p><b>Odległość:</b> ${transport.distanceKm} km</p>` : ''}
                  </div>
                `
              });

              endMarker.addListener('click', () => {
                endInfoWindow.open({
                  anchor: endMarker,
                  map: map
                });
              });

              newMarkers.push(endMarker);
              newInfoWindows.push(endInfoWindow);

              // Dodaj markery dla punktów pośrednich jeśli są
              if (transport.additionalPoints && transport.additionalPoints.length > 0) {
                transport.additionalPoints.forEach((point, index) => {
                  const waypointMarker = new google.maps.Marker({
                    position: { lat: point.lat, lng: point.lng },
                    map: map,
                    icon: createMarkerIcon(routeColor, false),
                    title: `Punkt pośredni: ${point.name || index + 1}`
                  });

                  const waypointInfoWindow = new google.maps.InfoWindow({
                    content: `
                      <div>
                        <h3 class="font-medium">${transport.displayName || 'Transport'}</h3>
                        <p><b>Punkt pośredni:</b> ${point.name || `#${index + 1}`}</p>
                        <p><b>Typ:</b> ${transport.typ === 'spedycja' ? 'Spedycja' : 'Transport własny'}</p>
                      </div>
                    `
                  });

                  waypointMarker.addListener('click', () => {
                    waypointInfoWindow.open({
                      anchor: waypointMarker,
                      map: map
                    });
                  });

                  newMarkers.push(waypointMarker);
                  newInfoWindows.push(waypointInfoWindow);
                });
              }
            } else {
              console.error(`Błąd wyznaczania trasy dla transportu ${transport.id}:`, status);
              
              // Jeśli nie można wyznaczyć trasy, dodaj markery i narysuj prostą linię
              const startMarker = new google.maps.Marker({
                position: { lat: transport.origin.lat, lng: transport.origin.lng },
                map: map,
                icon: createMarkerIcon(routeColor, true),
                title: `Start: ${transport.origin.name}`
              });
              
              const endMarker = new google.maps.Marker({
                position: { lat: transport.destination.lat, lng: transport.destination.lng },
                map: map,
                icon: createMarkerIcon(routeColor, false),
                title: `Cel: ${transport.destination.name}`
              });
              
              // Narysuj prostą linię między punktami
              const line = new google.maps.Polyline({
                path: [
                  { lat: transport.origin.lat, lng: transport.origin.lng },
                  { lat: transport.destination.lat, lng: transport.destination.lng }
                ],
                geodesic: true,
                strokeColor: routeColor,
                strokeOpacity: 0.7,
                strokeWeight: 3,
                map: map
              });
              
              newMarkers.push(startMarker, endMarker);
            }
          });
        } catch (error) {
          console.error(`Błąd podczas przetwarzania transportu ${transport.id}:`, error);
        }
      }
    };

    processTransporty();

    // Zapisz wszystkie nowe obiekty w stanie
    setMarkers(prev => [...prev, ...newMarkers]);
    setInfoWindows(prev => [...prev, ...newInfoWindows]);
    setDirectionsRenderers(prev => [...prev, ...newDirectionsRenderers]);

    // Funkcja czyszcząca
    return () => {
      newMarkers.forEach(marker => {
        if (marker) marker.setMap(null);
      });
      newInfoWindows.forEach(infoWindow => {
        if (infoWindow) infoWindow.close();
      });
      newDirectionsRenderers.forEach(renderer => {
        if (renderer) renderer.setMap(null);
      });
    };
  }, [isLoaded, map, google, transporty]);

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
