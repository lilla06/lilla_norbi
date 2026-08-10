import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

function createLocalId() {
  return crypto.randomUUID()
}

function createSubtask(sortOrder = 0) {
  return {
    id: createLocalId(),
    title: '',
    progress: 0,
    sort_order: sortOrder,
    assigneeIds: [],
    isNew: true,
  }
}

function createMaterial(sortOrder = 0) {
  return {
    id: createLocalId(),
    name: '',
    source: '',
    estimated_price: '',
    sort_order: sortOrder,
    isNew: true,
  }
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value))
}

export default function AdminTaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [adminProfiles, setAdminProfiles] = useState([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [progress, setProgress] = useState(0)
  const [assigneeIds, setAssigneeIds] = useState([])
  const [subtasks, setSubtasks] = useState([])
  const [materials, setMaterials] = useState([])
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
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
            .select('id, parent_id, title, progress, notes, sort_order')
            .eq('id', taskId)
            .maybeSingle(),
          supabase
            .from('wedding_tasks')
            .select('id, parent_id, title, progress, notes, sort_order')
            .eq('parent_id', taskId)
            .order('sort_order')
            .order('created_at'),
          supabase.from('wedding_task_assignees').select('task_id, user_id'),
          supabase
            .from('wedding_task_materials')
            .select('id, task_id, name, source, estimated_price, sort_order')
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
        sort_order: child.sort_order || 0,
        assigneeIds: assignees
          .filter((row) => row.task_id === child.id)
          .map((row) => row.user_id),
        isNew: false,
      }))

      const nextTitle = taskResult.data.title || ''
      const nextNotes = taskResult.data.notes || ''
      const nextProgress = clampProgress(taskResult.data.progress)
      const nextAssigneeIds = assignees
        .filter((row) => row.task_id === taskId)
        .map((row) => row.user_id)
      const nextMaterials = (materialsResult.data || []).map((item, index) => ({
        id: item.id,
        name: item.name || '',
        source: item.source || '',
        estimated_price:
          item.estimated_price === null || item.estimated_price === undefined
            ? ''
            : String(item.estimated_price),
        sort_order: item.sort_order ?? index,
        isNew: false,
      }))

      setAdminProfiles(profilesResult.data || [])
      setTitle(nextTitle)
      setNotes(nextNotes)
      setProgress(nextProgress)
      setAssigneeIds(nextAssigneeIds)
      setSubtasks(childTasks)
      setMaterials(nextMaterials)
      setSavedSnapshot(
        cloneState({
          title: nextTitle,
          notes: nextNotes,
          progress: nextProgress,
          assigneeIds: nextAssigneeIds,
          subtasks: childTasks,
          materials: nextMaterials,
        }),
      )
      setIsLoading(false)
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

  function startEditing() {
    setSavedSnapshot(
      cloneState({
        title,
        notes,
        progress,
        assigneeIds,
        subtasks,
        materials,
      }),
    )
    setStatusMessage('')
    setIsEditing(true)
  }

  function discardChanges() {
    if (!savedSnapshot) {
      setIsEditing(false)
      return
    }

    setTitle(savedSnapshot.title)
    setNotes(savedSnapshot.notes)
    setProgress(savedSnapshot.progress)
    setAssigneeIds(savedSnapshot.assigneeIds)
    setSubtasks(cloneState(savedSnapshot.subtasks))
    setMaterials(cloneState(savedSnapshot.materials))
    setStatusMessage('')
    setIsEditing(false)
  }

  function updateSubtask(id, field, value) {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === id
          ? {
              ...subtask,
              [field]: field === 'progress' ? clampProgress(value) : value,
            }
          : subtask,
      ),
    )
  }

  function toggleSubtaskAssignee(subtaskId, userId) {
    setSubtasks((current) =>
      current.map((subtask) => {
        if (subtask.id !== subtaskId) {
          return subtask
        }

        const isAssigned = subtask.assigneeIds.includes(userId)

        return {
          ...subtask,
          assigneeIds: isAssigned
            ? subtask.assigneeIds.filter((id) => id !== userId)
            : [...subtask.assigneeIds, userId],
        }
      }),
    )
  }

  function toggleParentAssignee(userId) {
    setAssigneeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  function addSubtask() {
    setSubtasks((current) => [
      ...current,
      createSubtask(current.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1),
    ])
  }

  function removeSubtask(id) {
    setSubtasks((current) => current.filter((subtask) => subtask.id !== id))
  }

  function updateMaterial(id, field, value) {
    setMaterials((current) =>
      current.map((material) =>
        material.id === id ? { ...material, [field]: value } : material,
      ),
    )
  }

  function addMaterial() {
    setMaterials((current) => [
      ...current,
      createMaterial(current.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1),
    ])
  }

  function removeMaterial(id) {
    setMaterials((current) => current.filter((material) => material.id !== id))
  }

  async function replaceAssignees(taskIdsToClear, rows) {
    if (taskIdsToClear.length) {
      const { error: deleteError } = await supabase
        .from('wedding_task_assignees')
        .delete()
        .in('task_id', taskIdsToClear)

      if (deleteError) {
        return deleteError
      }
    }

    if (!rows.length) {
      return null
    }

    const { error } = await supabase.from('wedding_task_assignees').insert(rows)
    return error
  }

  async function saveChanges() {
    setStatusMessage('')
    setIsSubmitting(true)

    const trimmedTitle = title.trim() || 'Névtelen feladat'
    const nextSubtasks = subtasks
      .map((subtask, index) => ({
        ...subtask,
        title: subtask.title.trim(),
        progress: clampProgress(subtask.progress),
        sort_order: index,
      }))
      .filter((subtask) => subtask.title || subtask.assigneeIds.length || subtask.progress > 0)

    const nextMaterials = materials
      .map((material, index) => ({
        ...material,
        name: material.name.trim(),
        source: material.source.trim(),
        estimated_price:
          material.estimated_price === '' ? 0 : Number(material.estimated_price) || 0,
        sort_order: index,
      }))
      .filter(
        (material) =>
          material.name || material.source || Number(material.estimated_price) > 0,
      )

    const { error: taskError } = await supabase
      .from('wedding_tasks')
      .update({
        title: trimmedTitle,
        notes: notes.trim(),
        progress: nextSubtasks.length ? 0 : clampProgress(progress),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)

    if (taskError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni a feladatot: ${taskError.message}`)
      return
    }

    const { data: existingChildren, error: existingChildrenError } = await supabase
      .from('wedding_tasks')
      .select('id')
      .eq('parent_id', taskId)

    if (existingChildrenError) {
      setIsSubmitting(false)
      setStatusMessage(
        `Nem sikerült frissíteni az alfeladatokat: ${existingChildrenError.message}`,
      )
      return
    }

    const existingChildIds = (existingChildren || []).map((child) => child.id)
    const keptChildIds = nextSubtasks.filter((subtask) => !subtask.isNew).map((subtask) => subtask.id)
    const childIdsToDelete = existingChildIds.filter((id) => !keptChildIds.includes(id))

    if (childIdsToDelete.length) {
      const { error: deleteChildrenError } = await supabase
        .from('wedding_tasks')
        .delete()
        .in('id', childIdsToDelete)

      if (deleteChildrenError) {
        setIsSubmitting(false)
        setStatusMessage(
          `Nem sikerült törölni az alfeladatokat: ${deleteChildrenError.message}`,
        )
        return
      }
    }

    const savedSubtasks = []

    for (const subtask of nextSubtasks) {
      if (subtask.isNew) {
        const { data, error } = await supabase
          .from('wedding_tasks')
          .insert({
            parent_id: taskId,
            title: subtask.title || 'Alfeladat',
            progress: subtask.progress,
            notes: '',
            sort_order: subtask.sort_order,
          })
          .select('id, title, progress, sort_order')
          .single()

        if (error) {
          setIsSubmitting(false)
          setStatusMessage(`Nem sikerült létrehozni az alfeladatot: ${error.message}`)
          return
        }

        savedSubtasks.push({
          id: data.id,
          title: data.title,
          progress: clampProgress(data.progress),
          sort_order: data.sort_order,
          assigneeIds: subtask.assigneeIds,
          isNew: false,
        })
      } else {
        const { error } = await supabase
          .from('wedding_tasks')
          .update({
            title: subtask.title || 'Alfeladat',
            progress: subtask.progress,
            sort_order: subtask.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subtask.id)

        if (error) {
          setIsSubmitting(false)
          setStatusMessage(`Nem sikerült menteni az alfeladatot: ${error.message}`)
          return
        }

        savedSubtasks.push({
          ...subtask,
          title: subtask.title || 'Alfeladat',
          isNew: false,
        })
      }
    }

    const assigneeTaskIds = [taskId, ...existingChildIds, ...savedSubtasks.map((item) => item.id)]
    const assigneeRows = savedSubtasks.length
      ? savedSubtasks.flatMap((subtask) =>
          subtask.assigneeIds.map((userId) => ({
            task_id: subtask.id,
            user_id: userId,
          })),
        )
      : assigneeIds.map((userId) => ({
          task_id: taskId,
          user_id: userId,
        }))

    const assigneeError = await replaceAssignees([...new Set(assigneeTaskIds)], assigneeRows)

    if (assigneeError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni a hozzárendeléseket: ${assigneeError.message}`)
      return
    }

    const { error: deleteMaterialsError } = await supabase
      .from('wedding_task_materials')
      .delete()
      .eq('task_id', taskId)

    if (deleteMaterialsError) {
      setIsSubmitting(false)
      setStatusMessage(
        `Nem sikerült frissíteni az alapanyagokat: ${deleteMaterialsError.message}`,
      )
      return
    }

    let savedMaterials = []

    if (nextMaterials.length) {
      const { data, error } = await supabase
        .from('wedding_task_materials')
        .insert(
          nextMaterials.map((material) => ({
            task_id: taskId,
            name: material.name,
            source: material.source,
            estimated_price: material.estimated_price,
            sort_order: material.sort_order,
          })),
        )
        .select('id, name, source, estimated_price, sort_order')

      if (error) {
        setIsSubmitting(false)
        setStatusMessage(`Nem sikerült menteni az alapanyagokat: ${error.message}`)
        return
      }

      savedMaterials = (data || []).map((material, index) => ({
        id: material.id,
        name: material.name || '',
        source: material.source || '',
        estimated_price: String(material.estimated_price ?? 0),
        sort_order: material.sort_order ?? index,
        isNew: false,
      }))
    }

    const nextState = {
      title: trimmedTitle,
      notes: notes.trim(),
      progress: savedSubtasks.length ? 0 : clampProgress(progress),
      assigneeIds: savedSubtasks.length ? [] : assigneeIds,
      subtasks: savedSubtasks,
      materials: savedMaterials,
    }

    setTitle(nextState.title)
    setNotes(nextState.notes)
    setProgress(nextState.progress)
    setAssigneeIds(nextState.assigneeIds)
    setSubtasks(nextState.subtasks)
    setMaterials(nextState.materials)
    setSavedSnapshot(cloneState(nextState))
    setIsEditing(false)
    setIsSubmitting(false)
    setStatusMessage('A feladat mentve.')
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
        <p className="eyebrow">Admin · Feladat</p>
        <h1>{title || 'Feladat szerkesztése'}</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="admin-actions">
              {!isEditing ? (
                <button type="button" onClick={startEditing}>
                  Szerkesztés
                </button>
              ) : (
                <>
                  <button type="button" onClick={saveChanges} disabled={isSubmitting}>
                    {isSubmitting ? 'Mentés...' : 'Mentés'}
                  </button>
                  <button type="button" onClick={discardChanges} disabled={isSubmitting}>
                    Módosítások elvetése
                  </button>
                </>
              )}
              <Link className="text-link" to="/admin/tasks">
                Vissza a listához
              </Link>
            </div>

            <div className="task-detail-grid">
              <label className="task-field">
                <span>Feladat neve</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                ) : (
                  <strong>{title || 'Névtelen feladat'}</strong>
                )}
              </label>

              <div className="task-field">
                <span>Készültség</span>
                {hasSubtasks || !isEditing ? (
                  <div className="task-progress-readonly">
                    <div className="task-progress-bar" aria-hidden="true">
                      <span style={{ width: `${displayProgress}%` }} />
                    </div>
                    <strong>{displayProgress}%</strong>
                    {hasSubtasks && <span className="task-progress-hint">átlag</span>}
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
                      onChange={(event) => setProgress(clampProgress(event.target.value))}
                    />
                    <span>%</span>
                  </div>
                )}
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
                ) : isEditing ? (
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
                ) : (
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
                )}
              </div>

              <label className="task-field task-field-wide">
                <span>Megjegyzések</span>
                {isEditing ? (
                  <textarea
                    rows="5"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ide írhatod a feladat részleteit, döntéseket, teendőket..."
                  />
                ) : (
                  <p className="task-notes-readonly">
                    {notes.trim() || 'Nincs megjegyzés.'}
                  </p>
                )}
              </label>
            </div>

            <section className="task-section">
              <div className="task-section-head">
                <h2>Alfeladatok</h2>
                {isEditing && (
                  <button type="button" onClick={addSubtask}>
                    Alfeladat hozzáadása
                  </button>
                )}
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
                      <th>Készültség</th>
                      <th>Hozzárendelve</th>
                      {isEditing && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {subtasks.length === 0 ? (
                      <tr>
                        <td colSpan={isEditing ? 4 : 3}>Még nincs alfeladat.</td>
                      </tr>
                    ) : (
                      subtasks.map((subtask) => (
                        <tr key={subtask.id}>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={subtask.title}
                                onChange={(event) =>
                                  updateSubtask(subtask.id, 'title', event.target.value)
                                }
                                placeholder="Alfeladat neve"
                              />
                            ) : (
                              subtask.title || 'Névtelen alfeladat'
                            )}
                          </td>
                          <td className="task-progress-cell">
                            {isEditing ? (
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
                            ) : (
                              <strong>{subtask.progress}%</strong>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
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
                            ) : (
                              <div className="task-assignee-chips">
                                {subtask.assigneeIds.length === 0 ? (
                                  <span className="task-assignee-empty">Nincs</span>
                                ) : (
                                  subtask.assigneeIds.map((userId) => (
                                    <span className="task-assignee-chip" key={userId}>
                                      {profileName(userId)}
                                    </span>
                                  ))
                                )}
                              </div>
                            )}
                          </td>
                          {isEditing && (
                            <td>
                              <button type="button" onClick={() => removeSubtask(subtask.id)}>
                                Törlés
                              </button>
                            </td>
                          )}
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
                {isEditing && (
                  <button type="button" onClick={addMaterial}>
                    Alapanyag hozzáadása
                  </button>
                )}
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table tasks-table">
                  <thead>
                    <tr>
                      <th>Alapanyag</th>
                      <th>Beszerzés</th>
                      <th>Becsült ár</th>
                      {isEditing && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr>
                        <td colSpan={isEditing ? 4 : 3}>Még nincs alapanyag.</td>
                      </tr>
                    ) : (
                      materials.map((material) => (
                        <tr key={material.id}>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={material.name}
                                onChange={(event) =>
                                  updateMaterial(material.id, 'name', event.target.value)
                                }
                                placeholder="pl. virág, szalag"
                              />
                            ) : (
                              material.name || '—'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={material.source}
                                onChange={(event) =>
                                  updateMaterial(material.id, 'source', event.target.value)
                                }
                                placeholder="Honnan szerezzük be?"
                              />
                            ) : (
                              material.source || '—'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
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
                            ) : (
                              `${Number(material.estimated_price || 0).toLocaleString('hu-HU')} Ft`
                            )}
                          </td>
                          {isEditing && (
                            <td>
                              <button type="button" onClick={() => removeMaterial(material.id)}>
                                Törlés
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
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
