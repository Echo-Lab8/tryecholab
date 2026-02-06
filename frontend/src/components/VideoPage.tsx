import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './VideoPage.css'

type HistoryEntry = {
  id: string
  prompt: string
  createdAt: string // ISO
}

const HISTORY_KEY = 'videoHistory_v1'

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

  // WebSocket streaming states
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string>('')
  const [fps, setFps] = useState<number>(24)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoWsRef = useRef<WebSocket | null>(null)
  const audioWsRef = useRef<WebSocket | null>(null)
  
  // Frame and audio queues
  const frameQueueRef = useRef<Map<number, string>>(new Map())
  const audioQueueRef = useRef<AudioBuffer[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const nextFrameIndexRef = useRef<number>(0)
  const nextAudioIndexRef = useRef<number>(0)
  
  // Playback control
  const playbackStartTimeRef = useRef<number | null>(null)
  const playbackIntervalRef = useRef<number | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const isPlayingRef = useRef<boolean>(false)
  const streamStartTimeRef = useRef<number | null>(null)
  
  // Generation complete flags
  const videoCompleteRef = useRef<boolean>(false)
  const audioCompleteRef = useRef<boolean>(false)
  const totalFramesRef = useRef<number>(0)

  useEffect(() => {
    cacheRef.current = videoCache
  }, [videoCache])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        try { window.clearInterval(timerRef.current) } catch (_) {}
        timerRef.current = null
      }
      cleanupWebSockets()
      cleanupPlayback()
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
      setPrompt(initialPrompt)
      generate(initialPrompt)
    }

    return () => {
      Object.values(cacheRef.current).forEach((u) => { try { URL.revokeObjectURL(u) } catch (_) {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanupWebSockets = () => {
    if (videoWsRef.current) {
      videoWsRef.current.close()
      videoWsRef.current = null
    }
    if (audioWsRef.current) {
      audioWsRef.current.close()
      audioWsRef.current = null
    }
  }

  const cleanupPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop()
      } catch (_) {}
      audioSourceRef.current = null
    }
    isPlayingRef.current = false
  }

  const startVideoWebSocket = (prompt: string) => {
    const wsUrl = `ws://localhost:8000/ws/video`
    console.log('Connecting to video WebSocket:', wsUrl)
    
    const ws = new WebSocket(wsUrl)
    videoWsRef.current = ws

    ws.onopen = () => {
      console.log('Video WebSocket connected')
      setStreamStatus('Receiving video frames...')

      // Send request to WebSocket server
      ws.send(JSON.stringify({
        prompts: [prompt, prompt, prompt, prompt, prompt],
        blocks_per_chunk: 5,
        switch_frame_indices: [96, 192, 288, 384],
        reprompts: null
      }));

      setTimeout(() => {
          if (!isPlayingRef.current) {
            startPlayback()
          }
        }, 30000)
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'start') {
        // Received FPS and metadata
        setFps(data.fps)
        
        // Set the stream start time when we receive the start message
        if (!streamStartTimeRef.current) {
          streamStartTimeRef.current = performance.now()
        }
        
        // Schedule playback to start after 5 seconds
        // TODO: video socket needs to have a "start" data.type
        setTimeout(() => {
          if (!isPlayingRef.current) {
            startPlayback()
          }
        }, 5000)
        
      } else if (data.type === 'frame') {
        // Received a frame
        const frameIndex = data.frame_index
        
        // Decode base64 to image URL
        const binaryString = atob(data.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        const blob = new Blob([bytes], { type: 'image/jpeg' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const imageUrl = reader.result as string
          frameQueueRef.current.set(frameIndex, imageUrl)
          console.log(`Queued frame ${frameIndex}, queue size: ${frameQueueRef.current.size}`)
        }
        reader.readAsDataURL(blob)
        
      } else if (data.type === 'done') {
        videoCompleteRef.current = true
        totalFramesRef.current = data.total_frames
        console.log('Video stream complete, total frames:', data.total_frames)
      }
    }

    ws.onerror = (error) => {
      console.error('Video WebSocket error:', error)
      setStreamStatus('Video stream error')
    }

    ws.onclose = () => {
      console.log('Video WebSocket closed')
    }
  }

  const startAudioWebSocket = (prompt: string) => {
    const wsUrl = `ws://localhost:8000/ws/audio`
    console.log('Connecting to audio WebSocket:', wsUrl)
    
    // Initialize AudioContext if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    
    const ws = new WebSocket(wsUrl)
    audioWsRef.current = ws

    ws.onopen = () => {
      console.log('Audio WebSocket connected')

      // Send request to WebSocket server
      ws.send(JSON.stringify({
        question: prompt,
        num_scenes: 5,
      }));
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      const audioContext = audioContextRef.current
      if (!audioContext) {
        console.warn("AudioContext missing, dropping audio chunk")
        return
      }

      if (data.type === 'scene_audio') {
        // Received an audio chunk
        try {
          // Decode base64 audio data
          const binaryString = atob(data.audio_data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          
          // Decode audio buffer
          const audioBuffer = await audioContext.decodeAudioData(bytes.buffer)
          audioQueueRef.current.push(audioBuffer)
          console.log(`Queued audio chunk, queue size: ${audioQueueRef.current.length}`)

        } catch (error) {
          console.error('Error decoding audio chunk:', error)
        }
        
      } else if (data.type === 'scene_complete') {
        console.log('Audio stream complete')
        audioCompleteRef.current = true
      }
    }

    ws.onerror = (error) => {
      console.error('Audio WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Audio WebSocket closed')
    }
  }

  const startPlayback = () => {
    if (isPlayingRef.current) {
      console.log('Playback already started')
      return
    }
    
    console.log('Starting playback after 5 second buffer...')
    setStreamStatus('Playing (still receiving data)...')
    isPlayingRef.current = true
    
    const canvas = canvasRef.current
    if (!canvas) {
      console.error('Canvas not found')
      return
    }
    
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Cannot get canvas context')
      return
    }
    
    // Start audio playback
    if (audioQueueRef.current.length > 0 && audioContextRef.current) {
      playAudioQueue()
    }
    
    // Start video playback
    playbackStartTimeRef.current = performance.now()
    const frameInterval = 1000 / fps
    let currentFrameIndex = 0
    
    const playFrame = () => {
      if (!isPlayingRef.current) {
        return
      }
      
      const imageUrl = frameQueueRef.current.get(currentFrameIndex)
      
      if (imageUrl) {
        const img = new Image()
        img.onload = () => {
          // Set canvas size on first frame
          if (currentFrameIndex === 0) {
            canvas.width = img.width
            canvas.height = img.height
          }
          ctx.drawImage(img, 0, 0)
        }
        img.src = imageUrl
        
        currentFrameIndex++
      } else {
        // Frame not available yet - wait for it
        console.log(`Waiting for frame ${currentFrameIndex}...`)
      }
      
      // Check if playback should end
      // End when we've received all frames AND played them all
      if (videoCompleteRef.current && currentFrameIndex >= totalFramesRef.current) {
        console.log('Playback complete')
        setStreamStatus('Playback complete!')
        stopPlayback()
        return
      }
    }
    
    // Play frames at specified FPS
    playbackIntervalRef.current = window.setInterval(playFrame, frameInterval)
    playFrame() // Play first frame immediately
  }

  const playAudioQueue = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      return
    }
    
    const playNext = (index: number) => {
      if (index >= audioQueueRef.current.length) {
        audioSourceRef.current = null
        audioQueueRef.current = [] // Clear the queue when done
        return
      }

      const buffer = audioQueueRef.current[index]
      if (!audioContextRef.current) {
        playNext(index);
      }
      else {
        const source = audioContextRef.current.createBufferSource()
        source.buffer = buffer
        source.connect(audioContextRef.current.destination)
        source.start(0)
        audioSourceRef.current = source

        source.onended = () => {
          console.log(`Audio chunk ${index + 1} ended`)
          playNext(index + 1) // Play the next buffer
        }
      }
    }

    playNext(0);
  }

  const stopPlayback = () => {
    isPlayingRef.current = false
    cleanupPlayback()
  }

  const generate = async (fromPrompt?: string, addToHistory = true, existingId?: string) => {
    const p = (fromPrompt ?? prompt).trim()
    if (!p) return

    try {
      setLoading(true)
      setIsStreaming(true)

      // Reset state
      videoCompleteRef.current = false
      audioCompleteRef.current = false
      totalFramesRef.current = 0
      frameQueueRef.current.clear()
      audioQueueRef.current = []
      nextFrameIndexRef.current = 0
      nextAudioIndexRef.current = 0
      streamStartTimeRef.current = null // Will be set when we receive 'start' message

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

      // Cleanup existing playback
      cleanupWebSockets()
      cleanupPlayback()

      // revoke the currently-playing URL only if it's not cached for later reuse
      if (videoUrl) {
        const isCached = Object.values(cacheRef.current).includes(videoUrl)
        if (!isCached) {
          try { URL.revokeObjectURL(videoUrl) } catch (_) {}
        }
        setVideoUrl(null)
      }

      // Start both websockets
      startVideoWebSocket(p)
      startAudioWebSocket(p)
      
      setStreamStatus('Connecting to streams...')

      // add to in-memory cache for quick replay
      if (addToHistory) {
        const entry: HistoryEntry = { id: String(Date.now()), prompt: p, createdAt: new Date().toISOString() }
        const next = [entry, ...history].slice(0, 100)
        setHistory(next)
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
        setSelectedId(entry.id)
      } else if (existingId) {
        // when regenerating a previously saved prompt, attach to that id
        setSelectedId(existingId)
      }
    } catch (err: any) {
      console.error(err)
      alert('Failed to generate video: ' + (err?.message ?? err))
      cleanupWebSockets()
      setIsStreaming(false)
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
    const cached = videoCache[entry.id]
    if (cached) {
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
    if (videoUrl) {
      const isCached = Object.values(cacheRef.current).includes(videoUrl)
      if (!isCached) {
        try { URL.revokeObjectURL(videoUrl) } catch (_) {}
      }
    }
    cleanupWebSockets()
    cleanupPlayback()
    setVideoUrl(null)
    setPrompt('')
    setSelectedId(null)
    setIsStreaming(false)
    setStreamStatus('')
  }

  const deleteHistoryItem = (id: string) => {
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
      setVideoUrl(null)
      setPrompt('')
      cleanupWebSockets()
      cleanupPlayback()
      setIsStreaming(false)
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
          {isStreaming ? (
            <div style={{ position: 'relative' }}>
              <canvas 
                ref={canvasRef} 
                className="video-player"
                style={{ width: '100%', height: 'auto', background: '#000' }}
              />
              {streamStatus && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}>
                  {streamStatus}
                </div>
              )}
              {isPlayingRef.current && (
                <button
                  onClick={stopPlayback}
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    padding: '10px 20px',
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          ) : videoUrl ? (
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
