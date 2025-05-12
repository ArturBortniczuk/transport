// src/components/TransportRatingBadge.js - uproszczona wersja
'use client'
import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'

export default function TransportRatingBadge({ transportId }) {
  const [ratingData, setRatingData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    let isMounted = true
    
    if (!transportId) {
      setLoading(false)
      return
    }
    
    const fetchRating = async () => {
      try {
        const response = await fetch(`/api/transport-ratings?transportId=${transportId}`)
        const data = await response.json()
        
        if (isMounted && data.success) {
          setRatingData({
            average: data.averageRating,
            count: data.count,
            canBeRated: data.canBeRated
          })
        }
      } catch (error) {
        console.error('Błąd pobierania oceny:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    fetchRating()
    
    return () => {
      isMounted = false
    }
  }, [transportId])
  
  if (loading) {
    return <span className="text-gray-400 text-sm">...</span>
  }
  
  if (!ratingData || ratingData.count === 0) {
    return (
      <span className="text-gray-400 text-sm">Brak oceny</span>
    )
  }
  
  const getColor = (avg) => {
    if (avg >= 4.5) return 'bg-green-500'
    if (avg >= 3.5) return 'bg-green-400'
    if (avg >= 2.5) return 'bg-yellow-400'
    if (avg >= 1.5) return 'bg-orange-400'
    return 'bg-red-500'
  }
  
  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-md ${getColor(ratingData.average)}`}>
      <span className="text-white font-medium mr-1">{ratingData.average.toFixed(1)}</span>
      <Star size={14} className="text-white fill-white" />
    </div>
  )
}
