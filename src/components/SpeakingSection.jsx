import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

export default function SpeakingSection({ lessonId }) {
  const [activity, setActivity] = useState('')
  const [transcription, setTranscription] = useState('')
  const [corrections, setCorrections] = useState('')
  const [recordingState, setRecordingState] = useState('idle') // idle | recording | stopped
  const [audioUrl, setAudioUrl] = useState(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskId, setTaskId] = useState(null)

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const audioBlob = useRef(null)

  useEffect(() => { loadData() }, [lessonId])

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
      if (data.audio_url) setAudioUrl(data.audio_url)
    }
    setLoading(false)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks.current = []
      mediaRecorder.current = new MediaRecorder(stream)
      mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data)
      mediaRecorder.current.onstop = () => {
        audioBlob.current = new Blob(audioChunks.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob.current)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorder.current.start()
      setRecordingState('recording')
      setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch (err) {
      alert('No se pudo acceder al micrófono. Verifica los permisos.')
    }
  }

  function stopRecording() {
    if (mediaRecorder.current) mediaRecorder.current.stop()
    clearInterval(timerRef.current)
    setRecordingState('stopped')
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  async function save() {
    setSaving(true)
    let finalAudioUrl = audioUrl

    // Upload audio if we have a new blob
    if (audioBlob.current) {
      const fileName = `speaking_${lessonId}_${Date.now()}.webm`
      const { data: uploadData } = await supabase.storage
        .from('audios')
        .upload(fileName, audioBlob.current, { upsert: true })

      if (uploadData) {
        const { data: urlData } = supabase.storage.from('audios').getPublicUrl(fileName)
        finalAudioUrl = urlData.publicUrl
      }
    }

    const payload = {
      lesson_id: lessonId,
      activity,
      transcription,
      corrections,
      audio_url: finalAudioUrl,
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
              <audio controls src={audioUrl} className={styles.audio} />
              <button className={styles.rerecBtn} onClick={() => { setRecordingState('idle'); setAudioUrl(null); audioBlob.current = null }}>
                Grabar de nuevo
              </button>
            </div>
          )}
          {recordingState === 'idle' && audioUrl && (
            <div className={styles.audioPlayer}>
              <audio controls src={audioUrl} className={styles.audio} />
              <button className={styles.rerecBtn} onClick={() => { setAudioUrl(null) }}>
                Grabar de nuevo
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
