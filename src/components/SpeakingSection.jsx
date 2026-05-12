import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

export default function SpeakingSection({ lessonId }) {
  const [activity, setActivity] = useState('')
  const [transcription, setTranscription] = useState('')
  const [corrections, setCorrections] = useState('')

  // 'idle' | 'recording' | 'uploading' | 'ready'
  const [phase, setPhase] = useState('idle')
  const [recSeconds, setRecSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)   // always a Supabase public URL
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskId, setTaskId] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => { loadData() }, [lessonId])
  useEffect(() => () => clearInterval(timerRef.current), [])

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
        setPhase('ready')
      }
    }
    setLoading(false)
  }

  async function startRecording() {
    setUploadError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks.current = []

      // iOS Safari supports audio/mp4, Chrome supports audio/webm
      let mime = ''
      for (const m of ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', '']) {
        try {
          if (!m || MediaRecorder.isTypeSupported(m)) { mime = m; break }
        } catch {}
      }

      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      mediaRecorder.current = mr

      mr.ondataavailable = e => { if (e.data?.size > 0) audioChunks.current.push(e.data) }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)

        const finalMime = mr.mimeType || mime || 'audio/webm'
        const blob = new Blob(audioChunks.current, { type: finalMime })

        // Upload immediately so iOS can play from a real URL
        setPhase('uploading')
        const ext = finalMime.includes('mp4') || finalMime.includes('aac') ? 'mp4'
          : finalMime.includes('ogg') ? 'ogg' : 'webm'
        const fileName = `audio_${lessonId}_${Date.now()}.${ext}`

        const { data: up, error } = await supabase.storage
          .from('audios')
          .upload(fileName, blob, { upsert: true, contentType: finalMime })

        if (error || !up) {
          setUploadError('Error al subir el audio. Revisa tu conexión e intenta de nuevo.')
          setPhase('idle')
          return
        }

        const { data: urlData } = supabase.storage.from('audios').getPublicUrl(fileName)
        setAudioUrl(urlData.publicUrl)
        setPhase('ready')
      }

      mr.start(1000)
      setPhase('recording')
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setUploadError('Permiso de micrófono denegado. Ve a Configuración → Safari → Micrófono.')
      } else {
        setUploadError('No se pudo iniciar la grabación: ' + err.message)
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder.current?.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    clearInterval(timerRef.current)
  }

  function resetAudio() {
    setAudioUrl(null)
    setPhase('idle')
    setRecSeconds(0)
    setUploadError('')
    if (audioRef.current) audioRef.current.pause()
  }

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function save() {
    setSaving(true)
    const payload = {
      lesson_id: lessonId,
      activity,
      transcription,
      corrections,
      audio_url: audioUrl,
    }
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
        <span className={styles.sectionTag} style={{ background: 'rgba(74,222,158,0.12)', color: 'var(--green)' }}>
          Speaking Task
        </span>
        <p className={styles.sectionDesc}>Practica tu pronunciación y fluidez oral</p>
      </div>

      {/* Actividad */}
      <div className={styles.card}>
        <label className={styles.label}>Actividad del día</label>
        <textarea className={styles.textarea} rows={3} value={activity}
          onChange={e => { setActivity(e.target.value); setSaved(false) }}
          placeholder="Describe la actividad de speaking de hoy..." />
      </div>

      {/* Audio */}
      <div className={styles.card}>
        <label className={styles.label}>Grabación de audio</label>
        <div className={styles.recordArea}>

          {phase === 'idle' && (
            <>
              <button className={styles.recBtn} onClick={startRecording}>
                <span className={styles.recDot} />
                Grabar audio
              </button>
              {uploadError && (
                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, lineHeight: 1.6 }}>
                  ⚠️ {uploadError}
                </p>
              )}
            </>
          )}

          {phase === 'recording' && (
            <div className={styles.recActive}>
              <div className={styles.recPulse} />
              <span className={styles.recTime}>{fmt(recSeconds)}</span>
              <button className={styles.stopBtn} onClick={stopRecording}>Detener</button>
            </div>
          )}

          {phase === 'uploading' && (
            <div className={styles.uploadingRow}>
              <div className={styles.spinner} />
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Procesando audio...</span>
            </div>
          )}

          {phase === 'ready' && audioUrl && (
            <div className={styles.audioReady}>
              {/* Standard <audio> tag — works on iOS when src is a real HTTPS URL */}
              <audio
                ref={audioRef}
                controls
                playsInline
                preload="metadata"
                className={styles.audioNative}
                key={audioUrl}
              >
                <source src={audioUrl} />
              </audio>
              <button className={styles.rerecBtn} onClick={resetAudio}>
                🔄 Grabar de nuevo
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Transcripción */}
      <div className={styles.card}>
        <label className={styles.label}>Transcripción</label>
        <textarea className={styles.textarea} rows={4} value={transcription}
          onChange={e => { setTranscription(e.target.value); setSaved(false) }}
          placeholder="Escribe aquí lo que dijiste en inglés..." />
      </div>

      {/* Correcciones */}
      <div className={styles.card}>
        <label className={styles.label}>Correcciones</label>
        <textarea className={styles.textarea} rows={4} value={corrections}
          onChange={e => { setCorrections(e.target.value); setSaved(false) }}
          placeholder="Errores encontrados y cómo corregirlos..." />
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
