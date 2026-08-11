import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function formatPrice(value) {
  return `${Number(value || 0).toLocaleString('hu-HU')} Ft`
}

export default function AdminWishlistPage() {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState([])
  const [tasksById, setTasksById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all')

  useEffect(() => {
    async function loadWishlist() {
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

      const [materialsResult, tasksResult] = await Promise.all([
        supabase
          .from('wedding_task_materials')
          .select('id, task_id, name, source, estimated_price, is_acquired, sort_order, created_at')
          .order('sort_order')
          .order('created_at'),
        supabase
          .from('wedding_tasks')
          .select('id, parent_id, title')
          .is('parent_id', null)
          .order('sort_order')
          .order('created_at'),
      ])

      if (materialsResult.error) {
        setStatusMessage(
          `Nem sikerült betölteni az alapanyagokat: ${materialsResult.error.message}`,
        )
        setIsLoading(false)
        return
      }

      if (tasksResult.error) {
        setStatusMessage(`Nem sikerült betölteni a feladatokat: ${tasksResult.error.message}`)
        setIsLoading(false)
        return
      }

      const nextTasks = {}
      ;(tasksResult.data || []).forEach((task) => {
        nextTasks[task.id] = task
      })

      setTasksById(nextTasks)
      setMaterials(materialsResult.data || [])
      setIsLoading(false)
    }

    loadWishlist()
  }, [navigate])

  const taskOptions = useMemo(
    () =>
      Object.values(tasksById).sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', 'hu'),
      ),
    [tasksById],
  )

  const filteredMaterials = useMemo(() => {
    if (taskFilter === 'all') {
      return materials
    }

    if (taskFilter === 'unassigned') {
      return materials.filter((item) => !item.task_id)
    }

    return materials.filter((item) => item.task_id === taskFilter)
  }, [materials, taskFilter])

  async function createMaterial() {
    setIsCreating(true)
    setStatusMessage('')

    const sortOrder =
      materials.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1

    const { data, error } = await supabase
      .from('wedding_task_materials')
      .insert({
        task_id: null,
        name: 'Új alapanyag',
        source: '',
        estimated_price: 0,
        is_acquired: false,
        sort_order: sortOrder,
      })
      .select('id')
      .single()

    setIsCreating(false)

    if (error) {
      setStatusMessage(`Nem sikerült létrehozni az alapanyagot: ${error.message}`)
      return
    }

    navigate(`/admin/wishlist/${data.id}`)
  }

  async function deleteMaterial(materialId) {
    const confirmed = window.confirm('Biztosan törölni szeretnéd ezt az alapanyagot?')

    if (!confirmed) {
      return
    }

    setDeletingId(materialId)
    setStatusMessage('')

    const { error } = await supabase
      .from('wedding_task_materials')
      .delete()
      .eq('id', materialId)

    setDeletingId(null)

    if (error) {
      setStatusMessage(`Nem sikerült törölni az alapanyagot: ${error.message}`)
      return
    }

    setMaterials((current) => current.filter((item) => item.id !== materialId))
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
        <h1>Wishlist</h1>
        <p className="admin-summary">
          Az összes alapanyag egy helyen. Megnézheted, melyik feladathoz tartozik, és olyan
          tételeket is felvehetsz, amik még egyik feladathoz sem vannak rendelve.
        </p>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <>
            <div className="admin-actions task-list-toolbar">
              <button type="button" onClick={createMaterial} disabled={isCreating}>
                {isCreating ? 'Létrehozás...' : 'Új alapanyag'}
              </button>
              <div className="task-filter-controls" role="group" aria-label="Szűrés feladat szerint">
                <span>Feladat:</span>
                <button
                  type="button"
                  className={taskFilter === 'all' ? 'is-active' : ''}
                  onClick={() => setTaskFilter('all')}
                >
                  Összes
                </button>
                <button
                  type="button"
                  className={taskFilter === 'unassigned' ? 'is-active' : ''}
                  onClick={() => setTaskFilter('unassigned')}
                >
                  Nincs feladathoz rendelve
                </button>
                {taskOptions.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={taskFilter === task.id ? 'is-active' : ''}
                    onClick={() => setTaskFilter(task.id)}
                  >
                    {task.title || 'Névtelen feladat'}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table tasks-table wishlist-table">
                <thead>
                  <tr>
                    <th>Beszerezve</th>
                    <th>Alapanyag</th>
                    <th>Beszerzés</th>
                    <th>Becsült ár</th>
                    <th>Feladat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        {materials.length === 0
                          ? 'Még nincs alapanyag. Hozz létre egyet az Új alapanyag gombbal.'
                          : 'Nincs a szűrőnek megfelelő alapanyag.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((material) => {
                      const task = material.task_id ? tasksById[material.task_id] : null

                      return (
                        <tr
                          key={material.id}
                          className={material.is_acquired ? 'material-row-acquired' : ''}
                        >
                          <td>{material.is_acquired ? 'Igen' : 'Nem'}</td>
                          <td>
                            <Link
                              className="task-title-link"
                              to={`/admin/wishlist/${material.id}`}
                            >
                              {material.name || 'Névtelen alapanyag'}
                            </Link>
                          </td>
                          <td>{material.source || '—'}</td>
                          <td>{formatPrice(material.estimated_price)}</td>
                          <td>
                            {task ? (
                              <Link className="text-link" to={`/admin/tasks/${task.id}`}>
                                {task.title || 'Névtelen feladat'}
                              </Link>
                            ) : (
                              <span className="task-assignee-empty">Nincs hozzárendelve</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="task-row-action"
                              onClick={() => deleteMaterial(material.id)}
                              disabled={deletingId === material.id}
                            >
                              Törlés
                            </button>
                          </td>
                        </tr>
                      )
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
