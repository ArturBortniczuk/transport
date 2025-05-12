'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Truck, Calendar, Map, Users, Settings, TrendingUp, Shield } from 'lucide-react'

export default function Home() {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Animacje dla elementów
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  }

  const cardVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: i => ({ 
      y: 0, 
      opacity: 1,
      transition: { 
        delay: i * 0.1 + 0.3,
        type: 'spring',
        stiffness: 70,
        damping: 8
      }
    })
  }

  const fadeInVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.6 }
    }
  }

  // Lista funkcji/modułów systemu
  const features = [
    {
      title: "Kalendarz Transportów",
      description: "Planuj i zarządzaj transportami w intuicyjnym kalendarzu. Wszystko w jednym miejscu.",
      icon: <Calendar className="h-10 w-10" />,
      color: "from-blue-400 to-blue-600",
      path: "/kalendarz"
    },
    {
      title: "Mapa Tras",
      description: "Śledź trasy i optymalizuj przejazdy dzięki interaktywnej mapie z automatycznym liczeniem odległości.",
      icon: <Map className="h-10 w-10" />,
      color: "from-cyan-400 to-blue-500",
      path: "/mapa"
    },
    {
      title: "Zarządzanie Zespołem",
      description: "Efektywnie zarządzaj pracą magazynów i handlowców. Kontroluj uprawnienia i deleguj zadania.",
      icon: <Users className="h-10 w-10" />,
      color: "from-indigo-400 to-blue-600",
      path: "/admin"
    },
    {
      title: "Panel Spedycji",
      description: "Zarządzaj zleceniami transportowymi, kontroluj status przesyłek i przydzielaj zadania kierowcom.",
      icon: <Truck className="h-10 w-10" />,
      color: "from-blue-500 to-indigo-600",
      path: "/spedycja"
    },
    {
      title: "Panel Administracyjny",
      description: "Konfiguruj uprawnienia, zarządzaj użytkownikami i monitoruj pracę systemu.",
      icon: <Settings className="h-10 w-10" />,
      color: "from-blue-600 to-indigo-700",
      path: "/admin"
    },
    {
      title: "Analityka i Raporty",
      description: "Generuj szczegółowe raporty wydajności, monitoruj kluczowe wskaźniki i analizuj trendy.",
      icon: <TrendingUp className="h-10 w-10" />,
      color: "from-sky-400 to-blue-500",
      path: "/archiwum"
    }
  ]

  return (
    <div className="min-h-[80vh] flex flex-col justify-center">
      {/* Animowane tło z gradientem i "floating" efektem */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute opacity-20 w-[500px] h-[500px] rounded-full bg-blue-600 blur-3xl top-[-100px] right-[-100px] animate-pulse"></div>
        <div className="absolute opacity-20 w-[600px] h-[600px] rounded-full bg-blue-400 blur-3xl bottom-[-200px] left-[-200px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute opacity-10 w-[400px] h-[400px] rounded-full bg-indigo-500 blur-3xl top-[20%] left-[30%] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Hero Section z animacją */}
      <motion.section 
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={containerVariants}
        className="text-center py-16 px-4 sm:px-6 lg:px-8 mb-4 relative z-10"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl mb-4">
            <span className="block">System Zarządzania</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Transportem</span>
          </h1>
        </motion.div>
        
        <motion.p 
          variants={itemVariants}
          className="mt-3 max-w-md mx-auto text-base text-gray-600 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl"
        >
          Kompleksowe rozwiązanie do zarządzania flotą, kierowcami i przesyłkami.
          Wszystko czego potrzebujesz w jednym miejscu.
        </motion.p>
        
        <motion.div 
          variants={itemVariants}
          className="mt-8 max-w-md mx-auto"
        >
          <Link href="/login" className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-200"></div>
            <button className="relative w-full px-8 py-4 bg-white rounded-lg leading-none flex items-center justify-center space-x-2 text-blue-600 font-medium group-hover:text-blue-700 transition-all duration-200">
              <span>Zaloguj się</span>
              <span className="group-hover:translate-x-1 transition-transform duration-200">&rarr;</span>
            </button>
          </Link>
        </motion.div>
      </motion.section>

      {/* Animated Features Grid */}
      <motion.section 
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={fadeInVariants}
        className="py-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
      >
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate={isVisible ? "visible" : "hidden"}
              key={index}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative p-6 rounded-xl overflow-hidden group"
            >
              {/* Background gradient with hover effect */}
              <div className="absolute inset-0 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity duration-300"></div>
              
              {/* Card content with backdrop blur effect */}
              <div className="relative bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-100 h-full transition-all duration-300 group-hover:shadow-xl">
                {/* Animated icon background */}
                <div className={`absolute opacity-10 group-hover:opacity-20 -inset-4 blur-xl bg-gradient-to-r ${feature.color} transition-opacity duration-300`}></div>
                
                {/* Icon */}
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} text-white mb-5 shadow-md`}>
                  {feature.icon}
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                
                {/* Link button */}
                <Link 
                  href={feature.path}
                  className="inline-flex items-center text-blue-600 font-medium hover:text-blue-800 transition-colors group/btn"
                >
                  <span>Przejdź</span>
                  <span className="ml-1 group-hover/btn:translate-x-1 transition-transform duration-200">&rarr;</span>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* System benefits with blurred background */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="mt-12 relative z-10 overflow-hidden rounded-xl mx-4 sm:mx-6 lg:mx-8 max-w-7xl lg:mx-auto mb-8"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 opacity-70"></div>
        <div className="absolute inset-0 bg-blue-600/5 backdrop-blur-[2px]"></div>
        
        <div className="relative p-8 md:p-10">
          <div className="flex items-center justify-start mb-6">
            <Shield className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-900">Korzyści z systemu</h2>
          </div>
          
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              "Zwiększenie efektywności zarządzania transportem",
              "Optymalizacja tras i redukcja kosztów paliwa",
              "Automatyzacja procesów logistycznych",
              "Bieżący monitoring statusu przesyłek",
              "Lepsza komunikacja między działami",
              "Generowanie raportów i analiz efektywności"
            ].map((benefit, i) => (
              <motion.li 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + (i * 0.1) }}
                className="flex items-start"
              >
                <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-500 opacity-80 mt-1 mr-2"></div>
                <span className="text-gray-700">{benefit}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.section>
    </div>
  )
}
