// src/components/ChangePassword.js
import React, { useRef, useEffect } from 'react';

const ChangePassword = ({ onClose }) => {
  // Używamy useRef zamiast useState dla pól formularza
  const currentPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const formRef = useRef(null);

  // Ustawiamy fokus na pierwsze pole po załadowaniu
  useEffect(() => {
    if (currentPasswordRef.current) {
      currentPasswordRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const currentPassword = currentPasswordRef.current.value;
    const newPassword = newPasswordRef.current.value;
    const confirmPassword = confirmPasswordRef.current.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Wszystkie pola są wymagane');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert('Nowe hasła nie są identyczne');
      return;
    }
    
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Hasło zostało zmienione pomyślnie!');
        onClose();
      } else {
        alert(data.error || 'Wystąpił błąd podczas zmiany hasła');
      }
    } catch (error) {
      alert('Wystąpił błąd podczas komunikacji z serwerem');
    }
  };

  return (
    <div 
      id="password-modal"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target.id === "password-modal") {
          onClose();
        }
      }}
    >
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Zmiana hasła</h2>
        
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium mb-1">
              Aktualne hasło
            </label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              ref={currentPasswordRef}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium mb-1">
              Nowe hasło
            </label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              ref={newPasswordRef}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
              Potwierdź nowe hasło
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              ref={confirmPasswordRef}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md"
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Zmień hasło
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
