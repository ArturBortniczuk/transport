'use client'
import { useState, useEffect } from 'react'

export default function LocationSelector({ onSelect, onClose }) {
  const [locations, setLocations] = useState([])
  const [filteredLocations, setFilteredLocations] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Wczytaj zapisane lokalizacje przy inicjalizacji
  useEffect(() => {
    const loadLocations = () => {
      setIsLoading(true)
      try {
        // Pobierz lokalizacje z localStorage
        const savedLocations = localStorage.getItem('savedLocations')
        if (savedLocations) {
          const parsedLocations = JSON.parse(savedLocations)
          setLocations(parsedLocations)
          setFilteredLocations(parsedLocations)
        }
      } catch (error) {
        console.error('Błąd podczas wczytywania lokalizacji:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLocations()
  }, [])

  // Filtrowanie lokalizacji na podstawie wyszukiwania
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLocations(locations)
    } else {
      const filtered = locations.filter(location => 
        location.miasto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.kodPocztowy.includes(searchTerm) ||
        (location.ulica && location.ulica.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredLocations(filtered)
    }
  }, [searchTerm, locations])

  const handleSelect = (location) => {
    onSelect(location)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">Wybierz lokalizację</h2>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Szukaj po mieście, kodzie pocztowym lub ulicy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">Ładowanie lokalizacji...</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {filteredLocations.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {filteredLocations.map((location, index) => (
                  <div 
                    key={index}
                    onClick={() => handleSelect(location)}
                    className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <div className="font-medium">{location.miasto} ({location.kodPocztowy})</div>
                    {location.ulica && <div className="text-gray-600">{location.ulica}</div>}
                    <div className="text-sm text-gray-500 mt-1">
                      Klient: {location.nazwaKlienta || 'Brak danych'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                {searchTerm ? 'Nie znaleziono pasujących lokalizacji' : 'Brak zapisanych lokalizacji'}
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 mr-2 hover:bg-gray-100"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  )
}
