import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  return tables.map((table) => ({ ...table, seats: [...table.seats] }))
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
  const [tables, setTables] = useState([])
  const [savedTables, setSavedTables] = useState([])
  const [guestNames, setGuestNames] = useState([])
  const [guestResponses, setGuestResponses] = useState([])
  const [draggedGuest, setDraggedGuest] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showLabelColors, setShowLabelColors] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

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
        { data: tableData, error: tableError },
        { data: assignmentData, error: assignmentError },
      ] = await Promise.all([
        supabase.from('guests').select('name, response, label').order('name'),
        supabase
          .from('seating_tables')
          .select('table_key, name, capacity, table_type, display_order')
          .order('display_order'),
        supabase
          .from('seating_assignments')
          .select('table_key, seat_index, guest_name')
          .order('table_key'),
      ])

      if (guestError || tableError || assignmentError) {
        setStatusMessage(
          `Nem sikerült betölteni az ülésrendet: ${
            guestError?.message || tableError?.message || assignmentError?.message
          }`,
        )
      } else {
        const loadedTables = tableData?.length
          ? normalizeTables(tableData, assignmentData || [])
          : createDefaultTables()

        setGuestResponses(guestData || [])
        setGuestNames((guestData || []).filter((guest) => guest.response).map((guest) => guest.name))
        setTables(loadedTables)
        setSavedTables(cloneTables(loadedTables))
      }

      setIsLoading(false)
    }

    loadSeating()
  }, [navigate])

  const assignedGuests = tables.flatMap((table) => table.seats).filter(Boolean)
  const availableGuests = guestNames.filter((guest) => !assignedGuests.includes(guest))
  const guestResponseByName = new Map(guestResponses.map((guest) => [guest.name, guest.response]))
  const guestLabelByName = new Map(guestResponses.map((guest) => [guest.name, guest.label]))
  const getVisibleGuestLabelClass = (guestName) =>
    showLabelColors ? getGuestLabelClass(guestLabelByName.get(guestName)) : ''
  const seatingWarnings = tables.flatMap((table) =>
    table.seats
      .filter(Boolean)
      .map((guestName) => ({
        guestName,
        tableName: table.name,
      }))
      .filter(({ guestName }) => guestResponseByName.get(guestName) !== true),
  )

  function updateTable(index, field, value) {
    setTables((currentTables) =>
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
      }),
    )
  }

  function getDraggedGuest(event) {
    return event?.dataTransfer?.getData('text/plain') || draggedGuest
  }

  function assignGuest(tableIndex, seatIndex, guestName = draggedGuest) {
    if (!guestName || !isEditing) {
      return
    }

    setTables((currentTables) =>
      currentTables.map((table, currentTableIndex) => ({
        ...table,
        seats: table.seats.map((seat, currentSeatIndex) => {
          if (seat === guestName) {
            return ''
          }

          if (currentTableIndex === tableIndex && currentSeatIndex === seatIndex) {
            return guestName
          }

          return seat
        }),
      })),
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

  function startEditing() {
    setSavedTables(cloneTables(tables))
    setStatusMessage('')
    setIsEditing(true)
  }

  function discardChanges() {
    setTables(cloneTables(savedTables))
    setDraggedGuest('')
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

    const { error: deleteError } = await supabase
      .from('seating_assignments')
      .delete()
      .gte('seat_index', 0)

    if (deleteError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült frissíteni az ültetéseket: ${deleteError.message}`)
      return
    }

    const assignmentRows = tables.flatMap((table) =>
      table.seats
        .map((guestName, seatIndex) => ({
          table_key: table.table_key,
          seat_index: seatIndex,
          guest_name: guestName,
        }))
        .filter((assignment) => assignment.guest_name),
    )

    const { error: assignmentError } = assignmentRows.length
      ? await supabase.from('seating_assignments').insert(assignmentRows)
      : { error: null }

    setIsSubmitting(false)

    if (assignmentError) {
      setStatusMessage(`Nem sikerült menteni az ültetéseket: ${assignmentError.message}`)
      return
    }

    setIsEditing(false)
    setSavedTables(cloneTables(tables))
    setStatusMessage('Az ülésrend mentve.')
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
              {seatingWarnings.map(({ guestName, tableName }) => (
                <li key={`${tableName}-${guestName}`}>
                  {guestName} - {tableName}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasAccess && (
          <div>
            <div className="admin-actions">
              <button type="button" onClick={() => setShowLabelColors((current) => !current)}>
                {showLabelColors
                  ? 'Kategória szerinti színezés kikapcsolása'
                  : 'Kategória szerinti színezés bekapcsolása'}
              </button>

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
                    <h2>Vendégek</h2>
                    {availableGuests.length === 0 ? (
                      <p>Minden visszajelzett vendég kapott helyet.</p>
                    ) : (
                      availableGuests.map((guest) => (
                        <button
                          draggable
                          type="button"
                          className={getVisibleGuestLabelClass(guest)}
                          key={guest}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', guest)
                            event.dataTransfer.effectAllowed = 'move'
                            setDraggedGuest(guest)
                          }}
                        >
                          {guest}
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
                              className={`seat ${guestName ? 'is-occupied' : ''} ${getGuestLabelClass(
                                showLabelColors ? guestLabelByName.get(guestName) : '',
                              )}`}
                              type="button"
                              onClick={() => {
                                if (isEditing && guestName) {
                                  clearSeat(tableIndex, seatIndex)
                                }
                              }}
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
                          {seatedGuests.map((guestName) => (
                            <li key={`${table.table_key}-${guestName}`}>
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
