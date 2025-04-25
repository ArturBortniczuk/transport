'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      console.log('Próba logowania:', email);
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password
        }),
      })
  
      const data = await response.json()
      console.log('Odpowiedź logowania:', data);
  
      if (data.success) {
        localStorage.setItem('userEmail', email);
        // Emitujemy zdarzenie, aby powiadomić o zmianie stanu uwierzytelnienia
        window.dispatchEvent(new Event('auth-state-changed'));
        
        // Odczekaj chwilę, aby ciasteczka miały czas się ustawić
        setTimeout(async () => {
          try {
            // Sprawdź czy to pierwsze logowanie
            const checkResponse = await fetch('/api/check-first-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email
              }),
            })
      
            const checkData = await checkResponse.json()
            console.log('Sprawdzenie pierwszego logowania:', checkData);
      
            if (checkData.shouldChangePassword) {
              // Przekieruj do strony zmiany hasła
              console.log('Przekierowuję do zmiany hasła...');
              router.push('/first-change-password')
            } else {
              // Przekieruj w zależności od roli
              console.log('Przekierowuję do właściwej strony dla roli:', data.user.role);
              if (data.user.role === 'admin') {
                router.push('/admin')
              } else {
                router.push('/kalendarz')
              }
            }
          } catch (error) {
            console.error('Błąd po logowaniu:', error);
            setError('Wystąpił błąd podczas przekierowania');
            setIsLoading(false);
          }
        }, 500); // Poczekaj 500ms
      } else {
        setError(data.error || 'Błąd logowania')
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Wystąpił błąd podczas logowania')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Logowanie do systemu
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Adres email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
              {isLoading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
