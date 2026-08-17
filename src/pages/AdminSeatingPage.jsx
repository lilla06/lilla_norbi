import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  buildInviteeToGuestNameMap,
  clonePlanTables,
  copySeatingPlannedToActual,
} from '../lib/planAssignments'
import { supabase } from '../lib/supabase'

const defaultRoundTableCount = 13
const guestLabelClasses = {
  'Lilla család': 'guest-label-lilla-family',
  'Lilla barát': 'guest-label-lilla-friend',
  'Közös barát': 'guest-label-common-friend',
  'Norbi barát': 'guest-label-norbi-friend',
  'Norbi család': 'guest-label-norbi-family',
}

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function getGuestLabelClass(label) {
  return guestLabelClasses[label] || ''
}

function cloneTables(tables) {
  return clonePlanTables(tables)
}

function createDefaultTables() {
  return [
    {
      table_key: 'head-table',
      name: 'Főasztal',
      capacity: 2,
      table_type: 'head',
      display_order: 0,
      seats: Array(2).fill(''),
    },
    ...Array.from({ length: defaultRoundTableCount }, (_, index) => ({
      table_key: `round-table-${index + 1}`,
      name: `${index + 1}. asztal`,
      capacity: 8,
      table_type: 'round',
      display_order: index + 1,
      seats: Array(8).fill(''),
    })),
  ]
}

function normalizeTables(tables, assignments) {
  return tables.map((table) => {
    const seats = Array(table.capacity).fill('')

    assignments
      .filter((assignment) => assignment.table_key === table.table_key)
      .forEach((assignment) => {
        if (assignment.seat_index < seats.length) {
          seats[assignment.seat_index] = assignment.guest_name
        }
      })

    return { ...table, seats }
  })
}

function getTablePosition(tableIndex, tableCount) {
  const angle = -90 + (tableIndex * 360) / Math.max(tableCount, 1)
  const horizontalRadius = 42
  const verticalRadius = 38
  const radians = (angle * Math.PI) / 180
  const left = 50 + horizontalRadius * Math.cos(radians)
  const top = 50 + verticalRadius * Math.sin(radians)

  return { left: `${left}%`, top: `${top}%` }
}

function getSeatPosition(seatIndex, seatCount, tableType) {
  if (tableType === 'head') {
    return {
      '--seat-left': `${31 + seatIndex * 38}%`,
      '--seat-top': '27%',
    }
  }

  const spreadOutEightSeatAngles = [-90, -35, 0, 35, 90, 145, 180, 215]
  const angle =
    seatCount === 8
      ? spreadOutEightSeatAngles[seatIndex]
      : -90 + (seatIndex * 360) / Math.max(seatCount, 1)
  const radians = (angle * Math.PI) / 180
  const horizontalRadius = 29
  const verticalRadius = 29
  const left = 50 + horizontalRadius * Math.cos(radians)
  const top = 50 + verticalRadius * Math.sin(radians)

  return {
    '--seat-left': `${left}%`,
    '--seat-top': `${top}%`,
  }
}

export default function AdminSeatingPage() {
  const navigate = useNavigate()
  const [planType, setPlanType] = useState('planned')
  const [plannedTables, setPlannedTables] = useState([])
  const [actualTables, setActualTables] = useState([])
  const [savedPlannedTables, setSavedPlannedTables] = useState([])
  const [savedActualTables, setSavedActualTables] = useState([])
  const [invitees, setInvitees] = useState([])
  const [guests, setGuests] = useState([])
  const [draggedGuest, setDraggedGuest] = useState('')
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showLabelColors, setShowLabelColors] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const tables = planType === 'planned' ? plannedTables : actualTables

  function setTables(value) {
    if (planType === 'planned') {
      setPlannedTables(value)
    } else {
      setActualTables(value)
    }
  }

  useEffect(() => {
    async function loadSeating() {
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

      const [
        { data: guestData, error: guestError },
        { data: inviteeData, error: inviteeError },
        { data: tableData, error: tableError },
        { data: assignmentData, error: assignmentError },
      ] = await Promise.all([
        supabase.from('guests').select('id, name, response, label').order('name'),
        supabase.from('invitees').select('id, name, label, guest_id').order('name'),
        supabase
          .from('seating_tables')
          .select('table_key, name, capacity, table_type, display_order')
          .order('display_order'),
        supabase
          .from('seating_assignments')
          .select('table_key, seat_index, guest_name, plan_type')
          .order('table_key'),
      ])

      if (guestError || inviteeError || tableError || assignmentError) {
        setStatusMessage(
          `Nem sikerült betölteni az ülésrendet: ${
            guestError?.message ||
            inviteeError?.message ||
            tableError?.message ||
            assignmentError?.message
          }`,
        )
      } else {
        const baseTables = tableData?.length ? tableData : createDefaultTables()
        const plannedAssignments = (assignmentData || []).filter(
          (row) => (row.plan_type || 'actual') === 'planned',
        )
        const actualAssignments = (assignmentData || []).filter(
          (row) => (row.plan_type || 'actual') === 'actual',
        )
        const loadedPlanned = normalizeTables(baseTables, plannedAssignments)
        const loadedActual = normalizeTables(baseTables, actualAssignments)

        setGuests(guestData || [])
        setInvitees(inviteeData || [])
        setPlannedTables(loadedPlanned)
        setActualTables(loadedActual)
        setSavedPlannedTables(cloneTables(loadedPlanned))
        setSavedActualTables(cloneTables(loadedActual))
      }

      setIsLoading(false)
    }

    loadSeating()
  }, [navigate])

  const personNames =
    planType === 'planned'
      ? invitees.map((invitee) => invitee.name).filter(Boolean)
      : guests.filter((guest) => guest.response).map((guest) => guest.name)
  // Ugyanaz a nev tobb emberhez is tartozhat, ezert nevenkent szamoljuk a fero szemelyeket
  const nameTotals = personNames.reduce(
    (totals, name) => totals.set(name, (totals.get(name) || 0) + 1),
    new Map(),
  )
  const seatedCounts = tables
    .flatMap((table) => table.seats)
    .filter(Boolean)
    .reduce((counts, name) => counts.set(name, (counts.get(name) || 0) + 1), new Map())
  const availableGuests = [...nameTotals.entries()]
    .map(([name, total]) => ({ name, remaining: total - (seatedCounts.get(name) || 0) }))
    .filter((item) => item.remaining > 0)
    .sort((left, right) => left.name.localeCompare(right.name, 'hu'))
  const labelSource =
    planType === 'planned'
      ? invitees.map((invitee) => ({ name: invitee.name, label: invitee.label }))
      : guests.map((guest) => ({ name: guest.name, label: guest.label }))
  const guestLabelByName = new Map(labelSource.map((item) => [item.name, item.label]))
  const guestResponseByName = new Map(guests.map((guest) => [guest.name, guest.response]))
  const getVisibleGuestLabelClass = (guestName) =>
    showLabelColors ? getGuestLabelClass(guestLabelByName.get(guestName)) : ''
  const seatingWarnings =
    planType === 'actual'
      ? tables.flatMap((table) =>
          table.seats
            .filter(Boolean)
            .map((guestName) => ({
              guestName,
              tableName: table.name,
            }))
            .filter(({ guestName }) => guestResponseByName.get(guestName) !== true),
        )
      : []
  const duplicateWarnings = [...seatedCounts.entries()]
    .filter(([name, count]) => nameTotals.has(name) && count > nameTotals.get(name))
    .map(([name, count]) => ({ name, count, total: nameTotals.get(name) || 0 }))

  function switchPlanType(nextType) {
    if (nextType === planType) {
      return
    }

    if (isEditing) {
      const confirmed = window.confirm(
        'Mentetlen módosítások elveszhetnek. Biztosan váltasz nézetet?',
      )
      if (!confirmed) {
        return
      }

      setPlannedTables(cloneTables(savedPlannedTables))
      setActualTables(cloneTables(savedActualTables))
      setIsEditing(false)
      setDraggedGuest('')
      setSelectedSeat(null)
    }

    setPlanType(nextType)
    setStatusMessage('')
  }

  function updateTable(index, field, value) {
    const apply = (currentTables) =>
      currentTables.map((table, tableIndex) => {
        if (tableIndex !== index) {
          return table
        }

        if (field === 'capacity') {
          const capacity = Number(value)
          const seats = [...table.seats]

          while (seats.length < capacity) {
            seats.push('')
          }

          return {
            ...table,
            capacity,
            seats: seats.slice(0, capacity),
          }
        }

        return { ...table, [field]: value }
      })

    setPlannedTables(apply)
    setActualTables(apply)
  }

  function getDraggedGuest(event) {
    return event?.dataTransfer?.getData('text/plain') || draggedGuest
  }

  function assignGuest(tableIndex, seatIndex, guestName = draggedGuest) {
    if (!guestName || !isEditing) {
      return
    }

    const total = nameTotals.get(guestName) || 0
    const seated = seatedCounts.get(guestName) || 0
    const targetSeat = tables[tableIndex]?.seats[seatIndex]

    if (total > 0 && seated >= total && targetSeat !== guestName) {
      setStatusMessage(`Nincs több "${guestName}" nevű személy a listában.`)
      setDraggedGuest('')
      return
    }

    setSelectedSeat(null)

    setTables((currentTables) =>
      currentTables.map((table, currentTableIndex) =>
        currentTableIndex === tableIndex
          ? {
              ...table,
              seats: table.seats.map((seat, currentSeatIndex) =>
                currentSeatIndex === seatIndex ? guestName : seat,
              ),
            }
          : table,
      ),
    )
    setDraggedGuest('')
  }

  function assignGuestToTable(tableIndex, guestName = draggedGuest) {
    if (!guestName || !isEditing) {
      return
    }

    const firstEmptySeatIndex = tables[tableIndex].seats.findIndex((seat) => !seat)

    if (firstEmptySeatIndex === -1) {
      setStatusMessage('Ennél az asztalnál nincs szabad hely.')
      return
    }

    assignGuest(tableIndex, firstEmptySeatIndex, guestName)
  }

  function clearSeat(tableIndex, seatIndex) {
    setTables((currentTables) =>
      currentTables.map((table, currentTableIndex) =>
        currentTableIndex === tableIndex
          ? {
              ...table,
              seats: table.seats.map((seat, currentSeatIndex) =>
                currentSeatIndex === seatIndex ? '' : seat,
              ),
            }
          : table,
      ),
    )
  }

  function swapSeats(source, target) {
    setTables((currentTables) => {
      const next = cloneTables(currentTables)
      const sourceSeats = next[source.tableIndex]?.seats
      const targetSeats = next[target.tableIndex]?.seats

      if (!sourceSeats || !targetSeats) {
        return currentTables
      }

      const movedName = sourceSeats[source.seatIndex] || ''
      sourceSeats[source.seatIndex] = targetSeats[target.seatIndex] || ''
      targetSeats[target.seatIndex] = movedName

      return next
    })
  }

  function isSeatSelected(tableIndex, seatIndex) {
    return selectedSeat?.tableIndex === tableIndex && selectedSeat?.seatIndex === seatIndex
  }

  function handleSeatClick(tableIndex, seatIndex) {
    if (!isEditing) {
      return
    }

    const seatName = tables[tableIndex]?.seats[seatIndex] || ''

    if (!selectedSeat) {
      if (seatName) {
        setSelectedSeat({ tableIndex, seatIndex })
        setStatusMessage(`${seatName} kijelölve. Kattints a cél helyre az áthelyezéshez.`)
      }
      return
    }

    if (isSeatSelected(tableIndex, seatIndex)) {
      setSelectedSeat(null)
      setStatusMessage('')
      return
    }

    swapSeats(selectedSeat, { tableIndex, seatIndex })
    setSelectedSeat(null)
    setStatusMessage('')
  }

  function handleSeatDoubleClick(tableIndex, seatIndex) {
    if (!isEditing) {
      return
    }

    setSelectedSeat(null)

    if (tables[tableIndex]?.seats[seatIndex]) {
      clearSeat(tableIndex, seatIndex)
      setStatusMessage('')
    }
  }

  function startEditing() {
    setSavedPlannedTables(cloneTables(plannedTables))
    setSavedActualTables(cloneTables(actualTables))
    setStatusMessage('')
    setSelectedSeat(null)
    setIsEditing(true)
  }

  function discardChanges() {
    setPlannedTables(cloneTables(savedPlannedTables))
    setActualTables(cloneTables(savedActualTables))
    setDraggedGuest('')
    setSelectedSeat(null)
    setStatusMessage('')
    setIsEditing(false)
  }

  async function saveChanges() {
    setStatusMessage('')
    setIsSubmitting(true)

    const tableRows = tables.map((table) => ({
      table_key: table.table_key,
      name: table.name,
      capacity: table.capacity,
      table_type: table.table_type,
      display_order: table.display_order,
    }))

    const { error: tableError } = await supabase
      .from('seating_tables')
      .upsert(tableRows, { onConflict: 'table_key' })

    if (tableError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni az asztalokat: ${tableError.message}`)
      return
    }

    const currentError = await persistSeatingPlan(planType, tables)
    if (currentError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni az ültetéseket: ${currentError.message}`)
      return
    }

    const otherPlanType = planType === 'planned' ? 'actual' : 'planned'
    const otherTables = planType === 'planned' ? actualTables : plannedTables
    const otherError = await persistSeatingPlan(otherPlanType, otherTables)
    if (otherError) {
      setIsSubmitting(false)
      setStatusMessage(
        `Nem sikerült frissíteni a másik nézet ültetéseit: ${otherError.message}`,
      )
      return
    }

    setIsEditing(false)
    setSelectedSeat(null)
    setSavedPlannedTables(cloneTables(plannedTables))
    setSavedActualTables(cloneTables(actualTables))
    setIsSubmitting(false)
    setStatusMessage(
      planType === 'planned' ? 'A tervezett ülésrend mentve.' : 'A valós ülésrend mentve.',
    )
  }

  async function persistSeatingPlan(targetPlanType, nextTables) {
    const { error: deleteError } = await supabase
      .from('seating_assignments')
      .delete()
      .eq('plan_type', targetPlanType)
      .gte('seat_index', 0)

    if (deleteError) {
      return deleteError
    }

    const assignmentRows = nextTables.flatMap((table) =>
      table.seats
        .map((guestName, seatIndex) => ({
          table_key: table.table_key,
          seat_index: seatIndex,
          guest_name: guestName,
          plan_type: targetPlanType,
        }))
        .filter((assignment) => assignment.guest_name),
    )

    if (!assignmentRows.length) {
      return null
    }

    const { error: assignmentError } = await supabase
      .from('seating_assignments')
      .insert(assignmentRows)

    return assignmentError
  }

  async function transferLinkedToActual() {
    if (isEditing) {
      setStatusMessage('Előbb mentsd vagy vesd el a szerkesztést, mielőtt áttöltenél.')
      return
    }

    const inviteeToGuest = buildInviteeToGuestNameMap(invitees, guests)
    if (inviteeToGuest.size === 0) {
      setStatusMessage('Nincs összekötött meghívott–visszajelzés pár az áttöltéshez.')
      return
    }

    setIsSubmitting(true)
    const nextActual = copySeatingPlannedToActual(plannedTables, actualTables, inviteeToGuest)
    const persistError = await persistSeatingPlan('actual', nextActual)
    setIsSubmitting(false)

    if (persistError) {
      setStatusMessage(`Nem sikerült áttölteni a valós ülésrendbe: ${persistError.message}`)
      return
    }

    setActualTables(nextActual)
    setSavedActualTables(cloneTables(nextActual))
    setPlanType('actual')
    setStatusMessage('Az összekötött meghívottak áttöltve a valós ülésrendbe.')
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
    <main className="auth-page seating-page">
      <section className="auth-card admin-card seating-card">
        <p className="eyebrow">Admin</p>
        <h1>Ülésrend</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}
        {seatingWarnings.length > 0 && (
          <div className="form-message seating-warning">
            <strong>Figyelmeztetés:</strong> az alábbi vendégek szerepelnek az ülésrendben, de
            nem jelezték, hogy jönnek, vagy nincsenek az RSVP-zett vendégek között:
            <ul>
              {seatingWarnings.map(({ guestName, tableName }, warningIndex) => (
                <li key={`${tableName}-${guestName}-${warningIndex}`}>
                  {guestName} - {tableName}
                </li>
              ))}
            </ul>
          </div>
        )}
        {duplicateWarnings.length > 0 && (
          <div className="form-message seating-warning">
            <strong>Figyelmeztetés:</strong> az alábbi nevek több helyen szerepelnek, mint ahány
            ilyen nevű személy van a listában:
            <ul>
              {duplicateWarnings.map(({ name, count, total }) => (
                <li key={`duplicate-${name}`}>
                  {name} - {count} helyen ül, de {total} ilyen nevű személy van
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasAccess && (
          <div>
            <div className="admin-view-tabs" role="tablist" aria-label="Ülésrend nézetek">
              <button
                type="button"
                role="tab"
                className={planType === 'planned' ? 'is-active' : ''}
                aria-selected={planType === 'planned'}
                onClick={() => switchPlanType('planned')}
              >
                Tervezett
              </button>
              <button
                type="button"
                role="tab"
                className={planType === 'actual' ? 'is-active' : ''}
                aria-selected={planType === 'actual'}
                onClick={() => switchPlanType('actual')}
              >
                Valós
              </button>
            </div>

            <p className="admin-summary">
              {planType === 'planned'
                ? 'Tervezett nézet: a meghívottak listájából ültetsz.'
                : 'Valós nézet: a visszajelzett (jön) vendégekből ültetsz.'}
            </p>

            <div className="admin-actions">
              <button type="button" onClick={() => setShowLabelColors((current) => !current)}>
                {showLabelColors
                  ? 'Kategória szerinti színezés kikapcsolása'
                  : 'Kategória szerinti színezés bekapcsolása'}
              </button>

              {!isEditing && (
                <button type="button" onClick={transferLinkedToActual} disabled={isSubmitting}>
                  Áttöltés tervezettből
                </button>
              )}

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
            </div>

            <div className={`seating-editor ${isEditing ? 'is-editing' : 'is-viewing'}`}>
              <div className="seating-circle">
                {isEditing && (
                  <aside className="guest-palette">
                    <h2>{planType === 'planned' ? 'Meghívottak' : 'Vendégek'}</h2>
                    <p className="guest-palette-hint">
                      Kattints egy leültetett névre a kijelöléshez, majd a cél helyre az
                      áthelyezéshez. Ha ott már ül valaki, a két név helyet cserél. Dupla
                      kattintással törlöd a nevet a helyről.
                    </p>
                    {availableGuests.length === 0 ? (
                      <p>
                        {planType === 'planned'
                          ? 'Minden meghívott kapott helyet.'
                          : 'Minden visszajelzett vendég kapott helyet.'}
                      </p>
                    ) : (
                      availableGuests.map(({ name, remaining }) => (
                        <button
                          draggable
                          type="button"
                          className={getVisibleGuestLabelClass(name)}
                          key={name}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', name)
                            event.dataTransfer.effectAllowed = 'move'
                            setDraggedGuest(name)
                          }}
                        >
                          {remaining > 1 ? `${name} (${remaining} fő)` : name}
                        </button>
                      ))
                    )}
                  </aside>
                )}

                {tables.map((table, tableIndex) => {
                  const position = getTablePosition(tableIndex, tables.length)
                  return (
                    <div
                      className={`seating-table ${table.table_type === 'head' ? 'head-table' : ''}`}
                      style={position}
                      key={table.table_key}
                    >
                      <div className="table-core">
                        {isEditing ? (
                          <div className="table-settings">
                            <input
                              type="text"
                              value={table.name}
                              onChange={(event) =>
                                updateTable(tableIndex, 'name', event.target.value)
                              }
                            />
                            <label className="capacity-control">
                              <input
                                type="number"
                                min="1"
                                max="16"
                                value={table.capacity}
                                onChange={(event) =>
                                  updateTable(tableIndex, 'capacity', event.target.value)
                                }
                              />
                              <span>fő</span>
                            </label>
                          </div>
                        ) : (
                          <>
                            <h2>{table.name}</h2>
                            <p className="table-capacity">{table.capacity} fő</p>
                          </>
                        )}
                      </div>

                      <div className="seat-list">
                        {table.seats.map((guestName, seatIndex) => (
                          <div
                            className="seat-drop-zone"
                            style={getSeatPosition(
                              seatIndex,
                              table.seats.length,
                              table.table_type,
                            )}
                            key={`${table.table_key}-${seatIndex}`}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault()
                              assignGuest(tableIndex, seatIndex, getDraggedGuest(event))
                            }}
                          >
                            <button
                              className={`seat ${guestName ? 'is-occupied' : ''} ${
                                isSeatSelected(tableIndex, seatIndex) ? 'is-selected' : ''
                              } ${getGuestLabelClass(
                                showLabelColors ? guestLabelByName.get(guestName) : '',
                              )}`}
                              type="button"
                              onClick={() => handleSeatClick(tableIndex, seatIndex)}
                              onDoubleClick={() => handleSeatDoubleClick(tableIndex, seatIndex)}
                            >
                              {guestName || `Üres ${seatIndex + 1}. hely / index ${seatIndex}`}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <section className="seating-summary">
              <h2>Ülésrend lista</h2>
              <div className="seating-summary-grid">
                {tables.map((table, tableIndex) => {
                  const seatedGuests = table.seats.filter(Boolean)

                  return (
                    <article
                      className={isEditing ? 'is-droppable' : ''}
                      key={`${table.table_key}-summary`}
                      onDragOver={(event) => {
                        if (isEditing) {
                          event.preventDefault()
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        assignGuestToTable(tableIndex, getDraggedGuest(event))
                      }}
                    >
                      <h3>{table.name}</h3>
                      {seatedGuests.length === 0 ? (
                        <p>Nincs még vendég ennél az asztalnál.</p>
                      ) : (
                        <ul>
                          {seatedGuests.map((guestName, seatedIndex) => (
                            <li key={`${table.table_key}-${guestName}-${seatedIndex}`}>
                              <span
                                className={`seating-summary-guest ${getVisibleGuestLabelClass(
                                  guestName,
                                )}`}
                              >
                                {guestName}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
