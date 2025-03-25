import Link from 'next/link'

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
          <span className="block">System Zarządzania</span>
          <span className="block text-blue-600">Transportem</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Kompleksowe rozwiązanie do zarządzania flotą, kierowcami i przesyłkami.
          Wszystko czego potrzebujesz w jednym miejscu.
        </p>
        <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
          <div className="rounded-md shadow">
            <Link
              href="/login"
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-custom"
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white py-12 rounded-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="relative p-6 bg-gradient-to-br from-blue-50 to-white rounded-lg transition-custom hover:shadow-lg">
              <div className="absolute top-6 right-6">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Kalendarz Transportów</h3>
              <p className="mt-2 text-base text-gray-500">
                Planuj i zarządzaj transportami w intuicyjnym kalendarzu. Wszystkie informacje w jednym miejscu.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="relative p-6 bg-gradient-to-br from-blue-50 to-white rounded-lg transition-custom hover:shadow-lg">
              <div className="absolute top-6 right-6">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Mapa Tras</h3>
              <p className="mt-2 text-base text-gray-500">
                Śledź trasy i optymalizuj przejazdy dzięki interaktywnej mapie z automatycznym liczeniem odległości.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="relative p-6 bg-gradient-to-br from-blue-50 to-white rounded-lg transition-custom hover:shadow-lg">
              <div className="absolute top-6 right-6">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Zarządzanie Zespołem</h3>
              <p className="mt-2 text-base text-gray-500">
                Efektywnie zarządzaj pracą magazynów i handlowców. Kontroluj uprawnienia i deleguj zadania.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}