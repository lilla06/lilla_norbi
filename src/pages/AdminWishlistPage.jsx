import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminModal from '../components/AdminModal'
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
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false)
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    source: '',
    estimated_price: '',
  })
  const [deletingId, setDeletingId] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all')
  const [acquiredFilter, setAcquiredFilter] = useState('all')

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

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      if (taskFilter === 'assigned' && !item.task_id) {
        return false
      }

      if (taskFilter === 'unassigned' && item.task_id) {
        return false
      }

      if (acquiredFilter === 'acquired' && !item.is_acquired) {
        return false
      }

      if (acquiredFilter === 'not_acquired' && item.is_acquired) {
        return false
      }

      return true
    })
  }, [materials, taskFilter, acquiredFilter])

  function openAddMaterialModal() {
    setNewMaterial({ name: '', source: '', estimated_price: '' })
    setIsAddMaterialOpen(true)
    setStatusMessage('')
  }

  function closeAddMaterialModal() {
    setIsAddMaterialOpen(false)
    setNewMaterial({ name: '', source: '', estimated_price: '' })
  }

  async function createMaterial() {
    const name = newMaterial.name.trim()
    if (!name) {
      setStatusMessage('Az új tételhez kell nevet adni.')
      return
    }

    setIsCreating(true)
    setStatusMessage('')

    const sortOrder =
      materials.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1

    const { data, error } = await supabase
      .from('wedding_task_materials')
      .insert({
        task_id: null,
        name,
        source: newMaterial.source.trim(),
        estimated_price: Number(newMaterial.estimated_price) || 0,
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

    closeAddMaterialModal()
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
              <button type="button" onClick={openAddMaterialModal} disabled={isCreating}>
                Új tétel
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
                  className={taskFilter === 'assigned' ? 'is-active' : ''}
                  onClick={() => setTaskFilter('assigned')}
                >
                  Feladathoz rendelve
                </button>
                <button
                  type="button"
                  className={taskFilter === 'unassigned' ? 'is-active' : ''}
                  onClick={() => setTaskFilter('unassigned')}
                >
                  Nincs feladathoz rendelve
                </button>
              </div>
              <div
                className="task-filter-controls"
                role="group"
                aria-label="Szűrés beszerzés szerint"
              >
                <span>Beszerzés:</span>
                <button
                  type="button"
                  className={acquiredFilter === 'all' ? 'is-active' : ''}
                  onClick={() => setAcquiredFilter('all')}
                >
                  Összes
                </button>
                <button
                  type="button"
                  className={acquiredFilter === 'acquired' ? 'is-active' : ''}
                  onClick={() => setAcquiredFilter('acquired')}
                >
                  Beszerezve
                </button>
                <button
                  type="button"
                  className={acquiredFilter === 'not_acquired' ? 'is-active' : ''}
                  onClick={() => setAcquiredFilter('not_acquired')}
                >
                  Nincs beszerezve
                </button>
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
                          ? 'Még nincs tétel. Hozz létre egyet az Új tétel gombbal.'
                          : 'Nincs a szűrőnek megfelelő tétel.'}
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

        {isAddMaterialOpen && (
          <AdminModal
            title="Új wishlist tétel"
            titleId="wishlist-new-item-title"
            onClose={closeAddMaterialModal}
            actions={
              <>
                <button type="button" onClick={createMaterial} disabled={isCreating}>
                  {isCreating ? 'Mentés...' : 'Mentés'}
                </button>
                <button type="button" onClick={closeAddMaterialModal} disabled={isCreating}>
                  Mégse
                </button>
              </>
            }
          >
            <label>
              Név
              <input
                type="text"
                value={newMaterial.name}
                onChange={(event) =>
                  setNewMaterial((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Pl. gyertyák"
                autoFocus
              />
            </label>
            <label>
              Forrás
              <input
                type="text"
                value={newMaterial.source}
                onChange={(event) =>
                  setNewMaterial((current) => ({ ...current, source: event.target.value }))
                }
                placeholder="Pl. Temu"
              />
            </label>
            <label>
              Becsült ár
              <input
                type="number"
                min="0"
                step="100"
                value={newMaterial.estimated_price}
                onChange={(event) =>
                  setNewMaterial((current) => ({
                    ...current,
                    estimated_price: event.target.value,
                  }))
                }
              />
            </label>
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
