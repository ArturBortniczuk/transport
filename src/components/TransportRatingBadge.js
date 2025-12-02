// src/components/TransportRatingBadge.js - OSTATECZNA POPRAWKA: Powrót do logiki API z bezwzględnym priorytetem "R"
'use client'
import { useState, useEffect } from 'react'
import { Star, StarOff } from 'lucide-react'

export default function TransportDetailedRatingBadge({ 
  transportId, 
  refreshTrigger = 0, 
  type = 'transport' // 'transport' lub 'spedition'
}) {
  // UWAGA: Stan isResolved jest pobierany asynchronicznie przez API.
  const [rating, setRating] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const fetchRating = async () => {
      try {
        setLoading(true)
        
        // Wybierz właściwe API w zależności od typu
        const apiUrl = type === 'spedition' 
          ? `/api/spedition-detailed-ratings?speditionId=${transportId}`
          : `/api/transport-detailed-ratings?transportId=${transportId}`
        
        const response = await fetch(apiUrl)
        const data = await response.json()
        
        if (data.success) {
          setRating({
            totalRatings: data.stats.totalRatings,
            overallPercentage: data.stats.overallRatingPercentage,
            canBeRated: data.canBeRated,
            hasUserRated: data.hasUserRated,
            // Kluczowe: Flaga 'isResolved' z API jest pobierana dla obu typów
            isResolved: data.hasResolution || false
          })
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
  }, [transportId, refreshTrigger, type])
  
  if (loading) {
    // Widok ładowania, gdy czekamy na dane (w tym isResolved)
    return (
      <div className="w-20 h-5 bg-gray-100 rounded animate-pulse"></div>
    )
  }
  
  // =================================================================
  // LOGIKA PRIORYTETU "ROZWIĄZANE"
  // Wykonywana natychmiast po załadowaniu danych (loading === false).
  // =================================================================
  if (rating?.isResolved) {
    return (
      <div className="flex items-center">
        <div className="flex items-center px-2 py-1 rounded-md text-sm font-bold bg-purple-600 text-white">
          R
        </div>
      </div>
    )
  }

  // =================================================================
  // LOGIKA BRAKU OCENY I STANDARDOWA OCENA PROCENTOWA
  // Wykonywana tylko, gdy transport/spedycja NIE JEST rozwiązany.
  // =================================================================
  if (!rating || rating.totalRatings === 0) {
    return (
      <span className="text-gray-400 text-sm flex items-center">
        <StarOff size={14} className="mr-1" />
        Brak oceny
      </span>
    )
  }
  
  // Określ kolor na podstawie procentu
  const getColorClass = (percentage) => {
    if (percentage >= 80) return 'bg-green-500 text-white'
    if (percentage >= 60) return 'bg-yellow-500 text-white'
    if (percentage >= 40) return 'bg-orange-500 text-white'
    return 'bg-red-500 text-white'
  }
  
  // Standardowe wyświetlanie oceny procentowej
  return (
    <div className="flex items-center">
      <div className={`flex items-center px-2 py-1 rounded-md text-sm font-medium ${getColorClass(rating.overallPercentage)}`}>
        <Star size={14} className="mr-1 fill-current" />
        {rating.overallPercentage}%
      </div>
    </div>
  )
}