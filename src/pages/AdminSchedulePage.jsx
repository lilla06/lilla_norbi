import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, '0')
  const minutes = String((index % 4) * 15).padStart(2, '0')

  return `${hours}:${minutes}`
})

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function createScheduleItem() {
  return {
    event_time: '12:00',
    end_time: '12:15',
    title: '',
  }
}

function formatTime(time) {
  return time?.slice(0, 5) || ''
}

function sortScheduleItems(items) {
  return [...items].sort((a, b) => a.event_time.localeCompare(b.event_time))
}

function cloneScheduleItems(items) {
  return items.map((item) => ({ ...item }))
}

export default function AdminSchedulePage() {
  const [scheduleItems, setScheduleItems] = useState([])
  const [savedScheduleItems, setSavedScheduleItems] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    async function loadSchedule() {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        window.location.href = '/login'
        return
      }

      if (!isAdmin(user)) {
        setStatusMessage('Ehhez az oldalhoz admin jogosultság szükséges.')
        setIsLoading(false)
        return
      }

      setHasAccess(true)

      const { data, error } = await supabase
        .from('schedule_items')
        .select('event_time, end_time, title')
        .order('event_time')

      if (error) {
        setStatusMessage(`Nem sikerült betölteni a menetrendet: ${error.message}`)
      } else {
        const loadedItems = sortScheduleItems(
          (data || []).map((item) => ({
            event_time: formatTime(item.event_time),
            end_time: formatTime(item.end_time),
            title: item.title,
          })),
        )
        setScheduleItems(loadedItems)
        setSavedScheduleItems(cloneScheduleItems(loadedItems))
      }

      setIsLoading(false)
    }

    loadSchedule()
  }, [])

  function updateScheduleItem(index, field, value) {
    setScheduleItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  function addScheduleItem() {
    setScheduleItems((currentItems) => [...currentItems, createScheduleItem()])
  }

  function removeScheduleItem(index) {
    setScheduleItems((currentItems) =>
      currentItems.filter((_item, itemIndex) => itemIndex !== index),
    )
  }

  function startEditing() {
    setSavedScheduleItems(cloneScheduleItems(scheduleItems))
    setStatusMessage('')
    setIsEditing(true)
  }

  function discardChanges() {
    setScheduleItems(cloneScheduleItems(savedScheduleItems))
    setStatusMessage('')
    setIsEditing(false)
  }

  async function saveChanges() {
    setStatusMessage('')

    const rows = scheduleItems
      .map((item) => ({
        event_time: item.event_time,
        end_time: item.end_time,
        title: item.title.trim(),
      }))
      .filter((item) => item.title)

    setIsSubmitting(true)

    const { error: deleteError } = await supabase
      .from('schedule_items')
      .delete()
      .gte('event_time', '00:00')

    if (deleteError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült frissíteni a menetrendet: ${deleteError.message}`)
      return
    }

    const { error } = rows.length
      ? await supabase.from('schedule_items').insert(rows)
      : { error: null }

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült menteni a menetrendet: ${error.message}`)
      return
    }

    const savedItems = sortScheduleItems(rows)
    setScheduleItems(savedItems)
    setSavedScheduleItems(cloneScheduleItems(savedItems))
    setIsEditing(false)
    setStatusMessage('A menetrend mentve.')
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card admin-card">
          <p className="eyebrow">Admin</p>
          <h1>Betöltés...</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card admin-card">
        <p className="eyebrow">Admin</p>
        <h1>Menetrend</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            {!isEditing ? (
              <>
                <div className="admin-actions">
                  <button type="button" onClick={startEditing}>
                    Szerkesztés
                  </button>
                </div>

                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Időpont</th>
                        <th>Esemény</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleItems.length === 0 ? (
                        <tr>
                          <td colSpan="2">Még nincs menetrend megadva.</td>
                        </tr>
                      ) : (
                        scheduleItems.map((item) => (
                          <tr key={`${item.event_time}-${item.end_time}-${item.title}`}>
                            <td>{item.event_time} - {item.end_time}</td>
                            <td>{item.title}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="auth-form schedule-form">
                <div className="schedule-list">
                  {scheduleItems.map((item, index) => (
                    <div className="schedule-row" key={`schedule-item-${index + 1}`}>
                      <label>
                        Kezdés
                        <select
                          value={item.event_time}
                          onChange={(event) =>
                            updateScheduleItem(index, 'event_time', event.target.value)
                          }
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Vége
                        <select
                          value={item.end_time}
                          onChange={(event) =>
                            updateScheduleItem(index, 'end_time', event.target.value)
                          }
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Esemény
                        <input
                          type="text"
                          value={item.title}
                          onChange={(event) =>
                            updateScheduleItem(index, 'title', event.target.value)
                          }
                          placeholder="Például: Szertartás"
                        />
                      </label>

                      <button type="button" onClick={() => removeScheduleItem(index)}>
                        Törlés
                      </button>
                    </div>
                  ))}
                </div>

                <div className="admin-actions">
                  <button type="button" onClick={addScheduleItem}>
                    Új menetrendi pont
                  </button>
                  <button type="button" onClick={saveChanges} disabled={isSubmitting}>
                    {isSubmitting ? 'Mentés...' : 'Mentés'}
                  </button>
                  <button type="button" onClick={discardChanges} disabled={isSubmitting}>
                    Módosítások elvetése
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <a className="text-link" href="/">Vissza a főoldalra</a>
      </section>
    </main>
  )
}
