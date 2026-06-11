'use client'
import { useState, useEffect } from 'react';
import AdminCheck from '@/components/AdminCheck';
import Link from 'next/link';

export default function CableDictionariesPage() {
  const [dictionaries, setDictionaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newValue, setNewValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('supplier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cablesCount, setCablesCount] = useState(0);

  const categories = [
    { id: 'supplier', name: 'Dostawca' },
    { id: 'order_type', name: 'Typ zamówienia' },
    { id: 'unloading_place', name: 'Miejsce rozładunku' },
    { id: 'cable_voltage', name: 'Napięcie kabla (rodzaj)' },
    { id: 'cable_guidelines', name: 'Wytyczne kabla' },
    { id: 'warehouse', name: 'Magazyn docelowy (Przeznaczenie)' }
  ];

  useEffect(() => {
    fetchDictionaries();
  }, []);

  const fetchDictionaries = async () => {
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
        setCablesCount(cablesData.all?.length || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/cable-dictionaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory, value: newValue.trim() })
      });

      if (!res.ok) throw new Error('Nie udało się dodać wpisu');
      
      setNewValue('');
      await fetchDictionaries();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Usunąć tę opcję? Przestanie być dostępna w formularzu.')) return;
    try {
      const res = await fetch(`/api/cable-dictionaries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nie udało się usunąć wpisu');
      await fetchDictionaries();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <AdminCheck requiredPermission="cable_advices">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center mb-8">
          <Link href="/admin" className="mr-4 text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Słowniki Awizacji Kabli</h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-medium mb-4">Dodaj nową opcję do formularza</h2>
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategoria</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-yellow-500 focus:border-yellow-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Wartość</label>
              <input 
                type="text" 
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="np. Kable-Pol S.A."
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-yellow-500 focus:border-yellow-500"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isSubmitting || !newValue.trim()}
              className="bg-yellow-600 text-white px-6 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 h-[42px]"
            >
              {isSubmitting ? 'Dodawanie...' : 'Dodaj'}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden border-2 border-indigo-200">
            <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
              <h3 className="font-bold text-indigo-900">Katalog Kabli (Excel)</h3>
              <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full font-bold">{cablesCount}</span>
            </div>
            <div className="p-4 text-sm text-gray-600">
              <p className="mb-2">Baza <strong>{cablesCount}</strong> modeli kabli oraz ich przekrojów została załadowana z pliku <code className="bg-gray-100 px-1 rounded">wszystkiekable.xlsx</code>.</p>
              <p>Zamiast ręcznego konfigurowania długich list, formularz Awizacji automatycznie przeszukuje i dopasowuje przekroje do wybranego modelu kabla.</p>
            </div>
          </div>

          {categories.map(cat => {
            const items = dictionaries.filter(d => d.category === cat.id);
            return (
              <div key={cat.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="font-medium text-gray-900">{cat.name}</h3>
                </div>
                {loading ? (
                  <div className="p-4 text-sm text-gray-500">Ładowanie...</div>
                ) : items.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">Brak pozycji w tym słowniku.</div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {items.map(item => (
                      <li key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                        <span className="text-sm font-medium text-gray-900">{item.value}</span>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Usuń
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminCheck>
  );
}
