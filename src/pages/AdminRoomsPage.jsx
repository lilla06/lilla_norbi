import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function createRoom(displayOrder = 0) {
  return {
    room_key: `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    location_name: '',
    room_number: '',
    double_beds: 0,
    single_beds: 0,
    extra_beds: 0,
    child_beds: 0,
    display_order: displayOrder,
    assignments: {},
  }
}

function cloneRooms(rooms) {
  return rooms.map((room) => ({
    ...room,
    assignments: { ...room.assignments },
  }))
}

function getRoomTitle(room) {
  return [room.location_name, room.room_number].filter(Boolean).join(' - ') || 'Névtelen szoba'
}

function getAdultCapacity(room) {
  return Number(room.double_beds) * 2 + Number(room.single_beds) + Number(room.extra_beds)
}

function getBedSlots(room) {
  const slots = []

  for (let bedIndex = 0; bedIndex < Number(room.double_beds); bedIndex += 1) {
    slots.push({
      bedKey: `double-${bedIndex}`,
      label: `${bedIndex + 1}. franciaágy`,
      type: 'double',
      slotCount: 2,
    })
  }

  for (let bedIndex = 0; bedIndex < Number(room.single_beds); bedIndex += 1) {
    slots.push({
      bedKey: `single-${bedIndex}`,
      label: `${bedIndex + 1}. szimpla ágy`,
      type: 'single',
      slotCount: 1,
    })
  }

  for (let bedIndex = 0; bedIndex < Number(room.extra_beds); bedIndex += 1) {
    slots.push({
      bedKey: `extra-${bedIndex}`,
      label: `${bedIndex + 1}. pótágy`,
      type: 'extra',
      slotCount: 1,
    })
  }

  return slots
}

function getValidAssignmentKeys(room) {
  return new Set(
    getBedSlots(room).flatMap((bed) =>
      Array.from({ length: bed.slotCount }, (_item, slotIndex) => `${bed.bedKey}:${slotIndex}`),
    ),
  )
}

function normalizeRooms(rooms, assignments) {
  return rooms.map((room) => {
    const validKeys = getValidAssignmentKeys(room)
    const roomAssignments = {}

    assignments
      .filter((assignment) => assignment.room_key === room.room_key)
      .forEach((assignment) => {
        const assignmentKey = `${assignment.bed_key}:${assignment.slot_index}`

        if (validKeys.has(assignmentKey)) {
          roomAssignments[assignmentKey] = assignment.guest_name
        }
      })

    return { ...room, assignments: roomAssignments }
  })
}

function sanitizeRoom(room, displayOrder) {
  const sanitizedRoom = {
    ...room,
    double_beds: Math.max(0, Number(room.double_beds) || 0),
    single_beds: Math.max(0, Number(room.single_beds) || 0),
    extra_beds: Math.max(0, Number(room.extra_beds) || 0),
    child_beds: Math.max(0, Number(room.child_beds) || 0),
    display_order: displayOrder,
  }
  const validKeys = getValidAssignmentKeys(sanitizedRoom)

  return {
    ...sanitizedRoom,
    assignments: Object.fromEntries(
      Object.entries(sanitizedRoom.assignments || {}).filter(([assignmentKey]) =>
        validKeys.has(assignmentKey),
      ),
    ),
  }
}

function createAssignmentRows(rooms) {
  return rooms.flatMap((room) =>
    Object.entries(room.assignments)
      .map(([assignmentKey, guestName]) => {
        const [bedKey, slotIndex] = assignmentKey.split(':')

        return {
          room_key: room.room_key,
          bed_key: bedKey,
          slot_index: Number(slotIndex),
          guest_name: guestName,
        }
      })
      .filter((assignment) => assignment.guest_name),
  )
}

export default function AdminRoomsPage() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [savedRooms, setSavedRooms] = useState([])
  const [guestResponses, setGuestResponses] = useState([])
  const [guestNames, setGuestNames] = useState([])
  const [draggedGuest, setDraggedGuest] = useState('')
  const [editMode, setEditMode] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    async function loadRooms() {
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
        { data: roomData, error: roomError },
        { data: assignmentData, error: assignmentError },
      ] = await Promise.all([
        supabase.from('guests').select('name, response').order('name'),
        supabase
          .from('accommodation_rooms')
          .select(
            'room_key, location_name, room_number, double_beds, single_beds, extra_beds, child_beds, display_order',
          )
          .order('display_order'),
        supabase
          .from('accommodation_assignments')
          .select('room_key, bed_key, slot_index, guest_name')
          .order('room_key'),
      ])

      if (guestError || roomError || assignmentError) {
        setStatusMessage(
          `Nem sikerült betölteni a szobabeosztást: ${
            guestError?.message || roomError?.message || assignmentError?.message
          }`,
        )
      } else {
        const loadedRooms = normalizeRooms(roomData || [], assignmentData || [])

        setGuestResponses(guestData || [])
        setGuestNames((guestData || []).filter((guest) => guest.response).map((guest) => guest.name))
        setRooms(loadedRooms)
        setSavedRooms(cloneRooms(loadedRooms))
      }

      setIsLoading(false)
    }

    loadRooms()
  }, [navigate])

  const assignedGuests = rooms.flatMap((room) => Object.values(room.assignments)).filter(Boolean)
  const availableGuests = guestNames.filter((guest) => !assignedGuests.includes(guest))
  const guestResponseByName = new Map(guestResponses.map((guest) => [guest.name, guest.response]))
  const roomWarnings = rooms.flatMap((room) =>
    Object.values(room.assignments)
      .filter(Boolean)
      .map((guestName) => ({
        guestName,
        roomName: getRoomTitle(room),
      }))
      .filter(({ guestName }) => guestResponseByName.get(guestName) !== true),
  )

  function getDraggedGuest(event) {
    return event?.dataTransfer?.getData('text/plain') || draggedGuest
  }

  function startEditing(nextMode) {
    setSavedRooms(cloneRooms(rooms))
    setEditMode(nextMode)
    setStatusMessage('')
  }

  function discardChanges() {
    setRooms(cloneRooms(savedRooms))
    setDraggedGuest('')
    setEditMode(null)
    setStatusMessage('')
  }

  function addRoom() {
    setRooms((currentRooms) => [...currentRooms, createRoom(currentRooms.length)])
  }

  function removeRoom(roomIndex) {
    setRooms((currentRooms) => currentRooms.filter((_room, index) => index !== roomIndex))
  }

  function updateRoom(roomIndex, field, value) {
    setRooms((currentRooms) =>
      currentRooms.map((room, index) => {
        if (index !== roomIndex) {
          return room
        }

        const nextValue = field.endsWith('_beds') ? Number(value) : value
        return sanitizeRoom({ ...room, [field]: nextValue }, index)
      }),
    )
  }

  function assignGuest(roomIndex, assignmentKey, guestName = draggedGuest) {
    if (!guestName || editMode !== 'assignments') {
      return
    }

    setRooms((currentRooms) =>
      currentRooms.map((room, currentRoomIndex) => {
        const nextAssignments = Object.fromEntries(
          Object.entries(room.assignments).map(([currentAssignmentKey, currentGuestName]) => [
            currentAssignmentKey,
            currentGuestName === guestName ? '' : currentGuestName,
          ]),
        )

        if (currentRoomIndex === roomIndex) {
          nextAssignments[assignmentKey] = guestName
        }

        return {
          ...room,
          assignments: nextAssignments,
        }
      }),
    )
    setDraggedGuest('')
  }

  function clearAssignment(roomIndex, assignmentKey) {
    setRooms((currentRooms) =>
      currentRooms.map((room, index) =>
        index === roomIndex
          ? {
              ...room,
              assignments: {
                ...room.assignments,
                [assignmentKey]: '',
              },
            }
          : room,
      ),
    )
  }

  async function saveRooms() {
    setStatusMessage('')
    setIsSubmitting(true)

    const sanitizedRooms = rooms.map((room, index) => sanitizeRoom(room, index))
    const roomRows = sanitizedRooms.map((room) => ({
      room_key: room.room_key,
      location_name: room.location_name.trim(),
      room_number: room.room_number.trim(),
      double_beds: room.double_beds,
      single_beds: room.single_beds,
      extra_beds: room.extra_beds,
      child_beds: room.child_beds,
      display_order: room.display_order,
    }))

    const removedRoomKeys = savedRooms
      .map((room) => room.room_key)
      .filter((roomKey) => !sanitizedRooms.some((room) => room.room_key === roomKey))

    if (removedRoomKeys.length > 0) {
      const { error: deleteError } = await supabase
        .from('accommodation_rooms')
        .delete()
        .in('room_key', removedRoomKeys)

      if (deleteError) {
        setIsSubmitting(false)
        setStatusMessage(`Nem sikerült törölni a szobákat: ${deleteError.message}`)
        return
      }
    }

    const { error: roomError } = roomRows.length
      ? await supabase.from('accommodation_rooms').upsert(roomRows, { onConflict: 'room_key' })
      : { error: null }

    if (roomError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni a szobákat: ${roomError.message}`)
      return
    }

    const currentRoomKeys = sanitizedRooms.map((room) => room.room_key)

    if (currentRoomKeys.length > 0) {
      const { error: deleteAssignmentError } = await supabase
        .from('accommodation_assignments')
        .delete()
        .in('room_key', currentRoomKeys)

      if (deleteAssignmentError) {
        setIsSubmitting(false)
        setStatusMessage(`Nem sikerült frissíteni a szobabeosztást: ${deleteAssignmentError.message}`)
        return
      }
    }

    const assignmentRows = createAssignmentRows(sanitizedRooms)
    const { error: assignmentError } = assignmentRows.length
      ? await supabase.from('accommodation_assignments').insert(assignmentRows)
      : { error: null }

    if (assignmentError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni a szobabeosztást: ${assignmentError.message}`)
      return
    }

    setRooms(sanitizedRooms)
    setSavedRooms(cloneRooms(sanitizedRooms))
    setIsSubmitting(false)
    setEditMode(null)
    setStatusMessage('A szobák mentve.')
  }

  async function saveAssignments() {
    setStatusMessage('')
    setIsSubmitting(true)

    const { error: deleteError } = await supabase
      .from('accommodation_assignments')
      .delete()
      .gte('slot_index', 0)

    if (deleteError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült frissíteni a szobabeosztást: ${deleteError.message}`)
      return
    }

    const assignmentRows = createAssignmentRows(rooms)

    const { error: assignmentError } = assignmentRows.length
      ? await supabase.from('accommodation_assignments').insert(assignmentRows)
      : { error: null }

    if (assignmentError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült menteni a szobabeosztást: ${assignmentError.message}`)
      return
    }

    setSavedRooms(cloneRooms(rooms))
    setIsSubmitting(false)
    setEditMode(null)
    setStatusMessage('A szobabeosztás mentve.')
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
    <main className={`auth-page rooms-page ${editMode === 'assignments' ? 'is-assigning' : ''}`}>
      <section className="auth-card admin-card rooms-card">
        <p className="eyebrow">Admin</p>
        <h1>Szobabeosztás</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}
        {roomWarnings.length > 0 && (
          <div className="form-message seating-warning">
            <strong>Figyelmeztetés:</strong> az alábbi vendégek szerepelnek a szobabeosztásban,
            de nem jelezték, hogy jönnek, vagy nincsenek az RSVP-zett vendégek között:
            <ul>
              {roomWarnings.map(({ guestName, roomName }) => (
                <li key={`${roomName}-${guestName}`}>
                  {guestName} - {roomName}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasAccess && (
          <div>
            <div className="admin-actions">
              {!editMode ? (
                <>
                  <button type="button" onClick={() => startEditing('rooms')}>
                    Szobák szerkesztése
                  </button>
                  <button type="button" onClick={() => startEditing('assignments')}>
                    Szobabeosztás módosítása
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={editMode === 'rooms' ? saveRooms : saveAssignments}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Mentés...' : 'Mentés'}
                  </button>
                  <button type="button" onClick={discardChanges} disabled={isSubmitting}>
                    Módosítások elvetése
                  </button>
                </>
              )}
            </div>

            {editMode === 'rooms' && (
              <section className="room-edit-list">
                {rooms.map((room, roomIndex) => (
                  <article className="room-edit-card" key={room.room_key}>
                    <label>
                      Helyszín
                      <input
                        type="text"
                        value={room.location_name}
                        onChange={(event) =>
                          updateRoom(roomIndex, 'location_name', event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Szoba száma / neve
                      <input
                        type="text"
                        value={room.room_number}
                        onChange={(event) => updateRoom(roomIndex, 'room_number', event.target.value)}
                      />
                    </label>
                    <label>
                      Franciaágy
                      <input
                        min="0"
                        type="number"
                        value={room.double_beds}
                        onChange={(event) => updateRoom(roomIndex, 'double_beds', event.target.value)}
                      />
                    </label>
                    <label>
                      Szimpla ágy
                      <input
                        min="0"
                        type="number"
                        value={room.single_beds}
                        onChange={(event) => updateRoom(roomIndex, 'single_beds', event.target.value)}
                      />
                    </label>
                    <label>
                      Pótágy
                      <input
                        min="0"
                        type="number"
                        value={room.extra_beds}
                        onChange={(event) => updateRoom(roomIndex, 'extra_beds', event.target.value)}
                      />
                    </label>
                    <label>
                      Gyerekágy
                      <input
                        min="0"
                        type="number"
                        value={room.child_beds}
                        onChange={(event) => updateRoom(roomIndex, 'child_beds', event.target.value)}
                      />
                    </label>
                    <button type="button" onClick={() => removeRoom(roomIndex)}>
                      Szoba törlése
                    </button>
                  </article>
                ))}

                <button className="room-add-button" type="button" onClick={addRoom}>
                  Új szoba hozzáadása
                </button>
              </section>
            )}

            {editMode === 'assignments' && (
              <section className="room-assignment-editor">
                <aside className="guest-palette room-guest-palette">
                  <h2>Vendégek</h2>
                  {availableGuests.length === 0 ? (
                    <p>Minden visszajelzett vendég kapott szobát.</p>
                  ) : (
                    availableGuests.map((guest) => (
                      <button
                        draggable
                        type="button"
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

                <div className="room-assignment-grid">
                  {rooms.map((room, roomIndex) => (
                    <article className="room-card is-editing" key={`${room.room_key}-editor`}>
                      <h2>{getRoomTitle(room)}</h2>
                      <p>{getAdultCapacity(room)} felnőtt férőhely</p>
                      {Number(room.child_beds) > 0 && <p>{room.child_beds} gyerekágy eltárolva</p>}

                      <div className="bed-list">
                        {getBedSlots(room).map((bed) => (
                          <div className={`bed-row bed-row-${bed.type}`} key={bed.bedKey}>
                            <span>{bed.label}</span>
                            <div className="bed-slots">
                              {Array.from({ length: bed.slotCount }, (_item, slotIndex) => {
                                const assignmentKey = `${bed.bedKey}:${slotIndex}`
                                const guestName = room.assignments[assignmentKey]

                                return (
                                  <button
                                    className={`room-drop-zone ${guestName ? 'is-occupied' : ''} ${
                                      bed.type === 'extra' ? 'is-extra-bed' : ''
                                    }`}
                                    type="button"
                                    key={assignmentKey}
                                    onClick={() => {
                                      if (guestName) {
                                        clearAssignment(roomIndex, assignmentKey)
                                      }
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                      event.preventDefault()
                                      assignGuest(roomIndex, assignmentKey, getDraggedGuest(event))
                                    }}
                                  >
                                    {guestName || (bed.type === 'extra' ? 'Pótágy' : 'Üres')}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!editMode && (
              <section className="room-grid">
                {rooms.length === 0 ? (
                  <p className="admin-summary">Még nincs szoba megadva.</p>
                ) : (
                  rooms.map((room) => {
                    const assignedRoomGuests = Object.values(room.assignments).filter(Boolean)

                    return (
                      <article className="room-card" key={`${room.room_key}-view`}>
                        <p className="eyebrow">{room.location_name || 'Nincs helyszín'}</p>
                        <h2>{room.room_number || 'Névtelen szoba'}</h2>
                        <p>
                          {getAdultCapacity(room)} felnőtt férőhely
                          {Number(room.child_beds) > 0 ? ` + ${room.child_beds} gyerekágy` : ''}
                        </p>
                        <p>
                          Franciaágy: {room.double_beds}, szimpla: {room.single_beds}, pótágy:{' '}
                          {room.extra_beds}
                        </p>

                        {assignedRoomGuests.length === 0 ? (
                          <p>Nincs még vendég ebbe a szobába beosztva.</p>
                        ) : (
                          <ul>
                            {assignedRoomGuests.map((guestName) => (
                              <li key={`${room.room_key}-${guestName}`}>{guestName}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    )
                  })
                )}
              </section>
            )}
          </div>
        )}

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
