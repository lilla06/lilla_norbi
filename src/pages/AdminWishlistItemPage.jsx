import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AUTOSAVE_DELAY_MS = 650

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function parsePrice(value) {
  if (value === '' || value === null || value === undefined) {
    return 0
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export default function AdminWishlistItemPage() {
  const { materialId } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [estimatedPrice, setEstimatedPrice] = useState('')
  const [isAcquired, setIsAcquired] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [isManualSaving, setIsManualSaving] = useState(false)

  const readyRef = useRef(false)
  const timerRef = useRef(null)
  const saveCountRef = useRef(0)
  const draftRef = useRef({
    name: '',
    source: '',
    estimatedPrice: '',
    isAcquired: false,
    taskId: '',
  })

  useEffect(() => {
    draftRef.current = {
      name,
      source,
      estimatedPrice,
      isAcquired,
      taskId,
    }
  }, [name, source, estimatedPrice, isAcquired, taskId])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    readyRef.current = false

    async function loadMaterial() {
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

      const [materialResult, tasksResult] = await Promise.all([
        supabase
          .from('wedding_task_materials')
          .select('id, task_id, name, source, estimated_price, is_acquired')
          .eq('id', materialId)
          .maybeSingle(),
        supabase
          .from('wedding_tasks')
          .select('id, parent_id, title')
          .is('parent_id', null)
          .order('sort_order')
          .order('created_at'),
      ])

      if (materialResult.error || !materialResult.data) {
        setStatusMessage(
          materialResult.error
            ? `Nem sikerült betölteni az alapanyagot: ${materialResult.error.message}`
            : 'Az alapanyag nem található.',
        )
        setIsLoading(false)
        return
      }

      if (tasksResult.error) {
        setStatusMessage(`Nem sikerült betölteni a feladatokat: ${tasksResult.error.message}`)
        setIsLoading(false)
        return
      }

      const material = materialResult.data
      setName(material.name || '')
      setSource(material.source || '')
      setEstimatedPrice(
        material.estimated_price === null || material.estimated_price === undefined
          ? ''
          : String(material.estimated_price),
      )
      setIsAcquired(Boolean(material.is_acquired))
      setTaskId(material.task_id || '')
      setTasks(tasksResult.data || [])
      setStatusMessage('')
      setSaveState('idle')
      setIsLoading(false)
      readyRef.current = true
    }

    loadMaterial()
  }, [materialId, navigate])

  function beginSave() {
    saveCountRef.current += 1
    setSaveState('saving')
  }

  function endSave(errorMessage) {
    saveCountRef.current = Math.max(0, saveCountRef.current - 1)

    if (errorMessage) {
      setStatusMessage(errorMessage)
      setSaveState('error')
      return
    }

    if (saveCountRef.current === 0) {
      setStatusMessage('')
      setSaveState('saved')
    }
  }

  async function persistMaterial() {
    const draft = draftRef.current
    const { error } = await supabase
      .from('wedding_task_materials')
      .update({
        name: draft.name.trim() || 'Névtelen alapanyag',
        source: draft.source.trim(),
        estimated_price: parsePrice(draft.estimatedPrice),
        is_acquired: Boolean(draft.isAcquired),
        task_id: draft.taskId || null,
      })
      .eq('id', materialId)

    return error ? `Nem sikerült menteni az alapanyagot: ${error.message}` : null
  }

  function scheduleAutosave() {
    if (!readyRef.current) {
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(async () => {
      timerRef.current = null
      beginSave()

      try {
        endSave(await persistMaterial())
      } catch (error) {
        endSave(error?.message || 'Ismeretlen mentési hiba.')
      }
    }, AUTOSAVE_DELAY_MS)
  }

  async function saveNow() {
    if (!readyRef.current) {
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setIsManualSaving(true)
    beginSave()

    try {
      endSave(await persistMaterial())
    } catch (error) {
      endSave(error?.message || 'Ismeretlen mentési hiba.')
    }

    setIsManualSaving(false)
  }

  function handleNameChange(value) {
    setName(value)
    draftRef.current = { ...draftRef.current, name: value }
    scheduleAutosave()
  }

  function handleSourceChange(value) {
    setSource(value)
    draftRef.current = { ...draftRef.current, source: value }
    scheduleAutosave()
  }

  function handlePriceChange(value) {
    setEstimatedPrice(value)
    draftRef.current = { ...draftRef.current, estimatedPrice: value }
    scheduleAutosave()
  }

  function handleTaskChange(value) {
    setTaskId(value)
    draftRef.current = { ...draftRef.current, taskId: value }
    scheduleAutosave()
  }

  function handleAcquiredChange(checked) {
    setIsAcquired(checked)
    draftRef.current = { ...draftRef.current, isAcquired: checked }
    scheduleAutosave()
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Mentés...'
      : saveState === 'saved'
        ? 'Automatikusan mentve'
        : saveState === 'error'
          ? 'Mentési hiba'
          : 'A változtatások automatikusan mentődnek'

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card admin-card tasks-card">
          <p className="eyebrow">Admin</p>
          <h1>Betöltés...</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card admin-card tasks-card">
        <p className="eyebrow">Admin · Wishlist</p>
        <h1>{name || 'Alapanyag szerkesztése'}</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="admin-actions task-detail-actions">
              <p className={`task-autosave-status is-${saveState}`}>{saveLabel}</p>
              <button type="button" onClick={saveNow} disabled={isManualSaving}>
                {isManualSaving ? 'Mentés...' : 'Mentés'}
              </button>
              <Link className="text-link" to="/admin/wishlist">
                Vissza a wishlisthez
              </Link>
            </div>

            <div className="task-detail-grid">
              <label className="task-field">
                <span>Alapanyag neve</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => handleNameChange(event.target.value)}
                />
              </label>

              <label className="task-field">
                <span>Beszerzés helye</span>
                <input
                  type="text"
                  value={source}
                  onChange={(event) => handleSourceChange(event.target.value)}
                  placeholder="Honnan szerezzük be?"
                />
              </label>

              <label className="task-field">
                <span>Becsült ár</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedPrice}
                  onChange={(event) => handlePriceChange(event.target.value)}
                  placeholder="0"
                />
              </label>

              <div className="task-field">
                <span>Beszerezve</span>
                <label className="material-acquired-option">
                  <input
                    type="checkbox"
                    checked={isAcquired}
                    onChange={(event) => handleAcquiredChange(event.target.checked)}
                  />
                  <span>{isAcquired ? 'Igen' : 'Nem'}</span>
                </label>
              </div>

              <label className="task-field task-field-wide">
                <span>Feladat</span>
                <select
                  className="task-timing-select"
                  value={taskId}
                  onChange={(event) => handleTaskChange(event.target.value)}
                >
                  <option value="">Nincs feladathoz rendelve</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title || 'Névtelen feladat'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}

        <p className="auth-switch">
          <Link className="text-link" to="/admin/wishlist">
            Vissza a wishlisthez
          </Link>
        </p>
      </section>
    </main>
  )
}
