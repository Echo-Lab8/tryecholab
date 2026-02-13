import { useEffect, useRef, useState } from 'react'

const DEFAULT_NUM_SCENES = 5
const DEFAULT_FPS = 16

interface SceneInfo {
  scene_number: number
  title: string
  description: string
}

export function useStreamPlayback() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStatus, setStreamStatus] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentScene, setCurrentScene] = useState<SceneInfo | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Frame queue: frame_index → { url, scene_number }
  const frameQueueRef = useRef<Map<number, { url: string; scene_number: number }>>(new Map())
  // Audio queue: scene_number → AudioBuffer
  const audioQueueRef = useRef<Map<number, AudioBuffer>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentPlayingSceneRef = useRef<number>(0)

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
      setStreamStatus('Generating Stream')
      setIsGenerating(true)
      setCurrentScene(null)

      ws.send(JSON.stringify({
        question: prompt,
        fps: DEFAULT_FPS,
        num_scenes: DEFAULT_NUM_SCENES,
      }))

      streamStartTimeRef.current = performance.now()
    }

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'scene_info') {
        setCurrentScene({
          scene_number: data.scene_number,
          title: data.title,
          description: data.description,
        })
        console.log(`Scene ${data.scene_number}: ${data.title}`)
      } else if (data.type === 'scene_complete') {
        console.log('Scene complete, starting playback')
        setIsGenerating(false)
        setCurrentScene(null)
        if (!isPlayingRef.current) startPlayback()
      } else if (data.type === 'frame') {
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
    const sceneNumber = data.scene_number

    const binaryString = atob(data.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const blob = new Blob([bytes], { type: 'image/jpeg' })
    const reader = new FileReader()
    reader.onloadend = () => {
      frameQueueRef.current.set(frameIndex, {
        url: reader.result as string,
        scene_number: sceneNumber,
      })
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
      const sceneNumber = data.scene_number
      const binaryString = atob(data.audio_data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer)
      audioQueueRef.current.set(sceneNumber, audioBuffer)
      console.log(`Queued audio for scene ${sceneNumber}`)
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

    setIsGenerating(false)
    setCurrentScene(null)

    console.log('Starting playback...')
    setStreamStatus('Playing (still receiving data)...')
    isPlayingRef.current = true
    currentPlayingSceneRef.current = 0

    const canvas = canvasRef.current
    if (!canvas) { console.error('Canvas not found'); return }
    const ctx = canvas.getContext('2d')
    if (!ctx) { console.error('Cannot get canvas context'); return }

    // Video frames
    playbackStartTimeRef.current = performance.now()
    const frameInterval = 1000 / DEFAULT_FPS
    let currentFrameIndex = 0

    const playFrame = () => {
      if (!isPlayingRef.current) return

      const frame = frameQueueRef.current.get(currentFrameIndex)
      if (frame) {
        // If scene changed, play that scene's audio
        if (frame.scene_number !== currentPlayingSceneRef.current) {
          currentPlayingSceneRef.current = frame.scene_number
          playSceneAudio(frame.scene_number)
        }

        const img = new Image()
        img.onload = () => {
          if (canvas.width !== img.width || canvas.height !== img.height) {
            canvas.width = img.width
            canvas.height = img.height
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height)
        }
        img.src = frame.url
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

  const playSceneAudio = (sceneNumber: number) => {
    if (!audioContextRef.current) return

    // Stop current audio if playing
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop() } catch (_) {}
      audioSourceRef.current = null
    }

    const buffer = audioQueueRef.current.get(sceneNumber)
    if (!buffer) {
      console.log(`No audio yet for scene ${sceneNumber}`)
      return
    }

    const source = audioContextRef.current.createBufferSource()
    source.buffer = buffer
    source.connect(audioContextRef.current.destination)
    source.start(0)
    audioSourceRef.current = source
    console.log(`Playing audio for scene ${sceneNumber}`)
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
    audioQueueRef.current.clear()
    currentPlayingSceneRef.current = 0
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
    isGenerating,
    currentScene,
    canvasRef,
    isPlayingRef,

    // Actions
    startStream,
    stopPlayback,
    resetState,
    fullCleanup,
  }
}
