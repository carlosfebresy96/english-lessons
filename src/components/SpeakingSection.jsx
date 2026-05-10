import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

// Detect best supported mime type for this browser/device
function getSupportedMimeType() {
  const types = [
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/aac',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return ''
}

export default function SpeakingSection({ lessonId }) {
  const [activity, setActivity] = useState('')
  const [transcription, setTranscription] = useState('')
  const [corrections, setCorrections] = useState('')
  const [recordingState, setRecordingState] = useState('idle')
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioMime, setAudioMime] = useState('')
  const [recSeconds, setRecSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskId, setTaskId] = useState(null)
  const [micError, setMicError] = useState('')

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const audioBlob = useRef(null)

  useEffect(() => { loadData() }, [lessonId])
  useEffect(() => () => { clearInterval(timerRef.current) }, [])

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
        setAudioUrl(data.audio_url)
        setRecordingState('stopped')
      }
    }
    setLoading(false)
  }

  async function startRecording() {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks.current = []

      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : {}

      try {
        mediaRecorder.current = new MediaRecorder(stream, options)
      } catch {
        mediaRecorder.current = new MediaRecorder(stream)
      }

      const actualMime = mediaRecorder.current.mimeType || mimeType || 'audio/webm'
      setAudioMime(actualMime)

      mediaRecorder.current.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunks.current.push(e.data)
      }

      mediaRecorder.current.onstop = () => {
        const mime = mediaRecorder.current.mimeType || actualMime
        const blob = new Blob(audioChunks.current, { type: mime })
        audioBlob.current = blob
        setAudioMime(mime)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }

      // timeslice of 1000ms helps iOS collect chunks reliably
      mediaRecorder.current.start(1000)
      setRecordingState('recording')
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setMicError('Permiso denegado. Ve a Configuración → Safari → Micrófono y actívalo.')
      } else if (err.name === 'NotFoundError') {
        setMicError('No se encontró micrófono en este dispositivo.')
      } else {
        setMicError('Error al acceder al micrófono: ' + err.message)
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    clearInterval(timerRef.current)
    setRecordingState('stopped')
  }

  function resetRecording() {
    if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl)
    audioBlob.current = null
    setAudioUrl(null)
    setAudioMime('')
    setRecordingState('idle')
    setRecSeconds(0)
    setMicError('')
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function save() {
    setSaving(true)
    let finalAudioUrl = audioUrl

    if (audioBlob.current) {
      const mime = audioBlob.current.type || audioMime || 'audio/webm'
      let ext = 'webm'
      if (mime.includes('mp4') || mime.includes('aac')) ext = 'mp4'
      else if (mime.includes('ogg')) ext = 'ogg'

      const fileName = `speaking_${lessonId}_${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage
        .from('audios')
        .upload(fileName, audioBlob.current, { upsert: true, contentType: mime })

      if (uploadData) {
        const { data: urlData } = supabase.storage.from('audios').getPublicUrl(fileName)
        finalAudioUrl = urlData.publicUrl
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

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTag} style={{ background: 'rgba(74,222,158,0.12)', color: 'var(--green)' }}>Speaking Task</span>
        <p className={styles.sectionDesc}>Practica tu pronunciación y fluidez oral</p>
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Actividad del día</label>
        <textarea
          className={styles.textarea}
          rows={3}
          value={activity}
          onChange={e => { setActivity(e.target.value); setSaved(false) }}
          placeholder="Describe la actividad de speaking de hoy..."
        />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Grabación de audio</label>
        <div className={styles.recordArea}>

          {recordingState === 'idle' && (
            <>
              <button className={styles.recBtn} onClick={startRecording}>
                <span className={styles.recDot} />
                Grabar audio
              </button>
              {micError && (
                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, lineHeight: 1.5 }}>
                  ⚠️ {micError}
                </p>
              )}
            </>
          )}

          {recordingState === 'recording' && (
            <div className={styles.recActive}>
              <div className={styles.recPulse} />
              <span className={styles.recTime}>{formatTime(recSeconds)}</span>
              <button className={styles.stopBtn} onClick={stopRecording}>Detener</button>
            </div>
          )}

          {recordingState === 'stopped' && audioUrl && (
            <div className={styles.audioPlayer}>
              <audio controls className={styles.audio} key={audioUrl} preload="auto">
                <source src={audioUrl} type={audioMime || undefined} />
                <source src={audioUrl} />
              </audio>
              <button className={styles.rerecBtn} onClick={resetRecording}>
                🔄 Grabar de nuevo
              </button>
            </div>
          )}

        </div>
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Transcripción</label>
        <textarea
          className={styles.textarea}
          rows={4}
          value={transcription}
          onChange={e => { setTranscription(e.target.value); setSaved(false) }}
          placeholder="Escribe aquí lo que dijiste en inglés..."
        />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Correcciones</label>
        <textarea
          className={styles.textarea}
          rows={4}
          value={corrections}
          onChange={e => { setCorrections(e.target.value); setSaved(false) }}
          placeholder="Errores encontrados y cómo corregirlos..."
        />
      </div>

      <button
        className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Guardando...' : saved ? '¡Guardado ✓' : 'Guardar speaking'}
      </button>
    </div>
  )
}
