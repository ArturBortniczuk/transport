// src/components/WzLeafletMap.js
'use client';
import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

const WAREHOUSE_COORDS = [
  { name: 'Magazyn Główny Białystok (BIG)', lat: 53.1325, lng: 23.1688, color: '#DC2626' },
  { name: 'Magazyn Zielonka (WAH)', lat: 52.3025, lng: 21.1620, color: '#2563EB' }
];

export default function WzLeafletMap({
  documents = [],
  selectedWzNumbers = [],
  onToggleSelect,
  className = 'h-[550px] w-full rounded-xl overflow-hidden shadow-sm border border-gray-200'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [L, setL] = useState(null);

  // Inicjalizacja Leaflet po stronie klienta
  useEffect(() => {
    let isMounted = true;
    import('leaflet').then((leafletModule) => {
      if (isMounted) {
        const leaflet = leafletModule.default || leafletModule;
        // Naprawa domyślnych ścieżek ikon
        delete leaflet.Icon.Default.prototype._getIconUrl;
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'
        });
        setL(leaflet);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Inicjalizacja instancji mapy
  useEffect(() => {
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    // Domyślny widok na Polskę wschodnią / centralną
    const map = L.map(mapContainerRef.current, {
      center: [52.8, 22.0],
      zoom: 7,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [L]);

  // Renderowanie markerów gdy zmieniają się dokumenty lub zaznaczenia
  useEffect(() => {
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    const bounds = L.latLngBounds();

    // 1. Markery bazowe magazynów
    WAREHOUSE_COORDS.forEach(wh => {
      bounds.extend([wh.lat, wh.lng]);

      const whIcon = L.divIcon({
        className: 'custom-warehouse-marker',
        html: `
          <div style="
            background: ${wh.color};
            color: white;
            font-size: 11px;
            font-weight: bold;
            padding: 4px 8px;
            border-radius: 9999px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
            border: 2px solid white;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            🏢 ${wh.name}
          </div>
        `,
        iconSize: [140, 26],
        iconAnchor: [70, 13]
      });

      L.marker([wh.lat, wh.lng], { icon: whIcon, zIndexOffset: 1000 })
        .bindPopup(`<b>${wh.name}</b><br/>Baza transportowa Grupy Eltron`)
        .addTo(layer);
    });

    // 2. Markery dokumentów WZ
    const validDocs = documents.filter(d => d.latitude && d.longitude);

    // Grupowanie punktów o identycznych współrzędnych, żeby się nie nakładały
    const coordsMap = new Map();
    validDocs.forEach(doc => {
      const key = `${parseFloat(doc.latitude).toFixed(3)}_${parseFloat(doc.longitude).toFixed(3)}`;
      if (!coordsMap.has(key)) coordsMap.set(key, []);
      coordsMap.get(key).push(doc);
    });

    coordsMap.forEach((docsAtPoint, key) => {
      const first = docsAtPoint[0];
      const count = docsAtPoint.length;
      bounds.extend([first.latitude, first.longitude]);

      const hasSelected = docsAtPoint.some(d => selectedWzNumbers.includes(d.nr_wz));
      const allAssigned = docsAtPoint.every(d => d.status === 'przypisany');

      let bgColor = '#2563EB'; // Niebieski (nowy)
      if (hasSelected) {
        bgColor = '#16A34A'; // Zielony (zaznaczony)
      } else if (allAssigned) {
        bgColor = '#9333EA'; // Fioletowy (przypisany)
      }

      const markerHtml = `
        <div style="
          background-color: ${bgColor};
          color: white;
          width: ${count > 1 ? '32px' : '26px'};
          height: ${count > 1 ? '32px' : '26px'};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 3px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${count > 1 ? '11px' : '10px'};
          font-weight: 700;
          cursor: pointer;
          transform: ${hasSelected ? 'scale(1.2)' : 'scale(1)'};
          transition: transform 0.2s ease;
        ">
          ${count > 1 ? count : 'WZ'}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-wz-icon',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([first.latitude, first.longitude], {
        icon: customIcon,
        zIndexOffset: hasSelected ? 800 : 100
      });

      // Tworzenie treści Popup
      const popupContent = document.createElement('div');
      popupContent.className = 'p-1 text-sm max-w-xs';
      popupContent.innerHTML = `
        <div style="min-width: 200px;">
          <div style="font-weight: bold; font-size: 13px; color: #111827; margin-bottom: 4px;">
            ${docsAtPoint.map(d => d.nazwa_kontrahenta).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
          </div>
          <div style="font-size: 11px; color: #4B5563; margin-bottom: 6px;">
            📍 ${first.adres_dostawy || first.extracted_city || 'Brak dokładnego adresu'}
          </div>
          <div style="font-size: 11px; color: #1F2937; margin-bottom: 8px;">
            Magazyn: <b>${first.symbol_magazynu}</b> | Dokumentów: <b>${count}</b>
          </div>
          <div style="max-height: 140px; overflow-y: auto; margin-bottom: 8px; border-top: 1px solid #E5E7EB; padding-top: 6px;">
            ${docsAtPoint.map(d => {
              const isSel = selectedWzNumbers.includes(d.nr_wz);
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 11px;">
                  <span style="font-family: monospace; font-weight: 600;">${d.nr_wz}</span>
                  <span style="color: ${d.status === 'przypisany' ? '#9333EA' : '#2563EB'}; font-size: 10px; background: #F3F4F6; padding: 2px 6px; border-radius: 4px;">
                    ${d.status === 'przypisany' ? 'Transport #' + (d.transport_id || '') : 'Do zaplanowania'}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
          <button id="toggle-wz-btn" style="
            width: 100%;
            background-color: ${hasSelected ? '#DC2626' : '#2563EB'};
            color: white;
            border: none;
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            ${hasSelected ? '✕ Odznacz te punkty' : '✓ Zaznacz do transportu'}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById('toggle-wz-btn');
        if (btn && onToggleSelect) {
          btn.onclick = () => {
            docsAtPoint.forEach(d => onToggleSelect(d.nr_wz));
            map.closePopup();
          };
        }
      });

      marker.addTo(layer);
    });

    // Dopasowanie widoku do markerów
    if (bounds.isValid() && validDocs.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [L, documents, selectedWzNumbers, onToggleSelect]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className={className} />
      
      {/* Legenda mapy */}
      <div className="absolute bottom-4 right-4 z-[999] bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200 text-xs flex flex-col gap-1.5">
        <span className="font-semibold text-gray-800 text-[11px] uppercase tracking-wider mb-0.5">Legenda</span>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white shadow-sm inline-block"></span>
          <span className="text-gray-700">Do zaplanowania (Nowe)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-green-600 border border-white shadow-sm inline-block"></span>
          <span className="text-gray-700 font-medium">Zaznaczone do trasy</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-purple-600 border border-white shadow-sm inline-block"></span>
          <span className="text-gray-700">W transporcie</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-red-600 border border-white shadow-sm inline-block"></span>
          <span className="text-gray-700">Baza Białystok</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white shadow-sm inline-block"></span>
          <span className="text-gray-700">Baza Zielonka</span>
        </div>
      </div>
    </div>
  );
}
