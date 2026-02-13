import { useEffect, useRef, useState } from 'react'

const DEFAULT_NUM_SCENES = 5
const DEFAULT_FPS = 24
const DEFAULT_WAIT_MILLISECOND = 10000

export function useStreamPlayback() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState('')
  const [isBuffering, setIsBuffering] = useState(false)
  const [bufferElapsed, setBufferElapsed] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const bufferTimerRef = useRef<number | null>(null)

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
  const pipelineCompleteRef = useRef<boolean>(false)
  const totalFramesRef = useRef<number>(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) {
        try { window.clearInterval(bufferTimerRef.current) } catch (_) {}
        bufferTimerRef.current = null
      }
      cleanupWebSocket()
      cleanupPlayback()
    }
  }, [])

  // ── WebSocket ──────────────────────────────────────────────

  const cleanupWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const startStream = (prompt: string) => {
    const wsUrl = `ws://localhost:8000/ws/generate`
    console.log('Connecting to pipeline WebSocket:', wsUrl)

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Pipeline WebSocket connected')
      setStreamStatus('Connected, generating...')

      ws.send(JSON.stringify({
        question: prompt,
        fps: DEFAULT_FPS,
        num_scenes: DEFAULT_NUM_SCENES,
      }))

      streamStartTimeRef.current = performance.now()

      // Buffer countdown
      setIsBuffering(true)
      setBufferElapsed(0)
      const bufferStart = performance.now()
      if (bufferTimerRef.current) window.clearInterval(bufferTimerRef.current)

      bufferTimerRef.current = window.setInterval(() => {
        const ms = Math.round(performance.now() - bufferStart)
        setBufferElapsed(ms)
        if (ms >= DEFAULT_WAIT_MILLISECOND) {
          if (bufferTimerRef.current) {
            window.clearInterval(bufferTimerRef.current)
            bufferTimerRef.current = null
          }
        }
      }, 100)

      // Schedule playback after buffer delay
      setTimeout(() => {
        if (!isPlayingRef.current) startPlayback()
      }, DEFAULT_WAIT_MILLISECOND)
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'frame') {
        handleFrame(data)
      } else if (data.type === 'scene_audio') {
        await handleAudio(data)
      } else if (data.type === 'video_complete') {
        videoCompleteRef.current = true
        totalFramesRef.current = data.total_frames
        console.log('Video generation complete, total frames:', data.total_frames)
      } else if (data.type === 'pipeline_complete') {
        pipelineCompleteRef.current = true
        console.log('Pipeline complete')
        setStreamStatus('Generation complete!')
      }
    }

    ws.onerror = (error) => {
      console.error('Pipeline WebSocket error:', error)
      setStreamStatus('Connection error')
    }

    ws.onclose = () => {
      console.log('Pipeline WebSocket closed')
    }
  }

  // ── Message handlers ───────────────────────────────────────

  const handleFrame = (data: any) => {
    const frameIndex = data.frame_index

    const binaryString = atob(data.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const blob = new Blob([bytes], { type: 'image/jpeg' })
    const reader = new FileReader()
    reader.onloadend = () => {
      frameQueueRef.current.set(frameIndex, reader.result as string)
    }
    reader.readAsDataURL(blob)
  }

  const handleAudio = async (data: any) => {
    const audioContext = audioContextRef.current
    if (!audioContext) {
      console.warn('AudioContext missing, dropping audio chunk')
      return
    }

    try {
      const binaryString = atob(data.audio_data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer)
      audioQueueRef.current.push(audioBuffer)
      console.log(`Queued audio chunk, queue size: ${audioQueueRef.current.length}`)
    } catch (error) {
      console.error('Error decoding audio chunk:', error)
    }
  }

  // ── Playback ───────────────────────────────────────────────

  const cleanupPlayback = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop() } catch (_) {}
      audioSourceRef.current = null
    }
    isPlayingRef.current = false
  }

  const startPlayback = () => {
    if (isPlayingRef.current) {
      console.log('Playback already started')
      return
    }

    setIsBuffering(false)
    if (bufferTimerRef.current) {
      window.clearInterval(bufferTimerRef.current)
      bufferTimerRef.current = null
    }

    console.log('Starting playback...')
    setStreamStatus('Playing (still receiving data)...')
    isPlayingRef.current = true

    const canvas = canvasRef.current
    if (!canvas) { console.error('Canvas not found'); return }
    const ctx = canvas.getContext('2d')
    if (!ctx) { console.error('Cannot get canvas context'); return }

    // Audio
    if (audioQueueRef.current.length > 0 && audioContextRef.current) {
      playAudioQueue()
    }

    // Video frames
    playbackStartTimeRef.current = performance.now()
    const frameInterval = 1000 / DEFAULT_FPS
    let currentFrameIndex = 0

    const playFrame = () => {
      if (!isPlayingRef.current) return

      const imageUrl = frameQueueRef.current.get(currentFrameIndex)
      if (imageUrl) {
        const img = new Image()
        img.onload = () => {
          if (canvas.width !== img.width || canvas.height !== img.height) {
            canvas.width = img.width
            canvas.height = img.height
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height)
        }
        img.src = imageUrl
        currentFrameIndex++
      } else {
        console.log(`Waiting for frame ${currentFrameIndex}...`)
      }

      if (videoCompleteRef.current && currentFrameIndex >= totalFramesRef.current) {
        console.log('Playback complete')
        setStreamStatus('Playback complete!')
        stopPlayback()
      }
    }

    playbackIntervalRef.current = window.setInterval(playFrame, frameInterval)
    playFrame()
  }

  const playAudioQueue = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) return

    const playNext = (index: number) => {
      if (index >= audioQueueRef.current.length) {
        audioSourceRef.current = null
        audioQueueRef.current = []
        return
      }

      const buffer = audioQueueRef.current[index]
      if (!audioContextRef.current) {
        playNext(index)
      } else {
        const source = audioContextRef.current.createBufferSource()
        source.buffer = buffer
        source.connect(audioContextRef.current.destination)
        source.start(0)
        audioSourceRef.current = source
        source.onended = () => {
          console.log(`Audio chunk ${index + 1} ended`)
          playNext(index + 1)
        }
      }
    }

    playNext(0)
  }

  const stopPlayback = () => {
    isPlayingRef.current = false
    cleanupPlayback()
  }

  // ── Public reset (used when starting a new generation) ─────

  const resetState = () => {
    videoCompleteRef.current = false
    pipelineCompleteRef.current = false
    totalFramesRef.current = 0
    frameQueueRef.current.clear()
    audioQueueRef.current = []
    nextFrameIndexRef.current = 0
    nextAudioIndexRef.current = 0
    streamStartTimeRef.current = null
    cleanupWebSocket()
    cleanupPlayback()
  }

  const fullCleanup = () => {
    cleanupWebSocket()
    cleanupPlayback()
    setIsStreaming(false)
    setStreamStatus('')
  }

  return {
    // State
    isStreaming,
    setIsStreaming,
    streamStatus,
    setStreamStatus,
    isBuffering,
    bufferElapsed,
    canvasRef,
    isPlayingRef,

    // Actions
    startStream,
    stopPlayback,
    resetState,
    fullCleanup,

    // Constants (exposed for the buffer overlay UI)
    DEFAULT_WAIT_MILLISECOND,
  }
}
