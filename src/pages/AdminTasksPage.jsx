import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminModal from '../components/AdminModal'
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
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [newTaskDraft, setNewTaskDraft] = useState({
    title: '',
    timing: DEFAULT_TASK_TIMING,
    progress: 0,
    notes: '',
    assigneeIds: [],
    subtasks: [],
    materials: [],
  })
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set())
  // Szurt nezetben a talalatok alapbol nyitva vannak, itt csak a kezzel becsukottakat tartjuk
  const [collapsedFilteredTaskIds, setCollapsedFilteredTaskIds] = useState(() => new Set())
  const [timingSortDirection, setTimingSortDirection] = useState('anytime-to-wedding')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('hu')
  const hasActiveListFilter = assigneeFilter !== 'all' || Boolean(normalizedSearch)

  function matchesSearch(title) {
    if (!normalizedSearch) {
      return true
    }

    return (title || '').toLocaleLowerCase('hu').includes(normalizedSearch)
  }

  function matchesAssigneeFilter(assigneeIds) {
    if (assigneeFilter === 'all') {
      return true
    }

    if (assigneeFilter === 'unassigned') {
      return assigneeIds.length === 0
    }

    if (assigneeFilter.startsWith('only:')) {
      const userId = assigneeFilter.slice('only:'.length)
      return assigneeIds.length === 1 && assigneeIds[0] === userId
    }

    return assigneeIds.includes(assigneeFilter)
  }

  function childMatchesFilter(child) {
    return matchesAssigneeFilter(assigneesByTask[child.id] || [])
  }

  function childMatchesSearch(child) {
    return matchesSearch(child.title)
  }

  function topLevelMatchesFilter(task) {
    if (assigneeFilter === 'all') {
      return true
    }

    if (task.hasChildren) {
      // „Csak X”: a szülő akkor is megjelenik, ha van legalább egy csak X alfeladata
      if (assigneeFilter.startsWith('only:')) {
        return task.children.some(childMatchesFilter)
      }

      // Egyéb felelős-szűrőknél: a gyerekek uniója vagy bármelyik gyerek illeszkedik
      return (
        matchesAssigneeFilter(task.displayAssigneeIds) ||
        task.children.some(childMatchesFilter)
      )
    }

    return matchesAssigneeFilter(task.displayAssigneeIds)
  }

  function topLevelMatchesSearch(task) {
    if (!normalizedSearch) {
      return true
    }

    if (matchesSearch(task.title)) {
      return true
    }

    return task.children.some(
      (child) => childMatchesSearch(child) && childMatchesFilter(child),
    )
  }

  const filteredTopLevelTasks = useMemo(() => {
    return topLevelTasks.filter(
      (task) => topLevelMatchesFilter(task) && topLevelMatchesSearch(task),
    )
  }, [topLevelTasks, assigneeFilter, assigneesByTask, normalizedSearch])

  function profileName(userId) {
    return adminProfiles.find((profile) => profile.user_id === userId)?.display_name || 'Admin'
  }

  function isTaskOpen(taskId) {
    if (!hasActiveListFilter) {
      return expandedTaskIds.has(taskId)
    }

    return !collapsedFilteredTaskIds.has(taskId)
  }

  function toggleExpanded(taskId) {
    const setter = hasActiveListFilter ? setCollapsedFilteredTaskIds : setExpandedTaskIds

    setter((current) => {
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

  function renderAssigneeCell(assigneeIds) {
    return (
      <div className="task-assignee-chips">
        {assigneeIds.length === 0 ? (
          <span className="task-assignee-empty">—</span>
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

  function createEmptyTaskDraft() {
    return {
      title: '',
      timing: DEFAULT_TASK_TIMING,
      progress: 0,
      notes: '',
      assigneeIds: [],
      subtasks: [],
      materials: [],
    }
  }

  function openAddTaskModal() {
    setNewTaskDraft(createEmptyTaskDraft())
    setIsAddTaskOpen(true)
    setStatusMessage('')
  }

  function closeAddTaskModal() {
    setIsAddTaskOpen(false)
    setNewTaskDraft(createEmptyTaskDraft())
  }

  function updateNewTaskDraft(field, value) {
    setNewTaskDraft((current) => ({ ...current, [field]: value }))
  }

  function toggleNewTaskAssignee(userId) {
    setNewTaskDraft((current) => ({
      ...current,
      assigneeIds: current.assigneeIds.includes(userId)
        ? current.assigneeIds.filter((id) => id !== userId)
        : [...current.assigneeIds, userId],
    }))
  }

  function addDraftSubtask() {
    setNewTaskDraft((current) => ({
      ...current,
      subtasks: [
        ...current.subtasks,
        {
          key: crypto.randomUUID(),
          title: '',
          timing: DEFAULT_TASK_TIMING,
          progress: 0,
          assigneeIds: [],
        },
      ],
    }))
  }

  function updateDraftSubtask(key, field, value) {
    setNewTaskDraft((current) => ({
      ...current,
      subtasks: current.subtasks.map((subtask) =>
        subtask.key === key ? { ...subtask, [field]: value } : subtask,
      ),
    }))
  }

  function toggleDraftSubtaskAssignee(key, userId) {
    setNewTaskDraft((current) => ({
      ...current,
      subtasks: current.subtasks.map((subtask) => {
        if (subtask.key !== key) {
          return subtask
        }

        return {
          ...subtask,
          assigneeIds: subtask.assigneeIds.includes(userId)
            ? subtask.assigneeIds.filter((id) => id !== userId)
            : [...subtask.assigneeIds, userId],
        }
      }),
    }))
  }

  function removeDraftSubtask(key) {
    setNewTaskDraft((current) => ({
      ...current,
      subtasks: current.subtasks.filter((subtask) => subtask.key !== key),
    }))
  }

  function addDraftMaterial() {
    setNewTaskDraft((current) => ({
      ...current,
      materials: [
        ...current.materials,
        {
          key: crypto.randomUUID(),
          name: '',
          source: '',
          estimated_price: '',
          is_acquired: false,
        },
      ],
    }))
  }

  function updateDraftMaterial(key, field, value) {
    setNewTaskDraft((current) => ({
      ...current,
      materials: current.materials.map((material) =>
        material.key === key ? { ...material, [field]: value } : material,
      ),
    }))
  }

  function removeDraftMaterial(key) {
    setNewTaskDraft((current) => ({
      ...current,
      materials: current.materials.filter((material) => material.key !== key),
    }))
  }

  async function createTask() {
    const title = newTaskDraft.title.trim()
    if (!title) {
      setStatusMessage('Az új feladathoz kell címet adni.')
      return
    }

    const invalidSubtask = newTaskDraft.subtasks.find((subtask) => !subtask.title.trim())
    if (invalidSubtask) {
      setStatusMessage('Minden alfeladatnak kell címet adni, vagy töröld az üreseket.')
      return
    }

    const invalidMaterial = newTaskDraft.materials.find((material) => !material.name.trim())
    if (invalidMaterial) {
      setStatusMessage('Minden alapanyagnak kell nevet adni, vagy töröld az üreseket.')
      return
    }

    setIsCreating(true)
    setStatusMessage('')

    const hasSubtasks = newTaskDraft.subtasks.length > 0
    const parentProgress = hasSubtasks
      ? averageProgress(newTaskDraft.subtasks)
      : clampProgress(newTaskDraft.progress)
    const sortOrder =
      topLevelTasks.reduce((max, task) => Math.max(max, task.sort_order || 0), 0) + 1

    const { data: parent, error: parentError } = await supabase
      .from('wedding_tasks')
      .insert({
        title,
        progress: parentProgress,
        notes: newTaskDraft.notes.trim(),
        timing: normalizeTaskTiming(newTaskDraft.timing),
        sort_order: sortOrder,
      })
      .select('id, parent_id, title, progress, notes, timing, sort_order')
      .single()

    if (parentError) {
      setIsCreating(false)
      setStatusMessage(`Nem sikerült létrehozni a feladatot: ${parentError.message}`)
      return
    }

    const nextAssigneesByTask = { ...assigneesByTask }

    if (!hasSubtasks && newTaskDraft.assigneeIds.length > 0) {
      const { error: assigneeError } = await supabase.from('wedding_task_assignees').insert(
        newTaskDraft.assigneeIds.map((userId) => ({
          task_id: parent.id,
          user_id: userId,
        })),
      )

      if (assigneeError) {
        setIsCreating(false)
        setStatusMessage(
          `A feladat létrejött, de a hozzárendelés mentése nem sikerült: ${assigneeError.message}`,
        )
        setTasks((current) => [
          ...current,
          { ...parent, timing: normalizeTaskTiming(parent.timing) },
        ])
        closeAddTaskModal()
        return
      }

      nextAssigneesByTask[parent.id] = [...newTaskDraft.assigneeIds]
    } else {
      nextAssigneesByTask[parent.id] = []
    }

    const createdSubtasks = []

    for (const [index, subtask] of newTaskDraft.subtasks.entries()) {
      const { data: child, error: childError } = await supabase
        .from('wedding_tasks')
        .insert({
          parent_id: parent.id,
          title: subtask.title.trim(),
          progress: clampProgress(subtask.progress),
          notes: '',
          timing: normalizeTaskTiming(subtask.timing),
          sort_order: index + 1,
        })
        .select('id, parent_id, title, progress, notes, timing, sort_order')
        .single()

      if (childError) {
        setIsCreating(false)
        setStatusMessage(
          `A feladat létrejött, de egy alfeladat mentése nem sikerült: ${childError.message}`,
        )
        setTasks((current) => [
          ...current,
          { ...parent, timing: normalizeTaskTiming(parent.timing) },
          ...createdSubtasks,
        ])
        setAssigneesByTask(nextAssigneesByTask)
        closeAddTaskModal()
        return
      }

      const normalizedChild = { ...child, timing: normalizeTaskTiming(child.timing) }
      createdSubtasks.push(normalizedChild)

      if (subtask.assigneeIds.length > 0) {
        const { error: childAssigneeError } = await supabase.from('wedding_task_assignees').insert(
          subtask.assigneeIds.map((userId) => ({
            task_id: child.id,
            user_id: userId,
          })),
        )

        if (childAssigneeError) {
          setIsCreating(false)
          setStatusMessage(
            `Az alfeladat létrejött, de a hozzárendelés mentése nem sikerült: ${childAssigneeError.message}`,
          )
          nextAssigneesByTask[child.id] = []
          setTasks((current) => [
            ...current,
            { ...parent, timing: normalizeTaskTiming(parent.timing) },
            ...createdSubtasks,
          ])
          setAssigneesByTask(nextAssigneesByTask)
          closeAddTaskModal()
          return
        }

        nextAssigneesByTask[child.id] = [...subtask.assigneeIds]
      } else {
        nextAssigneesByTask[child.id] = []
      }
    }

    for (const [index, material] of newTaskDraft.materials.entries()) {
      const { error: materialError } = await supabase.from('wedding_task_materials').insert({
        task_id: parent.id,
        name: material.name.trim(),
        source: material.source.trim(),
        estimated_price: Number(material.estimated_price) || 0,
        is_acquired: Boolean(material.is_acquired),
        sort_order: index + 1,
      })

      if (materialError) {
        setIsCreating(false)
        setStatusMessage(
          `A feladat létrejött, de egy alapanyag mentése nem sikerült: ${materialError.message}`,
        )
        setTasks((current) => [
          ...current,
          { ...parent, timing: normalizeTaskTiming(parent.timing) },
          ...createdSubtasks,
        ])
        setAssigneesByTask(nextAssigneesByTask)
        closeAddTaskModal()
        return
      }
    }

    setTasks((current) => [
      ...current,
      { ...parent, timing: normalizeTaskTiming(parent.timing) },
      ...createdSubtasks,
    ])
    setAssigneesByTask(nextAssigneesByTask)
    setIsCreating(false)
    closeAddTaskModal()
    setStatusMessage('Az új feladat mentve.')
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
          Kövesd az esküvőig elvégzendő feladatokat. A készültség és az időzítés a listában
          szerkeszthető. A hozzárendeléseket a feladat részletes oldalán lehet módosítani.
        </p>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="admin-actions task-list-toolbar">
              <button type="button" onClick={openAddTaskModal} disabled={isCreating}>
                Új feladat
              </button>
              <label className="task-search-field">
                <span>Keresés</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Feladat neve..."
                  aria-label="Keresés a feladat nevére"
                />
              </label>
              <div className="task-filter-controls" role="group" aria-label="Szűrés felelős szerint">
                <span>Felelős:</span>
                <button
                  type="button"
                  className={assigneeFilter === 'all' ? 'is-active' : ''}
                  onClick={() => setAssigneeFilter('all')}
                >
                  Összes
                </button>
                {adminProfiles.map((profile) => (
                  <button
                    key={profile.user_id}
                    type="button"
                    className={assigneeFilter === profile.user_id ? 'is-active' : ''}
                    onClick={() => setAssigneeFilter(profile.user_id)}
                  >
                    {profile.display_name}
                  </button>
                ))}
                {adminProfiles.map((profile) => (
                  <button
                    key={`only-${profile.user_id}`}
                    type="button"
                    className={assigneeFilter === `only:${profile.user_id}` ? 'is-active' : ''}
                    onClick={() => setAssigneeFilter(`only:${profile.user_id}`)}
                  >
                    Csak {profile.display_name}
                  </button>
                ))}
                <button
                  type="button"
                  className={assigneeFilter === 'unassigned' ? 'is-active' : ''}
                  onClick={() => setAssigneeFilter('unassigned')}
                >
                  Nincs hozzárendelve
                </button>
              </div>
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
                  {filteredTopLevelTasks.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        {topLevelTasks.length === 0
                          ? 'Még nincs feladat. Hozz létre egyet az Új feladat gombbal.'
                          : normalizedSearch
                            ? 'Nincs a keresésnek megfelelő feladat.'
                            : 'Nincs a szűrőnek megfelelő feladat.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTopLevelTasks.flatMap((task) => {
                      const isExpanded = isTaskOpen(task.id)
                      let visibleChildren =
                        assigneeFilter === 'all'
                          ? task.children
                          : task.children.filter(childMatchesFilter)

                      if (normalizedSearch && !matchesSearch(task.title)) {
                        visibleChildren = visibleChildren.filter(childMatchesSearch)
                      }

                      const showChildren =
                        task.hasChildren && visibleChildren.length > 0 && isExpanded

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
                          <td>{renderAssigneeCell(task.displayAssigneeIds)}</td>
                          <td>
                            <button
                              type="button"
                              className="task-row-action"
                              onClick={() => deleteTask(task.id)}
                              disabled={savingTaskId === task.id}
                            >
                              Törlés
                            </button>
                          </td>
                        </tr>,
                      ]

                      if (showChildren) {
                        visibleChildren.forEach((child) => {
                          rows.push(
                            <tr key={child.id} className="task-row-child">
                              <td>
                                <div className="task-title-cell is-child">
                                  <span className="task-expand-spacer" aria-hidden="true" />
                                  <Link
                                    className="task-child-title"
                                    to={`/admin/tasks/${task.id}`}
                                  >
                                    {child.title || 'Névtelen alfeladat'}
                                  </Link>
                                </div>
                              </td>
                              <td className="task-timing-cell">{renderTimingCell(child)}</td>
                              <td className="task-progress-cell">
                                {renderProgressCell(child)}
                              </td>
                              <td>
                                {renderAssigneeCell(assigneesByTask[child.id] || [])}
                              </td>
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

        {isAddTaskOpen && (
          <AdminModal
            title="Új feladat"
            titleId="tasks-new-task-title"
            className="is-wide"
            onClose={closeAddTaskModal}
            actions={
              <>
                <button type="button" onClick={createTask} disabled={isCreating}>
                  {isCreating ? 'Mentés...' : 'Mentés'}
                </button>
                <button type="button" onClick={closeAddTaskModal} disabled={isCreating}>
                  Mégse
                </button>
              </>
            }
          >
            {statusMessage && <p className="form-message">{statusMessage}</p>}

            <label>
              Feladat neve
              <input
                type="text"
                value={newTaskDraft.title}
                onChange={(event) => updateNewTaskDraft('title', event.target.value)}
                placeholder="Pl. Meghívók nyomtatása"
                autoFocus
              />
            </label>

            <label>
              Időzítés
              <select
                value={newTaskDraft.timing}
                onChange={(event) => updateNewTaskDraft('timing', event.target.value)}
              >
                {TASK_TIMING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {newTaskDraft.subtasks.length === 0 ? (
              <label>
                Készültség (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newTaskDraft.progress}
                  onChange={(event) => updateNewTaskDraft('progress', event.target.value)}
                />
              </label>
            ) : (
              <p className="admin-summary">
                Készültség: a mentéskor az alfeladatok átlaga lesz (
                {averageProgress(newTaskDraft.subtasks)}%).
              </p>
            )}

            {newTaskDraft.subtasks.length === 0 ? (
              <div className="budget-modal-section">
                <h3>Hozzárendelve</h3>
                <div className="budget-modal-assignees">
                  {adminProfiles.length === 0 ? (
                    <span>Nincs elérhető admin profil.</span>
                  ) : (
                    adminProfiles.map((profile) => (
                      <label key={profile.user_id}>
                        <input
                          type="checkbox"
                          checked={newTaskDraft.assigneeIds.includes(profile.user_id)}
                          onChange={() => toggleNewTaskAssignee(profile.user_id)}
                        />
                        <span>{profile.display_name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="admin-summary">
                Ha vannak alfeladatok, a hozzárendelés az alfeladatoknál adható meg.
              </p>
            )}

            <label>
              Megjegyzések
              <textarea
                value={newTaskDraft.notes}
                onChange={(event) => updateNewTaskDraft('notes', event.target.value)}
                placeholder="Ide írhatod a feladat részleteit, döntéseket, teendőket..."
              />
            </label>

            <div className="budget-modal-section">
              <div className="budget-modal-section-head">
                <h3>Alfeladatok</h3>
                <button type="button" onClick={addDraftSubtask}>
                  Alfeladat hozzáadása
                </button>
              </div>

              {newTaskDraft.subtasks.length === 0 ? (
                <p className="admin-summary">Még nincs alfeladat.</p>
              ) : (
                <div className="budget-modal-draft-list">
                  {newTaskDraft.subtasks.map((subtask) => (
                    <div className="budget-modal-draft-card" key={subtask.key}>
                      <label>
                        Név
                        <input
                          type="text"
                          value={subtask.title}
                          onChange={(event) =>
                            updateDraftSubtask(subtask.key, 'title', event.target.value)
                          }
                          placeholder="Alfeladat neve"
                        />
                      </label>
                      <div className="budget-modal-row">
                        <label>
                          Időzítés
                          <select
                            value={subtask.timing}
                            onChange={(event) =>
                              updateDraftSubtask(subtask.key, 'timing', event.target.value)
                            }
                          >
                            {TASK_TIMING_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Készültség (%)
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={subtask.progress}
                            onChange={(event) =>
                              updateDraftSubtask(subtask.key, 'progress', event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <div>
                        <span>Hozzárendelve</span>
                        <div className="budget-modal-assignees">
                          {adminProfiles.map((profile) => (
                            <label key={`${subtask.key}-${profile.user_id}`}>
                              <input
                                type="checkbox"
                                checked={subtask.assigneeIds.includes(profile.user_id)}
                                onChange={() =>
                                  toggleDraftSubtaskAssignee(subtask.key, profile.user_id)
                                }
                              />
                              <span>{profile.display_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeDraftSubtask(subtask.key)}>
                        Alfeladat törlése
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="budget-modal-section">
              <div className="budget-modal-section-head">
                <h3>Alapanyagok</h3>
                <button type="button" onClick={addDraftMaterial}>
                  Alapanyag hozzáadása
                </button>
              </div>

              {newTaskDraft.materials.length === 0 ? (
                <p className="admin-summary">Még nincs alapanyag.</p>
              ) : (
                <div className="budget-modal-draft-list">
                  {newTaskDraft.materials.map((material) => (
                    <div className="budget-modal-draft-card" key={material.key}>
                      <label>
                        Név
                        <input
                          type="text"
                          value={material.name}
                          onChange={(event) =>
                            updateDraftMaterial(material.key, 'name', event.target.value)
                          }
                          placeholder="pl. virág, szalag"
                        />
                      </label>
                      <div className="budget-modal-row">
                        <label>
                          Beszerzés
                          <input
                            type="text"
                            value={material.source}
                            onChange={(event) =>
                              updateDraftMaterial(material.key, 'source', event.target.value)
                            }
                            placeholder="Honnan?"
                          />
                        </label>
                        <label>
                          Becsült ár
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={material.estimated_price}
                            onChange={(event) =>
                              updateDraftMaterial(
                                material.key,
                                'estimated_price',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      <label className="budget-modal-checkbox">
                        <input
                          type="checkbox"
                          checked={material.is_acquired}
                          onChange={(event) =>
                            updateDraftMaterial(material.key, 'is_acquired', event.target.checked)
                          }
                        />
                        <span>Beszerezve</span>
                      </label>
                      <button type="button" onClick={() => removeDraftMaterial(material.key)}>
                        Alapanyag törlése
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminModal>
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
