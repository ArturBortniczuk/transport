// src/app/admin/packagings/page.js
'use client'
import { useState, useEffect } from 'react'
import AdminCheck from '@/components/AdminCheck'

export default function PackagingsAdminPage() {
  const [mapId, setMapId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [packagings, setPackagings] = useState([])
  const [isLoadingPackagings, setIsLoadingPackagings] = useState(false)
  const [expandedPackaging, setExpandedPackaging] = useState(null)

  // Funkcja do pobierania listy opakowań
  const fetchPackagings = async () => {
    try {
      setIsLoadingPackagings(true)
      const response = await fetch('/api/packagings')
      const data = await response.json()
      
      if (data.success) {
        setPackagings(data.packagings)
      } else {
        console.error('Błąd pobierania opakowań:', data.error)
      }
    } catch (error) {
      console.error('Błąd podczas komunikacji z API:', error)
    } finally {
      setIsLoadingPackagings(false)
    }
  }

  // Pobierz opakowania przy montowaniu komponentu
  useEffect(() => {
    fetchPackagings()
  }, [])

  // Funkcja do synchronizacji z MyMaps
  const handleSync = async () => {
    try {
      setIsLoading(true)
      setSyncResult(null)
      
      const response = await fetch('/api/packagings/sync-mymaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mapId: mapId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSyncResult({
          status: 'success',
          message: data.message,
          details: data.results
        })
        
        // Odśwież listę opakowań
        fetchPackagings()
      } else {
        setSyncResult({
          status: 'error',
          message: data.error || 'Wystąpił błąd podczas synchronizacji'
        })
      }
    } catch (error) {
      console.error('Błąd podczas synchronizacji:', error)
      setSyncResult({
        status: 'error',
        message: 'Wystąpił błąd podczas komunikacji z serwerem'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Funkcja do usuwania opakowań
  const handleDeletePackaging = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć to opakowanie?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/packagings?id=${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('Opakowanie zostało usunięte')
        fetchPackagings()
      } else {
        alert(`Błąd: ${data.error || 'Nie udało się usunąć opakowania'}`)
      }
    } catch (error) {
      console.error('Błąd podczas usuwania opakowania:', error)
      alert('Wystąpił błąd podczas komunikacji z serwerem')
    }
  }

  // Funkcja do formatowania informacji o opakowaniach
  const formatPackagingInfo = (description) => {
    if (!description) return null;
    
    // Podziel opis na sekcje
    const sections = {
      'Uwagi': [],
      'Adres': [],
      'Kontakt': [],
      'Opakowania': []
    };
    
    const lines = description.split('\n');
    
    let currentSection = null;
    
    for (const line of lines) {
      // Sprawdź czy linia zaczyna się od nazwy sekcji
      if (line.startsWith('Uwagi:')) {
        currentSection = 'Uwagi';
        // Nie dodawaj samego nagłówka "Uwagi:" do zawartości
        continue;
      } else if (line.startsWith('Adres:')) {
        currentSection = 'Adres';
        // Nie dodawaj samego nagłówka "Adres:" do zawartości
        continue;
      } else if (line.startsWith('Kontakt:')) {
        currentSection = 'Kontakt';
        // Nie dodawaj samego nagłówka "Kontakt:" do zawartości
        continue;
      } else if (line.startsWith('Opakowania:')) {
        currentSection = 'Opakowania';
        // Nie dodawaj samego nagłówka "Opakowania:" do zawartości
        continue;
      }
      
      // Jeśli mamy aktualną sekcję i linia nie jest pusta, dodaj ją
      if (currentSection && line.trim()) {
        sections[currentSection].push(line.trim());
      }
    }
    
    // Usuń puste sekcje
    Object.keys(sections).forEach(key => {
      if (sections[key].length === 0) {
        delete sections[key];
      }
    });
    
    return sections;
  }
  
  // Formatowanie wyświetlania opakowań
  const renderPackagingDetails = (packaging) => {
    const info = formatPackagingInfo(packaging.description);
    
    return (
      <div className="p-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Adres:</h4>
            <p className="mb-1">
              {packaging.city}, {packaging.postal_code}
            </p>
            {packaging.street && <p className="mb-1">{packaging.street}</p>}
            
            {info && info['Kontakt'] && info['Kontakt'].length > 0 && (
              <>
                <h4 className="font-semibold text-gray-700 mt-4 mb-2">Kontakt:</h4>
                {info['Kontakt'].map((line, i) => (
                  <p key={i} className="mb-1">{line}</p>
                ))}
              </>
            )}
          </div>
          
          <div>
            {info && info['Opakowania'] && info['Opakowania'].length > 0 && (
              <>
                <h4 className="font-semibold text-gray-700 mb-2">Opakowania:</h4>
                {info['Opakowania'].map((line, i) => (
                  <p key={i} className="mb-1">{line}</p>
                ))}
              </>
            )}
            
            {info && info['Uwagi'] && info['Uwagi'].length > 0 && (
              <>
                <h4 className="font-semibold text-gray-700 mt-4 mb-2">Uwagi:</h4>
                {info['Uwagi'].filter(line => 
                  // Filtrujemy linie zawierające adres, który już wyświetlamy w sekcji Adres
                  !line.includes(packaging.city) && 
                  !line.includes(packaging.postal_code) && 
                  !line.includes(packaging.street) &&
                  !line.startsWith('od ') // Zakładam, że linie zaczynające się od "od " zwykle zawierają daty
                ).map((line, i) => (
                  <p key={i} className="mb-1">{line}</p>
                ))}
              </>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setExpandedPackaging(null)}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Zwiń szczegóły
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminCheck>
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Zarządzanie opakowaniami do odbioru
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Synchronizacja z Google MyMaps</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Mapy Google MyMaps
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={mapId}
                  onChange={(e) => setMapId(e.target.value)}
                  placeholder="np. 1BpEawKzzJKMQR-HQm8BwzU0ellzB1WXM"
                  className="flex-1 rounded-l-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleSync}
                  disabled={isLoading || !mapId}
                  className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isLoading ? 'Synchronizacja...' : 'Synchronizuj'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                ID mapy znajdziesz w URL MyMaps: https://www.google.com/maps/d/edit?mid=YOUR_MAP_ID_HERE
              </p>
            </div>
            
            {syncResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                syncResult.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <h3 className={`font-medium ${
                  syncResult.status === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {syncResult.status === 'success' ? 'Synchronizacja zakończona pomyślnie' : 'Błąd synchronizacji'}
                </h3>
                <p className={syncResult.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {syncResult.message}
                </p>
                {syncResult.details && (
                  <ul className="mt-2 list-disc list-inside text-sm">
                    <li>Dodano: {syncResult.details.added}</li>
                    <li>Zaktualizowano: {syncResult.details.updated}</li>
                    <li>Błędy: {syncResult.details.errors}</li>
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            Lista opakowań do odbioru ({packagings.length})
          </h2>
          
          {isLoadingPackagings ? (
            <div className="text-center py-4">Ładowanie opakowań...</div>
          ) : packagings.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Brak opakowań do odbioru
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {packagings.map((packaging) => (
                <div key={packaging.id} className="border-b border-gray-200 last:border-b-0">
                  <div 
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      expandedPackaging === packaging.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setExpandedPackaging(expandedPackaging === packaging.id ? null : packaging.id)}
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{packaging.client_name}</h3>
                      <p className="text-sm text-gray-600">
                        {packaging.city}, {packaging.postal_code}
                        {packaging.street ? `, ${packaging.street}` : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        packaging.status === 'completed' ? 'bg-green-100 text-green-800' :
                        packaging.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {packaging.status === 'completed' ? 'Zrealizowane' :
                        packaging.status === 'scheduled' ? 'Zaplanowane' :
                        'Oczekujące'}
                      </span>
                      
                      {packaging.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePackaging(packaging.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Usuń
                        </button>
                      )}
                      
                      <button
                        className="text-gray-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPackaging(expandedPackaging === packaging.id ? null : packaging.id);
                        }}
                      >
                        {expandedPackaging === packaging.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {expandedPackaging === packaging.id && renderPackagingDetails(packaging)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminCheck>
  );
}
