import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import History from './components/History.jsx'
import LessonEditor from './components/LessonEditor.jsx'
import styles from './styles/App.module.css'

export default function App() {
  const [view, setView] = useState('history') // 'history' | 'lesson'
  const [selectedDate, setSelectedDate] = useState(null)
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchLessons() }, [])

  async function fetchLessons() {
    setLoading(true)
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .order('date', { ascending: false })
    setLessons(data || [])
    setLoading(false)
  }

  function openLesson(date) {
    setSelectedDate(date)
    setView('lesson')
  }

  function openToday() {
    const today = new Date().toISOString().split('T')[0]
    openLesson(today)
  }

  return (
    <div className={styles.app}>
      {view === 'history' ? (
        <History
          lessons={lessons}
          loading={loading}
          onOpenLesson={openLesson}
          onOpenToday={openToday}
        />
      ) : (
        <LessonEditor
          date={selectedDate}
          onBack={() => { setView('history'); fetchLessons() }}
        />
      )}
    </div>
  )
}
