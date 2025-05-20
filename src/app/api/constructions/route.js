// src/app/admin/constructions/page.js
'use client'
import { useState, useEffect } from 'react'
import AdminCheck from '@/components/AdminCheck'

export default function ConstructionsPage() {
  const [constructions, setConstructions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newConstruction, setNewConstruction] = useState({ name: '', mpk: '' });
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchConstructions();
  }, []);

  const fetchConstructions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/constructions');
      
      if (!response.ok) {
        throw new Error('Problem z pobraniem danych');
      }
      
      const data = await response.json();
      setConstructions(data.constructions || []);
    } catch (err) {
      setError('Nie udało się pobrać listy budów: ' + err.message);
      console.error('Error fetching constructions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewConstruction(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      if (editMode) {
        // Edycja istniejącej budowy
        const response = await fetch('/api/constructions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: editingId,
            name: newConstruction.name,
            mpk: newConstruction.mpk
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Problem z aktualizacją danych');
        }
        
        // Aktualizuj lokalny stan
        setConstructions(constructions.map(construction => 
          construction.id === editingId 
            ? { ...construction, name: newConstruction.name, mpk: newConstruction.mpk }
            : construction
        ));
        
        // Wyczyść formularz
        resetForm();
      } else {
        // Dodanie nowej budowy
        const response = await fetch('/api/constructions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newConstruction.name,
            mpk: newConstruction.mpk
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Problem z zapisem danych');
        }
        
        const data = await response.json();
        
        // Dodaj nową budowę do lokalnego stanu
        setConstructions([
          ...constructions,
          { id: data.id, name: newConstruction.name, mpk: newConstruction.mpk }
        ]);
        
        // Wyczyść formularz
        resetForm();
      }
    } catch (err) {
      setError('Wystąpił błąd podczas zapisywania: ' + err.message);
      console.error('Error saving construction:', err);
    }
  };
  
  const handleEdit = (construction) => {
    setEditMode(true);
    setEditingId(construction.id);
    setNewConstruction({
      name: construction.name,
      mpk: construction.mpk
    });
  };
  
  const handleDelete = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć tę budowę?')) {
      return;
    }
    
    setError(null);
    
    try {
      const response = await fetch(`/api/constructions`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Problem z usunięciem danych');
      }
      
      // Aktualizuj lokalny stan
      setConstructions(constructions.filter(c => c.id !== id));
    } catch (err) {
      setError('Wystąpił błąd podczas usuwania: ' + err.message);
      console.error('Error deleting construction:', err);
    }
  };

  const resetForm = () => {
    setNewConstruction({ name: '', mpk: '' });
    setEditMode(false);
    setEditingId(null);
  };

  return (
    <AdminCheck moduleType="constructions">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Zarządzanie budowami</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formularz dodawania/edycji */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {editMode ? 'Edytuj budowę' : 'Dodaj nową budowę'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nazwa budowy
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={newConstruction.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numer MPK
                    </label>
                    <input
                      type="text"
                      name="mpk"
                      value={newConstruction.mpk}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      {editMode ? 'Zapisz zmiany' : 'Dodaj budowę'}
                    </button>
                    
                    {editMode && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                      >
                        Anuluj
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
          
          {/* Lista budów - nowa wersja z poprawionym widokiem */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Lista budów</h2>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                    {error}
                  </div>
                )}
                
                {loading ? (
                  <div className="text-center py-4">Ładowanie...</div>
                ) : constructions.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    Brak zdefiniowanych budów. Dodaj pierwszą budowę za pomocą formularza.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {constructions.map((construction) => (
                      <div key={construction.id} className="py-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-900">{construction.name}</div>
                            <div className="mt-1 text-sm text-gray-500">MPK: {construction.mpk}</div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEdit(construction)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                              title="Edytuj"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(construction.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="Usuń"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminCheck>
  );
}
