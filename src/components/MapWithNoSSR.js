'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

// Dynamicznie importujemy komponenty Leaflet, aby uniknąć problemów z SSR
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

export default function MapWithNoSSR({ transporty = [], magazyny = {} }) {
  const [isMounted, setIsMounted] = useState(false);
  const [leaflet, setLeaflet] = useState(null);

  // Dodajmy log dla debugowania
  console.log("Transporty przekazane do mapy:", transporty);

  // Ładowanie Leaflet tylko po stronie klienta
  useEffect(() => {
    setIsMounted(true);
    import('leaflet').then((L) => {
      // Naprawia problem z ikonami w Leaflet
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
      setLeaflet(L);
    });
  }, []);

  // Funkcja tworząca niestandardowe ikony markerów
  const createIcon = (color, isMagazyn = false) => {
    if (!leaflet) return null;
    
    if (isMagazyn) {
      return leaflet.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background-color: ${color};
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
    }

    return leaflet.divIcon({
      className: 'custom-div-icon',
      html: `<div style="
        background-color: ${color}; 
        width: 16px; 
        height: 16px; 
        border-radius: 50%; 
        border: 2px solid white; 
        box-shadow: 0 0 4px rgba(0,0,0,0.5);
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  if (!isMounted || !leaflet) {
    return (
      <div className="flex justify-center items-center h-[500px] bg-gray-100">
        <p className="text-gray-500">Ładowanie mapy...</p>
      </div>
    );
  }

  return (
    <MapContainer 
      center={[52.7, 22]} 
      zoom={7} 
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* Markery magazynów */}
      {Object.entries(magazyny).map(([key, magazyn]) => (
        <Marker 
          key={key}
          position={[magazyn.lat, magazyn.lng]}
          icon={createIcon(magazyn.kolor, true)}
        >
          <Popup>
            <div className="text-center">
              <b>{magazyn.nazwa}</b>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Markery transportów */}
      {transporty && transporty.map((transport, index) => {
        // Sprawdź, czy transport ma wszystkie niezbędne dane
        if (transport && transport.wspolrzedne && transport.wspolrzedne.lat && transport.wspolrzedne.lng) {
          console.log(`Transport ${index} ma współrzędne:`, transport.wspolrzedne);
          return (
            <Marker
              key={transport.id || index}
              position={[transport.wspolrzedne.lat, transport.wspolrzedne.lng]}
              icon={createIcon(magazyny[transport.zrodlo]?.kolor || '#888888')}
            >
              <Popup>
                <div>
                  <b>{transport.miasto}</b>
                  <br />
                  {transport.kodPocztowy}
                  {transport.ulica && <><br />{transport.ulica}</>}
                  <br />
                  <small>Magazyn: {magazyny[transport.zrodlo]?.nazwa || transport.zrodlo}</small>
                  <br />
                  <small>Odległość: {transport.odleglosc} km</small>
                </div>
              </Popup>
            </Marker>
          )
        }
        console.log(`Transport ${index} nie ma współrzędnych:`, transport);
        return null;
      })}
    </MapContainer>
  )
}