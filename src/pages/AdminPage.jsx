import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const guestLabels = [
  '',
  'Lilla család',
  'Lilla barát',
  'Közös barát',
  'Norbi barát',
  'Norbi család',
]

const inviteRoundOptions = [
  { value: 'first', label: 'Első kör' },
  { value: 'second', label: 'Második kör' },
]

const EMPTY_LABEL_FILTER = '__none__'

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

function hasAllergy(guest, allergy) {
  return guest.allergies
    ?.toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .includes(allergy)
}

function hasOtherAllergy(guest) {
  const allergies = guest.allergies
    ?.toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return allergies?.some(
    (allergy) => allergy !== 'gluténérzékeny' && allergy !== 'laktózérzékeny',
  )
}

function getInviteRoundLabel(inviteRound) {
  return inviteRoundOptions.find((option) => option.value === inviteRound)?.label || 'Első kör'
}

function createInvitee(sortOrder = 0) {
  return {
    id: crypto.randomUUID(),
    name: '',
    label: '',
    invite_round: 'first',
    guest_id: null,
    sort_order: sortOrder,
    isNew: true,
  }
}

function cloneList(value) {
  return JSON.parse(JSON.stringify(value))
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [activeView, setActiveView] = useState('invitees')
  const [guests, setGuests] = useState([])
  const [savedGuests, setSavedGuests] = useState([])
  const [invitees, setInvitees] = useState([])
  const [savedInvitees, setSavedInvitees] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [roundFilter, setRoundFilter] = useState('all')
  const [appliedLabelFilter, setAppliedLabelFilter] = useState([])
  const [draftLabelFilter, setDraftLabelFilter] = useState([])
  const [isLabelFilterOpen, setIsLabelFilterOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
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

      const [guestsResult, inviteesResult] = await Promise.all([
        supabase.from('guests').select('id, name, response, allergies, label').order('name'),
        supabase
          .from('invitees')
          .select('id, name, label, invite_round, guest_id, sort_order')
          .order('sort_order')
          .order('name'),
      ])

      if (guestsResult.error) {
        setStatusMessage(`Nem sikerült betölteni a visszajelzéseket: ${guestsResult.error.message}`)
        setIsLoading(false)
        return
      }

      if (inviteesResult.error) {
        setStatusMessage(
          `Nem sikerült betölteni a meghívottakat: ${inviteesResult.error.message}. Futtasd a supabase/invitees_schema.sql scriptet.`,
        )
        setIsLoading(false)
        return
      }

      const normalizedGuests = (guestsResult.data || []).map((guest) => ({
        ...guest,
        originalName: guest.name,
      }))
      const normalizedInvitees = (inviteesResult.data || []).map((invitee, index) => ({
        ...invitee,
        label: invitee.label || '',
        invite_round: invitee.invite_round === 'second' ? 'second' : 'first',
        guest_id: invitee.guest_id ? String(invitee.guest_id) : null,
        sort_order: invitee.sort_order ?? index,
        isNew: false,
      }))

      setGuests(normalizedGuests)
      setSavedGuests(cloneList(normalizedGuests))
      setInvitees(normalizedInvitees)
      setSavedInvitees(cloneList(normalizedInvitees))
      setIsLoading(false)
    }

    loadData()
  }, [navigate])

  const guestById = useMemo(() => {
    const map = new Map()
    guests.forEach((guest) => map.set(String(guest.id), guest))
    return map
  }, [guests])

  const linkedGuestIds = useMemo(() => {
    return new Set(
      invitees.map((invitee) => (invitee.guest_id ? String(invitee.guest_id) : null)).filter(Boolean),
    )
  }, [invitees])

  const filteredInvitees = useMemo(() => {
    return invitees.filter((invitee) => {
      if (roundFilter === 'first' && invitee.invite_round !== 'first') {
        return false
      }

      if (appliedLabelFilter.length === 0) {
        return true
      }

      const labelKey = invitee.label || EMPTY_LABEL_FILTER
      return appliedLabelFilter.includes(labelKey)
    })
  }, [invitees, roundFilter, appliedLabelFilter])

  const firstRoundCount = invitees.filter((invitee) => invitee.invite_round === 'first').length

  function openLabelFilter() {
    setDraftLabelFilter([...appliedLabelFilter])
    setIsLabelFilterOpen(true)
  }

  function toggleDraftLabel(labelKey) {
    setDraftLabelFilter((current) =>
      current.includes(labelKey)
        ? current.filter((item) => item !== labelKey)
        : [...current, labelKey],
    )
  }

  function applyLabelFilter() {
    setAppliedLabelFilter([...draftLabelFilter])
    setIsLabelFilterOpen(false)
  }

  function clearLabelFilter() {
    setAppliedLabelFilter([])
    setDraftLabelFilter([])
    setIsLabelFilterOpen(false)
  }

  function switchView(nextView) {
    if (isEditing) {
      const confirmed = window.confirm(
        'Mentetlen módosítások elveszhetnek. Biztosan váltasz nézetet?',
      )
      if (!confirmed) {
        return
      }

      setGuests(cloneList(savedGuests))
      setInvitees(cloneList(savedInvitees))
      setIsEditing(false)
      setStatusMessage('')
    }

    setActiveView(nextView)
  }

  function updateGuestField(guestId, field, value) {
    setGuests((currentGuests) =>
      currentGuests.map((guest) => (guest.id === guestId ? { ...guest, [field]: value } : guest)),
    )
  }

  function updateInviteeField(inviteeId, field, value) {
    setInvitees((current) =>
      current.map((invitee) =>
        invitee.id === inviteeId ? { ...invitee, [field]: value } : invitee,
      ),
    )
  }

  function addInvitee() {
    setInvitees((current) => [
      ...current,
      createInvitee(current.reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1),
    ])
  }

  function removeInvitee(inviteeId) {
    setInvitees((current) => current.filter((invitee) => invitee.id !== inviteeId))
  }

  function discardChanges() {
    setGuests(cloneList(savedGuests))
    setInvitees(cloneList(savedInvitees))
    setIsEditing(false)
    setStatusMessage('')
  }

  async function saveGuestChanges() {
    for (const guest of guests) {
      const guestRow = {
        name: guest.name,
        response: guest.response,
        allergies: guest.allergies || '',
        label: guest.label || null,
      }

      const { error: guestError } = await supabase.from('guests').update(guestRow).eq('id', guest.id)

      if (guestError) {
        return `Nem sikerült menteni a vendéget: ${guestError.message}`
      }

      if (guest.originalName !== guest.name) {
        const [{ error: seatingError }, { error: roomError }] = await Promise.all([
          supabase
            .from('seating_assignments')
            .update({ guest_name: guest.name })
            .eq('guest_name', guest.originalName),
          supabase
            .from('accommodation_assignments')
            .update({ guest_name: guest.name })
            .eq('guest_name', guest.originalName),
        ])

        if (seatingError || roomError) {
          return `A vendég mentve, de a beosztások frissítése nem sikerült: ${
            seatingError?.message || roomError?.message
          }`
        }
      }
    }

    const normalizedGuests = guests.map((guest) => ({ ...guest, originalName: guest.name }))
    setGuests(normalizedGuests)
    setSavedGuests(cloneList(normalizedGuests))
    return null
  }

  async function saveInviteeChanges() {
    const nextInvitees = invitees
      .map((invitee, index) => ({
        ...invitee,
        name: invitee.name.trim(),
        label: invitee.label || null,
        invite_round: invitee.invite_round === 'second' ? 'second' : 'first',
        guest_id: invitee.guest_id ? String(invitee.guest_id) : null,
        sort_order: index,
      }))
      .filter((invitee) => invitee.name || invitee.guest_id)

    const guestIds = nextInvitees.map((invitee) => invitee.guest_id).filter(Boolean)
    if (new Set(guestIds).size !== guestIds.length) {
      return 'Egy visszajelzést csak egy meghívotthoz lehet kötni.'
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('invitees')
      .select('id')

    if (existingError) {
      return `Nem sikerült frissíteni a meghívottakat: ${existingError.message}`
    }

    const existingIds = (existingRows || []).map((row) => row.id)
    const keptIds = nextInvitees.filter((invitee) => !invitee.isNew).map((invitee) => invitee.id)
    const idsToDelete = existingIds.filter((id) => !keptIds.includes(id))

    if (idsToDelete.length) {
      const { error: deleteError } = await supabase.from('invitees').delete().in('id', idsToDelete)
      if (deleteError) {
        return `Nem sikerült törölni a meghívottakat: ${deleteError.message}`
      }
    }

    const savedInviteesNext = []

    for (const invitee of nextInvitees) {
      const payload = {
        name: invitee.name || 'Névtelen meghívott',
        label: invitee.label,
        invite_round: invitee.invite_round,
        guest_id: invitee.guest_id ? Number(invitee.guest_id) : null,
        sort_order: invitee.sort_order,
        updated_at: new Date().toISOString(),
      }

      if (invitee.isNew) {
        const { data, error } = await supabase
          .from('invitees')
          .insert(payload)
          .select('id, name, label, invite_round, guest_id, sort_order')
          .single()

        if (error) {
          return `Nem sikerült létrehozni a meghívottat: ${error.message}`
        }

        savedInviteesNext.push({
          ...data,
          label: data.label || '',
          invite_round: data.invite_round === 'second' ? 'second' : 'first',
          guest_id: data.guest_id ? String(data.guest_id) : null,
          isNew: false,
        })
      } else {
        const { error } = await supabase.from('invitees').update(payload).eq('id', invitee.id)

        if (error) {
          return `Nem sikerült menteni a meghívottat: ${error.message}`
        }

        savedInviteesNext.push({
          ...invitee,
          name: payload.name,
          label: invitee.label || '',
          invite_round: payload.invite_round,
          isNew: false,
        })
      }
    }

    setInvitees(savedInviteesNext)
    setSavedInvitees(cloneList(savedInviteesNext))
    return null
  }

  async function saveChanges() {
    setIsSubmitting(true)
    setStatusMessage('')

    const errorMessage =
      activeView === 'invitees' ? await saveInviteeChanges() : await saveGuestChanges()

    setIsSubmitting(false)

    if (errorMessage) {
      setStatusMessage(errorMessage)
      return
    }

    setIsEditing(false)
    setStatusMessage(
      activeView === 'invitees' ? 'A meghívottak mentve.' : 'A visszajelzések mentve.',
    )
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

  const attendingCount = guests.filter((guest) => guest.response).length
  const declinedCount = guests.filter((guest) => !guest.response).length
  const glutenCount = guests.filter((guest) => hasAllergy(guest, 'gluténérzékeny')).length
  const lactoseCount = guests.filter((guest) => hasAllergy(guest, 'laktózérzékeny')).length
  const otherAllergyCount = guests.filter(hasOtherAllergy).length
  const linkedInviteeCount = invitees.filter((invitee) => invitee.guest_id).length

  return (
    <main className="auth-page">
      <section className="auth-card admin-card">
        <p className="eyebrow">Admin</p>
        <h1>Vendéglista</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <div>
            <div className="admin-view-tabs" role="tablist" aria-label="Vendéglista nézetek">
              <button
                type="button"
                role="tab"
                className={activeView === 'invitees' ? 'is-active' : ''}
                aria-selected={activeView === 'invitees'}
                onClick={() => switchView('invitees')}
              >
                Meghívottak
              </button>
              <button
                type="button"
                role="tab"
                className={activeView === 'responses' ? 'is-active' : ''}
                aria-selected={activeView === 'responses'}
                onClick={() => switchView('responses')}
              >
                Visszajelzettek
              </button>
            </div>

            {activeView === 'invitees' ? (
              <>
                <p className="admin-summary">
                  Összes meghívott: <strong>{invitees.length}</strong>
                  {filteredInvitees.length !== invitees.length && (
                    <>
                      {' · '}
                      Megjelenítve: <strong>{filteredInvitees.length}</strong>
                    </>
                  )}
                </p>

                <div className="admin-stats">
                  <article>
                    <span>{invitees.length}</span>
                    <p>Összes meghívott</p>
                  </article>
                  <article>
                    <span>{firstRoundCount}</span>
                    <p>Elsőkörös</p>
                  </article>
                  <article>
                    <span>{invitees.length - firstRoundCount}</span>
                    <p>Második körös</p>
                  </article>
                  <article>
                    <span>{linkedInviteeCount}</span>
                    <p>Összekötve</p>
                  </article>
                </div>

                <div className="admin-filter-bar">
                  <label className="admin-filter-select">
                    Kör
                    <select
                      value={roundFilter}
                      onChange={(event) => setRoundFilter(event.target.value)}
                    >
                      <option value="all">Minden meghívott</option>
                      <option value="first">Csak elsőkörös</option>
                    </select>
                  </label>

                  <div className="admin-filter-control">
                    <button
                      type="button"
                      className="admin-filter-trigger"
                      aria-expanded={isLabelFilterOpen}
                      onClick={() =>
                        isLabelFilterOpen ? setIsLabelFilterOpen(false) : openLabelFilter()
                      }
                    >
                      {appliedLabelFilter.length === 0
                        ? 'Szűrés kategória szerint'
                        : `Szűrve: ${appliedLabelFilter.length} kategória`}
                    </button>

                    {isLabelFilterOpen && (
                      <div
                        className="admin-filter-dropdown"
                        role="dialog"
                        aria-label="Kategória szűrő"
                      >
                        <p>Válassz egy vagy több kategóriát, majd OK.</p>
                        <div className="admin-filter-options">
                          {guestLabels.map((label) => {
                            const labelKey = label || EMPTY_LABEL_FILTER
                            const checked = draftLabelFilter.includes(labelKey)

                            return (
                              <label key={labelKey}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleDraftLabel(labelKey)}
                                />
                                <span>{label || 'Nincs kategória'}</span>
                              </label>
                            )
                          })}
                        </div>
                        <div className="admin-filter-actions">
                          <button type="button" onClick={applyLabelFilter}>
                            OK
                          </button>
                          <button type="button" onClick={clearLabelFilter}>
                            Összes
                          </button>
                          <button type="button" onClick={() => setIsLabelFilterOpen(false)}>
                            Mégse
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="admin-summary">
                  Összes visszajelzett vendég: <strong>{guests.length}</strong>
                </p>

                <div className="admin-stats">
                  <article>
                    <span>{attendingCount}</span>
                    <p>Jönnek</p>
                  </article>
                  <article>
                    <span>{declinedCount}</span>
                    <p>Nem jönnek</p>
                  </article>
                  <article>
                    <span>{glutenCount}</span>
                    <p>Gluténérzékeny</p>
                  </article>
                  <article>
                    <span>{lactoseCount}</span>
                    <p>Laktózérzékeny</p>
                  </article>
                  <article>
                    <span>{otherAllergyCount}</span>
                    <p>Egyéb allergia</p>
                  </article>
                </div>
              </>
            )}

            <div className="admin-actions">
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)}>
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
                  {activeView === 'invitees' && (
                    <button type="button" onClick={addInvitee} disabled={isSubmitting}>
                      Meghívott hozzáadása
                    </button>
                  )}
                </>
              )}
            </div>

            {activeView === 'invitees' ? (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Név</th>
                      <th>Kategória</th>
                      <th>Kör</th>
                      <th>Kapcsolt visszajelzés</th>
                      {isEditing && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvitees.length === 0 ? (
                      <tr>
                        <td colSpan={isEditing ? 5 : 4}>
                          {invitees.length === 0
                            ? 'Még nincs meghívott. Szerkesztés után add hozzá őket.'
                            : 'Nincs a szűrésnek megfelelő meghívott.'}
                        </td>
                      </tr>
                    ) : (
                      filteredInvitees.map((invitee) => {
                        const linkedGuest = invitee.guest_id
                          ? guestById.get(String(invitee.guest_id))
                          : null
                        const availableGuests = guests.filter(
                          (guest) =>
                            String(guest.id) === String(invitee.guest_id) ||
                            !linkedGuestIds.has(String(guest.id)),
                        )

                        return (
                          <tr key={invitee.id}>
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={invitee.name}
                                  onChange={(event) =>
                                    updateInviteeField(invitee.id, 'name', event.target.value)
                                  }
                                  placeholder="Meghívott neve"
                                />
                              ) : (
                                invitee.name || 'Névtelen meghívott'
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  value={invitee.label || ''}
                                  onChange={(event) =>
                                    updateInviteeField(invitee.id, 'label', event.target.value)
                                  }
                                >
                                  {guestLabels.map((label) => (
                                    <option value={label} key={label || 'empty-label'}>
                                      {label || 'Nincs kategória'}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                invitee.label || 'Nincs kategória'
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  value={invitee.invite_round || 'first'}
                                  onChange={(event) =>
                                    updateInviteeField(
                                      invitee.id,
                                      'invite_round',
                                      event.target.value,
                                    )
                                  }
                                >
                                  {inviteRoundOptions.map((option) => (
                                    <option value={option.value} key={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                getInviteRoundLabel(invitee.invite_round)
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  value={invitee.guest_id || ''}
                                  onChange={(event) =>
                                    updateInviteeField(
                                      invitee.id,
                                      'guest_id',
                                      event.target.value || null,
                                    )
                                  }
                                >
                                  <option value="">Nincs összekötve</option>
                                  {availableGuests.map((guest) => (
                                    <option value={guest.id} key={guest.id}>
                                      {guest.name}
                                      {guest.response ? '' : ' (nem jön)'}
                                    </option>
                                  ))}
                                </select>
                              ) : linkedGuest ? (
                                `${linkedGuest.name}${
                                  linkedGuest.response ? '' : ' (nem jön)'
                                }`
                              ) : (
                                'Nincs összekötve'
                              )}
                            </td>
                            {isEditing && (
                              <td>
                                <button type="button" onClick={() => removeInvitee(invitee.id)}>
                                  Törlés
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Név</th>
                      <th>Válasz</th>
                      <th>Allergiák</th>
                      <th>Kategória</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.length === 0 ? (
                      <tr>
                        <td colSpan="4">Még nincs RSVP válasz.</td>
                      </tr>
                    ) : (
                      guests.map((guest) => (
                        <tr key={guest.id}>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={guest.name}
                                onChange={(event) =>
                                  updateGuestField(guest.id, 'name', event.target.value)
                                }
                              />
                            ) : (
                              guest.name
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select
                                value={guest.response ? 'yes' : 'no'}
                                onChange={(event) =>
                                  updateGuestField(
                                    guest.id,
                                    'response',
                                    event.target.value === 'yes',
                                  )
                                }
                              >
                                <option value="yes">Ott lesz</option>
                                <option value="no">Nem vesz részt</option>
                              </select>
                            ) : guest.response ? (
                              'Ott lesz'
                            ) : (
                              'Nem vesz részt'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                value={guest.allergies || ''}
                                onChange={(event) =>
                                  updateGuestField(guest.id, 'allergies', event.target.value)
                                }
                                placeholder="Nincs megadva"
                              />
                            ) : (
                              guest.allergies || 'Nincs megadva'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select
                                value={guest.label || ''}
                                onChange={(event) =>
                                  updateGuestField(guest.id, 'label', event.target.value)
                                }
                              >
                                {guestLabels.map((label) => (
                                  <option value={label} key={label || 'empty-label'}>
                                    {label || 'Nincs kategória'}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              guest.label || 'Nincs kategória'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <Link className="text-link" to="/">
          Vissza a főoldalra
        </Link>
      </section>
    </main>
  )
}
