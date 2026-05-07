import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

export default function WritingSection({ lessonId }) {
  const [activity, setActivity] = useState('')
  const [writtenText, setWrittenText] = useState('')
  const [corrections, setCorrections] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [taskId, setTaskId] = useState(null)

  useEffect(() => { loadData() }, [lessonId])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('writing_tasks')
      .select('*')
      .eq('lesson_id', lessonId)
      .single()

    if (data) {
      setTaskId(data.id)
      setActivity(data.activity || '')
      setWrittenText(data.written_text || '')
      setCorrections(data.corrections || '')
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const payload = { lesson_id: lessonId, activity, written_text: writtenText, corrections }

    if (taskId) {
      await supabase.from('writing_tasks').update(payload).eq('id', taskId)
    } else {
      const { data } = await supabase.from('writing_tasks').insert(payload).select('id').single()
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
        <span className={styles.sectionTag} style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--red)' }}>Writing Task</span>
        <p className={styles.sectionDesc}>Desarrolla tu habilidad de escritura en inglés</p>
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Actividad del día</label>
        <textarea
          className={styles.textarea}
          rows={3}
          value={activity}
          onChange={e => { setActivity(e.target.value); setSaved(false) }}
          placeholder="Describe la actividad de writing de hoy..."
        />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Mi respuesta escrita</label>
        <textarea
          className={styles.textarea}
          rows={8}
          value={writtenText}
          onChange={e => { setWrittenText(e.target.value); setSaved(false) }}
          placeholder="Write your answer here in English..."
        />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Correcciones</label>
        <textarea
          className={styles.textarea}
          rows={5}
          value={corrections}
          onChange={e => { setCorrections(e.target.value); setSaved(false) }}
          placeholder="Errores encontrados y versión corregida..."
        />
      </div>

      <button
        className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Guardando...' : saved ? '¡Guardado ✓' : 'Guardar writing'}
      </button>
    </div>
  )
}
