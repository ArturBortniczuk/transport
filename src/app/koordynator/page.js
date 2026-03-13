'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import dynamic from 'next/dynamic';
import { MapPin, FileSpreadsheet, Upload, Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

const MapKoordynatorWithNoSSR = dynamic(
  () => import('../../components/MapKoordynatorWithNoSSR'),
  { ssr: false, loading: () => (
    <div className="flex justify-center items-center h-full w-full bg-blue-50/50 rounded-xl">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )}
);

export default function KoordynatorPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Stan dla pliku i danych
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [groupedData, setGroupedData] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Stan dla filtrów
  const [filters, setFilters] = useState({
    jednostka: [],
    typ: [],
    magazyn: [],
    search: ''
  });
  
  // Opcje filtrów (wypełniane dynamicznie na podstawie danych)
  const [filterOptions, setFilterOptions] = useState({
    jednostki: [],
    typy: [],
    magazyny: []
  });

  // Autoryzacja
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (!data.isAuthenticated) {
          router.push('/login');
          return;
        }

        const role = data.user.role;
        const isAdmin = data.user.isAdmin === true || data.user.isAdmin === 'true' || data.user.role === 'admin';
        
        if (role !== 'koordynator' && !isAdmin) {
          router.push('/dashboard');
          return;
        }

        setUser(data.user);
      } catch (error) {
        console.error('Błąd weryfikacji użytkownika:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  // Obsługa przeciągania pliku
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelected(droppedFile);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Parsowanie CSV i wyciąganie danych
  const handleFileSelected = (selectedFile) => {
    if (!selectedFile.name.endsWith('.csv')) {
      alert('Proszę załączyć plik z rozszerzeniem .csv');
      return;
    }
    
    setFile(selectedFile);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";", // Wymuszamy podział po średnikach (standard z programów magazynowych PL)
      encoding: "windows-1250", // Kodowanie powszechne w polskich eksportach do excela, rozwiązuje problem 'krzaków'
      complete: (results) => {
        // Obiekty bezpośrednio z CSV, upewnijmy się, że klucze (nazwy z pierwszego wiersza) są zachowane
        const rawData = results.data;
        processData(rawData);
      },
      error: (error) => {
        console.error("Błąd podczas parsowania pliku CSV:", error);
        alert('Wystąpił błąd podczas odczytu pliku CSV.');
      }
    });
  };

  const extractAddress = (miejsceDostawy) => {
    if (!miejsceDostawy) return '';
    
    // Szukamy tekstu wewnątrz nawiasów kwadratowych [...]
    const match = miejsceDostawy.match(/\[(.*?)\]/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Zapasowo, jeśli nie ma nawiasów, zwracamy całość lub próbujemy inaczej (zostawmy puste na razie)
    return '';
  };

  const processData = (rawData) => {
    try {
      // 1. Standaryzacja i ekstrakcja danych z każdego wiersza
      const processedRows = rawData.map(row => {
        // Znalezienie prawidłowych kluczy ignorując wielkość znaków i białe znaki
        // Trimujemy klucze dla pewności (czasem wpadają z cudzysłowami ew. spacjami z CSV)
        const getColumn = (patterns) => {
          for (const pattern of patterns) {
            const key = Object.keys(row).find(k => 
              k.replace(/["'\s]/g, '').toLowerCase().includes(pattern.toLowerCase())
            );
            if (key) {
               // Usuwamy też ewentualne otaczające cudzysłowy ze środka samej string-wartości
               const val = row[key];
               return typeof val === 'string' ? val.replace(/^["']|["']$/g, '').trim() : val;
            }
          }
          return '';
        };

        const kontrahent = getColumn(['kontrahent', 'klient']);
        const jednostka = getColumn(['jednostka', 'lokalizacj']);
        const typ = getColumn(['typ', 'dokument']);
        const magazyn = getColumn(['magazyn', 'skład', 'sklad']);
        const numer = getColumn(['numer', 'wz']);
        const miejsceDostawy = getColumn(['miejsce', 'dostawy', 'adres']);
        
        const extractedAddress = extractAddress(miejsceDostawy);
        
        return {
          originalRow: row,
          kontrahent: kontrahent || 'Brak kontrahenta',
          jednostka: jednostka || 'Inna',
          typ: typ || 'Inny',
          magazyn: magazyn || 'Inny',
          numer: numer || 'Brak numeru',
          miejsceDostawy: miejsceDostawy,
          extractedAddress: extractedAddress
        };
      });

      setParsedData(processedRows);

      // 2. Budowanie opcji do filtrów
      const uniqueJednostki = [...new Set(processedRows.map(r => r.jednostka))].filter(Boolean);
      const uniqueTypy = [...new Set(processedRows.map(r => r.typ))].filter(Boolean);
      const uniqueMagazyny = [...new Set(processedRows.map(r => r.magazyn))].filter(Boolean);

      setFilterOptions({
        jednostki: uniqueJednostki.sort(),
        typy: uniqueTypy.sort(),
        magazyny: uniqueMagazyny.sort()
      });

      // 3. Grupowanie po kontrahencie
      groupData(processedRows, filters);
      
    } catch (err) {
      console.error("Błąd podczas przetwarzania danych:", err);
    }
  };

  const groupData = (dataToGroup, currentFilters) => {
    // Aplikowanie filtrów najpierw
    let filteredData = dataToGroup;
    
    if (currentFilters.jednostka.length > 0) {
      filteredData = filteredData.filter(row => currentFilters.jednostka.includes(row.jednostka));
    }
    
    if (currentFilters.typ.length > 0) {
      filteredData = filteredData.filter(row => currentFilters.typ.includes(row.typ));
    }
    
    if (currentFilters.magazyn.length > 0) {
      filteredData = filteredData.filter(row => currentFilters.magazyn.includes(row.magazyn));
    }
    
    if (currentFilters.search) {
      const searchLower = currentFilters.search.toLowerCase();
      filteredData = filteredData.filter(row => 
        row.kontrahent.toLowerCase().includes(searchLower) ||
        row.numer.toLowerCase().includes(searchLower) ||
        row.extractedAddress.toLowerCase().includes(searchLower)
      );
    }

    // Grupowanie
    const groups = {};
    
    filteredData.forEach(row => {
      const key = row.kontrahent;
      if (!groups[key]) {
        groups[key] = {
          kontrahent: key,
          numery: [],
          adresy: new Set(),
          wiersze: [] // Wszystkie oryginalne i ułożone wiersze dla tego kontrahenta
        };
      }
      
      if (row.numer && !groups[key].numery.includes(row.numer)) {
        groups[key].numery.push(row.numer);
      }
      
      if (row.extractedAddress) {
        groups[key].adresy.add(row.extractedAddress);
      }
      
      groups[key].wiersze.push(row);
    });

    // Przekształcenie obiektu w tablicę i sortowanie
    const groupedArray = Object.values(groups).map(group => ({
      ...group,
      adresyArray: Array.from(group.adresy) // Set to Array
    })).sort((a, b) => a.kontrahent.localeCompare(b.kontrahent));

    setGroupedData(groupedArray);
  };

  // Obsługa zmiany filtrów
  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const current = prev[filterType];
      const updated = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
        
      const newFilters = { ...prev, [filterType]: updated };
      
      // Od razu zaktualizuj zgrupowane dane
      if (parsedData.length > 0) {
        groupData(parsedData, newFilters);
      }
      
      return newFilters;
    });
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setFilters(prev => {
      const newFilters = { ...prev, search: value };
      if (parsedData.length > 0) {
        groupData(parsedData, newFilters);
      }
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    const cleared = {
      jednostka: [],
      typ: [],
      magazyn: [],
      search: ''
    };
    setFilters(cleared);
    if (parsedData.length > 0) {
      groupData(parsedData, cleared);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileSpreadsheet className="w-8 h-8 mr-3 text-blue-600" />
              Panel Koordynatora Transportu
            </h1>
            <p className="text-gray-500 mt-1">
              Wczytaj plik CSV z listą dokumentów, grupuj WZ i wyświetlaj na mapie
            </p>
          </div>
          
          {file && (
            <button 
              onClick={() => {
                setFile(null);
                setParsedData([]);
                setGroupedData([]);
              }}
              className="text-sm px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium flex items-center"
            >
              <X className="w-4 h-4 mr-2" /> Wyczyść dane
            </button>
          )}
        </div>

        {!file ? (
          /* Strefa D&D */
          <div 
            className={`
              mt-8 bg-white p-12 rounded-xl border-2 border-dashed
              flex flex-col items-center justify-center text-center transition-all
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="bg-blue-100 p-4 rounded-full mb-4">
              <Upload className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Przeciągnij i upuść plik CSV</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Zaznacz lub upuść tutaj plik typu CSV zawierający numery WZ, kontrahentów oraz miejsca dostawy podane w nawiasach kwadratowych.
            </p>
            
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm">
              Wybierz plik z komputera
              <input 
                type="file" 
                className="hidden" 
                accept=".csv"
                onChange={handleFileInput}
              />
            </label>
          </div>
        ) : (
          /* Panel danych */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Lewa kolumna: Filtry */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4 border-b pb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <Filter className="w-5 h-5 mr-2 text-gray-500" /> Filtracja
                  </h3>
                  {(filters.jednostka.length > 0 || filters.typ.length > 0 || filters.magazyn.length > 0 || filters.search) && (
                    <button onClick={clearAllFilters} className="text-xs text-blue-600 hover:underline">
                      Wyczyść
                    </button>
                  )}
                </div>

                {/* Szukaj */}
                <div className="mb-6 relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={handleSearchChange}
                    placeholder="Szukaj kontrahenta, WZ..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm"
                  />
                </div>

                {/* Sekcje filtrów */}
                <FilterSection 
                  title="Jednostka lokalizacji" 
                  options={filterOptions.jednostki} 
                  selected={filters.jednostka} 
                  onToggle={(val) => toggleFilter('jednostka', val)} 
                />
                
                <FilterSection 
                  title="Typ dokumentu" 
                  options={filterOptions.typy} 
                  selected={filters.typ} 
                  onToggle={(val) => toggleFilter('typ', val)} 
                />
                
                <FilterSection 
                  title="Magazyn" 
                  options={filterOptions.magazyny} 
                  selected={filters.magazyn} 
                  onToggle={(val) => toggleFilter('magazyn', val)} 
                />

              </div>
              
              {/* Statystyki */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-800 mb-4 border-b pb-4">Podsumowanie</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unikalni kontrahenci:</span>
                    <span className="font-semibold text-gray-900">{groupedData.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ilość dokumentów:</span>
                    <span className="font-semibold text-blue-600">
                      {groupedData.reduce((acc, curr) => acc + curr.numery.length, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Prawa kolumna: Mapa (Placeholder) i Tabela */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Tutaj miejsce na mapę z markerami */}
              <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 h-[500px] relative overflow-hidden">
                 {groupedData.length > 0 ? (
                    <MapKoordynatorWithNoSSR 
                      locations={Array.from(new Set(groupedData.flatMap(group => group.adresyArray)))} 
                    />
                 ) : (
                   <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center text-gray-500">
                      <MapPin className="w-12 h-12 mb-3 text-gray-400 opacity-60" />
                      <h3 className="text-lg font-medium">Brak punktów do wyświetlenia</h3>
                      <p className="text-sm mt-1">Wczytaj plik, lub zmień kryteria filtru</p>
                   </div>
                 )}
              </div>

              {/* Tabela zgrupowanych wyników */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-800">Zgrupowane zlecenia ({groupedData.length})</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-6 py-3 font-medium">Kontrahent</th>
                        <th className="px-6 py-3 font-medium">Dokumenty powiązane</th>
                        <th className="px-6 py-3 font-medium">Wyciągnięte adresy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupedData.length > 0 ? (
                        groupedData.map((group, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900 border-r border-gray-50">
                              {group.kontrahent} 
                              <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500 font-normal">
                                {group.wiersze.length} poz.
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {group.numery.map((numer, nIdx) => (
                                  <span key={nIdx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                    {numer}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                {group.adresyArray.length > 0 ? (
                                  group.adresyArray.map((adres, aIdx) => (
                                    <div key={aIdx} className="flex items-center text-gray-600 text-xs">
                                      <MapPin className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                                      <span className="truncate max-w-xs" title={adres}>{adres}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-xs italic">Brak sprecyzowanego adresu w nawiasach []</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                            Brak wyników spełniających kryteria filtrowania.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}

// Komponent pomocniczy dla sekcji filtrowania
function FilterSection({ title, options, selected, onToggle }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!options || options.length === 0) return null;

  return (
    <div className="mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full justify-between items-center py-2 text-sm font-medium text-gray-700 hover:text-blue-600"
      >
        <span>{title} {selected.length > 0 && `(${selected.length})`}</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {options.map((option, idx) => (
            <label key={idx} className="flex items-start cursor-pointer group">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onToggle(option)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
              </div>
              <div className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 break-words w-full">
                {option}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
