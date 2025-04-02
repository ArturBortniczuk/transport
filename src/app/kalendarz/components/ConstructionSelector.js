'use client'
import { useState, useEffect } from 'react'

export default function ConstructionSelector({ value, onChange, className }) {
  const [constructions, setConstructions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    const fetchConstructions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/constructions');
        
        if (!response.ok) {
          throw new Error('Problem z pobraniem danych');
        }
        
        const data = await response.json();
        setConstructions(data.constructions || []);
      } catch (err) {
        setError('Nie udało się pobrać listy budów');
        console.error('Error fetching constructions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConstructions();
  }, []);

  const filteredConstructions = search.trim() === '' 
    ? constructions 
    : constructions.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.mpk.toLowerCase().includes(search.toLowerCase())
      );

  const handleSelect = (construction) => {
    onChange(construction);
    setShowDropdown(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="Wyszukaj budowę..."
          className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      
      {value && (
        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          <div className="font-medium">{value.name}</div>
          <div className="text-sm text-gray-600">MPK: {value.mpk}</div>
        </div>
      )}
      
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-2 text-center text-gray-500">Ładowanie...</div>
          ) : error ? (
            <div className="p-2 text-center text-red-500">{error}</div>
          ) : filteredConstructions.length === 0 ? (
            <div className="p-2 text-center text-gray-500">
              {search.trim() === '' ? 'Brak budów' : 'Nie znaleziono pasujących budów'}
            </div>
          ) : (
            filteredConstructions.map(construction => (
              <div
                key={construction.id}
                onClick={() => handleSelect(construction)}
                className="p-2 hover:bg-gray-100 cursor-pointer"
              >
                <div className="font-medium">{construction.name}</div>
                <div className="text-sm text-gray-500">MPK: {construction.mpk}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
