// src/app/kalendarz/components/PackagingsList.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Package, RefreshCw } from 'lucide-react'
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function PackagingsList() {
  const [packagings, setPackagings] = useState([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [hoverPackagingId, setHoverPackagingId] = useState(null)

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

  return (
    <div className="mb-8 bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="p-3 bg-gradient-to-r from-blue-700 to-blue-800 text-white flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Package className="mr-2" size={18} />
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
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600 mb-2"></div>
              <div>Ładowanie opakowań...</div>
            </div>
          ) : packagings.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Brak opakowań do odbioru
            </div>
          ) : (
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
                            relative p-2 border rounded bg-blue-50 border-blue-200
                            ${snapshot.isDragging ? 'shadow-lg bg-blue-100' : 'hover:bg-blue-100'}
                            cursor-grab transition-all
                          `}
                          onMouseEnter={() => setHoverPackagingId(packaging.id)}
                          onMouseLeave={() => setHoverPackagingId(null)}
                        >
                          <div className="text-sm font-medium text-blue-800 truncate">
                            {packaging.city || 'Nieznane'}
                          </div>
                          
                          {/* Pokazujemy więcej informacji tylko przy najechaniu */}
                          {hoverPackagingId === packaging.id && (
                            <div className="absolute z-10 left-0 top-full mt-1 p-3 bg-white rounded-md shadow-lg border border-gray-200 w-64">
                              <h4 className="font-semibold mb-1">{packaging.client_name}</h4>
                              
                              <p className="text-xs text-gray-600 mb-2">
                                {packaging.city}{packaging.postal_code ? `, ${packaging.postal_code}` : ''}
                                {packaging.street ? `, ${packaging.street}` : ''}
                              </p>
                              
                              <div className="text-xs text-gray-700 max-h-28 overflow-y-auto">
                                {packaging.description?.split('\n').map((line, i) => 
                                  line.trim() && <p key={i} className="mb-1">{line}</p>
                                )}
                              </div>
                              
                              <div className="mt-2 text-xs text-blue-600 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                                Przeciągnij na datę
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
          )}
        </div>
      )}
    </div>
  )
}
