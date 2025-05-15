// src/app/kalendarz/components/SimpleCalendarGrid.js

import { useState } from 'react'
import { format, getDate } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Link2, ChevronRight, CheckCircle } from 'lucide-react'
import { KIEROWCY, POJAZDY } from '../constants'

export default function SimpleCalendarGrid({ 
  daysInMonth, 
  onDateSelect, 
  currentMonth, 
  transporty,
  filtryAktywne // Dodajemy props z filtrami
}) {
  const [selected, setSelected] = useState(null)
  const [hoverInfo, setHoverInfo] = useState(null)
  
  const handleClick = (day) => {
    setSelected(day)
    if (onDateSelect) {
      onDateSelect(day)
    }
  }
  
  // Funkcja do określania koloru na podstawie magazynu źródłowego
  const getMagazynColor = (zrodlo) => {
    if (zrodlo === 'bialystok') {
      return 'bg-red-100 text-red-800' 
    } else if (zrodlo === 'zielonka') {
      return 'bg-blue-100 text-blue-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  // Funkcja filtrująca transporty na podstawie aktywnych filtrów
  const filtrujTransporty = (transportyNaDzien) => {
    if (!transportyNaDzien || !Array.isArray(transportyNaDzien)) return [];
    
    return transportyNaDzien.filter(transport => {
      // Sprawdź czy transport jest zrealizowany
      const isCompleted = transport.status === 'completed' || transport.status === 'zakończony';
      
      // Jeśli transport jest zrealizowany i nie chcemy pokazywać zrealizowanych, odfiltrowujemy
      if (isCompleted && !filtryAktywne.pokazZrealizowane) {
        return false;
      }
      
      // Filtry magazynu, kierowcy i rynku
      const pasujeMagazyn = !filtryAktywne?.magazyn || transport.zrodlo === filtryAktywne.magazyn;
      const pasujeKierowca = !filtryAktywne.kierowca || parseInt(transport.kierowcaId) === filtryAktywne.kierowca;
      const pasujePojazd = !filtryAktywne.pojazd || 
                         parseInt(transport.pojazdId) === filtryAktywne.pojazd || 
                         (!transport.pojazdId && parseInt(transport.kierowcaId) === filtryAktywne.pojazd);
      const pasujeRynek = !filtryAktywne?.rynek || transport.rynek === filtryAktywne.rynek;
      
      return pasujeMagazyn && pasujeKierowca && pasujePojazd && pasujeRynek;
    });
  };

  // Funkcja pomocnicza sprawdzająca czy transport jest połączony
  const isConnectedTransport = (transport, allTransports) => {
    // Transport może mieć swój własny connected_transport_id
    if (transport.connected_transport_id) return true;
    
    // Lub być źródłem dla innego transportu
    return allTransports.some(t => t.connected_transport_id === transport.id);
  };
  
  // Funkcja pomocnicza znajdująca połączony transport
  const findConnectedTransport = (transport, allTransports) => {
    if (transport.connected_transport_id) {
      return allTransports.find(t => t.id === transport.connected_transport_id);
    }
    
    return allTransports.find(t => t.connected_transport_id === transport.id);
  };
  
  // Funkcje pomocnicze do wyświetlania informacji o kierowcy i pojeździe
  const getDriverName = (driverId) => {
    const driver = KIEROWCY.find(k => k.id === parseInt(driverId));
    return driver ? driver.imie : '';
  };

  // Ulepszona funkcja z kompatybilnością wsteczną
  const getVehicleNumber = (pojazdId, kierowcaId) => {
    // Najpierw sprawdzamy, czy mamy pojazdId
    if (pojazdId) {
      const pojazd = POJAZDY.find(p => p.id === parseInt(pojazdId));
      return pojazd ? pojazd.tabliceRej : '';
    }
    
    // Jeśli nie mamy pojazdId, ale mamy kierowcaId, użyjmy starego mapowania
    if (kierowcaId) {
      // W starym systemie id kierowcy odpowiadało id pojazdu
      const pojazd = POJAZDY.find(p => p.id === parseInt(kierowcaId));
      return pojazd ? pojazd.tabliceRej : '';
    }
    
    return '';
  };
  
  return (
    <div className="grid grid-cols-7 gap-2">
      {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'].map((day) => (
        <div key={day} className="text-center font-semibold p-2">
          {day}
        </div>
      ))}

      {daysInMonth.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd')
        const isCurrentMonth = format(day, 'M') === format(currentMonth, 'M')
        
        // Pobierz transporty dla danego dnia i filtruj je
        const transportyNaDzien = transporty[dateKey] || []
        const filtrowaneTransporty = filtrujTransporty(transportyNaDzien)
        
        return (
          <div
            key={dateKey}
            onClick={() => handleClick(day)}
            className={`
              p-4 border rounded-lg cursor-pointer
              ${selected && format(selected, 'yyyy-MM-dd') === dateKey ? 'ring-2 ring-blue-500' : ''}
              ${!isCurrentMonth ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-100'}
              min-h-[100px]
            `}
          >
            <div className={`font-medium ${!isCurrentMonth ? 'text-gray-400' : ''}`}>
              {getDate(day)}
            </div>
            
            {/* Obszar, na który można upuścić transport */}
            <Droppable droppableId={dateKey}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`mt-2 space-y-1 min-h-[20px] ${snapshot.isDraggingOver ? 'bg-blue-50 rounded p-1' : ''}`}
                >
                  {/* Wyświetlanie transportów z obsługą przeciągania */}
                  {filtrowaneTransporty.map((transport, index) => {
                    // Sprawdź, czy transport jest połączony z innym
                    const isConnected = isConnectedTransport(transport, transportyNaDzien);
                    const isSource = transportyNaDzien.some(t => t.connected_transport_id === transport.id);
                    const isTarget = transport.connected_transport_id !== null;
                    
                    // Sprawdź czy transport jest zrealizowany
                    const isCompleted = transport.status === 'completed' || transport.status === 'zakończony';
                    
                    return (
                      <Draggable 
                        key={transport.id} 
                        draggableId={transport.id.toString()} 
                        index={index}
                        isDragDisabled={isCompleted} // Wyłączamy możliwość przeciągania dla zrealizowanych
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`relative ${snapshot.isDragging ? 'opacity-50' : ''}`}
                            onMouseEnter={() => setHoverInfo(transport.id)}
                            onMouseLeave={() => setHoverInfo(null)}
                          >
                            <div className={`
                              text-xs px-2 py-1 rounded flex items-center justify-between
                              ${getMagazynColor(transport.zrodlo)}
                              ${isConnected ? 'border-l-4 border-blue-500' : ''}
                              ${isCompleted ? 'opacity-50' : ''}
                            `}>
                              <div className="flex items-center">
                                {isCompleted && (
                                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                                )}
                                {isConnected && !isCompleted && (
                                  <Link2 className="h-3 w-3 mr-1 text-blue-600" />
                                )}
                                <span>{transport.miasto}</span>
                              </div>
                              <span className="ml-1 text-xs opacity-75">
                                {getVehicleNumber(transport.pojazdId, transport.kierowcaId)}
                              </span>
                              {isSource && !isCompleted && (
                                <ChevronRight className="h-3 w-3 text-blue-600" />
                              )}
                            </div>
                            
                            {/* Tooltip (dymek) z dodatkowymi informacjami */}
                            {hoverInfo === transport.id && !snapshot.isDragging && (
                              <div className="absolute z-10 left-0 mt-1 w-48 bg-white rounded-md shadow-lg p-3 text-xs border border-gray-200">
                                <p className="font-semibold">{transport.nazwaKlienta || 'Brak nazwy klienta'}</p>
                                <p className="text-gray-600">{transport.osobaZlecajaca || 'Brak osoby odpowiedzialnej'}</p>
                                {transport.mpk && <p className="text-gray-600">MPK: {transport.mpk}</p>}
                                <div className="mt-1 pt-1 border-t border-gray-100">
                                  <p className="text-gray-500">{transport.ulica || ''}</p>
                                  <p className="text-gray-500">{transport.kodPocztowy} {transport.miasto}</p>
                                </div>
                                <div className="mt-1 pt-1 border-t border-gray-100">
                                  <p className="text-gray-600">Kierowca: {getDriverName(transport.kierowcaId)}</p>
                                  <p className="text-gray-600">Pojazd: {getVehicleNumber(transport.pojazdId, transport.kierowcaId)}</p>
                                </div>
                                {isCompleted && (
                                  <div className="mt-1 pt-1 border-t border-gray-100 text-green-600">
                                    <p className="font-medium">Transport zrealizowany</p>
                                  </div>
                                )}
                                {isConnected && (
                                  <div className="mt-1 pt-1 border-t border-gray-100 text-blue-600">
                                    <p className="font-medium">Transport połączony</p>
                                    {isSource ? 
                                      <p className="text-xs">Jest źródłem dla innego transportu</p> :
                                      <p className="text-xs">Połączony z innym transportem</p>
                                    }
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )
      })}
    </div>
  )
}
