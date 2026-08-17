export function clonePlanTables(tables) {
  return tables.map((table) => ({ ...table, seats: [...table.seats] }))
}

export function clonePlanRooms(rooms) {
  return rooms.map((room) => ({
    ...room,
    assignments: { ...room.assignments },
  }))
}

/** meghívott név -> visszajelzett vendég név */
export function buildInviteeToGuestNameMap(invitees, guests) {
  const guestById = new Map(guests.map((guest) => [String(guest.id), guest]))
  const map = new Map()

  invitees.forEach((invitee) => {
    if (!invitee.guest_id || !invitee.name) {
      return
    }

    const guest = guestById.get(String(invitee.guest_id))
    if (guest?.name) {
      map.set(invitee.name, guest.name)
    }
  })

  return map
}

export function copySeatingPlannedToActual(plannedTables, actualTables, inviteeToGuestName) {
  const next = clonePlanTables(actualTables)
  const placements = []

  plannedTables.forEach((table, tableIndex) => {
    table.seats.forEach((inviteeName, seatIndex) => {
      const guestName = inviteeToGuestName.get(inviteeName)
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
  const placements = []

  plannedRooms.forEach((room, roomIndex) => {
    Object.entries(room.assignments).forEach(([assignmentKey, inviteeName]) => {
      const guestName = inviteeToGuestName.get(inviteeName)
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
