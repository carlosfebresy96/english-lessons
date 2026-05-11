import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

export default function SpeakingSection({ lessonId }) {
  const [activity, setActivity] = useState('')
  const [transcription, setTranscription] = useState('')
  const [corrections, setCorrections] = useState('')
  const [recordingState, setRecordingState] = useState('idle') // idle | recording | stopped
  const [isPlaying, setIsPlaying] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [playSeconds, setPlaySeconds] = useState(0)
  const [duration, setDuration] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskId, setTaskId] = useState(null)
  const [hasAudio, setHasAudio] = useState(false)
  const [audioFromCloud, setAudioFromCloud] = useState(null)

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const playTimerRef = useRef(null)
  const audioBlob = useRef(null)
  const audioCtx = useRef(null)
  const audioBuffer = useRef(null)
  const sourceNode = useRef(null)
  const startedAt = useRef(0)
  const pausedAt = useRef(0)

  useEffect(() => { loadData() }, [lessonId])
  useEffect(() => () => {
    clearInterval(timerRef.current)
    clearInterval(playTimerRef.current)
    sourceNode.current?.stop()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('speaking_tasks')
      .select('*')
      .eq('lesson_id', lessonId)
      .single()
    if (data) {
      setTaskId(data.id)
      setActivity(data.activity || '')
      setTranscription(data.transcription || '')
      setCorrections(data.corrections || '')
      if (data.audio_url) {
        setAudioFromCloud(data.audio_url)
        setHasAudio(true)
        setRecordingState('stopped')
      }
    }
    setLoading(false)
  }

  // ── Get or create AudioContext ──────────────────────────────────
  function getAudioCtx() {
    if (!audioCtx.current || audioCtx.current.state === 'closed') {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtx.current
  }

  // ── Decode blob/url into AudioBuffer ───────────────────────────
  async function decodeAudio(source) {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') await ctx.resume()
    let arrayBuffer
    if (source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer()
    } else {
      // fetch from URL (cloud)
      const res = await fetch(source)
      arrayBuffer = await res.arrayBuffer()
    }
    audioBuffer.current = await ctx.decodeAudioData(arrayBuffer)
    setDuration(Math.round(audioBuffer.current.duration))
    return audioBuffer.current
  }

  // ── Play / Pause ───────────────────────────────────────────────
  async function togglePlay() {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') await ctx.resume()

    if (isPlaying) {
      // Pause
      sourceNode.current?.stop()
      clearInterval(playTimerRef.current)
      pausedAt.current = ctx.currentTime - startedAt.current
      setIsPlaying(false)
      return
    }

    // Load buffer if not loaded yet
    if (!audioBuffer.current) {
      try {
        const src = audioBlob.current || audioFromCloud
        await decodeAudio(src)
      } catch (err) {
        alert('No se pudo cargar el audio. Intenta grabarlo de nuevo.')
        return
      }
    }

    // Play from pausedAt
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer.current
    source.connect(ctx.destination)
    source.onended = () => {
      setIsPlaying(false)
      setPlaySeconds(0)
      pausedAt.current = 0
      clearInterval(playTimerRef.current)
    }
    const offset = pausedAt.current || 0
    source.start(0, offset)
    startedAt.current = ctx.currentTime - offset
    sourceNode.current = source
    setIsPlaying(true)

    // Update progress timer
    clearInterval(playTimerRef.current)
    playTimerRef.current = setInterval(() => {
      const elapsed = ctx.currentTime - startedAt.current
      setPlaySeconds(Math.min(Math.round(elapsed), duration))
    }, 200)
  }

  function stopPlayback() {
    sourceNode.current?.stop()
    clearInterval(playTimerRef.current)
    setIsPlaying(false)
    setPlaySeconds(0)
    pausedAt.current = 0
  }

  // ── Recording ─────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks.current = []
      audioBuffer.current = null
      pausedAt.current = 0

      // Try formats in order of iOS compatibility
      let mime = ''
      for (const m of ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm']) {
        if (MediaRecorder.isTypeSupported(m)) { mime = m; break }
      }

      const options = mime ? { mimeType: mime } : {}
      mediaRecorder.current = new MediaRecorder(stream, options)

      mediaRecorder.current.ondataavailable = e => {
        if (e.data?.size > 0) audioChunks.current.push(e.data)
      }
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const finalMime = mediaRecorder.current.mimeType || mime || 'audio/webm'
        const blob = new Blob(audioChunks.current, { type: finalMime })
        audioBlob.current = blob
        setHasAudio(true)
        setRecordingState('stopped')
        // Pre-decode so play is instant
        try { await decodeAudio(blob) } catch {}
      }

      mediaRecorder.current.start(500)
      setRecordingState('recording')
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch {
      alert('No se pudo acceder al micrófono. Verifica los permisos.')
    }
  }

  function stopRecording() {
    if (mediaRecorder.current?.state !== 'inactive') mediaRecorder.current.stop()
    clearInterval(timerRef.current)
  }

  function resetAudio() {
    stopPlayback()
    audioBlob.current = null
    audioBuffer.current = null
    setHasAudio(false)
    setAudioFromCloud(null)
    setRecordingState('idle')
    setRecSeconds(0)
    setPlaySeconds(0)
    setDuration(0)
    pausedAt.current = 0
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // ── Save ───────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    let finalAudioUrl = audioFromCloud

    if (audioBlob.current) {
      const mime = audioBlob.current.type || 'audio/webm'
      const ext = mime.includes('mp4') || mime.includes('aac') ? 'mp4'
        : mime.includes('ogg') ? 'ogg' : 'webm'
      const fileName = `speaking_${lessonId}_${Date.now()}.${ext}`
      const { data: up } = await supabase.storage
        .from('audios')
        .upload(fileName, audioBlob.current, { upsert: true, contentType: mime })
      if (up) {
        const { data: u } = supabase.storage.from('audios').getPublicUrl(fileName)
        finalAudioUrl = u.publicUrl
        setAudioFromCloud(finalAudioUrl)
      }
    }

    const payload = { lesson_id: lessonId, activity, transcription, corrections, audio_url: finalAudioUrl }
    if (taskId) {
      await supabase.from('speaking_tasks').update(payload).eq('id', taskId)
    } else {
      const { data } = await supabase.from('speaking_tasks').insert(payload).select('id').single()
      if (data) setTaskId(data.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className={styles.loading}>Cargando...</div>

  const progress = duration > 0 ? (playSeconds / duration) * 100 : 0

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTag} style={{ background: 'rgba(74,222,158,0.12)', color: 'var(--green)' }}>
          Speaking Task
        </span>
        <p className={styles.sectionDesc}>Practica tu pronunciación y fluidez oral</p>
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Actividad del día</label>
        <textarea className={styles.textarea} rows={3} value={activity}
          onChange={e => { setActivity(e.target.value); setSaved(false) }}
          placeholder="Describe la actividad de speaking de hoy..." />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Grabación de audio</label>
        <div className={styles.recordArea}>

          {/* IDLE */}
          {recordingState === 'idle' && (
            <button className={styles.recBtn} onClick={startRecording}>
              <span className={styles.recDot} />
              Grabar audio
            </button>
          )}

          {/* RECORDING */}
          {recordingState === 'recording' && (
            <div className={styles.recActive}>
              <div className={styles.recPulse} />
              <span className={styles.recTime}>{formatTime(recSeconds)}</span>
              <button className={styles.stopBtn} onClick={stopRecording}>Detener</button>
            </div>
          )}

          {/* STOPPED — custom player */}
          {recordingState === 'stopped' && hasAudio && (
            <div className={styles.customPlayer}>
              <button className={styles.playBtn} onClick={togglePlay}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
                <div className={styles.progressTimes}>
                  <span>{formatTime(playSeconds)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <button className={styles.rerecBtnSm} onClick={resetAudio} title="Grabar de nuevo">🗑</button>
            </div>
          )}

        </div>
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Transcripción</label>
        <textarea className={styles.textarea} rows={4} value={transcription}
          onChange={e => { setTranscription(e.target.value); setSaved(false) }}
          placeholder="Escribe aquí lo que dijiste en inglés..." />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Correcciones</label>
        <textarea className={styles.textarea} rows={4} value={corrections}
          onChange={e => { setCorrections(e.target.value); setSaved(false) }}
          placeholder="Errores encontrados y cómo corregirlos..." />
      </div>

      <button className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
        onClick={save} disabled={saving}>
        {saving ? 'Guardando...' : saved ? '¡Guardado ✓' : 'Guardar speaking'}
      </button>
    </div>
  )
}
