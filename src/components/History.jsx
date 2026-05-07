import styles from './History.module.css'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return { day: DAYS[date.getDay()], num: d, month: MONTHS[m - 1], year: y }
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0]
}

export default function History({ lessons, loading, onOpenLesson, onOpenToday }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const hasToday = lessons.some(l => l.date === todayStr)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>English Log</h1>
          <p className={styles.subtitle}>Tu diario de lecciones</p>
        </div>
        <div className={styles.streak}>
          <span className={styles.streakNum}>{lessons.length}</span>
          <span className={styles.streakLabel}>lecciones</span>
        </div>
      </div>

      <button className={styles.todayBtn} onClick={onOpenToday}>
        <span className={styles.todayIcon}>✦</span>
        {hasToday ? 'Continuar lección de hoy' : 'Nueva lección de hoy'}
        <span className={styles.arrow}>→</span>
      </button>

      <div className={styles.historyHeader}>
        <span>Historial</span>
      </div>

      {loading ? (
        <div className={styles.empty}>Cargando...</div>
      ) : lessons.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📖</span>
          <p>Aún no hay lecciones.<br/>¡Empieza hoy!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {lessons.map(lesson => {
            const f = formatDate(lesson.date)
            const today = isToday(lesson.date)
            return (
              <button
                key={lesson.id}
                className={`${styles.item} ${today ? styles.itemToday : ''}`}
                onClick={() => onOpenLesson(lesson.date)}
              >
                <div className={styles.dateBlock}>
                  <span className={styles.dayName}>{f.day}</span>
                  <span className={styles.dayNum}>{f.num}</span>
                  <span className={styles.monthName}>{f.month}</span>
                </div>
                <div className={styles.itemMeta}>
                  {today && <span className={styles.todayTag}>HOY</span>}
                  <span className={styles.itemYear}>{f.year}</span>
                </div>
                <span className={styles.itemArrow}>›</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
