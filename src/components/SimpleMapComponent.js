'use client'
import { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export default function SimpleMapComponent({ transporty = [], magazyny = {} }) {
  const [mapCreated, setMapCreated] = useState(false);
  const [mapContainer, setMapContainer] = useState(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setLeafletLib] = useState(null);
  const [map, setMap] = useState(null);

  // Logowanie danych wejściowych
  useEffect(() => {
    console.log("SimpleMapComponent: Otrzymane transporty:", transporty);
    console.log("SimpleMapComponent: Otrzymane magazyny:", magazyny);
  }, [transporty, magazyny]);

  // Funkcja inicjalizująca mapę
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dynamiczne załadowanie biblioteki Leaflet
    import('leaflet').then((leaflet) => {
      setLeafletLib(leaflet.default);
      setLeafletLoaded(true);
    });
  }, []);

  // Tworzenie mapy po załadowaniu Leaflet
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainer || mapCreated) return;

    // Napraw problem z ikonami Leaflet
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });

    // Utwórz mapę
    const mapInstance = L.map(mapContainer).setView([52.7, 22], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);

    setMap(mapInstance);
    setMapCreated(true);
  }, [L, mapContainer, leafletLoaded, mapCreated]);

  // Funkcja do określania źródła transportu (magazynu)
  const getTransportSource = (transport) => {
    // Sprawdź wszystkie możliwe pola źródła
    return transport.zrodlo || 
           transport.source_warehouse || 
           (transport.latitude > 53 ? 'bialystok' : 'zielonka'); // Domyślnie na podstawie położenia
  };

  // Dodawanie markerów magazynów
  useEffect(() => {
    if (!map || !L) return;

    // Usuń poprzednie markery
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Dodaj markery magazynów
    Object.entries(magazyny).forEach(([key, magazyn]) => {
      console.log(`Dodaję marker magazynu ${key}:`, magazyn);
      
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background-color: ${magazyn.kolor};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 12px;
            font-family: Arial, sans-serif;
          ">
            M
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([magazyn.lat, magazyn.lng], { icon }).addTo(map);
      marker.bindPopup(`<div class="text-center"><b>${magazyn.nazwa}</b></div>`);
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
      
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          background-color: ${kolor}; 
          width: 16px; 
          height: 16px; 
          border-radius: 50%; 
          border: 2px solid white; 
          box-shadow: 0 0 4px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([wspolrzedne.lat, wspolrzedne.lng], { icon }).addTo(map);
      
      const miasto = transport.miasto || transport.destination_city || '';
      const kodPocztowy = transport.kodPocztowy || transport.postal_code || '';
      const ulica = transport.ulica || transport.street || '';
      const odleglosc = transport.odleglosc || transport.distance || 0;
      const magazynNazwa = magazyn?.nazwa || sourceKey || '';
      
      const popupContent = `
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
      
      marker.bindPopup(popupContent);
    });
  }, [map, L, transporty, magazyny]);

  return (
    <div>
      <div 
        ref={setMapContainer} 
        style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
      />
    </div>
  );
}