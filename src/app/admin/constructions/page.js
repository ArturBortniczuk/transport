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
    
    try {
      let updatedConstructions;
      
      if (editMode) {
        // Edycja istniejącej budowy
        updatedConstructions = constructions.map(construction => 
          construction.id === editingId 
            ? { ...newConstruction, id: editingId } 
            : construction
        );
      } else {
        // Dodanie nowej budowy
        const newId = Math.max(0, ...constructions.map(c => c.id)) + 1;
        updatedConstructions = [
          ...constructions,
          { ...newConstruction, id: newId }
        ];
      }
      
      const response = await fetch('/api/constructions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ constructions: updatedConstructions })
      });
      
      if (!response.ok) {
        throw new Error('Problem z zapisem danych');
      }
      
      setConstructions(updatedConstructions);
      resetForm();
      
    } catch (err) {
      setError('Wystąpił błąd podczas zapisywania: ' + err.message);
      console.error('Error saving construction:', err);
    }
  };

  const handleEdit = (construction) => {
    setNewConstruction({
      name: construction.name,
      mpk: construction.mpk
    });
    setEditMode(true);
    setEditingId(construction.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('Czy na pewno chcesz usunąć tę budowę?')) {
      return;
    }
    
    try {
      const updatedConstructions = constructions.filter(c => c.id !== id);
      
      const response = await fetch('/api/constructions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ constructions: updatedConstructions })
      });
      
      if (!response.ok) {
        throw new Error('Problem z usunięciem danych');
      }
      
      setConstructions(updatedConstructions);
      
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
    <AdminCheck>
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
                  
                  {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
          
          {/* Lista budów */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Lista budów</h2>
                
                {loading ? (
                  <div className="text-center py-4">Ładowanie...</div>
                ) : constructions.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    Brak zdefiniowanych budów. Dodaj pierwszą budowę za pomocą formularza.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nazwa budowy
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MPK
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Akcje
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {constructions.map((construction) => (
                          <tr key={construction.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {construction.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {construction.mpk}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={() => handleEdit(construction)}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                  Edytuj
                                </button>
                                <button
                                  onClick={() => handleDelete(construction.id)}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                  Usuń
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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