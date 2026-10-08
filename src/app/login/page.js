'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        setIsLocalhost(true);
      }
    }

    // Automatyczne przekierowanie jeśli użytkownik jest zalogowany przez SSO lub sesję
    fetch('/api/user')
      .then(res => res.json())
      .then(data => {
        if (data.isAuthenticated && data.user) {
          if (data.user.role === 'admin' || data.user.isAdmin) {
            router.replace('/admin')
          } else {
            router.replace('/kalendarz')
          }
        }
      })
      .catch(() => {})
  }, [router])

  const doLogin = async (loginEmail, loginPassword) => {
    setIsLoading(true)
    setError('')
    
    try {
      console.log('Próba logowania:', loginEmail);
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        }),
      })
  
      const data = await response.json()
      console.log('Odpowiedź logowania:', data);
  
      if (data.success) {
        localStorage.setItem('userEmail', loginEmail);
        window.dispatchEvent(new Event('auth-state-changed'));
        
        setTimeout(async () => {
          try {
            const checkResponse = await fetch('/api/check-first-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: loginEmail
              }),
            })
      
            const checkData = await checkResponse.json()
            console.log('Sprawdzenie pierwszego logowania:', checkData);
      
            if (checkData.shouldChangePassword) {
              router.push('/first-change-password')
            } else {
              if (data.user.role === 'admin' || data.user.isAdmin) {
                router.push('/kalendarz')
              } else {
                router.push('/kalendarz')
              }
            }
          } catch (error) {
            console.error('Błąd po logowaniu:', error);
            router.push('/kalendarz');
          }
        }, 300);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    doLogin(email, password);
  }

  const handleQuickLogin = (quickEmail, quickPassword = 'admin123') => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    doLogin(quickEmail, quickPassword);
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200/80 max-w-md w-full space-y-6">
        
        {/* Nagłówek z oficjalnym logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="Grupa Eltron"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/logo40.png';
              }}
            />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            System Transportowy
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Zaloguj się, aby uzyskać dostęp do zleceń i kalendarza
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="email" 
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Adres email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="np. a.bortniczuk@grupaeltron.pl"
              className="appearance-none block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              required
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="appearance-none block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md shadow-blue-600/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? 'Logowanie...' : 'Zaloguj się'}
            </button>
          </div>
        </form>

        {/* KAFELKI SZYBKIEGO LOGOWANIA DEV (WIDOCZNE TYLKO NA LOCALHOST) */}
        {isLocalhost && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-center">
              ⚡ Szybkie testowe logowanie (Localhost):
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('a.bortniczuk@grupaeltron.pl')}
                disabled={isLoading}
                className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
              >
                <span>👑 Artur Bortniczuk</span>
                <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-bold">Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('m.borkowski@grupaeltron.pl')}
                disabled={isLoading}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
              >
                <span>📦 Michał Borkowski</span>
                <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">Magazyn</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('m.magnuszewski@grupaeltron.pl')}
                disabled={isLoading}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
              >
                <span>💼 Mateusz Magnuszewski</span>
                <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">Handlowiec</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default LoginPage
