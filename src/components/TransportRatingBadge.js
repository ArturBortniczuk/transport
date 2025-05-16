// src/components/TransportRatingBadge.js - zmodyfikowana wersja
'use client'
import { useState, useEffect, useRef } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

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
          if (data.ratings && data.ratings.length > 0) {
            setRating({
              isPositive: data.isPositive
            })
          } else {
            setRating(null) // Brak oceny
          }
          
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
  
  if (!rating) {
    return (
      <span className="text-gray-400 text-sm flex items-center">
        Brak oceny
      </span>
    )
  }
  
  return (
    <div className="flex items-center">
      <div className={`flex items-center px-2 py-1 rounded-md ${rating.isPositive ? 'bg-green-500' : 'bg-red-500'}`}>
        {rating.isPositive ? (
          <ThumbsUp size={16} className="text-white" />
        ) : (
          <ThumbsDown size={16} className="text-white" />
        )}
      </div>
    </div>
  )
}
