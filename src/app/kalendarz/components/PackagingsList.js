// src/app/kalendarz/components/PackagingsList.js
'use client'
import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Package } from 'lucide-react'
import { getGoogleCoordinates } from '../../services/geocoding-google'

export default function PackagingsList({ onDragEnd }) {
  const [packagings, setPackagings] = useState([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
    fetchPackagings()
  }, [])

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

  return (
    <div className="mb-8 bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="p-4 bg-gradient-to-r from-blue-700 to-blue-800 text-white flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Package className="mr-2" size={20} />
          <h3 className="text-lg font-semibold">Opakowania do odbioru</h3>
        </div>
        <div>
          <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
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
            <div className="text-center py-4">Ładowanie opakowań...</div>
          ) : packagings.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Brak opakowań do odbioru
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="packagings-list">
                {(provided) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
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
                              p-4 border rounded-lg bg-blue-50 border-blue-200
                              ${snapshot.isDragging ? 'shadow-lg' : ''}
                            `}
                          >
                            <h4 className="font-medium">{packaging.client_name}</h4>
                            <p className="text-sm text-gray-600">
                              {packaging.city}, {packaging.postal_code}
                              {packaging.street && <span>, {packaging.street}</span>}
                            </p>
                            <p className="mt-2 text-sm text-gray-700">
                              {packaging.description}
                            </p>
                            <div className="mt-2 text-xs text-blue-600">
                              Przeciągnij na datę, aby zaplanować odbiór
                            </div>
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
        </div>
      )}
    </div>
  )
}
