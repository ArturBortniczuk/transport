'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
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

  const backgroundStyle = {
    backgroundImage: `linear-gradient(135deg, #003580 0%, #001c40 100%)`,
    backgroundSize: 'cover',
    backgroundAttachment: 'fixed',
    backgroundPosition: `center ${scrollY * 0.3}px`
  }

  return (
    <div className="space-y-0 font-sans">
      {/* Hero Section */}
      <section 
        className="relative overflow-hidden py-20 px-6 text-white"
        style={backgroundStyle}
      >
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl font-bold mb-4 text-blue-100"
          >
            Panel Wewnętrzny
          </motion.h1>
          <p className="text-lg text-blue-200 mb-6">
            Narzędzie do zarządzania transportem, flotą i zespołem w Twojej firmie.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href="/login"
              className="inline-flex items-center px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow hover:bg-blue-50 transition"
            >
              Zaloguj się <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Quick Access */}
      <section className="bg-white py-16 border-t border-b border-blue-100">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[{
            icon: <Calendar className="text-blue-600 w-8 h-8" />, title: 'Kalendarz', href: '/kalendarz'
          }, {
            icon: <Truck className="text-blue-600 w-8 h-8" />, title: 'Flota', href: '/flota'
          }, {
            icon: <Users className="text-blue-600 w-8 h-8" />, title: 'Zespół', href: '/zespol'
          }].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={item.href} className="group block p-6 rounded-xl shadow border hover:shadow-md hover:border-blue-300 transition">
                <div className="flex items-center space-x-4">
                  {item.icon}
                  <span className="text-lg font-medium text-gray-800 group-hover:text-blue-700">{item.title}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-50 py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-semibold text-blue-900 mb-4"
          >
            Potrzebujesz pomocy lub chcesz zgłosić sugestię?
          </motion.h2>
          <p className="text-blue-700 mb-6">
            Skontaktuj się z działem IT lub wyślij zgłoszenie bezpośrednio z panelu użytkownika.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href="/support"
              className="inline-flex items-center px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg shadow hover:bg-blue-800 transition"
            >
              Przejdź do wsparcia <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
