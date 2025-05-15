// src/app/kalendarz/components/PackagingsList.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { Package, RefreshCw, MapPin, User, Phone, Calendar } from 'lucide-react'
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function PackagingsList() {
  const [packagings, setPackagings] = useState([])
  const [isExpanded, setIsExpanded] = useState(true)
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
  const handleShowDetails = (packaging) => {
    setActivePackaging(packaging)
    setIsDetailModalOpen(true)
  }

  // Funkcja do wyświetlania pierwszych n znaków z możliwością rozwinięcia
  const truncateText = (text, maxLength = 30) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  // Funkcja do wyodrębniania danych kontaktowych
  const extractContactInfo = (description) => {
    if (!description) return { contact: '', notes: '', packagingInfo: '' };
    
    const sections = {
      contact: '',
      notes: '',
      packagingInfo: ''
    };
    
    const lines = description.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      if (line.startsWith('Kontakt:')) {
        currentSection = 'contact';
        continue;
      } else if (line.startsWith('Uwagi:')) {
        currentSection = 'notes';
        continue;
      } else if (line.startsWith('Opakowania:')) {
        currentSection = 'packagingInfo';
        continue;
      }
      
      if (currentSection && line.trim()) {
        sections[currentSection] += sections[currentSection] ? `\n${line}` : line;
      }
    }
    
    return sections;
  }

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
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                >
                  {packagings.map((packaging, index) => {
                    const contactInfo = extractContactInfo(packaging.description);
                    
                    return (
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
                              relative p-3 border rounded
                              ${snapshot.isDragging ? 'shadow-lg bg-blue-100 z-10' : 'hover:bg-blue-50 bg-white'}
                              cursor-grab transition-all
                            `}
                            onClick={() => handleShowDetails(packaging)}
                            onMouseEnter={() => setHoverPackagingId(packaging.id)}
                            onMouseLeave={() => setHoverPackagingId(null)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-blue-800 truncate max-w-[80%]">
                                {packaging.client_name || 'Klient nieznany'}
                              </div>
                              <div className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-0.5 flex items-center">
                                <MapPin size={10} className="mr-1" />
                                {packaging.city || 'Nieznane'}
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-600">
                              {packaging.postal_code && (
                                <div className="mb-1">
                                  {packaging.postal_code}{packaging.street ? `, ${packaging.street}` : ''}
                                </div>
                              )}
                            </div>
                            
                            {contactInfo.packagingInfo && (
                              <div className="mt-2 text-xs">
                                <span className="font-medium text-gray-700">Opakowania: </span>
                                {truncateText(contactInfo.packagingInfo, 60)}
                              </div>
                            )}
                            
                            <div className="mt-2 text-xs text-blue-600 flex items-center justify-end">
                              <Package size={10} className="mr-1" />
                              <span>Przeciągnij na datę</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      )}
      
      {/* Modal ze szczegółami opakowania */}
      {isDetailModalOpen && activePackaging && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-xl w-full">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                {activePackaging.client_name || 'Klient nieznany'}
              </h3>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <MapPin size={16} className="text-blue-600 mr-2" />
                <div>
                  <span className="font-medium">Adres: </span>
                  {activePackaging.city}{activePackaging.postal_code ? `, ${activePackaging.postal_code}` : ''}
                  {activePackaging.street ? `, ${activePackaging.street}` : ''}
                </div>
              </div>
              
              {/* Wyświetlamy dane kontaktowe */}
              {(() => {
                const info = extractContactInfo(activePackaging.description);
                
                return (
                  <>
                    {info.contact && (
                      <div className="flex items-start mb-2">
                        <User size={16} className="text-blue-600 mr-2 mt-1" />
                        <div>
                          <div className="font-medium">Kontakt:</div>
                          <div className="whitespace-pre-line">{info.contact}</div>
                        </div>
                      </div>
                    )}
                    
                    {info.packagingInfo && (
                      <div className="flex items-start mb-2">
                        <Package size={16} className="text-blue-600 mr-2 mt-1" />
                        <div>
                          <div className="font-medium">Opakowania:</div>
                          <div className="whitespace-pre-line">{info.packagingInfo}</div>
                        </div>
                      </div>
                    )}
                    
                    {info.notes && (
                      <div className="flex items-start mb-2">
                        <Calendar size={16} className="text-blue-600 mr-2 mt-1" />
                        <div>
                          <div className="font-medium">Uwagi:</div>
                          <div className="whitespace-pre-line">{info.notes}</div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            
            <div className="bg-blue-50 rounded-md p-3 text-sm text-blue-700 mb-4">
              Aby zaplanować odbiór, przeciągnij opakowanie na datę w kalendarzu
            </div>
            
            <div className="text-right">
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
