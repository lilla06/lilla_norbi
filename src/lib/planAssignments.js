export function clonePlanTables(tables) {
  return tables.map((table) => ({ ...table, seats: [...table.seats] }))
}

export function clonePlanRooms(rooms) {
  return rooms.map((room) => ({
    ...room,
    assignments: { ...room.assignments },
  }))
}

export const guestLabelClasses = {
  'Lilla család': 'guest-label-lilla-family',
  'Lilla barát': 'guest-label-lilla-friend',
  'Közös barát': 'guest-label-common-friend',
  'Norbi barát': 'guest-label-norbi-friend',
  'Norbi család': 'guest-label-norbi-family',
}

/** Második körös meghívottak mindig szürkék, a többi a kategória szerint. */
export function getPersonColorClass(person) {
  if (person?.invite_round === 'second') {
    return 'guest-label-second-round'
  }

  return guestLabelClasses[person?.label] || ''
}

export function buildPlanPeople(planType, invitees, guests) {
  if (planType === 'planned') {
    return invitees
      .filter((invitee) => invitee.name)
      .map((invitee) => ({
        id: invitee.id,
        name: invitee.name,
        label: invitee.label || '',
        invite_round: invitee.invite_round || 'first',
      }))
  }

  const roundByGuestId = new Map(
    invitees
      .filter((invitee) => invitee.guest_id)
      .map((invitee) => [String(invitee.guest_id), invitee.invite_round || 'first']),
  )

  return guests
    .filter((guest) => guest.response && guest.name)
    .map((guest) => ({
      id: guest.id,
      name: guest.name,
      label: guest.label || '',
      invite_round: roundByGuestId.get(String(guest.id)) || 'first',
    }))
}

/** A beosztatlan személyek listája: egyforma nevek külön sorban, saját színnel. */
export function buildAvailablePeople(people, assignedNames) {
  const seatedCounts = assignedNames
    .filter(Boolean)
    .reduce((counts, name) => counts.set(name, (counts.get(name) || 0) + 1), new Map())
  const remainingToSkip = new Map(seatedCounts)
  const available = []

  people.forEach((person, index) => {
    const name = person?.name
    if (!name) {
      return
    }

    const skip = remainingToSkip.get(name) || 0
    if (skip > 0) {
      remainingToSkip.set(name, skip - 1)
      return
    }

    available.push({
      key: `${person.id ?? name}-${index}`,
      name,
      label: person.label || '',
      invite_round: person.invite_round || 'first',
      colorClass: getPersonColorClass(person),
    })
  })

  return available.sort((left, right) => {
    const byName = left.name.localeCompare(right.name, 'hu')
    if (byName !== 0) {
      return byName
    }

    const byRound = String(left.invite_round).localeCompare(String(right.invite_round), 'hu')
    if (byRound !== 0) {
      return byRound
    }

    return String(left.label).localeCompare(String(right.label), 'hu')
  })
}

/** Egyforma neveknél sorban adja a színosztályokat (1. előfordulás → 1. személy színe). */
export function createColorClassAssigner(people) {
  const classesByName = new Map()

  people.forEach((person) => {
    const name = person?.name
    if (!name) {
      return
    }

    const classes = classesByName.get(name)
    if (classes) {
      classes.push(getPersonColorClass(person))
    } else {
      classesByName.set(name, [getPersonColorClass(person)])
    }
  })

  const usedCounts = new Map()

  return (name) => {
    if (!name) {
      return ''
    }

    const classes = classesByName.get(name) || []
    if (classes.length === 0) {
      return ''
    }

    const used = usedCounts.get(name) || 0
    usedCounts.set(name, used + 1)
    return classes[Math.min(used, classes.length - 1)] || ''
  }
}

/** @deprecated Használd a createColorClassAssigner-t. */
export function createLabelAssigner(people) {
  return createColorClassAssigner(people)
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
