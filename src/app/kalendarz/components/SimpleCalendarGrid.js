'use client'
import { useState } from 'react'
import { format, getDate } from 'date-fns'
import { pl } from 'date-fns/locale'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Link2, ChevronRight } from 'lucide-react'

export default function SimpleCalendarGrid({ 
  daysInMonth, 
  onDateSelect, 
  currentMonth, 
  transporty,
  onTransportMove,
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

  // Funkcja filtrująca transporty na podstawie aktywnych filtrów - poprawiona
  const filtrujTransporty = (transportyNaDzien) => {
    if (!transportyNaDzien || !Array.isArray(transportyNaDzien)) return [];
    
    return transportyNaDzien.filter(transport => {
      // Upewnij się, że transporty ze statusem 'completed' są filtrowane
      if (transport.status === 'completed' || transport.status === 'zakończony') {
        return false;
      }
      
      // Sprawdź czy transport jest aktywny
      const isActive = transport.status === 'aktywny' || transport.status === 'active';
      if (!isActive) {
        return false;
      }
      
      // Filtry magazynu, kierowcy i rynku
      const pasujeMagazyn = !filtryAktywne?.magazyn || transport.zrodlo === filtryAktywne.magazyn;
      const pasujeKierowca = !filtryAktywne?.kierowca || transport.kierowcaId === filtryAktywne.kierowca;
      const pasujeRynek = !filtryAktywne?.rynek || transport.rynek === filtryAktywne.rynek;
      
      return pasujeMagazyn && pasujeKierowca && pasujeRynek;
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

  // Obsługa zakończenia przeciągania
  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result

    // Jeśli przeciągnięto poza obszar docelowy lub do tego samego miejsca
    if (!destination || (
      destination.droppableId === source.droppableId
    )) {
      return
    }

    // Pobierz transport przez ID
    const sourceDate = source.droppableId
    const sourceTransports = transporty[sourceDate] || []
    const transportIndex = sourceTransports.findIndex(t => t.id.toString() === draggableId)
    
    if (transportIndex === -1) return
    
    // Wywołaj callback z informacją o przeniesieniu
    const transport = sourceTransports[transportIndex]
    
    // Sprawdź, czy transport jest częścią połączonej trasy
    if (isConnectedTransport(transport, sourceTransports)) {
      // Jeśli to połączony transport, najpierw zapytaj użytkownika, czy chce przenieść wszystkie
      if (confirm("Ten transport jest częścią połączonej trasy. Czy chcesz przenieść wszystkie połączone transporty?")) {
        // Znajdź wszystkie powiązane transporty
        const connectedTransport = findConnectedTransport(transport, sourceTransports);
        if (connectedTransport) {
          // Przenieś główny transport
          onTransportMove(transport, destination.droppableId);
          
          // Przenieś połączony transport
          setTimeout(() => {
            onTransportMove(connectedTransport, destination.droppableId);
          }, 100);
        } else {
          // Jeśli nie znaleziono połączonego transportu, przenieś tylko ten
          onTransportMove(transport, destination.droppableId);
        }
      } else if (confirm("Czy chcesz rozłączyć transport przed przeniesieniem?")) {
        // Rozłącz transport i przenieś tylko ten
        fetch('/api/transports/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transportId: transport.id
          })
        }).then(response => response.json())
          .then(data => {
            if (data.success) {
              // Przeniesienie po rozłączeniu
              onTransportMove(transport, destination.droppableId);
            } else {
              alert("Nie udało się rozłączyć transportu: " + (data.error || "Nieznany błąd"));
            }
          })
          .catch(error => {
            console.error("Błąd podczas rozłączania transportu:", error);
            alert("Wystąpił błąd podczas rozłączania transportu");
          });
      }
    } else {
      // Jeśli to pojedynczy transport, po prostu go przenieś
      onTransportMove(transport, destination.droppableId);
    }
  }
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
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
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="mt-2 space-y-1 min-h-[20px]"
                  >
                    {/* Wyświetlanie transportów z obsługą przeciągania */}
                    {filtrowaneTransporty.map((transport, index) => {
                      // Sprawdź, czy transport jest połączony z innym
                      const isConnected = isConnectedTransport(transport, transportyNaDzien);
                      const isSource = transportyNaDzien.some(t => t.connected_transport_id === transport.id);
                      const isTarget = transport.connected_transport_id !== null;
                      
                      return (
                        <Draggable 
                          key={transport.id} 
                          draggableId={transport.id.toString()} 
                          index={index}
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
                              `}>
                                <div className="flex items-center">
                                  {isConnected && (
                                    <Link2 className="h-3 w-3 mr-1 text-blue-600" />
                                  )}
                                  <span>{transport.miasto}</span>
                                </div>
                                {isSource && (
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
    </DragDropContext>
  )
}
