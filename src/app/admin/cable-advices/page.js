'use client'
import { useState, useEffect } from 'react';
import AdminCheck from '@/components/AdminCheck';
import Link from 'next/link';

export default function CableDictionariesPage() {
  const [dictionaries, setDictionaries] = useState([]);
  const [cablesCatalog, setCablesCatalog] = useState({ all: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('cables');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // For standard dicts
  const [newValue, setNewValue] = useState('');
  // For cables
  const [newCableName, setNewCableName] = useState('');
  const [newCableCrossSection, setNewCableCrossSection] = useState('');
  
  const [importing, setImporting] = useState(false);

  const tabs = [
    { id: 'cables', name: 'Kable' },
    { id: 'supplier', name: 'Dostawcy' },
    { id: 'unloading_place', name: 'Miejsca rozładunku' },
    { id: 'order_type', name: 'Typy zamówienia' },
    { id: 'cable_voltage', name: 'Napięcie kabla' },
    { id: 'cable_guidelines', name: 'Wytyczne kabla' },
    { id: 'warehouse', name: 'Magazyn docelowy' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dictRes, cablesRes] = await Promise.all([
        fetch('/api/cable-dictionaries'),
        fetch('/api/cables-catalog')
      ]);
      if (!dictRes.ok) throw new Error('Nie udało się pobrać słowników');
      const dictData = await dictRes.json();
      setDictionaries(dictData);
      
      if (cablesRes.ok) {
        const cablesData = await cablesRes.json();
        setCablesCatalog(cablesData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      const res = await fetch('/api/cables-catalog/import', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nie udało się zaimportować');
      alert(data.message);
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      if (selectedTab === 'cables') {
        if (!newCableName.trim() || !newCableCrossSection.trim()) return;
        const res = await fetch('/api/cables-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCableName.trim(), cross_section: newCableCrossSection.trim() })
        });
        if (!res.ok) throw new Error('Nie udało się dodać kabla');
      } else {
        if (!newValue.trim()) return;
        const res = await fetch('/api/cable-dictionaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: selectedTab, value: newValue.trim() })
        });
        if (!res.ok) throw new Error('Nie udało się dodać wpisu');
      }

      setNewValue('');
      setNewCableName('');
      setNewCableCrossSection('');
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, isCable = false) => {
    if (!window.confirm('Usunąć tę opcję?')) return;
    try {
      if (isCable) {
         // Na przyszłość endpoint dla kabli, na razie blokujemy żeby przypadkowo nie skasować setek wpisów
         alert('Usuwanie z katalogu kabli nie jest jeszcze włączone w tym widoku (za duże ryzyko).');
         return;
      }
      
      const res = await fetch(`/api/cable-dictionaries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nie udało się usunąć wpisu');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const getFilteredItems = () => {
    if (selectedTab === 'cables') {
      const items = cablesCatalog.all || [];
      return items.filter(c => 
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.cross_section || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      const items = dictionaries.filter(d => d.category === selectedTab);
      return items.filter(d => (d.value || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
  };

  const filteredItems = getFilteredItems();

  return (
    <AdminCheck requiredPermission="cable_advices">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center mb-8">
          <Link href="/admin" className="mr-4 text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Zarządzanie Słownikami</h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Zakładki (Tabs) */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedTab(tab.id);
                setSearchQuery('');
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Pasek narzędzi (Szukajka + Dodaj) */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full sm:w-96">
            <input 
              type="text" 
              placeholder="Szukaj..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {selectedTab === 'cables' && (cablesCatalog.all?.length === 0 || cablesCatalog.all?.length === undefined) && (
              <button 
                onClick={handleImport}
                disabled={importing}
                className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm disabled:opacity-50"
              >
                {importing ? 'Importowanie...' : 'Wymuś import z Excela'}
              </button>
            )}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm flex justify-center items-center gap-2"
            >
              <span className="text-xl leading-none -mt-0.5">+</span> Dodaj opcję
            </button>
          </div>
        </div>

        {/* Dynamiczna Lista */}
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">
              {tabs.find(t => t.id === selectedTab)?.name} 
              <span className="ml-2 bg-indigo-100 text-indigo-700 font-bold text-xs px-2.5 py-0.5 rounded-full">{filteredItems.length}</span>
            </h3>
          </div>
          
          {loading ? (
            <div className="p-12 text-center text-gray-500">Ładowanie danych...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Brak wyników do wyświetlenia. {searchQuery && 'Spróbuj zmienić zapytanie.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredItems.map((item, index) => (
                <li key={item.id || index} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors group">
                  {selectedTab === 'cables' ? (
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-6 w-full">
                      <span className="font-semibold text-gray-900 w-full sm:w-1/2">{item.name}</span>
                      <span className="text-gray-600 text-sm sm:text-base">{item.cross_section}</span>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-900">{item.value}</span>
                  )}
                  
                  {selectedTab !== 'cables' && (
                    <button 
                      onClick={() => handleDelete(item.id, selectedTab === 'cables')}
                      className="text-red-500 hover:text-red-700 text-sm font-medium md:opacity-0 group-hover:opacity-100 transition-opacity ml-4"
                    >
                      Usuń
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal Dodawania */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                Dodaj: {tabs.find(t => t.id === selectedTab)?.name}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="p-6">
              {selectedTab === 'cables' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa kabla</label>
                    <input 
                      type="text" 
                      value={newCableName}
                      onChange={e => setNewCableName(e.target.value)}
                      placeholder="np. YAKY 0.6/1kV" 
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Przekrój</label>
                    <input 
                      type="text" 
                      value={newCableCrossSection}
                      onChange={e => setNewCableCrossSection(e.target.value)}
                      placeholder="np. 4x120" 
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3" 
                      required 
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wartość opcji</label>
                  <input 
                    type="text" 
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Wpisz nową wartość..."
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3"
                    required
                  />
                </div>
              )}
              
              <div className="mt-8 flex gap-3 justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminCheck>
  );
}
