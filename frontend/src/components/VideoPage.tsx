import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './VideoPage.css'

type HistoryEntry = {
  id: string
  prompt: string
  createdAt: string // ISO
}

const HISTORY_KEY = 'videoHistory_v1'

// Helper to request a generated video from the backend and return an object URL
async function requestVideo(prompt: string): Promise<string> {
  const res = await fetch('http://localhost:8000/generate_video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Server responded ${res.status}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return url
}

export default function VideoPage() {
  const location = useLocation()
  const initialPrompt = (location.state as any)?.prompt ?? ''

  const [prompt, setPrompt] = useState(initialPrompt)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [videoCache, setVideoCache] = useState<Record<string, string>>({})
  const cacheRef = useRef<Record<string, string>>({})
  const timerRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    cacheRef.current = videoCache
  }, [videoCache])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        try { window.clearInterval(timerRef.current) } catch (_) {}
        timerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      try {
        setHistory(JSON.parse(raw))
      } catch (e) {
        console.warn('Failed to parse history', e)
      }
    }

    if (initialPrompt) {
      // set the value but wait to push to history until generation succeeds
      setPrompt(initialPrompt)
      generate(initialPrompt)
    }

    return () => {
      // revoke all cached object URLs on unmount
      Object.values(cacheRef.current).forEach((u) => { try { URL.revokeObjectURL(u) } catch (_) {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generate = async (fromPrompt?: string, addToHistory = true, existingId?: string) => {
    const p = (fromPrompt ?? prompt).trim()
    if (!p) return

    try {
      setLoading(true)
      // start timing in tenths of a second (update every 100ms)
      const start = performance.now()
      setElapsed(0)
      if (timerRef.current) {
        try { window.clearInterval(timerRef.current) } catch (_) {}
      }
      timerRef.current = window.setInterval(() => {
        const ms = performance.now() - start
        // round to nearest tenth of a second
        const tenths = Math.round(ms / 100) / 10
        setElapsed(tenths)
      }, 100)
      // revoke the currently-playing URL only if it's not cached for later reuse
      if (videoUrl) {
        const isCached = Object.values(cacheRef.current).includes(videoUrl)
        if (!isCached) {
          try { URL.revokeObjectURL(videoUrl) } catch (_) {}
        }
        setVideoUrl(null)
      }
      const url = await requestVideo(p)
      setVideoUrl(url)

      // add to in-memory cache for quick replay
      if (addToHistory) {
        const entry: HistoryEntry = { id: String(Date.now()), prompt: p, createdAt: new Date().toISOString() }
        const next = [entry, ...history].slice(0, 100)
        setHistory(next)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
        setSelectedId(entry.id)
        setVideoCache((c) => ({ ...c, [entry.id]: url }))
      } else if (existingId) {
        // when regenerating a previously saved prompt, attach to that id
        setSelectedId(existingId)
        setVideoCache((c) => ({ ...c, [existingId]: url }))
      }
    } catch (err: any) {
      console.error(err)
      alert('Failed to generate video: ' + (err?.message ?? err))
    } finally {
      setLoading(false)
      if (timerRef.current) {
        try { window.clearInterval(timerRef.current) } catch (_) {}
        timerRef.current = null
      }
    }
  }

  const selectHistory = (entry: HistoryEntry) => {
    setPrompt(entry.prompt)
    // if we have a cached url for this id, use it; otherwise regenerate without adding duplicate history
    const cached = videoCache[entry.id]
    if (cached) {
      // Only revoke current playing URL if it's not cached elsewhere
      if (videoUrl && videoUrl !== cached) {
        const isCached = Object.values(cacheRef.current).includes(videoUrl)
        if (!isCached) {
          try { URL.revokeObjectURL(videoUrl) } catch (_) {}
        }
      }
      setVideoUrl(cached)
      setSelectedId(entry.id)
    } else {
      generate(entry.prompt, false, entry.id)
    }
  }

  const newVideo = () => {
    // keep history, but clear current video and prompt to start fresh
    if (videoUrl) {
      const isCached = Object.values(cacheRef.current).includes(videoUrl)
      if (!isCached) {
        try { URL.revokeObjectURL(videoUrl) } catch (_) {}
      }
    }
    setVideoUrl(null)
    setPrompt('')
    setSelectedId(null)
  }

  const deleteHistoryItem = (id: string) => {
    // remove from history state and localStorage
    const next = history.filter((h) => h.id !== id)
    setHistory(next)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))

    // revoke cached url if present
    const url = cacheRef.current[id]
    if (url) {
      try { URL.revokeObjectURL(url) } catch (_) {}
      const copy = { ...cacheRef.current }
      delete copy[id]
      setVideoCache(copy)
      cacheRef.current = copy
    }

    // if deleted item was selected, clear main area
    if (selectedId === id) {
      setSelectedId(null)
      setVideoUrl(null)
      setPrompt('')
    }
  }

  return (
    <div className="video-page">
      <aside className="video-history">
        <div className="history-header">
          <div className="history-left">
            <h3>History</h3>
          </div>
          <div className="history-right">
            <button className="btn-primary btn-small" onClick={newVideo}>New</button>
          </div>
        </div>
        <div className="history-list">
          {history.length === 0 && <div className="history-empty">No videos yet — generate one!</div>}
          {history.map((h) => (
            <div
              key={h.id}
              className={`history-item ${selectedId === h.id ? 'selected' : ''}`}
              onClick={() => selectHistory(h)}
              title={h.prompt}
            >
              <div className="history-top">
                <div className="history-prompt">{h.prompt}</div>
                <button
                  className="history-delete"
                  onClick={(e) => { e.stopPropagation(); deleteHistoryItem(h.id) }}
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
              <div className="history-time">{new Date(h.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="video-main">
        <div className="video-container">
          {videoUrl ? (
            <video className="video-player" src={videoUrl} controls autoPlay />
          ) : (
            <div className="video-empty">No video loaded</div>
          )}
        </div>

        <div className="generate-bar">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generate() } }}
            placeholder="Ask something, e.g. 'Explain quantum entanglement in 20s'"
          />
          <button onClick={() => generate()} disabled={loading} className="btn-primary">
            {loading ? `${elapsed.toFixed(1)}s` : 'Generate'}
          </button>
        </div>
      </main>
    </div>
  )
}
