'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Map, Users, Truck, Settings, TrendingUp } from 'lucide-react'

export default function Home() {
  const [isVisible, setIsVisible] = useState(false)
  const canvasRef = useRef(null)
  const requestRef = useRef(null)
  
  useEffect(() => {
    setIsVisible(true)
    
    // Efekt elektryczności na tle
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    class ElectricNode {
      constructor(x, y) {
        this.x = x
        this.y = y
        this.baseX = x
        this.baseY = y
        this.density = (Math.random() * 20) + 1
        this.distance = 0
        this.radius = 1
        this.velocity = {
          x: Math.random() * 0.6 - 0.3,
          y: Math.random() * 0.6 - 0.3
        }
        this.connected = []
        this.lastConnected = null
        this.lineWidth = 0.3
      }
      
      update() {
        // Dodaje naturalny ruch
        this.x += this.velocity.x
        this.y += this.velocity.y
        
        // Granice ekranu - odbijanie
        if (this.x > canvas.width - 10 || this.x < 10) this.velocity.x *= -1
        if (this.y > canvas.height - 10 || this.y < 10) this.velocity.y *= -1
        
        // Losowe zmiany w ruchu
        if (Math.random() < 0.02) {
          this.velocity.x = Math.random() * 0.6 - 0.3
          this.velocity.y = Math.random() * 0.6 - 0.3
        }
      }
      
      draw() {
        ctx.fillStyle = '#4F6BFF'
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.closePath()
        ctx.fill()
      }
    }
    
    let particlesArray = []
    
    const createParticles = () => {
      const numberOfParticles = Math.floor(canvas.width * canvas.height / 15000)
      particlesArray = []
      
      for (let i = 0; i < numberOfParticles; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        particlesArray.push(new ElectricNode(x, y))
      }
    }
    
    const connect = () => {
      const maxConnections = 2
      
      particlesArray.forEach(particle => {
        particle.connected = []
      })
      
      // Resetowanie połączeń
      for (let a = 0; a < particlesArray.length; a++) {
        const particleA = particlesArray[a]
        
        // Łączenie do najbliższych punktów
        let sortedParticles = [...particlesArray]
          .filter(p => p !== particleA)
          .sort((p1, p2) => {
            const dist1 = Math.hypot(particleA.x - p1.x, particleA.y - p1.y)
            const dist2 = Math.hypot(particleA.x - p2.x, particleA.y - p2.y)
            return dist1 - dist2
          })
          .slice(0, maxConnections)
        
        // Losowa szansa na pominięcie niektórych połączeń (piorun nie jest zbyt regularny)
        sortedParticles = sortedParticles.filter(() => Math.random() > 0.2)
        
        for (let b = 0; b < sortedParticles.length; b++) {
          const particleB = sortedParticles[b]
          
          // Sprawdź czy nie mamy za wielu połączeń
          if (particleA.connected.length >= maxConnections) break
          if (particleB.connected.length >= maxConnections) continue
          
          const distance = Math.hypot(particleA.x - particleB.x, particleA.y - particleB.y)
          const maxDistance = canvas.width / 10  // Maksymalna długość łączenia
          
          if (distance < maxDistance) {
            // Rejestruj to połączenie
            particleA.connected.push(particleB)
            particleB.connected.push(particleA)
            
            // Rysuj iskrę elektryczną (linię)
            const opacity = 1 - (distance / maxDistance)
            const strength = Math.random() * 0.5 + 0.5 // Losowa siła iskry
            
            // Główna linia
            ctx.beginPath()
            ctx.moveTo(particleA.x, particleA.y)
            
            // Losowo zakrzywiona linia (zygzak) dla efektu elektrycznego
            let currentX = particleA.x
            let currentY = particleA.y
            const segments = Math.floor(distance / 20) + 1
            
            for (let i = 1; i <= segments; i++) {
              const ratio = i / segments
              // Zakrzywienie - odchylenie od prostej linii
              const offsetX = (Math.random() - 0.5) * 10 * ratio
              const offsetY = (Math.random() - 0.5) * 10 * ratio
              
              currentX = particleA.x + (particleB.x - particleA.x) * ratio + offsetX
              currentY = particleA.y + (particleB.y - particleA.y) * ratio + offsetY
              
              ctx.lineTo(currentX, currentY)
            }
            
            // Końcowy punkt
            ctx.lineTo(particleB.x, particleB.y)
            
            // Stylizacja linii elektrycznej
            const gradient = ctx.createLinearGradient(
              particleA.x, particleA.y, particleB.x, particleB.y
            )
            
            gradient.addColorStop(0, `rgba(79, 107, 255, ${opacity * strength})`)
            gradient.addColorStop(0.5, `rgba(124, 189, 255, ${opacity * strength * 1.2})`)
            gradient.addColorStop(1, `rgba(79, 107, 255, ${opacity * strength})`)
            
            ctx.strokeStyle = gradient
            ctx.lineWidth = 1.2 * strength
            ctx.stroke()
            
            // Dodanie blasku w miejscach połączeń
            const glowRadius = 2 + Math.random() * 3
            ctx.beginPath()
            ctx.arc(currentX, currentY, glowRadius, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(194, 217, 255, ${opacity * 0.8})`
            ctx.fill()
          }
        }
      }
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Dodaj efekt wyładowania elektrycznego
      ctx.fillStyle = 'rgba(11, 30, 80, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      particlesArray.forEach(particle => {
        particle.update()
        particle.draw()
      })
      
      connect()
      
      // Efekt poświaty
      if (Math.random() < 0.05) {
        ctx.fillStyle = 'rgba(124, 189, 255, 0.03)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      
      requestRef.current = requestAnimationFrame(animate)
    }
    
    createParticles()
    animate()
    
    return () => {
      cancelAnimationFrame(requestRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  // Animacje dla elementów interfejsu
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
      description: "Planowanie i zarządzanie transportami w intuicyjnym kalendarzu. Wszystko w jednym miejscu.",
      icon: <Calendar className="h-10 w-10" />,
      color: "from-blue-400 to-blue-600",
      path: "/kalendarz"
    },
    {
      title: "Mapa Transportowa",
      description: "Śledzenie tras i optymalizacja przejazdów dzięki interaktywnej mapie z automatycznym liczeniem odległości.",
      icon: <Map className="h-10 w-10" />,
      color: "from-cyan-400 to-blue-500",
      path: "/mapa"
    },
    {
      title: "Panel Spedycji",
      description: "Zarządzaj zleceniami transportowymi, kontroluj status przesyłek i przydzielaj zadania kierowcom.",
      icon: <Truck className="h-10 w-10" />,
      color: "from-blue-500 to-indigo-600",
      path: "/spedycja"
    }
  ]

  return (
    <div className="min-h-[90vh] flex flex-col justify-center relative">
      {/* Canvas dla efektu elektryczności */}
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900"
      />
      
      {/* Hero Section z animacją */}
      <motion.section 
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={containerVariants}
        className="text-center py-16 px-4 sm:px-6 lg:px-8 mb-8 relative z-10"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl mb-4">
            <span className="block">System Zarządzania</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">Transportem</span>
          </h1>
        </motion.div>
        
        <motion.p 
          variants={itemVariants}
          className="mt-3 max-w-md mx-auto text-base text-blue-100 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl"
        >
          Kompleksowe rozwiązanie do zarządzania flotą, kierowcami i przesyłkami.
          Wszystko czego potrzebujesz w jednym miejscu.
        </motion.p>
        
        <motion.div 
          variants={itemVariants}
          className="mt-8 max-w-md mx-auto"
        >
          <Link 
            href="/login"
            className="group relative block"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg shadow-lg transform transition-all duration-300 group-hover:scale-105 group-hover:shadow-blue-400/50"></span>
            <span className="relative block text-white font-semibold py-4 px-8 text-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300">
              Zaloguj się <span className="ml-1 group-hover:translate-x-1 transition-transform duration-200 inline-block">&rarr;</span>
            </span>
          </Link>
        </motion.div>
      </motion.section>

      {/* Animated Features Grid */}
      <motion.section 
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={fadeInVariants}
        className="py-8 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
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
              className="relative rounded-xl overflow-hidden group"
            >
              {/* Card content with electric glow effect */}
              <div className="relative bg-blue-900/40 backdrop-blur-sm p-6 rounded-xl border border-blue-500/20 h-full transition-all duration-300 group-hover:shadow-xl group-hover:shadow-blue-500/10 group-hover:border-blue-400/30">
                {/* Animated icon background */}
                <div className={`absolute opacity-20 group-hover:opacity-30 -inset-4 blur-xl bg-gradient-to-r ${feature.color} transition-opacity duration-300`}></div>
                
                {/* Icon */}
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${feature.color} text-white mb-5 shadow-md shadow-blue-500/20`}>
                  {feature.icon}
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-blue-100/80 mb-4">{feature.description}</p>
                
                {/* Link button */}
                <Link 
                  href={feature.path}
                  className="inline-flex items-center text-cyan-300 font-medium hover:text-cyan-200 transition-colors group/btn"
                >
                  <span>Przejdź</span>
                  <span className="ml-1 group-hover/btn:translate-x-1 transition-transform duration-200">&rarr;</span>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
