import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
          .select('id, parent_id, title, progress, notes, sort_order')
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

      setTasks(tasksResult.data || [])
      setAssigneesByTask(nextAssignees)
      setAdminProfiles(profilesResult.data || [])
      setIsLoading(false)
    }

    loadTasks()
  }, [navigate])

  const topLevelTasks = useMemo(() => {
    return tasks
      .filter((task) => !task.parent_id)
      .map((task) => {
        const children = tasks
          .filter((child) => child.parent_id === task.id)
          .sort((a, b) => a.sort_order - b.sort_order)
        const hasChildren = children.length > 0
        const progress = hasChildren ? averageProgress(children) : clampProgress(task.progress)
        const assigneeIds = hasChildren
          ? uniqueAssignees(children, assigneesByTask)
          : assigneesByTask[task.id] || []

        return {
          ...task,
          children,
          hasChildren,
          displayProgress: progress,
          displayAssigneeIds: assigneeIds,
        }
      })
  }, [tasks, assigneesByTask])

  function profileName(userId) {
    return adminProfiles.find((profile) => profile.user_id === userId)?.display_name || 'Admin'
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
        sort_order: sortOrder,
      })
      .select('id, parent_id, title, progress, notes, sort_order')
      .single()

    setIsCreating(false)

    if (error) {
      setStatusMessage(`Nem sikerült létrehozni a feladatot: ${error.message}`)
      return
    }

    setTasks((current) => [...current, data])
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
                    <th>Készültség</th>
                    <th>Hozzárendelve</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {topLevelTasks.length === 0 ? (
                    <tr>
                      <td colSpan="4">Még nincs feladat. Hozz létre egyet az Új feladat gombbal.</td>
                    </tr>
                  ) : (
                    topLevelTasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <Link className="task-title-link" to={`/admin/tasks/${task.id}`}>
                            {task.title || 'Névtelen feladat'}
                          </Link>
                          {task.hasChildren && (
                            <span className="task-subcount">
                              {task.children.length} alfeladat
                            </span>
                          )}
                        </td>
                        <td className="task-progress-cell">
                          {task.hasChildren ? (
                            <div className="task-progress-readonly">
                              <div className="task-progress-bar" aria-hidden="true">
                                <span style={{ width: `${task.displayProgress}%` }} />
                              </div>
                              <strong>{task.displayProgress}%</strong>
                              <span className="task-progress-hint">átlag</span>
                            </div>
                          ) : (
                            <div className="task-progress-edit">
                              <div className="task-progress-bar" aria-hidden="true">
                                <span style={{ width: `${task.displayProgress}%` }} />
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={task.displayProgress}
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
                          )}
                        </td>
                        <td>
                          {task.hasChildren ? (
                            <div className="task-assignee-chips">
                              {task.displayAssigneeIds.length === 0 ? (
                                <span className="task-assignee-empty">Nincs hozzárendelve</span>
                              ) : (
                                task.displayAssigneeIds.map((userId) => (
                                  <span className="task-assignee-chip" key={userId}>
                                    {profileName(userId)}
                                  </span>
                                ))
                              )}
                            </div>
                          ) : (
                            <div className="task-assignee-picker">
                              {adminProfiles.map((profile) => {
                                const checked = (assigneesByTask[task.id] || []).includes(
                                  profile.user_id,
                                )

                                return (
                                  <label key={profile.user_id} className="task-assignee-option">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={savingTaskId === task.id}
                                      onChange={() =>
                                        toggleAssignee(task.id, profile.user_id)
                                      }
                                    />
                                    <span>{profile.display_name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
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
                      </tr>
                    ))
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
