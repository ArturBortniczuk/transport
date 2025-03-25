'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FirstChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Sprawdź czy nowe hasło zostało potwierdzone
    if (newPassword !== confirmPassword) {
      setError('Nowe hasło i potwierdzenie nie są takie same')
      setIsLoading(false)
      return
    }
    
    // Sprawdź długość hasła
    if (newPassword.length < 6) {
      setError('Nowe hasło musi mieć co najmniej 6 znaków')
      setIsLoading(false)
      return
    }

    try {
      const userId = localStorage.getItem('userId') // email użytkownika
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userId,
          currentPassword,
          newPassword
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        
        // Po 2 sekundach przekieruj do kalendarza
        setTimeout(() => {
          router.push('/kalendarz')
        }, 2000)
      } else {
        setError(data.error || 'Wystąpił błąd podczas zmiany hasła')
      }
    } catch (error) {
      setError('Wystąpił błąd podczas komunikacji z serwerem')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Pierwsze logowanie - zmiana hasła
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Aby kontynuować, prosimy o zmianę domyślnego hasła.
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-md text-center">
            Hasło zostało zmienione pomyślnie! Za chwilę zostaniesz przekierowany do systemu.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Obecne hasło
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nowe hasło
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Potwierdź nowe hasło
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Zmieniam hasło...' : 'Zmień hasło'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}