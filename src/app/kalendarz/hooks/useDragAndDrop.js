// src/app/kalendarz/hooks/useDragAndDrop.js
'use client'
import { useCallback } from 'react'

export default function useDragAndDrop({ 
  handlePackagingDrop,
  handleTransportMove
}) {
  
  // Funkcja logująca dla debugowania drag & drop
  const logDragInfo = useCallback((result) => {
    console.log('DragDropContext result:', {
      draggableId: result.draggableId,
      source: result.source,
      destination: result.destination,
      type: result.type,
      mode: result.mode,
      reason: result.reason,
    });
  }, []);
  
  // Obsługa rozpoczęcia przeciągania
  const handleDragStart = useCallback((start) => {
    console.log('Drag started:', start);
  }, []);
  
  // Obsługa aktualizacji podczas przeciągania
  const handleDragUpdate = useCallback((update) => {
    console.log('Drag update:', update);
  }, []);
  
  // Obsługa zakończenia przeciągania
  const handleDragEnd = useCallback((result) => {
    console.log('Main DragDropContext onDragEnd:');
    logDragInfo(result);
    
    if (!result.destination) {
      console.log("Drag cancelled - no destination");
      return;
    }
    
    // Sprawdź typ przeciąganego elementu
    if (result.type === 'PACKAGING' || result.type === undefined) {
      // Znajdź opakowanie
      const packagingId = result.draggableId;
      const newDateKey = result.destination.droppableId;
      
      console.log(`Processing packaging drop: ${packagingId} to ${newDateKey}`);
      
      // Sprawdź czy to z listy opakowań do dnia
      if (result.source.droppableId === 'packagings-list') {
        // Pobierz dane opakowania z API
        fetch(`/api/packagings?id=${packagingId}`)
          .then(res => res.json())
          .then(data => {
            console.log('Fetched packaging data:', data);
            if (data.success && data.packaging) {
              // Wywołaj funkcję obsługi upuszczenia opakowania
              handlePackagingDrop(data.packaging, newDateKey);
            }
          })
          .catch(err => {
            console.error("Error fetching packaging details:", err);
          });
      }
    } else if (result.type === 'TRANSPORT') {
      // Obsługa dla transportów
      console.log('Processing transport drag and drop');
      
      // Znajdź transport
      const sourceDate = result.source.droppableId;
      const transportId = result.draggableId;
      const newDateKey = result.destination.droppableId;
      
      // Pobierz dane transportu i przenieś go
      fetch(`/api/transports?id=${transportId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.transport) {
            handleTransportMove(data.transport, newDateKey);
          }
        })
        .catch(err => {
          console.error("Error fetching transport details:", err);
        });
    }
  }, [logDragInfo, handlePackagingDrop, handleTransportMove]);

  return {
    handleDragStart,
    handleDragUpdate,
    handleDragEnd
  }
}