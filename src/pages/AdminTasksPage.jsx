import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_TASK_TIMING,
  TASK_TIMING_OPTIONS,
  normalizeTaskTiming,
  taskTimingSortRank,
} from '../lib/taskTiming'

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

function uniqueAssignees(tasks, assigneeMap) {
  const ids = new Set()

  tasks.forEach((task) => {
    ;(assigneeMap[task.id] || []).forEach((userId) => ids.add(userId))
  })

  return [...ids]
}

export default function AdminTasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [assigneesByTask, setAssigneesByTask] = useState({})
  const [adminProfiles, setAdminProfiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [savingTaskId, setSavingTaskId] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set())
  const [timingSortDirection, setTimingSortDirection] = useState('anytime-to-wedding')

  useEffect(() => {
    async function loadTasks() {
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

      const [tasksResult, assigneesResult, profilesResult] = await Promise.all([
        supabase
          .from('wedding_tasks')
          .select('id, parent_id, title, progress, notes, timing, sort_order')
          .order('sort_order')
          .order('created_at'),
        supabase.from('wedding_task_assignees').select('task_id, user_id'),
        supabase.from('admin_profiles').select('user_id, display_name').order('display_name'),
      ])

      if (tasksResult.error) {
        setStatusMessage(`Nem sikerült betölteni a feladatokat: ${tasksResult.error.message}`)
        setIsLoading(false)
        return
      }

      if (assigneesResult.error) {
        setStatusMessage(
          `Nem sikerült betölteni a hozzárendeléseket: ${assigneesResult.error.message}`,
        )
        setIsLoading(false)
        return
      }

      if (profilesResult.error) {
        setStatusMessage(
          `Nem sikerült betölteni az admin profilokat: ${profilesResult.error.message}`,
        )
        setIsLoading(false)
        return
      }

      const nextAssignees = {}
      ;(assigneesResult.data || []).forEach((row) => {
        if (!nextAssignees[row.task_id]) {
          nextAssignees[row.task_id] = []
        }
        nextAssignees[row.task_id].push(row.user_id)
      })

      setTasks(
        (tasksResult.data || []).map((task) => ({
          ...task,
          timing: normalizeTaskTiming(task.timing),
        })),
      )
      setAssigneesByTask(nextAssignees)
      setAdminProfiles(profilesResult.data || [])
      setIsLoading(false)
    }

    loadTasks()
  }, [navigate])

  const topLevelTasks = useMemo(() => {
    const directionFactor = timingSortDirection === 'wedding-to-anytime' ? 1 : -1

    return tasks
      .filter((task) => !task.parent_id)
      .map((task) => {
        const children = tasks
          .filter((child) => child.parent_id === task.id)
          .sort((a, b) => {
            const timingDiff =
              (taskTimingSortRank(a.timing) - taskTimingSortRank(b.timing)) * directionFactor

            if (timingDiff !== 0) {
              return timingDiff
            }

            return a.sort_order - b.sort_order
          })
        const hasChildren = children.length > 0
        const progress = hasChildren ? averageProgress(children) : clampProgress(task.progress)
        const assigneeIds = hasChildren
          ? uniqueAssignees(children, assigneesByTask)
          : assigneesByTask[task.id] || []

        return {
          ...task,
          timing: normalizeTaskTiming(task.timing),
          children,
          hasChildren,
          displayProgress: progress,
          displayAssigneeIds: assigneeIds,
        }
      })
      .sort((a, b) => {
        const timingDiff =
          (taskTimingSortRank(a.timing) - taskTimingSortRank(b.timing)) * directionFactor

        if (timingDiff !== 0) {
          return timingDiff
        }

        return a.sort_order - b.sort_order
      })
  }, [tasks, assigneesByTask, timingSortDirection])

  function profileName(userId) {
    return adminProfiles.find((profile) => profile.user_id === userId)?.display_name || 'Admin'
  }

  function toggleExpanded(taskId) {
    setExpandedTaskIds((current) => {
      const next = new Set(current)

      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }

      return next
    })
  }

  function renderProgressCell(task, { readonly = false } = {}) {
    const progress = clampProgress(task.progress)

    if (readonly) {
      return (
        <div className="task-progress-readonly">
          <div className="task-progress-bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
          <span className="task-progress-hint">átlag</span>
        </div>
      )
    }

    return (
      <div className="task-progress-edit">
        <div className="task-progress-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <input
          type="number"
          min="0"
          max="100"
          value={progress}
          disabled={savingTaskId === task.id}
          onChange={(event) =>
            setTasks((current) =>
              current.map((item) =>
                item.id === task.id
                  ? {
                      ...item,
                      progress: clampProgress(event.target.value),
                    }
                  : item,
              ),
            )
          }
          onBlur={(event) => saveProgress(task.id, event.target.value)}
          aria-label={`${task.title} készültsége`}
        />
        <span>%</span>
      </div>
    )
  }

  function renderAssigneeCell(task, { readonly = false } = {}) {
    if (readonly) {
      const assigneeIds = task.displayAssigneeIds || []

      return (
        <div className="task-assignee-chips">
          {assigneeIds.length === 0 ? (
            <span className="task-assignee-empty">Nincs hozzárendelve</span>
          ) : (
            assigneeIds.map((userId) => (
              <span className="task-assignee-chip" key={userId}>
                {profileName(userId)}
              </span>
            ))
          )}
        </div>
      )
    }

    return (
      <div className="task-assignee-picker">
        {adminProfiles.map((profile) => {
          const checked = (assigneesByTask[task.id] || []).includes(profile.user_id)

          return (
            <label key={profile.user_id} className="task-assignee-option">
              <input
                type="checkbox"
                checked={checked}
                disabled={savingTaskId === task.id}
                onChange={() => toggleAssignee(task.id, profile.user_id)}
              />
              <span>{profile.display_name}</span>
            </label>
          )
        })}
      </div>
    )
  }

  function renderTimingCell(task) {
    return (
      <select
        className="task-timing-select"
        value={normalizeTaskTiming(task.timing)}
        disabled={savingTaskId === task.id}
        onChange={(event) => saveTiming(task.id, event.target.value)}
        aria-label={`${task.title} időzítése`}
      >
        {TASK_TIMING_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  async function createTask() {
    setIsCreating(true)
    setStatusMessage('')

    const sortOrder =
      topLevelTasks.reduce((max, task) => Math.max(max, task.sort_order || 0), 0) + 1

    const { data, error } = await supabase
      .from('wedding_tasks')
      .insert({
        title: 'Új feladat',
        progress: 0,
        notes: '',
        timing: DEFAULT_TASK_TIMING,
        sort_order: sortOrder,
      })
      .select('id, parent_id, title, progress, notes, timing, sort_order')
      .single()

    setIsCreating(false)

    if (error) {
      setStatusMessage(`Nem sikerült létrehozni a feladatot: ${error.message}`)
      return
    }

    setTasks((current) => [
      ...current,
      { ...data, timing: normalizeTaskTiming(data.timing) },
    ])
    navigate(`/admin/tasks/${data.id}`)
  }

  async function saveProgress(taskId, progress) {
    const nextProgress = clampProgress(progress)

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, progress: nextProgress } : task,
      ),
    )
    setSavingTaskId(taskId)
    setStatusMessage('')

    const { error } = await supabase
      .from('wedding_tasks')
      .update({ progress: nextProgress, updated_at: new Date().toISOString() })
      .eq('id', taskId)

    setSavingTaskId(null)

    if (error) {
      setStatusMessage(`Nem sikerült menteni a készültséget: ${error.message}`)
    }
  }

  async function saveTiming(taskId, timing) {
    const nextTiming = normalizeTaskTiming(timing)
    const previousTiming = tasks.find((task) => task.id === taskId)?.timing

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, timing: nextTiming } : task,
      ),
    )
    setSavingTaskId(taskId)
    setStatusMessage('')

    const { error } = await supabase
      .from('wedding_tasks')
      .update({ timing: nextTiming, updated_at: new Date().toISOString() })
      .eq('id', taskId)

    setSavingTaskId(null)

    if (error) {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? { ...task, timing: normalizeTaskTiming(previousTiming) }
            : task,
        ),
      )
      setStatusMessage(`Nem sikerült menteni az időzítést: ${error.message}`)
    }
  }

  async function toggleAssignee(taskId, userId) {
    const current = assigneesByTask[taskId] || []
    const isAssigned = current.includes(userId)
    const nextIds = isAssigned
      ? current.filter((id) => id !== userId)
      : [...current, userId]

    setAssigneesByTask((currentMap) => ({
      ...currentMap,
      [taskId]: nextIds,
    }))
    setSavingTaskId(taskId)
    setStatusMessage('')

    if (isAssigned) {
      const { error } = await supabase
        .from('wedding_task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId)

      setSavingTaskId(null)

      if (error) {
        setAssigneesByTask((currentMap) => ({
          ...currentMap,
          [taskId]: current,
        }))
        setStatusMessage(`Nem sikerült módosítani a hozzárendelést: ${error.message}`)
      }

      return
    }

    const { error } = await supabase
      .from('wedding_task_assignees')
      .insert({ task_id: taskId, user_id: userId })

    setSavingTaskId(null)

    if (error) {
      setAssigneesByTask((currentMap) => ({
        ...currentMap,
        [taskId]: current,
      }))
      setStatusMessage(`Nem sikerült módosítani a hozzárendelést: ${error.message}`)
    }
  }

  async function deleteTask(taskId) {
    const confirmed = window.confirm(
      'Biztosan törölni szeretnéd ezt a feladatot? Az alfeladatok és alapanyagok is törlődnek.',
    )

    if (!confirmed) {
      return
    }

    setSavingTaskId(taskId)
    setStatusMessage('')

    const { error } = await supabase.from('wedding_tasks').delete().eq('id', taskId)

    setSavingTaskId(null)

    if (error) {
      setStatusMessage(`Nem sikerült törölni a feladatot: ${error.message}`)
      return
    }

    setTasks((current) =>
      current.filter((task) => task.id !== taskId && task.parent_id !== taskId),
    )
    setAssigneesByTask((currentMap) => {
      const next = { ...currentMap }
      delete next[taskId]
      return next
    })
  }

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
        <p className="eyebrow">Admin</p>
        <h1>Feladatok</h1>
        <p className="admin-summary">
          Kövesd az esküvőig elvégzendő feladatokat. A készültség azonnal szerkeszthető. Ha egy
          feladatnak alfeladatai vannak, a készültség azok átlaga, és a hozzárendeltek az
          alfeladatok felelőseinek összessége.
        </p>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="admin-actions">
              <button type="button" onClick={createTask} disabled={isCreating}>
                {isCreating ? 'Létrehozás...' : 'Új feladat'}
              </button>
              <div className="task-sort-controls" role="group" aria-label="Rendezés időzítés szerint">
                <span>Rendezés:</span>
                <button
                  type="button"
                  className={
                    timingSortDirection === 'wedding-to-anytime' ? 'is-active' : ''
                  }
                  onClick={() => setTimingSortDirection('wedding-to-anytime')}
                >
                  Aznaptól a legkorábbig
                </button>
                <button
                  type="button"
                  className={
                    timingSortDirection === 'anytime-to-wedding' ? 'is-active' : ''
                  }
                  onClick={() => setTimingSortDirection('anytime-to-wedding')}
                >
                  Legkorábbitól aznapig
                </button>
              </div>
            </div>

            {!adminProfiles.length && (
              <p className="form-message">
                Még nincs admin profil. Futtasd a{' '}
                <code>supabase/tasks_schema.sql</code> scriptet a Supabase SQL Editorban, hogy
                feltöltődjenek az admin userek.
              </p>
            )}

            <div className="admin-table-wrapper">
              <table className="admin-table tasks-table">
                <thead>
                  <tr>
                    <th>Feladat</th>
                    <th>Mikor</th>
                    <th>Készültség</th>
                    <th>Hozzárendelve</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {topLevelTasks.length === 0 ? (
                    <tr>
                      <td colSpan="5">Még nincs feladat. Hozz létre egyet az Új feladat gombbal.</td>
                    </tr>
                  ) : (
                    topLevelTasks.flatMap((task) => {
                      const isExpanded = expandedTaskIds.has(task.id)
                      const rows = [
                        <tr key={task.id} className={task.hasChildren ? 'task-row-parent' : ''}>
                          <td>
                            <div className="task-title-cell">
                              {task.hasChildren ? (
                                <button
                                  type="button"
                                  className={`task-expand-toggle ${isExpanded ? 'is-open' : ''}`}
                                  onClick={() => toggleExpanded(task.id)}
                                  aria-expanded={isExpanded}
                                  aria-label={
                                    isExpanded
                                      ? 'Alfeladatok becsukása'
                                      : 'Alfeladatok lenyitása'
                                  }
                                >
                                  <span aria-hidden="true" />
                                </button>
                              ) : (
                                <span className="task-expand-spacer" aria-hidden="true" />
                              )}
                              <div className="task-title-copy">
                                <Link className="task-title-link" to={`/admin/tasks/${task.id}`}>
                                  {task.title || 'Névtelen feladat'}
                                </Link>
                                {task.hasChildren && (
                                  <span className="task-subcount">
                                    {task.children.length} alfeladat
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="task-timing-cell">{renderTimingCell(task)}</td>
                          <td className="task-progress-cell">
                            {renderProgressCell(
                              { ...task, progress: task.displayProgress },
                              { readonly: task.hasChildren },
                            )}
                          </td>
                          <td>
                            {renderAssigneeCell(task, { readonly: task.hasChildren })}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => deleteTask(task.id)}
                              disabled={savingTaskId === task.id}
                            >
                              Törlés
                            </button>
                          </td>
                        </tr>,
                      ]

                      if (task.hasChildren && isExpanded) {
                        task.children.forEach((child) => {
                          rows.push(
                            <tr key={child.id} className="task-row-child">
                              <td>
                                <div className="task-title-cell is-child">
                                  <span className="task-expand-spacer" aria-hidden="true" />
                                  <span className="task-child-title">
                                    {child.title || 'Névtelen alfeladat'}
                                  </span>
                                </div>
                              </td>
                              <td className="task-timing-cell">{renderTimingCell(child)}</td>
                              <td className="task-progress-cell">
                                {renderProgressCell(child)}
                              </td>
                              <td>{renderAssigneeCell(child)}</td>
                              <td />
                            </tr>,
                          )
                        })
                      }

                      return rows
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="auth-switch">
          <Link className="text-link" to="/">
            Vissza a főoldalra
          </Link>
        </p>
      </section>
    </main>
  )
}
