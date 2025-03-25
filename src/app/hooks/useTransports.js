// src/hooks/useTransports.js
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function useTransports() {
  const [transports, setTransports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pobierz wszystkie transporty
  const fetchTransports = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/transports');
      const data = await response.json();
      
      if (data.success) {
        setTransports(data.transports);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Nie udało się pobrać transportów');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Dodaj nowy transport
  const addTransport = async (transportData) => {
    try {
      const response = await fetch('/api/transports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transportData),
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchTransports(); // Odśwież listę transportów
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Error adding transport:', err);
      return { success: false, error: 'Nie udało się dodać transportu' };
    }
  };

  // Aktualizuj transport
  const updateTransport = async (id, transportData) => {
    try {
      const response = await fetch(`/api/transports`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...transportData }),
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchTransports(); // Odśwież listę transportów
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Error updating transport:', err);
      return { success: false, error: 'Nie udało się zaktualizować transportu' };
    }
  };

  // Usuń transport
  const deleteTransport = async (id) => {
    try {
      const response = await fetch(`/api/transports?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchTransports(); // Odśwież listę transportów
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Error deleting transport:', err);
      return { success: false, error: 'Nie udało się usunąć transportu' };
    }
  };

  // Pobierz transporty po dacie
  const getTransportsByDate = async (date) => {
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const response = await fetch(`/api/transports?date=${formattedDate}`);
      const data = await response.json();
      
      if (data.success) {
        return data.transports;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Error fetching transports by date:', err);
      throw err;
    }
  };

  // Pobierz transporty przy pierwszym renderowaniu
  useEffect(() => {
    fetchTransports();
  }, []);

  return {
    transports,
    isLoading,
    error,
    addTransport,
    updateTransport,
    deleteTransport,
    getTransportsByDate,
    refreshTransports: fetchTransports
  };
}