// src/app/kalendarz/components/PackagingsList.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Package, RefreshCw } from 'lucide-react'
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function PackagingsList({ onDragEnd }) {
  const [packagings, setPackagings] = useState([])
  const [isExpanded, setIsExpanded] = useState(true) // Rozwijamy domyślnie
  const [isLoading, setIsLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [error, setError] = useState(null)

  // Pobierz opakowania
  const fetchPackagings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.log('Pobieranie opakowań z API...')
      const response = await fetch('/api/packagings?status=pending', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Problem z API: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Odpowiedź z API opakowań:', data)
      
      if (data.success) {
        console.log(`Pobrano ${data.packagings?.length || 0} opakowań`)
        setPackagings(data.packagings || [])
      } else {
        throw new Error(data.error || 'Błąd podczas pobierania opakowań')
      }
    } catch (error) {
      console.error('Błąd podczas pobierania opakowań:', error)
      setError(`Błąd: ${error.message}`)
      setPackagings([]) // Reset packagings on error
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  // Pobranie informacji o ostatniej synchronizacji
  const fetchLastSync = useCallback(async () => {
    try {
      const response = await fetch('/api/packagings/last-sync')
      const data = await response.json()
      
      if (data.success && data.lastSync) {
        setLastSync(new Date(data.lastSync))
      }
    } catch (error) {
      console.error('Błąd pobierania informacji o synchronizacji:', error)
    }
  }, [])

  // Pobierz opakowania przy montowaniu komponentu
  useEffect(() => {
    fetchPackagings()
    fetchLastSync()
    
    // Opcjonalnie: odświeżaj listę co jakiś czas
    const intervalId = setInterval(() => {
      fetchPackagings()
    }, 300000) // co 5 minut
    
    return () => clearInterval(intervalId)
  }, [fetchPackagings, fetchLastSync])

  // Funkcja do formatowania opisu opakowania
  const formatPackagingDescription = (description) => {
    if (!description) return 'Brak danych'
    
    // Skróć długie opisy
    if (description.length > 100) {
      return description.substring(0, 100) + '...'
    }
    
    return description
  }

  // Obsługa przeciągania
  const handleDragEnd = (result) => {
    // Jeśli upuszczono poza celem, nic nie rób
    if (!result.destination) return
    
    console.log('Przeciągnięto opakowanie:', result)
    
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
          {lastSync && (
            <span className="ml-3 text-xs text-blue-200">
              Ostatnia synch.: {format(new Date(lastSync), 'dd.MM.yyyy HH:mm', { locale: pl })}
            </span>
          )}
        </div>
        <div className="flex items-center">
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Powstrzymaj rozwijanie/zwijanie przy kliknięciu przycisku
              fetchPackagings();
            }}
            className="mr-3 text-white p-1 rounded hover:bg-blue-600 transition-colors"
            title="Odśwież listę opakowań"
          >
            <RefreshCw size={16} />
          </button>
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
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mb-2"></div>
              <div>Ładowanie opakowań...</div>
            </div>
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
                              p-4 border rounded-lg bg-blue-50 border-blue-200 hover:shadow-md
                              ${snapshot.isDragging ? 'shadow-lg bg-blue-100' : ''}
                              cursor-grab
                            `}
                          >
                            <h4 className="font-medium text-blue-800">{packaging.client_name}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {packaging.city}, {packaging.postal_code}
                              {packaging.street && <span>, {packaging.street}</span>}
                            </p>
                            <p className="mt-2 text-sm text-gray-700">
                              {formatPackagingDescription(packaging.description)}
                            </p>
                            <div className="mt-2 text-xs text-blue-600 flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
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
