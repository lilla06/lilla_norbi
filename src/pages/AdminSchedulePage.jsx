import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminModal from '../components/AdminModal'
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
    is_public: true,
  }
}

function formatTime(time) {
  return time?.slice(0, 5) || ''
}

// Éjfél utáni időpontokat (06:00 előtt) a nap végére soroljuk, hogy a
// menetrend valós idősorrendben jelenjen meg.
function scheduleMinutes(time) {
  const [hours, minutes] = (time || '').split(':').map(Number)
  const total = (hours || 0) * 60 + (minutes || 0)

  return total < 360 ? total + 1440 : total
}

function sortScheduleItems(items) {
  return [...items].sort(
    (a, b) => scheduleMinutes(a.event_time) - scheduleMinutes(b.event_time),
  )
}

function cloneScheduleItems(items) {
  return items.map((item) => ({ ...item }))
}

export default function AdminSchedulePage() {
  const navigate = useNavigate()
  const [scheduleItems, setScheduleItems] = useState([])
  const [savedScheduleItems, setSavedScheduleItems] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [isPublishSaving, setIsPublishSaving] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newItem, setNewItem] = useState(null)

  useEffect(() => {
    async function loadSchedule() {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        navigate('/login')
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
        .select('event_time, end_time, title, is_public')
        .order('event_time')

      if (error) {
        setStatusMessage(`Nem sikerült betölteni a menetrendet: ${error.message}`)
      } else {
        const loadedItems = sortScheduleItems(
          (data || []).map((item) => ({
            event_time: formatTime(item.event_time),
            end_time: formatTime(item.end_time),
            title: item.title,
            is_public: item.is_public ?? false,
          })),
        )
        setScheduleItems(loadedItems)
        setSavedScheduleItems(cloneScheduleItems(loadedItems))
      }

      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('schedule_published')
        .eq('id', 1)
        .maybeSingle()

      setIsPublished(settingsData?.schedule_published ?? false)

      setIsLoading(false)
    }

    loadSchedule()
  }, [navigate])

  async function togglePublish() {
    const nextValue = !isPublished

    setIsPublishSaving(true)
    setStatusMessage('')
    setIsPublished(nextValue)

    const { error } = await supabase
      .from('site_settings')
      .update({ schedule_published: nextValue, updated_at: new Date().toISOString() })
      .eq('id', 1)

    setIsPublishSaving(false)

    if (error) {
      setIsPublished(!nextValue)
      setStatusMessage(`Nem sikerült módosítani a publikálást: ${error.message}`)
      return
    }

    setStatusMessage(
      nextValue
        ? 'A menetrend mostantól megjelenik a kezdőlapon.'
        : 'A menetrend nem jelenik meg a kezdőlapon.',
    )
  }

  function updateScheduleItem(index, field, value) {
    setScheduleItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  function addScheduleItem() {
    setNewItem(createScheduleItem())
    setIsAddModalOpen(true)
    setStatusMessage('')
  }

  function closeAddModal() {
    setIsAddModalOpen(false)
    setNewItem(null)
  }

  function updateNewItem(field, value) {
    setNewItem((current) => (current ? { ...current, [field]: value } : current))
  }

  async function saveNewScheduleItem() {
    if (!newItem) {
      return
    }

    const title = newItem.title.trim()
    if (!title) {
      setStatusMessage('Az új menetrendi ponthoz kell címet adni.')
      return
    }

    const row = {
      event_time: newItem.event_time,
      end_time: newItem.end_time,
      title,
      is_public: Boolean(newItem.is_public),
    }

    setIsSubmitting(true)
    setStatusMessage('')

    const { error } = await supabase.from('schedule_items').insert(row)
    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült hozzáadni a menetrendi pontot: ${error.message}`)
      return
    }

    setScheduleItems((current) => sortScheduleItems([...current, row]))
    setSavedScheduleItems((current) => sortScheduleItems([...current, row]))
    closeAddModal()
    setStatusMessage('Az új menetrendi pont mentve.')
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
        is_public: item.is_public,
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
            <label className="publish-toggle">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={togglePublish}
                disabled={isPublishSaving}
              />
              <span className="publish-toggle-track" aria-hidden="true">
                <span className="publish-toggle-thumb" />
              </span>
              <span className="publish-toggle-text">
                <strong>Menetrend publikálása a kezdőlapon</strong>
                <span>
                  {isPublished
                    ? 'A publikus menetrendi pontok megjelennek a látogatóknak.'
                    : 'A kezdőlapon csak annyi látszik: „Hamarosan jönnek a részletek”.'}
                </span>
              </span>
            </label>

            {!isEditing ? (
              <>
                <div className="admin-actions">
                  <button type="button" onClick={addScheduleItem}>
                    Új menetrendi pont
                  </button>
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
                        <th>Publikus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleItems.length === 0 ? (
                        <tr>
                          <td colSpan="3">Még nincs menetrend megadva.</td>
                        </tr>
                      ) : (
                        scheduleItems.map((item) => (
                          <tr key={`${item.event_time}-${item.end_time}-${item.title}`}>
                            <td>{item.event_time} - {item.end_time}</td>
                            <td>{item.title}</td>
                            <td>{item.is_public ? 'Igen' : 'Nem'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="auth-form schedule-form">
                <div className="admin-table-wrapper">
                  <table className="admin-table schedule-edit-table">
                    <thead>
                      <tr>
                        <th>Kezdés</th>
                        <th>Vége</th>
                        <th>Esemény</th>
                        <th>Publikus</th>
                        <th aria-label="Műveletek" />
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleItems.map((item, index) => (
                        <tr key={`schedule-item-${index + 1}`}>
                          <td>
                            <select
                              aria-label="Kezdés"
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
                          </td>
                          <td>
                            <select
                              aria-label="Vége"
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
                          </td>
                          <td>
                            <input
                              aria-label="Esemény"
                              type="text"
                              value={item.title}
                              onChange={(event) =>
                                updateScheduleItem(index, 'title', event.target.value)
                              }
                              placeholder="Például: Szertartás"
                            />
                          </td>
                          <td className="schedule-public-cell">
                            <input
                              aria-label="Publikus"
                              type="checkbox"
                              checked={item.is_public}
                              onChange={(event) =>
                                updateScheduleItem(index, 'is_public', event.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <button type="button" onClick={() => removeScheduleItem(index)}>
                              Törlés
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

        {isAddModalOpen && newItem && (
          <AdminModal
            title="Új menetrendi pont"
            titleId="schedule-new-item-title"
            onClose={closeAddModal}
            actions={
              <>
                <button type="button" onClick={saveNewScheduleItem} disabled={isSubmitting}>
                  {isSubmitting ? 'Mentés...' : 'Mentés'}
                </button>
                <button type="button" onClick={closeAddModal} disabled={isSubmitting}>
                  Mégse
                </button>
              </>
            }
          >
            <label>
              Kezdés
              <select
                value={newItem.event_time}
                onChange={(event) => updateNewItem('event_time', event.target.value)}
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
                value={newItem.end_time}
                onChange={(event) => updateNewItem('end_time', event.target.value)}
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
                value={newItem.title}
                onChange={(event) => updateNewItem('title', event.target.value)}
                placeholder="Például: Szertartás"
                autoFocus
              />
            </label>

            <label className="budget-modal-checkbox">
              <input
                type="checkbox"
                checked={newItem.is_public}
                onChange={(event) => updateNewItem('is_public', event.target.checked)}
              />
              <span>Publikus (látszik a kezdőlapon)</span>
            </label>
          </AdminModal>
        )}

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
