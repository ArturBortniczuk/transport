import './globals.css'
import Navigation from '../components/Navigation'
import { Inter } from 'next/font/google'
import LogoutCleanup from '../components/LogoutCleanup'
import AuthCheck from '../components/AuthCheck'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'System Zarządzania Transportem - Grupa Eltron',
  description: 'Kompleksowe rozwiązanie do zarządzania transportem i spedycją w Grupie Eltron',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <AuthCheck>
          <LogoutCleanup />
          <Navigation>
            {children}
          </Navigation>
        </AuthCheck>
      </body>
    </html>
  )
}