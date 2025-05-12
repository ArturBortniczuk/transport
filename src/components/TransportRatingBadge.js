// src/components/TransportRatingBadge.js
'use client'
import { useState, useEffect, useRef } from 'react'
import { Star } from 'lucide-react'

export default function TransportRatingBadge({ transportId, refreshTrigger = 0, onCanBeRatedChange }) {
  const [rating, setRating] = useState(null)
  const [loading, setLoading] = useState(true)
  const [canBeRated, setCanBeRated] = useState(false)
  // Dodajmy ref do śledzenia, czy komponent jest zamontowany
  const isMounted = useRef(true)
  // Dodajmy ref do śledzenia, czy dane zostały już pobrane
  const dataFetched = useRef(false)
  
  useEffect(() => {
    // Ustaw flagę montowania przy tworzeniu komponentu
    isMounted.current = true
    
    return () => {
      // Wyczyść flagę przy odmontowywaniu komponentu
      isMounted.current = false
    }
  }, [])
  
  useEffect(() => {
    // Jeśli nie mamy ID transportu lub dane już zostały pobrane, nie rób nic
    if (!transportId || (dataFetched.current && !refreshTrigger)) return
    
    const fetchRating = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/transport-ratings?transportId=${transportId}`)
        const data = await response.json()
        
        // Sprawdź, czy komponent nadal jest zamontowany przed aktualizacją stanu
        if (!isMounted.current) return
        
        if (data.success) {
          setRating({
            average: data.averageRating,
            count: data.count
          })
          setCanBeRated(data.canBeRated)
          
          // Oznacz, że dane zostały pobrane
          dataFetched.current = true
          
          // Przekaż informację o możliwości oceny na zewnątrz
          if (onCanBeRatedChange) {
            onCanBeRatedChange(data.canBeRated)
          }
          
          // Zapisujemy w localStorage, aby inne komponenty mogły to odczytać
          if (typeof window !== 'undefined') {
            localStorage.setItem(`transport-${transportId}-ratable`, data.canBeRated)
          }
        }
      } catch (error) {
        console.error('Błąd pobierania oceny:', error)
      } finally {
        // Sprawdź, czy komponent nadal jest zamontowany przed aktualizacją stanu
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }
    
    fetchRating()
  }, [transportId, refreshTrigger, onCanBeRatedChange])
  
  // Dodajmy opóźnienie dla stanu ładowania, aby uniknąć migotania
  useEffect(() => {
    if (!loading || !dataFetched.current) return
    
    // Jeśli dane są już załadowane, ale migocze, dodajmy małe opóźnienie
    const timer = setTimeout(() => {
      if (isMounted.current) {
        setLoading(false)
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [loading])
  
  if (loading && !dataFetched.current) {
    return (
      <div className="w-24 h-5 bg-gray-100 rounded animate-pulse"></div>
    )
  }
  
  if (!rating || rating.count === 0) {
    return (
      <span className="text-gray-400 text-sm flex items-center">
        <Star size={14} className="mr-1 text-gray-300" />
        Brak oceny
      </span>
    )
  }
  
  // Określenie koloru na podstawie średniej oceny
  const getColor = (avg) => {
    if (avg >= 4.5) return 'bg-green-500'
    if (avg >= 3.5) return 'bg-green-400'
    if (avg >= 2.5) return 'bg-yellow-400'
    if (avg >= 1.5) return 'bg-orange-400'
    return 'bg-red-500'
  }
  
  return (
    <div className="flex items-center">
      <div className={`flex items-center px-2 py-1 rounded-md ${getColor(rating.average)}`}>
        <span className="text-white font-medium mr-1">{rating.average.toFixed(1)}</span>
        <Star size={14} className="text-white fill-white" />
      </div>
    </div>
  )
}
