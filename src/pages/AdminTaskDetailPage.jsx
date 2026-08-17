import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminModal from '../components/AdminModal'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_TASK_TIMING,
  TASK_TIMING_OPTIONS,
  normalizeTaskTiming,
} from '../lib/taskTiming'

const AUTOSAVE_DELAY_MS = 650

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function clampProgress(value) {
  const number = Number(value)

  if (Number.isNaN(number)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(number)))
}

function averageProgress(items) {
  if (!items.length) {
    return 0
  }

  const total = items.reduce((sum, item) => sum + clampProgress(item.progress), 0)
  return Math.round(total / items.length)
}

function parsePrice(value) {
  if (value === '' || value === null || value === undefined) {
    return 0
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export default function AdminTaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [adminProfiles, setAdminProfiles] = useState([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [progress, setProgress] = useState(0)
  const [timing, setTiming] = useState(DEFAULT_TASK_TIMING)
  const [assigneeIds, setAssigneeIds] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [materials, setMaterials] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [busyAction, setBusyAction] = useState(null)
  const [isManualSaving, setIsManualSaving] = useState(false)
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskTiming, setNewSubtaskTiming] = useState(DEFAULT_TASK_TIMING)
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false)
  const [newMaterialDraft, setNewMaterialDraft] = useState({
    name: '',
    source: '',
    estimated_price: '',
  })

  const readyRef = useRef(false)
  const timersRef = useRef({})
  const saveCountRef = useRef(0)
  const draftRef = useRef({
    title: '',
    notes: '',
    progress: 0,
    timing: DEFAULT_TASK_TIMING,
    assigneeIds: [],
    subtasks: [],
    materials: [],
    hasSubtasks: false,
  })

  useEffect(() => {
    draftRef.current = {
      title,
      notes,
      progress,
      timing,
      assigneeIds,
      subtasks,
      materials,
      hasSubtasks: subtasks.length > 0,
    }
  }, [title, notes, progress, timing, assigneeIds, subtasks, materials])

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    readyRef.current = false

    async function loadTask() {
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

      const [taskResult, childrenResult, assigneesResult, materialsResult, profilesResult] =
        await Promise.all([
          supabase
            .from('wedding_tasks')
            .select('id, parent_id, title, progress, notes, timing, sort_order')
            .eq('id', taskId)
            .maybeSingle(),
          supabase
            .from('wedding_tasks')
            .select('id, parent_id, title, progress, notes, timing, sort_order')
            .eq('parent_id', taskId)
            .order('sort_order')
            .order('created_at'),
          supabase.from('wedding_task_assignees').select('task_id, user_id'),
          supabase
            .from('wedding_task_materials')
            .select('id, task_id, name, source, estimated_price, is_acquired, sort_order')
            .eq('task_id', taskId)
            .order('sort_order')
            .order('created_at'),
          supabase.from('admin_profiles').select('user_id, display_name').order('display_name'),
        ])

      if (taskResult.error || !taskResult.data) {
        setStatusMessage(
          taskResult.error
            ? `Nem sikerült betölteni a feladatot: ${taskResult.error.message}`
            : 'A feladat nem található.',
        )
        setIsLoading(false)
        return
      }

      if (taskResult.data.parent_id) {
        navigate(`/admin/tasks/${taskResult.data.parent_id}`, { replace: true })
        return
      }

      if (
        childrenResult.error ||
        assigneesResult.error ||
        materialsResult.error ||
        profilesResult.error
      ) {
        setStatusMessage(
          `Nem sikerült betölteni a részleteket: ${
            childrenResult.error?.message ||
            assigneesResult.error?.message ||
            materialsResult.error?.message ||
            profilesResult.error?.message
          }`,
        )
        setIsLoading(false)
        return
      }

      const assignees = assigneesResult.data || []
      const childTasks = (childrenResult.data || []).map((child) => ({
        id: child.id,
        title: child.title || '',
        progress: clampProgress(child.progress),
        timing: normalizeTaskTiming(child.timing),
        sort_order: child.sort_order || 0,
        assigneeIds: assignees
          .filter((row) => row.task_id === child.id)
          .map((row) => row.user_id),
      }))

      setAdminProfiles(profilesResult.data || [])
      setTitle(taskResult.data.title || '')
      setNotes(taskResult.data.notes || '')
      setProgress(clampProgress(taskResult.data.progress))
      setTiming(normalizeTaskTiming(taskResult.data.timing))
      setAssigneeIds(
        assignees.filter((row) => row.task_id === taskId).map((row) => row.user_id),
      )
      setSubtasks(childTasks)
      setMaterials(
        (materialsResult.data || []).map((item, index) => ({
          id: item.id,
          name: item.name || '',
          source: item.source || '',
          estimated_price:
            item.estimated_price === null || item.estimated_price === undefined
              ? ''
              : String(item.estimated_price),
          is_acquired: Boolean(item.is_acquired),
          sort_order: item.sort_order ?? index,
        })),
      )
      setStatusMessage('')
      setSaveState('idle')
      setIsLoading(false)
      readyRef.current = true
    }

    loadTask()
  }, [navigate, taskId])

  const hasSubtasks = subtasks.length > 0
  const displayProgress = hasSubtasks ? averageProgress(subtasks) : progress
  const displayAssigneeIds = useMemo(() => {
    if (!hasSubtasks) {
      return assigneeIds
    }

    const ids = new Set()
    subtasks.forEach((subtask) => {
      subtask.assigneeIds.forEach((id) => ids.add(id))
    })
    return [...ids]
  }, [hasSubtasks, assigneeIds, subtasks])

  function profileName(userId) {
    return adminProfiles.find((profile) => profile.user_id === userId)?.display_name || 'Admin'
  }

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

  function scheduleSave(key, action) {
    if (!readyRef.current) {
      return
    }

    if (timersRef.current[key]) {
      clearTimeout(timersRef.current[key])
    }

    timersRef.current[key] = setTimeout(async () => {
      delete timersRef.current[key]
      beginSave()

      try {
        const errorMessage = await action()
        endSave(errorMessage || null)
      } catch (error) {
        endSave(error?.message || 'Ismeretlen mentési hiba.')
      }
    }, AUTOSAVE_DELAY_MS)
  }

  async function runImmediate(action, busyKey = null) {
    if (!readyRef.current) {
      return
    }

    if (busyKey) {
      setBusyAction(busyKey)
    }

    beginSave()

    try {
      const errorMessage = await action()
      endSave(errorMessage || null)
    } catch (error) {
      endSave(error?.message || 'Ismeretlen mentési hiba.')
    }

    if (busyKey) {
      setBusyAction(null)
    }
  }

  function persistParentFields() {
    scheduleSave('parent', writeParentFields)
  }

  async function writeParentFields() {
    const draft = draftRef.current
    const { error } = await supabase
      .from('wedding_tasks')
      .update({
        title: draft.title.trim() || 'Névtelen feladat',
        notes: draft.notes.trim(),
        progress: draft.hasSubtasks ? 0 : clampProgress(draft.progress),
        timing: normalizeTaskTiming(draft.timing),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    return error ? `Nem sikerült menteni a feladatot: ${error.message}` : null
  }

  async function writeSubtask(subtaskId) {
    const current = draftRef.current.subtasks.find((item) => item.id === subtaskId)
    if (!current) {
      return null
    }

    const { error } = await supabase
      .from('wedding_tasks')
      .update({
        title: current.title.trim() || 'Alfeladat',
        progress: clampProgress(current.progress),
        timing: normalizeTaskTiming(current.timing),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subtaskId)

    return error ? `Nem sikerült menteni az alfeladatot: ${error.message}` : null
  }

  async function writeMaterial(materialId) {
    const current = draftRef.current.materials.find((item) => item.id === materialId)
    if (!current) {
      return null
    }

    const { error } = await supabase
      .from('wedding_task_materials')
      .update({
        name: current.name.trim(),
        source: current.source.trim(),
        estimated_price: parsePrice(current.estimated_price),
        is_acquired: Boolean(current.is_acquired),
      })
      .eq('id', materialId)

    return error ? `Nem sikerült menteni az alapanyagot: ${error.message}` : null
  }

  async function saveNow() {
    if (!readyRef.current) {
      return
    }

    Object.values(timersRef.current).forEach((timer) => clearTimeout(timer))
    timersRef.current = {}

    setIsManualSaving(true)
    beginSave()

    try {
      const errors = []
      const parentError = await writeParentFields()
      if (parentError) {
        errors.push(parentError)
      }

      for (const subtask of draftRef.current.subtasks) {
        const error = await writeSubtask(subtask.id)
        if (error) {
          errors.push(error)
        }
      }

      for (const material of draftRef.current.materials) {
        const error = await writeMaterial(material.id)
        if (error) {
          errors.push(error)
        }
      }

      endSave(errors[0] || null)
    } catch (error) {
      endSave(error?.message || 'Ismeretlen mentési hiba.')
    }

    setIsManualSaving(false)
  }

  function handleTitleChange(value) {
    setTitle(value)
    draftRef.current = { ...draftRef.current, title: value }
    persistParentFields()
  }

  function handleNotesChange(value) {
    setNotes(value)
    draftRef.current = { ...draftRef.current, notes: value }
    persistParentFields()
  }

  function handleProgressChange(value) {
    const nextProgress = clampProgress(value)
    setProgress(nextProgress)
    draftRef.current = { ...draftRef.current, progress: nextProgress }
    persistParentFields()
  }

  function handleTimingChange(value) {
    const nextTiming = normalizeTaskTiming(value)
    setTiming(nextTiming)
    draftRef.current = { ...draftRef.current, timing: nextTiming }
    persistParentFields()
  }

  function toggleParentAssignee(userId) {
    const isAssigned = assigneeIds.includes(userId)
    const previous = assigneeIds
    const nextIds = isAssigned
      ? assigneeIds.filter((id) => id !== userId)
      : [...assigneeIds, userId]

    setAssigneeIds(nextIds)

    runImmediate(async () => {
      if (isAssigned) {
        const { error } = await supabase
          .from('wedding_task_assignees')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', userId)

        if (error) {
          setAssigneeIds(previous)
          return `Nem sikerült módosítani a hozzárendelést: ${error.message}`
        }

        return null
      }

      const { error } = await supabase
        .from('wedding_task_assignees')
        .insert({ task_id: taskId, user_id: userId })

      if (error) {
        setAssigneeIds(previous)
        return `Nem sikerült módosítani a hozzárendelést: ${error.message}`
      }

      return null
    })
  }

  function persistSubtask(subtaskId) {
    scheduleSave(`subtask:${subtaskId}`, () => writeSubtask(subtaskId))
  }

  function updateSubtask(id, field, value) {
    const normalized =
      field === 'progress'
        ? clampProgress(value)
        : field === 'timing'
          ? normalizeTaskTiming(value)
          : value

    setSubtasks((current) => {
      const next = current.map((subtask) =>
        subtask.id === id
          ? {
              ...subtask,
              [field]: normalized,
            }
          : subtask,
      )
      draftRef.current = {
        ...draftRef.current,
        subtasks: next,
        hasSubtasks: next.length > 0,
      }
      return next
    })

    persistSubtask(id)
  }

  function toggleSubtaskAssignee(subtaskId, userId) {
    let previousAssignees = []
    let isAssigned = false

    setSubtasks((current) =>
      current.map((subtask) => {
        if (subtask.id !== subtaskId) {
          return subtask
        }

        previousAssignees = subtask.assigneeIds
        isAssigned = subtask.assigneeIds.includes(userId)

        return {
          ...subtask,
          assigneeIds: isAssigned
            ? subtask.assigneeIds.filter((id) => id !== userId)
            : [...subtask.assigneeIds, userId],
        }
      }),
    )

    runImmediate(async () => {
      if (isAssigned) {
        const { error } = await supabase
          .from('wedding_task_assignees')
          .delete()
          .eq('task_id', subtaskId)
          .eq('user_id', userId)

        if (error) {
          setSubtasks((current) =>
            current.map((subtask) =>
              subtask.id === subtaskId
                ? { ...subtask, assigneeIds: previousAssignees }
                : subtask,
            ),
          )
          return `Nem sikerült módosítani a hozzárendelést: ${error.message}`
        }

        return null
      }

      const { error } = await supabase
        .from('wedding_task_assignees')
        .insert({ task_id: subtaskId, user_id: userId })

      if (error) {
        setSubtasks((current) =>
          current.map((subtask) =>
            subtask.id === subtaskId
              ? { ...subtask, assigneeIds: previousAssignees }
              : subtask,
          ),
        )
        return `Nem sikerült módosítani a hozzárendelést: ${error.message}`
      }

      return null
    })
  }

  async function addSubtask() {
    const title = newSubtaskTitle.trim()
    if (!title) {
      setStatusMessage('Az új alfeladathoz kell címet adni.')
      return
    }

    const sortOrder =
      subtasks.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1

    await runImmediate(async () => {
      const { data, error } = await supabase
        .from('wedding_tasks')
        .insert({
          parent_id: taskId,
          title,
          progress: 0,
          notes: '',
          timing: normalizeTaskTiming(newSubtaskTiming),
          sort_order: sortOrder,
        })
        .select('id, title, progress, timing, sort_order')
        .single()

      if (error) {
        return `Nem sikerült létrehozni az alfeladatot: ${error.message}`
      }

      setSubtasks((current) => [
        ...current,
        {
          id: data.id,
          title: data.title || '',
          progress: clampProgress(data.progress),
          timing: normalizeTaskTiming(data.timing),
          sort_order: data.sort_order || sortOrder,
          assigneeIds: [],
        },
      ])

      if (subtasks.length === 0) {
        await supabase
          .from('wedding_tasks')
          .update({ progress: 0, updated_at: new Date().toISOString() })
          .eq('id', taskId)
      }

      setIsAddSubtaskOpen(false)
      setNewSubtaskTitle('')
      setNewSubtaskTiming(DEFAULT_TASK_TIMING)
      return null
    }, 'add-subtask')
  }

  function removeSubtask(id) {
    const previous = subtasks
    setSubtasks((current) => current.filter((subtask) => subtask.id !== id))

    if (timersRef.current[`subtask:${id}`]) {
      clearTimeout(timersRef.current[`subtask:${id}`])
      delete timersRef.current[`subtask:${id}`]
    }

    runImmediate(async () => {
      const { error } = await supabase.from('wedding_tasks').delete().eq('id', id)

      if (error) {
        setSubtasks(previous)
        return `Nem sikerült törölni az alfeladatot: ${error.message}`
      }

      return null
    }, `remove-subtask:${id}`)
  }

  function persistMaterial(materialId) {
    scheduleSave(`material:${materialId}`, () => writeMaterial(materialId))
  }

  function updateMaterial(id, field, value) {
    setMaterials((current) => {
      const next = current.map((material) =>
        material.id === id ? { ...material, [field]: value } : material,
      )
      draftRef.current = { ...draftRef.current, materials: next }
      return next
    })

    persistMaterial(id)
  }

  async function addMaterial() {
    const name = newMaterialDraft.name.trim()
    if (!name) {
      setStatusMessage('Az új alapanyaghoz kell nevet adni.')
      return
    }

    const sortOrder =
      materials.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1

    await runImmediate(async () => {
      const { data, error } = await supabase
        .from('wedding_task_materials')
        .insert({
          task_id: taskId,
          name,
          source: newMaterialDraft.source.trim(),
          estimated_price: parsePrice(newMaterialDraft.estimated_price),
          is_acquired: false,
          sort_order: sortOrder,
        })
        .select('id, name, source, estimated_price, is_acquired, sort_order')
        .single()

      if (error) {
        return `Nem sikerült létrehozni az alapanyagot: ${error.message}`
      }

      setMaterials((current) => [
        ...current,
        {
          id: data.id,
          name: data.name || '',
          source: data.source || '',
          estimated_price:
            data.estimated_price === null || data.estimated_price === undefined
              ? ''
              : String(data.estimated_price),
          is_acquired: Boolean(data.is_acquired),
          sort_order: data.sort_order || sortOrder,
        },
      ])

      setIsAddMaterialOpen(false)
      setNewMaterialDraft({ name: '', source: '', estimated_price: '' })
      return null
    }, 'add-material')
  }

  function removeMaterial(id) {
    const previous = materials
    setMaterials((current) => current.filter((material) => material.id !== id))

    if (timersRef.current[`material:${id}`]) {
      clearTimeout(timersRef.current[`material:${id}`])
      delete timersRef.current[`material:${id}`]
    }

    runImmediate(async () => {
      const { error } = await supabase.from('wedding_task_materials').delete().eq('id', id)

      if (error) {
        setMaterials(previous)
        return `Nem sikerült törölni az alapanyagot: ${error.message}`
      }

      return null
    }, `remove-material:${id}`)
  }

  function toggleMaterialAcquired(material) {
    const nextValue = !material.is_acquired
    const previousValue = material.is_acquired

    setMaterials((current) =>
      current.map((item) =>
        item.id === material.id ? { ...item, is_acquired: nextValue } : item,
      ),
    )

    runImmediate(async () => {
      const { error } = await supabase
        .from('wedding_task_materials')
        .update({ is_acquired: nextValue })
        .eq('id', material.id)

      if (error) {
        setMaterials((current) =>
          current.map((item) =>
            item.id === material.id ? { ...item, is_acquired: previousValue } : item,
          ),
        )
        return `Nem sikerült menteni a beszerzés státuszát: ${error.message}`
      }

      return null
    })
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
        <p className="eyebrow">Admin · Feladat</p>
        <h1>{title || 'Feladat szerkesztése'}</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="admin-actions task-detail-actions">
              <p className={`task-autosave-status is-${saveState}`}>{saveLabel}</p>
              <button type="button" onClick={saveNow} disabled={isManualSaving}>
                {isManualSaving ? 'Mentés...' : 'Mentés'}
              </button>
              <Link className="text-link" to="/admin/tasks">
                Vissza a listához
              </Link>
            </div>

            <div className="task-detail-grid">
              <label className="task-field">
                <span>Feladat neve</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                />
              </label>

              <div className="task-field">
                <span>Készültség</span>
                {hasSubtasks ? (
                  <div className="task-progress-readonly">
                    <div className="task-progress-bar" aria-hidden="true">
                      <span style={{ width: `${displayProgress}%` }} />
                    </div>
                    <strong>{displayProgress}%</strong>
                    <span className="task-progress-hint">átlag</span>
                  </div>
                ) : (
                  <div className="task-progress-edit">
                    <div className="task-progress-bar" aria-hidden="true">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={(event) => handleProgressChange(event.target.value)}
                    />
                    <span>%</span>
                  </div>
                )}
              </div>

              <div className="task-field">
                <span>Mikor végezhető el</span>
                <select
                  className="task-timing-select"
                  value={normalizeTaskTiming(timing)}
                  onChange={(event) => handleTimingChange(event.target.value)}
                >
                  {TASK_TIMING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-field">
                <span>Hozzárendelve</span>
                {hasSubtasks ? (
                  <div className="task-assignee-chips">
                    {displayAssigneeIds.length === 0 ? (
                      <span className="task-assignee-empty">Nincs hozzárendelve</span>
                    ) : (
                      displayAssigneeIds.map((userId) => (
                        <span className="task-assignee-chip" key={userId}>
                          {profileName(userId)}
                        </span>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="task-assignee-picker">
                    {adminProfiles.map((profile) => (
                      <label key={profile.user_id} className="task-assignee-option">
                        <input
                          type="checkbox"
                          checked={assigneeIds.includes(profile.user_id)}
                          onChange={() => toggleParentAssignee(profile.user_id)}
                        />
                        <span>{profile.display_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label className="task-field task-field-wide">
                <span>Megjegyzések</span>
                <textarea
                  rows="5"
                  value={notes}
                  onChange={(event) => handleNotesChange(event.target.value)}
                  placeholder="Ide írhatod a feladat részleteit, döntéseket, teendőket..."
                />
              </label>
            </div>

            <section className="task-section">
              <div className="task-section-head">
                <h2>Alfeladatok</h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewSubtaskTitle('')
                    setNewSubtaskTiming(DEFAULT_TASK_TIMING)
                    setIsAddSubtaskOpen(true)
                    setStatusMessage('')
                  }}
                  disabled={busyAction === 'add-subtask'}
                >
                  Alfeladat hozzáadása
                </button>
              </div>
              <p className="admin-summary">
                Ha vannak alfeladatok, a fő feladat készültsége azok átlaga, a hozzárendeltek pedig
                az alfeladatok felelőseinek összessége.
              </p>

              <div className="admin-table-wrapper">
                <table className="admin-table tasks-table">
                  <thead>
                    <tr>
                      <th>Alfeladat</th>
                      <th>Mikor</th>
                      <th>Készültség</th>
                      <th>Hozzárendelve</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {subtasks.length === 0 ? (
                      <tr>
                        <td colSpan="5">Még nincs alfeladat.</td>
                      </tr>
                    ) : (
                      subtasks.map((subtask) => (
                        <tr key={subtask.id}>
                          <td>
                            <input
                              type="text"
                              value={subtask.title}
                              onChange={(event) =>
                                updateSubtask(subtask.id, 'title', event.target.value)
                              }
                              placeholder="Alfeladat neve"
                            />
                          </td>
                          <td className="task-timing-cell">
                            <select
                              className="task-timing-select"
                              value={normalizeTaskTiming(subtask.timing)}
                              onChange={(event) =>
                                updateSubtask(subtask.id, 'timing', event.target.value)
                              }
                            >
                              {TASK_TIMING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="task-progress-cell">
                            <div className="task-progress-edit">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={subtask.progress}
                                onChange={(event) =>
                                  updateSubtask(subtask.id, 'progress', event.target.value)
                                }
                              />
                              <span>%</span>
                            </div>
                          </td>
                          <td>
                            <div className="task-assignee-picker">
                              {adminProfiles.map((profile) => (
                                <label
                                  key={profile.user_id}
                                  className="task-assignee-option"
                                >
                                  <input
                                    type="checkbox"
                                    checked={subtask.assigneeIds.includes(profile.user_id)}
                                    onChange={() =>
                                      toggleSubtaskAssignee(subtask.id, profile.user_id)
                                    }
                                  />
                                  <span>{profile.display_name}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeSubtask(subtask.id)}
                              disabled={busyAction === `remove-subtask:${subtask.id}`}
                            >
                              Törlés
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="task-section">
              <div className="task-section-head">
                <h2>Alapanyagok</h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewMaterialDraft({ name: '', source: '', estimated_price: '' })
                    setIsAddMaterialOpen(true)
                    setStatusMessage('')
                  }}
                  disabled={busyAction === 'add-material'}
                >
                  Alapanyag hozzáadása
                </button>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table tasks-table">
                  <thead>
                    <tr>
                      <th>Beszerezve</th>
                      <th>Alapanyag</th>
                      <th>Beszerzés</th>
                      <th>Becsült ár</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr>
                        <td colSpan="5">Még nincs alapanyag.</td>
                      </tr>
                    ) : (
                      materials.map((material) => (
                        <tr
                          key={material.id}
                          className={material.is_acquired ? 'material-row-acquired' : ''}
                        >
                          <td className="material-acquired-cell">
                            <label className="material-acquired-option">
                              <input
                                type="checkbox"
                                checked={Boolean(material.is_acquired)}
                                onChange={() => toggleMaterialAcquired(material)}
                                aria-label={`${material.name || 'Alapanyag'} beszerezve`}
                              />
                              <span>{material.is_acquired ? 'Igen' : 'Nem'}</span>
                            </label>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={material.name}
                              onChange={(event) =>
                                updateMaterial(material.id, 'name', event.target.value)
                              }
                              placeholder="pl. virág, szalag"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={material.source}
                              onChange={(event) =>
                                updateMaterial(material.id, 'source', event.target.value)
                              }
                              placeholder="Honnan szerezzük be?"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={material.estimated_price}
                              onChange={(event) =>
                                updateMaterial(
                                  material.id,
                                  'estimated_price',
                                  event.target.value,
                                )
                              }
                              placeholder="0"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeMaterial(material.id)}
                              disabled={busyAction === `remove-material:${material.id}`}
                            >
                              Törlés
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {isAddSubtaskOpen && (
          <AdminModal
            title="Új alfeladat"
            titleId="task-new-subtask-title"
            onClose={() => setIsAddSubtaskOpen(false)}
            actions={
              <>
                <button
                  type="button"
                  onClick={addSubtask}
                  disabled={busyAction === 'add-subtask'}
                >
                  {busyAction === 'add-subtask' ? 'Mentés...' : 'Mentés'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSubtaskOpen(false)}
                  disabled={busyAction === 'add-subtask'}
                >
                  Mégse
                </button>
              </>
            }
          >
            <label>
              Alfeladat neve
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                placeholder="Pl. meghívó szöveg írása"
                autoFocus
              />
            </label>
            <label>
              Időzítés
              <select
                value={newSubtaskTiming}
                onChange={(event) => setNewSubtaskTiming(event.target.value)}
              >
                {TASK_TIMING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </AdminModal>
        )}

        {isAddMaterialOpen && (
          <AdminModal
            title="Új alapanyag"
            titleId="task-new-material-title"
            onClose={() => setIsAddMaterialOpen(false)}
            actions={
              <>
                <button
                  type="button"
                  onClick={addMaterial}
                  disabled={busyAction === 'add-material'}
                >
                  {busyAction === 'add-material' ? 'Mentés...' : 'Mentés'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMaterialOpen(false)}
                  disabled={busyAction === 'add-material'}
                >
                  Mégse
                </button>
              </>
            }
          >
            <label>
              Alapanyag
              <input
                type="text"
                value={newMaterialDraft.name}
                onChange={(event) =>
                  setNewMaterialDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="pl. virág, szalag"
                autoFocus
              />
            </label>
            <label>
              Beszerzés
              <input
                type="text"
                value={newMaterialDraft.source}
                onChange={(event) =>
                  setNewMaterialDraft((current) => ({ ...current, source: event.target.value }))
                }
                placeholder="Honnan szerezzük be?"
              />
            </label>
            <label>
              Becsült ár
              <input
                type="number"
                min="0"
                step="0.01"
                value={newMaterialDraft.estimated_price}
                onChange={(event) =>
                  setNewMaterialDraft((current) => ({
                    ...current,
                    estimated_price: event.target.value,
                  }))
                }
                placeholder="0"
              />
            </label>
          </AdminModal>
        )}

        <p className="auth-switch">
          <Link className="text-link" to="/admin/tasks">
            Vissza a feladatokhoz
          </Link>
        </p>
      </section>
    </main>
  )
}
