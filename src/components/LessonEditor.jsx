import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import VocabularySection from './VocabularySection.jsx'
import SpeakingSection from './SpeakingSection.jsx'
import WritingSection from './WritingSection.jsx'
import styles from './LessonEditor.module.css'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export default function LessonEditor({ date, onBack }) {
  const [tab, setTab] = useState('vocab')
  const [lessonId, setLessonId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initLesson()
  }, [date])

  async function initLesson() {
    setLoading(true)
    // Check if lesson exists for this date
    let { data } = await supabase
      .from('lessons')
      .select('id')
      .eq('date', date)
      .single()

    if (!data) {
      // Create new lesson
      const { data: newLesson } = await supabase
        .from('lessons')
        .insert({ date })
        .select('id')
        .single()
      data = newLesson
    }

    if (data) setLessonId(data.id)
    setLoading(false)
  }

  const tabs = [
    { key: 'vocab', label: 'Vocabulary', icon: '📚' },
    { key: 'speaking', label: 'Speaking', icon: '🎙' },
    { key: 'writing', label: 'Writing', icon: '✍️' },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>← Atrás</button>
        <div className={styles.dateLabel}>{formatDateLabel(date)}</div>
        <div style={{ width: 60 }} />
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Cargando lección...</div>
        ) : !lessonId ? (
          <div className={styles.loading}>Error al cargar la lección</div>
        ) : (
          <>
            {tab === 'vocab' && <VocabularySection lessonId={lessonId} />}
            {tab === 'speaking' && <SpeakingSection lessonId={lessonId} />}
            {tab === 'writing' && <WritingSection lessonId={lessonId} />}
          </>
        )}
      </div>
    </div>
  )
}
