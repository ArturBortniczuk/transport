'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Truck, Calendar, Map, Users, Check, ArrowRight } from 'lucide-react'

export default function Home() {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Animacja paralaksy dla tła
  const backgroundStyle = {
    backgroundImage: `linear-gradient(135deg, #0052cc 0%, #003580 100%)`,
    backgroundSize: 'cover',
    backgroundAttachment: 'fixed',
    backgroundPosition: `center ${scrollY * 0.5}px`
  }

  return (
    <div className="space-y-0">
      {/* Hero Section z animowanym tłem */}
      <section 
        className="relative overflow-hidden py-32 px-4 sm:px-6 lg:px-8 text-white"
        style={backgroundStyle}
      >
        {/* Animowane kształty w tle */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-64 h-64 rounded-full bg-white opacity-20"
              initial={{ 
                x: Math.random() * 100 - 50, 
                y: Math.random() * 100 - 50 
              }}
              animate={{ 
                x: [Math.random() * 100 - 50, Math.random() * 100 - 50],
                y: [Math.random() * 100 - 50, Math.random() * 100 - 50]
              }}
              transition={{ 
                repeat: Infinity, 
                repeatType: "reverse", 
                duration: 20 + Math.random() * 10,
                ease: "easeInOut"
              }}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl tracking-tight font-extrabold sm:text-6xl md:text-7xl mb-6">
              <span className="block">System Zarządzania</span>
              <span className="block text-blue-200">Transportem</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-lg sm:text-xl md:text-2xl md:max-w-3xl text-blue-100">
              Kompleksowe rozwiązanie do zarządzania flotą, kierowcami i przesyłkami.
              Wszystko czego potrzebujesz w jednym miejscu.
            </p>
            <div className="mt-10">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-md shadow inline-block"
              >
                <Link
                  href="/login"
                  className="flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 md:text-lg md:px-10 transition-all duration-300"
                >
                  <span>Zaloguj się</span>
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Fala separująca sekcje */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-auto">
            <path fill="#ffffff" fillOpacity="1" d="M0,96L80,80C160,64,320,32,480,32C640,32,800,64,960,69.3C1120,75,1280,53,1360,42.7L1440,32L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"></path>
          </svg>
        </div>
      </section>

      {/* Sekcja "Jak to działa" */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Jak działa nasz system?
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Zintegrowana platforma, która łączy wszystkie aspekty zarządzania transportem w jednym miejscu
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: <Calendar className="h-10 w-10 text-blue-600" />,
                title: "Planowanie",
                description: "Łatwe planowanie tras i harmonogramów dla kierowców z automatycznymi powiadomieniami"
              },
              {
                icon: <Map className="h-10 w-10 text-blue-600" />,
                title: "Śledzenie",
                description: "Monitorowanie pojazdów w czasie rzeczywistym z dokładnymi trasami i przewidywanym czasem przybycia"
              },
              {
                icon: <Users className="h-10 w-10 text-blue-600" />,
                title: "Zarządzanie",
                description: "Kompleksowe narzędzia do zarządzania zespołem, pojazdami i dokumentacją transportową"
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100"
              >
                <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-xl mb-5">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sekcja funkcji z animowanymi ikonami */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Funkcje systemu
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Odkryj zaawansowane możliwości naszej platformy
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Calendar />,
                title: "Kalendarz Transportów",
                description: "Planuj i zarządzaj transportami w intuicyjnym kalendarzu. Wszystkie informacje w jednym miejscu."
              },
              {
                icon: <Map />,
                title: "Mapa Tras",
                description: "Śledź trasy i optymalizuj przejazdy dzięki interaktywnej mapie z automatycznym liczeniem odległości."
              },
              {
                icon: <Users />,
                title: "Zarządzanie Zespołem",
                description: "Efektywnie zarządzaj pracą magazynów i handlowców. Kontroluj uprawnienia i deleguj zadania."
              },
              {
                icon: <Truck />,
                title: "Zarządzanie Flotą",
                description: "Monitoruj stan techniczny pojazdów, planuj przeglądy i optymalizuj wykorzystanie floty."
              },
              {
                icon: <Check />,
                title: "Raportowanie",
                description: "Generuj szczegółowe raporty i analizy efektywności transportów oraz pracy kierowców."
              },
              {
                icon: <div className="w-6 h-6 flex items-center justify-center font-bold">📱</div>,
                title: "Aplikacja Mobilna",
                description: "Dostęp do systemu z dowolnego urządzenia, idealny dla kierowców w trasie."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="relative p-8 bg-white rounded-xl shadow-md overflow-hidden group-hover:shadow-lg transition-all duration-300">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 bg-blue-500 bg-opacity-10 w-24 h-24 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-5">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sekcja CTA */}
      <section className="relative py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute transform -rotate-12 -translate-x-1/4 -translate-y-1/2 w-full h-full bg-blue-500 opacity-10"></div>
          <div className="absolute transform rotate-12 translate-x-1/4 translate-y-1/2 w-full h-full bg-blue-700 opacity-10"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold sm:text-4xl mb-6">
              Gotowy, by usprawnić zarządzanie transportem?
            </h2>
            <p className="text-xl mb-10 text-blue-100">
              Dołącz do setek firm, które już korzystają z naszego systemu i optymalizują swoje procesy transportowe.
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <Link
                href="/login"
                className="px-8 py-4 text-blue-700 bg-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center"
              >
                Rozpocznij teraz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
