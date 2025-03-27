// src/components/ChangePassword.js
import React, { useState } from 'react';

const ChangePassword = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Nowe hasła nie są identyczne');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Nowe hasło musi mieć co najmniej 6 znaków');
      setIsLoading(false);
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
        setSuccess(true);
        
        // Po 2 sekundach zamknij modal
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(data.error || 'Wystąpił błąd podczas zmiany hasła');
      }
    } catch (error) {
      setError('Wystąpił błąd podczas zmiany hasła');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
    }}>
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full" style={{
        border: '1px solid #ccc',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 className="text-xl font-semibold mb-4">Zmiana hasła</h2>
        
        {success ? (
          <div style={{
            backgroundColor: '#d1fae5',
            color: '#047857',
            padding: '16px',
            borderRadius: '6px'
          }}>
            Hasło zostało zmienione pomyślnie!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                Aktualne hasło
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                Nowe hasło
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500'
              }}>
                Potwierdź nowe hasło
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px'
                }}
                required
              />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                disabled={isLoading}
              >
                Anuluj
              </button>
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Zapisywanie...' : 'Zmień hasło'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePassword;
