'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion'
import { Truck, Calendar, Map, Users, Check, ArrowRight, BarChart3, Clock, Shield, Cpu } from 'lucide-react'

export default function Home() {
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const heroRef = useRef(null)
  const heroInView = useInView(heroRef)
  
  // Animacje oparte na scroll
  const { scrollYProgress } = useScroll()
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, -300])
  const opacityTransform = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const springScrollY = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    
    const handleMouseMove = (e) => {
      setMousePosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight
      })
    }
    
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Zaawansowany efekt tła reagujący na mysz i scroll
  const heroBackgroundStyle = {
    backgroundImage: `
      radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, rgba(0, 120, 255, 0.8) 0%, rgba(0, 53, 128, 0.95) 50%), 
      linear-gradient(135deg, #0046b3 0%, #001d40 100%)
    `,
    backgroundSize: 'cover',
    backgroundAttachment: 'fixed',
    backgroundPosition: `center ${scrollY * 0.3}px`
  }

  // Zaawansowane efekty 3D i świetlne
  const lightEffect = {
    background: `
      radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, 
      rgba(255, 255, 255, 0.1) 0%, 
      rgba(255, 255, 255, 0) 60%)
    `
  }

  return (
    <div className="space-y-0">
      {/* Hero Section z zaawansowanym interaktywnym tłem */}
      <section 
        ref={heroRef}
        className="relative overflow-hidden min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 text-white"
        style={heroBackgroundStyle}
      >
        {/* Interaktywna siatka w tle */}
        <div className="absolute inset-0 overflow-hidden">
          <svg
            className="absolute w-full h-full opacity-10"
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          
          {/* Dynamiczny efekt świetlny */}
          <div 
            className="absolute inset-0 opacity-30 transition-all duration-1000 ease-out"
            style={lightEffect}
          />
          
          {/* Animowane linie w tle */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent"
              style={{
                width: '100%',
                top: `${20 * i}%`,
                left: 0,
                opacity: 0.3,
                y: useTransform(scrollYProgress, [0, 1], [0, i * 50])
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                repeat: Infinity,
                repeatType: "loop",
                duration: 15 + i * 5,
                ease: "linear"
              }}
            />
          ))}
        </div>

        {/* Nowoczesne UI elementy pływające */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Element 1: trójkąt */}
          <motion.div
            className="absolute w-32 h-32 opacity-20"
            style={{
              left: '10%',
              top: '20%',
              background: 'linear-gradient(45deg, #4d94ff, transparent)',
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              filter: 'blur(8px)',
              transformStyle: 'preserve-3d',
              transform: `translateZ(100px) rotate(${mousePosition.x * 40}deg)`
            }}
            animate={{
              y: [0, 30, 0],
              rotate: [0, 5, 0]
            }}
            transition={{
              repeat: Infinity,
              duration: 5,
              ease: "easeInOut"
            }}
          />
          
          {/* Element 2: okrąg */}
          <motion.div
            className="absolute w-48 h-48 opacity-20 rounded-full"
            style={{
              right: '15%',
              top: '15%',
              background: 'radial-gradient(circle, #00a6ff, transparent)',
              filter: 'blur(10px)',
              transformStyle: 'preserve-3d',
              transform: `translateZ(50px) translateX(${mousePosition.x * -20}px)`
            }}
            animate={{
              scale: [1, 1.2, 1]
            }}
            transition={{
              repeat: Infinity,
              duration: 8,
              ease: "easeInOut"
            }}
          />
          
          {/* Element 3: falujący kształt */}
          <motion.div
            className="absolute h-40 w-64 opacity-10"
            style={{
              left: '50%',
              bottom: '20%',
              background: 'linear-gradient(180deg, #57a0ff, transparent)',
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              filter: 'blur(8px)',
              transformStyle: 'preserve-3d',
              transform: `translateZ(75px) translateX(${mousePosition.y * -30}px)`
            }}
            animate={{
              borderRadius: [
                '50% 50% 50% 50% / 60% 60% 40% 40%',
                '40% 60% 60% 40% / 50% 40% 60% 50%',
                '50% 50% 50% 50% / 60% 60% 40% 40%'
              ]
            }}
            transition={{
              repeat: Infinity,
              duration: 10,
              ease: "easeInOut"
            }}
          />
          
          {/* Małe świecące punkty - jak gwiazdy */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.1
              }}
              animate={{
                opacity: [0.1, 0.5, 0.1]
              }}
              transition={{
                repeat: Infinity,
                duration: 2 + Math.random() * 3,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>

        {/* Główna treść hero */}
        <motion.div 
          className="relative z-10 max-w-5xl mx-auto"
          style={{ 
            y: useTransform(scrollYProgress, [0, 0.5], [0, 100]),
            opacity: opacityTransform 
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={heroInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center"
          >
            {/* Tytuł z efektem glassmorphism */}
            <motion.div
              initial={{ y: 50 }}
              animate={heroInView ? { y: 0 } : { y: 50 }}
              transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }}
              className="mb-8"
            >
              <h1 className="relative inline-block">
                <span className="block text-5xl tracking-tight font-extrabold sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 pb-2">
                  System Zarządzania
                </span>
                <span className="block text-5xl tracking-tight font-extrabold sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-br from-blue-200 to-blue-400">
                  Transportem
                </span>
                <motion.span 
                  className="absolute -bottom-3 left-1/2 w-1/2 h-1 bg-blue-300"
                  style={{ x: '-50%' }}
                  initial={{ width: 0 }}
                  animate={heroInView ? { width: '50%' } : { width: 0 }}
                  transition={{ duration: 0.8, delay: 1 }}
                />
              </h1>
            </motion.div>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-3 max-w-md mx-auto text-lg sm:text-xl md:text-2xl md:max-w-3xl text-blue-100"
            >
              Kompleksowe rozwiązanie do zarządzania flotą, kierowcami i przesyłkami.
              <span className="block mt-2">Wszystko czego potrzebujesz w jednym miejscu.</span>
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={heroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-10 flex justify-center"
            >
              <motion.div
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" 
                }}
                whileTap={{ scale: 0.95 }}
                className="rounded-lg shadow-lg overflow-hidden"
              >
                <Link
                  href="/login"
                  className="group relative flex items-center justify-center px-8 py-4 bg-white text-blue-700 font-medium text-lg md:text-xl"
                >
                  <span className="relative z-10">Zaloguj się</span>
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                  />
                  <motion.div
                    className="absolute right-8 flex items-center justify-center"
                    whileHover={{ x: 5 }}
                  >
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </motion.div>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Zaawansowana fala separująca sekcje z animacją */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: '150px' }}>
          <svg
            className="absolute bottom-0 w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 1200 120"
            xmlns="http://www.w3.org/2000/svg"
          >
            <motion.path
              d="M0,32L48,37.3C96,43,192,53,288,69.3C384,85,480,107,576,101.3C672,96,768,64,864,64C960,64,1056,96,1152,101.3C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              fill="white"
              animate={{
                d: [
                  "M0,32L48,37.3C96,43,192,53,288,69.3C384,85,480,107,576,101.3C672,96,768,64,864,64C960,64,1056,96,1152,101.3C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                  "M0,64L48,74.7C96,85,192,107,288,117.3C384,128,480,128,576,117.3C672,107,768,85,864,90.7C960,96,1056,128,1152,122.7C1248,117,1344,75,1392,53.3L1440,32L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
                  "M0,32L48,37.3C96,43,192,53,288,69.3C384,85,480,107,576,101.3C672,96,768,64,864,64C960,64,1056,96,1152,101.3C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                ]
              }}
              transition={{
                repeat: Infinity,
                repeatType: "mirror",
                duration: 20,
                ease: "easeInOut"
              }}
            />
          </svg>
        </div>
      </section>

      {/* Sekcja "Jak to działa" z zaawansowanymi efektami */}
      <section className="py-24 bg-white overflow-hidden relative">
        {/* Tło z gradientem i elementami dekoracyjnymi */}
        <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
          <div className="absolute -right-40 -top-40 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
          <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl relative inline-block">
                Jak działa nasz system?
                <motion.div 
                  className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  viewport={{ once: true }}
                />
              </h2>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Zintegrowana platforma, która łączy wszystkie aspekty zarządzania transportem
              w jednym miejscu dla maksymalnej wydajności i kontroli
            </motion.p>
          </motion.div>

          {/* Zaawansowane karty z efektami 3D */}
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 perspective-1000">
            {[
              {
                icon: <Calendar className="h-10 w-10 text-white" />,
                bgColor: "from-blue-500 to-blue-700",
                accentColor: "rgba(59, 130, 246, 0.7)",
                title: "Inteligentne Planowanie",
                description: "Automatyczne planowanie tras i harmonogramów dla kierowców z powiadomieniami w czasie rzeczywistym i predykcją opóźnień"
              },
              {
                icon: <Map className="h-10 w-10 text-white" />,
                bgColor: "from-blue-600 to-blue-800",
                accentColor: "rgba(37, 99, 235, 0.7)",
                title: "Śledzenie GPS",
                description: "Zaawansowane monitorowanie pojazdów w czasie rzeczywistym z dokładnymi trasami i automatycznym liczeniem odległości"
              },
              {
                icon: <Users className="h-10 w-10 text-white" />,
                bgColor: "from-blue-700 to-blue-900",
                accentColor: "rgba(30, 64, 175, 0.7)",
                title: "Zarządzanie Flotą",
                description: "Kompleksowe narzędzia do zarządzania zespołem, optymalizacji tras i automatycznego generowania dokumentacji"
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 + index * 0.2 }}
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{ 
                  scale: 1.03, 
                  rotateY: 5,
                  rotateX: -5,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                }}
                className="relative rounded-2xl overflow-hidden transform transition-all duration-500 will-change-transform"
                style={{ 
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden"
                }}
              >
                {/* Karta z gradientem i efektem szkła */}
                <div className={`h-full bg-gradient-to-br ${item.bgColor} p-8 rounded-2xl overflow-hidden relative z-10`}>
                  {/* Świecąca obwódka */}
                  <div className="absolute inset-0 rounded-2xl border border-white opacity-10"></div>
                  
                  {/* Błyszczące

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
