import './globals.css'
import Navigation from '../components/Navigation'
import { Inter } from 'next/font/google'
import LogoutCleanup from '../components/LogoutCleanup'
import AuthCheck from '../components/AuthCheck'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'System Zarządzania Transportem',
  description: 'Kompleksowe rozwiązanie do zarządzania transportem i kierowcami',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <AuthCheck>
          <LogoutCleanup />
          <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="bg-gray-800 text-white py-6">
              <div className="container mx-auto px-4 text-center">
                <p>&copy; 2025 System Zarządzania Transportem. Wszelkie prawa zastrzeżone.</p>
              </div>
            </footer>
          </div>
        </AuthCheck>
      </body>
    </html>
  )
}