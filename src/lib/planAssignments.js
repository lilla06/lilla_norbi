export function clonePlanTables(tables) {
  return tables.map((table) => ({ ...table, seats: [...table.seats] }))
}

export function clonePlanRooms(rooms) {
  return rooms.map((room) => ({
    ...room,
    assignments: { ...room.assignments },
  }))
}

/** meghívott név -> összekötött vendég nevek listája (egy név több emberhez is tartozhat) */
export function buildInviteeToGuestNameMap(invitees, guests) {
  const guestById = new Map(guests.map((guest) => [String(guest.id), guest]))
  const map = new Map()

  invitees.forEach((invitee) => {
    if (!invitee.guest_id || !invitee.name) {
      return
    }

    const guest = guestById.get(String(invitee.guest_id))
    if (!guest?.name) {
      return
    }

    const guestNames = map.get(invitee.name)
    if (guestNames) {
      guestNames.push(guest.name)
    } else {
      map.set(invitee.name, [guest.name])
    }
  })

  return map
}

/**
 * Az egyforma nevű meghívottakhoz sorban rendeli hozzá az összekötött vendégeket,
 * így egy vendég csak egyszer kerül be az átvitt beosztásba.
 */
function createGuestNamePicker(inviteeToGuestName) {
  const usedCounts = new Map()

  return (inviteeName) => {
    const raw = inviteeToGuestName.get(inviteeName)
    const guestNames = Array.isArray(raw) ? raw : raw ? [raw] : []
    const usedCount = usedCounts.get(inviteeName) || 0

    if (usedCount >= guestNames.length) {
      return ''
    }

    usedCounts.set(inviteeName, usedCount + 1)
    return guestNames[usedCount]
  }
}

export function copySeatingPlannedToActual(plannedTables, actualTables, inviteeToGuestName) {
  const next = clonePlanTables(actualTables)
  const pickGuestName = createGuestNamePicker(inviteeToGuestName)
  const placements = []

  plannedTables.forEach((table, tableIndex) => {
    table.seats.forEach((inviteeName, seatIndex) => {
      const guestName = pickGuestName(inviteeName)
      if (guestName) {
        placements.push({ tableIndex, seatIndex, guestName })
      }
    })
  })

  const guestNames = new Set(placements.map((item) => item.guestName))

  next.forEach((table) => {
    table.seats = table.seats.map((name) => (guestNames.has(name) ? '' : name))
  })

  placements.forEach(({ tableIndex, seatIndex, guestName }) => {
    if (next[tableIndex] && seatIndex < next[tableIndex].seats.length) {
      next[tableIndex].seats[seatIndex] = guestName
    }
  })

  return next
}

export function copyRoomsPlannedToActual(plannedRooms, actualRooms, inviteeToGuestName) {
  const next = clonePlanRooms(actualRooms)
  const pickGuestName = createGuestNamePicker(inviteeToGuestName)
  const placements = []

  plannedRooms.forEach((room, roomIndex) => {
    Object.entries(room.assignments).forEach(([assignmentKey, inviteeName]) => {
      const guestName = pickGuestName(inviteeName)
      if (guestName) {
        placements.push({ roomIndex, assignmentKey, guestName })
      }
    })
  })

  const guestNames = new Set(placements.map((item) => item.guestName))

  next.forEach((room) => {
    Object.entries(room.assignments).forEach(([key, name]) => {
      if (guestNames.has(name)) {
        room.assignments[key] = ''
      }
    })
  })

  placements.forEach(({ roomIndex, assignmentKey, guestName }) => {
    if (next[roomIndex]) {
      next[roomIndex].assignments[assignmentKey] = guestName
    }
  })

  return next
}
