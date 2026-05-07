import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Section.module.css'

const EMPTY_WORD = { word: '', meaning: '', example: '' }

export default function VocabularySection({ lessonId }) {
  const [words, setWords] = useState(Array(10).fill(null).map(() => ({ ...EMPTY_WORD })))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWords()
  }, [lessonId])

  async function loadWords() {
    setLoading(true)
    const { data } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('position')

    if (data && data.length > 0) {
      const filled = Array(10).fill(null).map((_, i) => {
        const found = data.find(w => w.position === i)
        return found ? { word: found.word || '', meaning: found.meaning || '', example: found.example || '' } : { ...EMPTY_WORD }
      })
      setWords(filled)
    }
    setLoading(false)
  }

  function update(index, field, value) {
    setWords(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    // Delete existing and re-insert
    await supabase.from('vocabulary').delete().eq('lesson_id', lessonId)

    const toInsert = words
      .map((w, i) => ({ lesson_id: lessonId, word: w.word, meaning: w.meaning, example: w.example, position: i }))
      .filter(w => w.word.trim())

    if (toInsert.length > 0) {
      await supabase.from('vocabulary').insert(toInsert)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div className={styles.loading}>Cargando...</div>

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTag} style={{ background: 'rgba(124,106,247,0.15)', color: 'var(--accent2)' }}>Vocabulary</span>
        <p className={styles.sectionDesc}>10 nuevas palabras con significado y ejemplo</p>
      </div>

      {words.map((w, i) => (
        <div key={i} className={styles.wordCard}>
          <div className={styles.wordNum}>{i + 1}</div>
          <div className={styles.wordFields}>
            <div className={styles.wordRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Palabra</label>
                <input
                  className={styles.input}
                  value={w.word}
                  onChange={e => update(i, 'word', e.target.value)}
                  placeholder="e.g. endeavor"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Significado</label>
                <input
                  className={styles.input}
                  value={w.meaning}
                  onChange={e => update(i, 'meaning', e.target.value)}
                  placeholder="e.g. a serious effort"
                />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Oración de ejemplo</label>
              <input
                className={`${styles.input} ${styles.inputFull}`}
                value={w.example}
                onChange={e => update(i, 'example', e.target.value)}
                placeholder="e.g. She made every endeavor to finish on time."
              />
            </div>
          </div>
        </div>
      ))}

      <button
        className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
        onClick={save}
        disabled={saving}
      >
        {saving ? 'Guardando...' : saved ? '¡Guardado ✓' : 'Guardar vocabulario'}
      </button>
    </div>
  )
}
