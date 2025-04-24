// src/app/kalendarz/components/PackagingsList.js
'use client'
import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Package } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export default function PackagingsList({ onDragEnd }) {
  const [packagings, setPackagings] = useState([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [hoverPackaging, setHoverPackaging] = useState(null)

  // Pobierz opakowania
  const fetchPackagings = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/packagings?status=pending')
      const data = await response.json()
      
      if (data.success) {
        setPackagings(data.packagings || [])
      } else {
        console.error('Błąd podczas pobierania opakowań:', data.error)
      }
    } catch (error) {
      console.error('Błąd podczas komunikacji z API:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Pobierz opakowania przy montowaniu komponentu
  useEffect(() => {
    fetchPackagings();
    
    const fetchLastSync = async () => {
      try {
        const response = await fetch('/api/packagings/last-sync');
        const data = await response.json();
        
        if (data.success && data.lastSync) {
          setLastSync(new Date(data.lastSync));
        }
      } catch (error) {
        console.error('Błąd pobierania informacji o synchronizacji:', error);
      }
    };
    
    fetchLastSync();
  }, []);

  // Obsługa przeciągania
  const handleDragEnd = (result) => {
    // Jeśli upuszczono poza celem, nic nie rób
    if (!result.destination) return
    
    // Znajdź przeciągnięte opakowanie
    const draggedPackaging = packagings.find(
      pkg => pkg.id.toString() === result.draggableId
    )
    
    if (draggedPackaging && onDragEnd) {
      onDragEnd(draggedPackaging, result.destination.droppableId)
    }
  }

  // Funkcja pomocnicza do formatowania opisu opakowania
  const formatDescription = (desc) => {
    if (!desc) return '';
    // Ogranicz opis do 50 znaków
    return desc.length > 50 ? desc.substring(0, 50) + '...' : desc;
  }

  return (
    <div className="mb-8 bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="p-3 bg-gradient-to-r from-blue-700 to-blue-800 text-white flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Package className="mr-2" size={18} />
          <h3 className="font-semibold">Opakowania do odbioru</h3>
        </div>
        <div className="flex items-center">
          {lastSync && (
            <span className="text-xs text-blue-200 mr-2">
              Ostatnia synchronizacja: {format(lastSync, 'dd.MM.yyyy', {locale: pl})}
            </span>
          )}
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs">
            {packagings.length}
          </span>
          <span className="ml-2">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-2 text-sm">Ładowanie opakowań...</div>
          ) : packagings.length === 0 ? (
            <div className="text-center py-2 text-sm text-gray-500">
              Brak opakowań do odbioru
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="packagings-list">
                {(provided) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
                  >
                    {packagings.map((packaging, index) => (
                      <Draggable
                        key={packaging.id}
                        draggableId={packaging.id.toString()}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`
                              p-2 border rounded-md bg-gray-900 border-gray-700 relative text-white
                              ${snapshot.isDragging ? 'shadow-lg' : ''}
                              hover:bg-gray-800 transition-colors
                            `}
                            onMouseEnter={() => setHoverPackaging(packaging.id)}
                            onMouseLeave={() => setHoverPackaging(null)}
                          >
                            <h4 className="font-medium text-sm truncate">{packaging.client_name}</h4>
                            <p className="text-xs text-gray-300 truncate">
                              {packaging.city}
                            </p>
                            
                            {/* Tooltip z dodatkowymi informacjami */}
                            {hoverPackaging === packaging.id && (
                              <div className="absolute z-10 left-0 top-full mt-1 w-64 bg-white rounded-md shadow-lg p-3 text-xs border border-gray-200">
                                <p className="font-semibold">{packaging.client_name}</p>
                                <p className="text-gray-600">
                                  {packaging.city}, {packaging.postal_code}
                                  {packaging.street && <span>, {packaging.street}</span>}
                                </p>
                                <div className="mt-1 text-gray-700 border-t pt-1">
                                  {packaging.description}
                                </div>
                                <div className="mt-1 text-blue-600">
                                  Przeciągnij na datę, aby zaplanować odbiór
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
          
          <div className="mt-3 flex justify-end">
            <button
              onClick={fetchPackagings}
              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
            >
              Odśwież listę
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
