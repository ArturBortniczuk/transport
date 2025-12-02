// src/components/CompleteRatingModal.js - Z FUNKCJĄ ROZWIĄZANIA PROBLEMU
'use client'
import { useState, useEffect } from 'react'
import { X, ThumbsUp, ThumbsDown, CheckCircle, AlertCircle, MessageSquare, Edit, Send, Shield, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export default function CompleteRatingModal({ transport, onClose, onSuccess, getMagazynName }) {
  const [ratings, setRatings] = useState({
    driverProfessional: null,
    driverTasksCompleted: null,
    cargoComplete: null,
    cargoCorrect: null,
    deliveryNotified: null,
    deliveryOnTime: null
  })
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [otherProblem, setOtherProblem] = useState(false)
  
  // Stan ocen
  const [hasMainRating, setHasMainRating] = useState(false)
  const [userHasRated, setUserHasRated] = useState(false)
  const [overallPercentage, setOverallPercentage] = useState(null)
  const [ratingToLoad, setRatingToLoad] = useState(null);

  
  // Komentarze
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const [allComments, setAllComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)

  // NOWE: Stan rozwiązania problemu
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasResolution, setHasResolution] = useState(false)
  const [resolutionInfo, setResolutionInfo] = useState(null)
  const [resolutionText, setResolutionText] = useState('')
  const [submittingResolution, setSubmittingResolution] = useState(false)

  // Kategorie oceny
  const categories = [
    {
      id: 'driver',
      title: '👤 Kierowca',
      criteria: [
        { key: 'driverProfessional', text: 'Kulturalny i profesjonalny' },
        { key: 'driverTasksCompleted', text: 'Wykonał wszystkie zadania' }
      ]
    },
    {
      id: 'cargo',
      title: '📦 Towar',
      criteria: [
        { key: 'cargoComplete', text: 'Pełna ilość' },
        { key: 'cargoCorrect', text: 'Odpowiedni asortyment' }
      ]
    },
    {
      id: 'delivery',
      title: '🚚 Organizacja dostawy',
      criteria: [
        { key: 'deliveryNotified', text: 'Zgłoszenie dostawy' },
        { key: 'deliveryOnTime', text: 'Dostawa na czas' }
      ]
    }
  ]

  useEffect(() => {
    checkAdminStatus()
    loadExistingRating()
    fetchComments()
  }, [transport.id])

  // NOWA FUNKCJA: Sprawdzenie czy użytkownik jest adminem
  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/check-admin')
      const data = await response.json()
      setIsAdmin(data.isAdmin || false)
    } catch (error) {
      console.error('Błąd sprawdzania statusu admina:', error)
      setIsAdmin(false)
    }
  }

  const loadExistingRating = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/transport-detailed-ratings?transportId=${transport.id}`)
      const data = await response.json()
      
      if (data.success) {
        const hasRating = data.stats.totalRatings > 0
        
        setHasMainRating(hasRating)
        setUserHasRated(data.hasUserRated)
        setOverallPercentage(data.stats.overallRatingPercentage)
        
        // NOWE: Załaduj informacje o rozwiązaniu
        setHasResolution(data.hasResolution || false)
        setResolutionInfo(data.resolutionInfo || null)
        setRatingToLoad(data.latestRating || null);

        
        const ratingToLoad = data.rating || (data.allRatings && data.allRatings[0])
        
        if (ratingToLoad) {
          setRatings({
            driverProfessional: ratingToLoad.driver_professional,
            driverTasksCompleted: ratingToLoad.driver_tasks_completed,
            cargoComplete: ratingToLoad.cargo_complete,
            cargoCorrect: ratingToLoad.cargo_correct,
            deliveryNotified: ratingToLoad.delivery_notified,
            deliveryOnTime: ratingToLoad.delivery_on_time
          })
          setComment(ratingToLoad.comment || '')
          setOtherProblem(ratingToLoad.other_problem || false)
        }
      }
    } catch (error) {
      console.error('Błąd pobierania oceny:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      setLoadingComments(true)
      const response = await fetch(`/api/transport-comments?transportId=${transport.id}`)
      const data = await response.json()
      
      if (data.success) {
        setAllComments(data.comments || [])
      }
    } catch (error) {
      console.error('Błąd pobierania komentarzy:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // ZMIENIONE: Sprawdź czy rozwiązanie już istnieje
    if (hasResolution) {
      setError('Nie można edytować oceny - administrator dodał już rozwiązanie problemu')
      return
    }
    
    if (otherProblem) {
      if (!comment || comment.trim() === '') {
        setError('Przy wyborze "Inny problem" komentarz jest wymagany')
        return
      }
    } else {
      const allRated = Object.values(ratings).every(rating => rating !== null)
      if (!allRated) {
        setError('Proszę ocenić wszystkie kryteria lub zaznaczyć "Inny problem"')
        return
      }
    }

    setSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/transport-detailed-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transportId: transport.id,
          ratings: otherProblem ? {} : ratings,
          comment,
          otherProblem
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        await loadExistingRating()
        setIsEditMode(false)
        
        setTimeout(() => {
          if (onSuccess) onSuccess()
        }, 1500)
      } else {
        setError(data.error || 'Wystąpił błąd podczas zapisywania oceny')
      }
    } catch (error) {
      console.error('Błąd zapisywania oceny:', error)
      setError('Wystąpił błąd podczas zapisywania oceny')
    } finally {
      setSubmitting(false)
    }
  }

  // NOWA FUNKCJA: Dodanie rozwiązania problemu przez admina
  const handleSubmitResolution = async (e) => {
    e.preventDefault()
    
    if (!resolutionText.trim()) {
      setError('Treść rozwiązania jest wymagana')
      return
    }

    setSubmittingResolution(true)
    setError('')

    try {
      const response = await fetch('/api/transport-detailed-ratings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transportId: transport.id,
          resolution: resolutionText.trim()
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setResolutionText('')
        await loadExistingRating() // Odśwież dane
        
        setTimeout(() => {
          setSuccess(false)
        }, 3000)
      } else {
        setError(data.error || 'Wystąpił błąd podczas zapisywania rozwiązania')
      }
    } catch (error) {
      console.error('Błąd zapisywania rozwiązania:', error)
      setError('Wystąpił błąd podczas zapisywania rozwiązania')
    } finally {
      setSubmittingResolution(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    
    try {
      setAddingComment(true)
      setError('')
      
      const response = await fetch('/api/transport-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transportId: transport.id,
          comment: newComment.trim()
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setNewComment('')
        await fetchComments()
      } else {
        setError(result.error || 'Nie udało się dodać komentarza')
      }
    } catch (error) {
      console.error('Błąd dodawania komentarza:', error)
      setError('Wystąpił błąd podczas dodawania komentarza')
    } finally {
      setAddingComment(false)
    }
  }

  const RatingButton = ({ criteriaKey, value, label }) => {
    const isSelected = ratings[criteriaKey] === value
    const disabled = (hasMainRating && !isEditMode) || hasResolution // ZMIENIONE: Dodano hasResolution
    
    const baseClasses = "flex items-center px-3 py-2 rounded-md border text-sm font-medium transition-colors"
    
    if (disabled) {
      const readOnlyClasses = value !== null 
        ? (value ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300")
        : "bg-gray-50 text-gray-400 border-gray-200"
      
      return (
        <div className={`${baseClasses} ${readOnlyClasses} cursor-not-allowed`}>
          {value ? <ThumbsUp size={16} className="mr-1" /> : <ThumbsDown size={16} className="mr-1" />}
          {label}
        </div>
      )
    }
    
    const selectedClasses = value 
      ? "bg-green-100 text-green-700 border-green-300"
      : "bg-red-100 text-red-700 border-red-300"
    const unselectedClasses = "bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100"
    
    return (
      <button
        type="button"
        onClick={() => setRatings(prev => ({ ...prev, [criteriaKey]: value }))}
        className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
      >
        {value ? <ThumbsUp size={16} className="mr-1" /> : <ThumbsDown size={16} className="mr-1" />}
        {label}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full p-6">
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {!hasMainRating 
                  ? 'Oceń transport' 
                  : 'Ocena i komentarze transportu'
                }
              </h2>
              <p className="text-gray-600 mt-1">
                {transport.destination_city} - {transport.client_name} 
                {getMagazynName && ` (${getMagazynName(transport.source_warehouse)})`}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* NOWE: Informacja o blokadzie gdy istnieje rozwiązanie */}
          {hasResolution && (
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-start">
              <Lock size={20} className="text-purple-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-900 font-medium">Transport rozwiązany</p>
                <p className="text-purple-700 text-sm mt-1">
                  Administrator dodał rozwiązanie problemu. Ocena i komentarze zostały zablokowane.
                </p>
              </div>
            </div>
          )}

          {/* Komunikaty */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md flex items-center">
              <CheckCircle size={16} className="mr-2" />
              {submittingResolution 
                ? 'Rozwiązanie zostało dodane!' 
                : (userHasRated ? 'Ocena została zaktualizowana!' : 'Ocena została zapisana!')
              }
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md flex items-center">
              <AlertCircle size={16} className="mr-2" />
              {error}
            </div>
          )}

          {/* SEKCJA OCENY */}
          {hasMainRating && !isEditMode && (
            <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold mb-4 text-blue-900">
                ⭐ Ocena transportu: {overallPercentage}%
              </h3>
              {ratingToLoad && (
                <div className="text-sm text-gray-600 mt-1">
                  Oceniający: {ratingToLoad.rater_name || ratingToLoad.rater_email}, {ratingToLoad.created_at && format(new Date(ratingToLoad.created_at), 'dd.MM.yyyy, HH:mm', { locale: pl })}
                </div>
              )}
              
              {otherProblem && (
                <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">⚠️ Zaznaczono: Inny problem</p>
                </div>
              )}
              
              {!otherProblem && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {categories.map(category => (
                    <div key={category.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <h4 className="font-medium text-sm mb-3 text-gray-800">{category.title}</h4>
                      {category.criteria.map(criteria => {
                        const ratingValue = ratings[criteria.key]
                        
                        return (
                          <div key={criteria.key} className={`flex items-center justify-between text-sm mb-2 p-2 rounded ${
                            ratingValue ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                          }`}>
                            <span className="text-gray-700 text-xs flex-1 mr-2">{criteria.text}</span>
                            <div className="flex items-center">
                              {ratingValue ? (
                                <>
                                  <ThumbsUp size={14} className="text-green-600 mr-1" />
                                  <span className="text-green-700 text-xs font-medium">TAK</span>
                                </>
                              ) : (
                                <>
                                  <ThumbsDown size={14} className="text-red-600 mr-1" />
                                  <span className="text-red-700 text-xs font-medium">NIE</span>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}

              {comment && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                  <h5 className="font-medium text-sm text-blue-800 mb-2">💬 Komentarz do oceny:</h5>
                  <p className="text-gray-700 text-sm italic">"{comment}"</p>
                </div>
              )}

              {userHasRated && !hasResolution && (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mt-4"
                >
                  <Edit size={16} className="mr-2" />
                  Edytuj swoją ocenę
                </button>
              )}
            </div>
          )}

          {/* Formularz oceny */}
          {(!hasMainRating || isEditMode) && !hasResolution && (
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="p-6 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">
                  {userHasRated ? 'Edytuj ocenę' : 'Dodaj ocenę'}
                </h3>

                <div className="mb-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={otherProblem}
                      onChange={(e) => setOtherProblem(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      🚨 Inny problem (wymaga komentarza)
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Zaznacz jeśli wystąpił problem nieujęty w poniższych kategoriach.
                    W takim przypadku komentarz jest wymagany.
                  </p>
                </div>
                
                {!otherProblem && (
                  <div className="space-y-6">
                    {categories.map(category => (
                      <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium mb-3 text-gray-800">{category.title}</h4>
                        
                        {category.criteria.map(criteria => (
                          <div key={criteria.key} className="mb-3 last:mb-0">
                            <p className="text-sm text-gray-700 mb-2">{criteria.text}</p>
                            <div className="flex space-x-2">
                              <RatingButton criteriaKey={criteria.key} value={true} label="TAK" />
                              <RatingButton criteriaKey={criteria.key} value={false} label="NIE" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MessageSquare className="inline w-4 h-4 mr-1" />
                    Komentarz {otherProblem && <span className="text-red-600">*</span>}
                    {otherProblem ? ' (wymagany)' : ' (opcjonalnie)'}
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500"
                    placeholder={otherProblem ? "Opisz problem..." : "Dodaj komentarz do oceny..."}
                  />
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Anuluj
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Zapisywanie...' : (userHasRated ? 'Aktualizuj ocenę' : 'Zapisz ocenę')}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SEKCJA KOMENTARZY */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              Komentarze i dyskusja
            </h3>

            {/* Formularz dodawania komentarza - tylko gdy nie ma rozwiązania */}
            {!hasResolution && (
              <div className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="Dodaj komentarz do tego transportu..."
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddComment}
                    disabled={addingComment || !newComment.trim()}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Send size={16} className="mr-2" />
                    {addingComment ? 'Wysyłanie...' : 'Dodaj komentarz'}
                  </button>
                </div>
              </div>
            )}

            {/* Lista komentarzy */}
            <div className="space-y-4">
              {loadingComments ? (
                <div className="text-center py-4 text-gray-500">Ładowanie komentarzy...</div>
              ) : allComments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Brak komentarzy</p>
                  <p className="text-sm mt-1">Bądź pierwszy który skomentuje ten transport</p>
                </div>
              ) : (
                allComments.map((commentItem, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{commentItem.commenter_email}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {commentItem.created_at && format(new Date(commentItem.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm">{commentItem.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* NOWA SEKCJA: Rozwiązanie problemu przez admina */}
          {hasMainRating && isAdmin && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-purple-600" />
                Rozwiązanie problemu (Administrator)
              </h3>

              {hasResolution ? (
                // Wyświetl istniejące rozwiązanie
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-start mb-4">
                    <CheckCircle className="w-6 h-6 text-purple-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-purple-900 mb-2">Rozwiązanie dodane</h4>
                      <p className="text-gray-700 text-sm mb-3">{resolutionInfo.text}</p>
                      <div className="flex items-center text-xs text-purple-700">
                        <span className="font-medium mr-2">Dodane przez:</span>
                        <span>{resolutionInfo.addedBy}</span>
                        <span className="mx-2">•</span>
                        <span>{format(new Date(resolutionInfo.addedAt), 'dd.MM.yyyy HH:mm', { locale: pl })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-100 rounded-lg p-3">
                    <p className="text-sm text-purple-800 flex items-center">
                      <Lock size={14} className="mr-2" />
                      Ocena i komentarze zostały zablokowane po dodaniu rozwiązania
                    </p>
                  </div>
                </div>
              ) : (
                // Formularz dodawania rozwiązania
                <form onSubmit={handleSubmitResolution}>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <p className="text-sm text-purple-800 mb-4 flex items-start">
                      <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                      <span>
                        Dodanie rozwiązania <strong>trwale zablokuje</strong> możliwość edycji oceny i dodawania komentarzy do tego transportu.
                      </span>
                    </p>
                    
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opis rozwiązania problemu
                    </label>
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-purple-500"
                      placeholder="Opisz jak problem został rozwiązany..."
                      required
                    />
                    
                    <div className="flex justify-end mt-4">
                      <button
                        type="submit"
                        disabled={submittingResolution || !resolutionText.trim()}
                        className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        <Shield size={16} className="mr-2" />
                        {submittingResolution ? 'Zapisywanie...' : 'Dodaj rozwiązanie i zablokuj'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}