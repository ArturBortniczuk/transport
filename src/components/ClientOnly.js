'use client'
import { useEffect, useState } from 'react'

export default function ClientOnly({ children }) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return <div className="flex justify-center items-center h-[500px] bg-gray-100">
      <p className="text-gray-500">Ładowanie...</p>
    </div>
  }

  return <>{children}</>
}