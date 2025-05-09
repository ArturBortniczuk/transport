// src/components/TransportRatingBadge.js
'use client'
import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'

export default function TransportRatingBadge({ transportId }) {
  const [rating, setRating] = useState(null)
  const [loading, setLoading] = useState(true)
  const [canBeRated, setCanBeRated] = useState(false)
  
  useEffect(() => {
    const fetchRating = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/transport-ratings?transportId=${transportId}`)
        const data = await response.json()
        
        if (data.success) {
          setRating({
            average: data.averageRating,
            count: data.count
          })
          setCanBeRated(data.canBeRated) // Ustawiamy stan na podstawie odpowiedzi API
        }
      } catch (error) {
        console.error('Błąd pobierania oceny:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (transportId) {
      fetchRating()
    }
  }, [transportId])
  
  if (loading) {
    return (
      <div className="w-10 h-5 bg-gray-100 rounded animate-pulse"></div>
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
