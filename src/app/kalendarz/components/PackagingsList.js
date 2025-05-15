// src/app/kalendarz/components/PackagingsList.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Package, RefreshCw, Info } from 'lucide-react'
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function PackagingsList() {
  const [packagings, setPackagings] = useState([])
  const [isExpanded, setIsExpanded] = useState(false) // Zmienione na false - domyślnie zwinięte
  const [isLoading, setIsLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [hoverPackagingId, setHoverPackagingId] = useState(null)
  const [activePackaging, setActivePackaging] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Pobierz opakowania
  const fetchPackagings = useCallback(async () => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/packagings?status=pending', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Problem z API: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setPackagings(data.packagings || [])
      } else {
        throw new Error(data.error || 'Błąd podczas pobierania opakowań')
      }
    } catch (error) {
      console.error('Błąd podczas pobierania opakowań:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Pobierz datę ostatniej synchronizacji
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
  }, [fetchPackagings, fetchLastSync])

  // Otwórz modal ze szczegółami
  const handleShowDetails = (packaging, e) => {
    e.stopPropagation(); // Zapobiegaj propagacji do handlera drag&drop
    setActivePackaging(packaging)
    setIsDetailModalOpen(true)
  }

  return (
    <div className="mb-4 bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="p-2 bg-gradient-to-r from-blue-700 to-blue-800 text-white flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Package className="mr-2" size={16} />
          <h3 className="text-base font-semibold">Opakowania do odbioru</h3>
          {lastSync && (
            <span className="ml-3 text-xs text-blue-200">
              Ostatnia synch.: {format(new Date(lastSync), 'dd.MM.yyyy HH:mm', { locale: pl })}
            </span>
          )}
        </div>
        <div className="flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchPackagings();
            }}
            className="mr-2 text-white p-1 hover:bg-blue-600 rounded"
            title="Odśwież listę"
          >
            <RefreshCw size={14} />
          </button>
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-xs mr-1">
            {packagings.length}
          </span>
          <span>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-3">
          {isLoading ? (
            <div className="text-center py-2">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600 mb-1"></div>
              <div className="text-sm">Ładowanie opakowań...</div>
            </div>
          ) : packagings.length === 0 ? (
            <div className="text-center py-2 text-gray-500 text-sm">
              Brak opakowań do odbioru
            </div>
          ) : (
            <Droppable droppableId="packagings-list">
              {(provided) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2"
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
                            relative p-2 border rounded text-xs
                            ${snapshot.isDragging ? 'shadow-lg bg-blue-100 z-10' : 'hover:bg-blue-50 bg-white'}
                            cursor-grab transition-all
                          `}
                        >
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-blue-800 truncate max-w-[70%]">
                              {packaging.client_name || 'Klient'}
                            </div>
                            <button
                              onClick={(e) => handleShowDetails(packaging, e)}
                              className="text-gray-400 hover:text-blue-600"
                              title="Pokaż szczegóły"
                            >
                              <Info size={12} />
                            </button>
                          </div>
                          
                          <div className="text-gray-600 truncate">
                            {packaging.city || 'Nieznane'}
                          </div>
                          
                          {packaging.description && (
                            <div className="mt-1 text-xs text-gray-500 truncate">
                              {packaging.description.substring(0, 25)}
                              {packaging.description.length > 25 && '...'}
                            </div>
                          )}
                          
                          <div className="mt-1 text-xxs text-blue-500 flex justify-end">
                            <span>⟳ Przeciągnij na datę</span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      )}
      
      {/* Modal ze szczegółami opakowania */}
      {isDetailModalOpen && activePackaging && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
             onClick={() => setIsDetailModalOpen(false)}>
          <div className="bg-white p-4 rounded-lg shadow-xl max-w-lg w-full" 
               onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {activePackaging.client_name || 'Klient nieznany'}
              </h3>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="mb-3">
              <div className="flex">
                <div className="font-medium">Adres:</div>
                <div className="ml-2">
                  {activePackaging.city}{activePackaging.postal_code ? `, ${activePackaging.postal_code}` : ''}
                  {activePackaging.street ? `, ${activePackaging.street}` : ''}
                </div>
              </div>
              
              {activePackaging.description && (
                <div className="mt-2">
                  <div className="font-medium">Informacje:</div>
                  <div className="whitespace-pre-line text-sm mt-1 bg-gray-50 p-2 rounded border">
                    {activePackaging.description}
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-right mt-3">
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
