'use client'
import { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'

export default function SimpleMapComponent({ transporty = [], magazyny = {} }) {
  const [mapCreated, setMapCreated] = useState(false);
  const [mapContainer, setMapContainer] = useState(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setLeafletLib] = useState(null);
  const [map, setMap] = useState(null);

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

  // Dodawanie markerów magazynów
  useEffect(() => {
    if (!map || !L) return;

    // Dodaj markery magazynów
    const magazynyMarkers = [];
    Object.entries(magazyny).forEach(([key, magazyn]) => {
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
      magazynyMarkers.push(marker);
    });

    // Cleanup
    return () => {
      magazynyMarkers.forEach(marker => {
        if (map) map.removeLayer(marker);
      });
    };
  }, [map, L, magazyny]);

  // Dodawanie markerów transportów
  useEffect(() => {
    if (!map || !L || !transporty.length) return;

    const transportMarkers = [];
    transporty.forEach((transport, index) => {
      if (transport?.wspolrzedne?.lat && transport?.wspolrzedne?.lng) {
        const kolor = magazyny[transport.zrodlo]?.kolor || '#888888';
        
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

        const marker = L.marker([transport.wspolrzedne.lat, transport.wspolrzedne.lng], { icon }).addTo(map);
        
        const popupContent = `
          <div>
            <b>${transport.miasto || ''}</b>
            <br />
            ${transport.kodPocztowy || ''}
            ${transport.ulica ? `<br />${transport.ulica}` : ''}
            <br />
            <small>Magazyn: ${magazyny[transport.zrodlo]?.nazwa || transport.zrodlo || ''}</small>
            <br />
            <small>Odległość: ${transport.odleglosc || 0} km</small>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        transportMarkers.push(marker);
      }
    });

    // Cleanup
    return () => {
      transportMarkers.forEach(marker => {
        if (map) map.removeLayer(marker);
      });
    };
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