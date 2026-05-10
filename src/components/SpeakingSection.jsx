import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

// Check if MediaRecorder actually works (it's broken on iOS Safari)
function mediaRecorderWorks() {
  try {
    return (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported('audio/webm')
    )
  } catch {
    return false
  }
}

export default function SpeakingSection({ lessonId }) {
  const [activity, setActivity] = useState('')
  const [transcription, setTranscription] = useState('')
  const [corrections, setCorrections] = useState('')
  const [recordingState, setRecordingState] = useState('idle') // idle | recording | stopped
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioMime, setAudioMime] = useState('audio/webm')
  const [recSeconds, setRecSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskId, setTaskId] = useState(null)
  const [uploadProgress, setUploadProgress] = useState('')

  const useNativeInput = !mediaRecorderWorks()
  const fileInputRef = useRef(null)
  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const audioBlob = useRef(null)

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
        setRecordingState('stopped')
      }
    }
    setLoading(false)
  }

  // ── Native file input (iOS Safari / iPhone) ──────────────────────
  function handleNativeFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    audioBlob.current = file
    setAudioMime(file.type || 'audio/mp4')
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setRecordingState('stopped')
  }

  // ── MediaRecorder (Chrome / Android / desktop) ────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks.current = []
      const mime = 'audio/webm;codecs=opus'
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: mime })
      mediaRecorder.current.ondataavailable = e => {
        if (e.data?.size > 0) audioChunks.current.push(e.data)
      }
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: mime })
        audioBlob.current = blob
        setAudioMime(mime)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorder.current.start(500)
      setRecordingState('recording')
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch (err) {
      alert('No se pudo acceder al micrófono. Verifica los permisos en tu navegador.')
    }
  }

  function stopRecording() {
    if (mediaRecorder.current?.state !== 'inactive') mediaRecorder.current.stop()
    clearInterval(timerRef.current)
    setRecordingState('stopped')
  }

  function resetAudio() {
    if (audioUrl?.startsWith('blob:')) URL.revokeObjectURL(audioUrl)
    audioBlob.current = null
    setAudioUrl(null)
    setRecordingState('idle')
    setRecSeconds(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function save() {
    setSaving(true)
    let finalAudioUrl = audioUrl

    if (audioBlob.current) {
      setUploadProgress('Subiendo audio...')
      const mime = audioBlob.current.type || audioMime
      const ext = mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a') ? 'mp4'
        : mime.includes('ogg') ? 'ogg' : 'webm'
      const fileName = `speaking_${lessonId}_${Date.now()}.${ext}`

      const { data: uploadData } = await supabase.storage
        .from('audios')
        .upload(fileName, audioBlob.current, { upsert: true, contentType: mime })

      if (uploadData) {
        const { data: urlData } = supabase.storage.from('audios').getPublicUrl(fileName)
        finalAudioUrl = urlData.publicUrl
      }
      setUploadProgress('')
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
        <span className={styles.sectionTag} style={{ background: 'rgba(74,222,158,0.12)', color: 'var(--green)' }}>
          Speaking Task
        </span>
        <p className={styles.sectionDesc}>Practica tu pronunciación y fluidez oral</p>
      </div>

      {/* Actividad */}
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

      {/* Audio */}
      <div className={styles.card}>
        <label className={styles.label}>Grabación de audio</label>
        <div className={styles.recordArea}>

          {/* ── iOS / Safari: native recorder via file input ── */}
          {useNativeInput && (
            <>
              {recordingState !== 'stopped' && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>
                    Toca el botón para abrir la grabadora de tu iPhone:
                  </p>
                  <label className={styles.recBtn} style={{ cursor: 'pointer', justifyContent: 'center' }}>
                    <span style={{ fontSize: 18 }}>🎙</span>
                    Abrir grabadora
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      capture="microphone"
                      style={{ display: 'none' }}
                      onChange={handleNativeFile}
                    />
                  </label>
                </>
              )}
              {recordingState === 'stopped' && audioUrl && (
                <div className={styles.audioPlayer}>
                  <audio controls className={styles.audio} key={audioUrl} src={audioUrl} preload="auto" />
                  <button className={styles.rerecBtn} onClick={resetAudio}>🔄 Grabar de nuevo</button>
                </div>
              )}
            </>
          )}

          {/* ── Chrome / Android / Desktop: MediaRecorder ── */}
          {!useNativeInput && (
            <>
              {recordingState === 'idle' && (
                <button className={styles.recBtn} onClick={startRecording}>
                  <span className={styles.recDot} />
                  Grabar audio
                </button>
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
                  <audio controls className={styles.audio} key={audioUrl} src={audioUrl} preload="auto" />
                  <button className={styles.rerecBtn} onClick={resetAudio}>🔄 Grabar de nuevo</button>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Transcripción */}
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

      {/* Correcciones */}
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
        {saving ? (uploadProgress || 'Guardando...') : saved ? '¡Guardado ✓' : 'Guardar speaking'}
      </button>
    </div>
  )
}
