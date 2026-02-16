import { useEffect, useState, useRef } from 'react'

export type HistoryEntry = {
  id: string
  prompt: string
  createdAt: string // ISO date
}

const HISTORY_KEY = 'videoHistory_v1'

export function useVideoHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [videoCache, setVideoCache] = useState<Record<string, string>>({})
  const cacheRef = useRef<Record<string, string>>({})

  // Keep ref in sync with state
  useEffect(() => {
    cacheRef.current = videoCache
  }, [videoCache])

  // Load history from localStorage on mount; revoke cached URLs on unmount
  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      try {
        setHistory(JSON.parse(raw))
      } catch (e) {
        console.warn('Failed to parse history', e)
      }
    }
    return () => {
      Object.values(cacheRef.current).forEach((u) => {
        try { URL.revokeObjectURL(u) } catch (_) {}
      })
    }
  }, [])

  const addEntry = (prompt: string): HistoryEntry => {
    const entry: HistoryEntry = {
      id: String(Date.now()),
      prompt,
      createdAt: new Date().toISOString(),
    }
    const next = [entry, ...history].slice(0, 100)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    setSelectedId(entry.id)
    return entry
  }

  const deleteEntry = (id: string) => {
    const next = history.filter((h) => h.id !== id)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))

    const url = cacheRef.current[id]
    if (url) {
      try { URL.revokeObjectURL(url) } catch (_) {}
      const copy = { ...cacheRef.current }
      delete copy[id]
      setVideoCache(copy)
      cacheRef.current = copy
    }

    if (selectedId === id) {
      setSelectedId(null)
    }

    return selectedId === id
  }

  const getCachedUrl = (id: string): string | undefined => videoCache[id]

  const cacheVideo = (id: string, url: string) => {
    const copy = { ...cacheRef.current, [id]: url }
    setVideoCache(copy)
    cacheRef.current = copy
  }

  /** Revoke a video URL if it's not in the cache */
  const safeRevoke = (url: string | null) => {
    if (!url) return
    const isCached = Object.values(cacheRef.current).includes(url)
    if (!isCached) {
      try { URL.revokeObjectURL(url) } catch (_) {}
    }
  }

  return {
    history,
    selectedId,
    setSelectedId,
    videoCache,
    cacheRef,
    addEntry,
    deleteEntry,
    getCachedUrl,
    cacheVideo,
    safeRevoke,
  }
}
