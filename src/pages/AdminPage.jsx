import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const guestLabels = [
  '',
  'Lilla család',
  'Lilla barát',
  'Közös barát',
  'Norbi barát',
  'Norbi család',
]

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

export default function AdminPage() {
  const [guests, setGuests] = useState([])
  const [savedGuests, setSavedGuests] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    async function loadGuests() {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        window.location.href = '/login'
        return
      }

      if (!isAdmin(user)) {
        setStatusMessage('Ehhez az oldalhoz admin jogosultság szükséges.')
        setIsLoading(false)
        return
      }

      setHasAccess(true)

      const { data, error } = await supabase
        .from('guests')
        .select('id, name, response, allergies, label')
        .order('name')

      if (error) {
        setStatusMessage(`Nem sikerült betölteni a vendéglistát: ${error.message}`)
      } else {
        const normalizedGuests = (data || []).map((guest) => ({ ...guest, originalName: guest.name }))
        setGuests(normalizedGuests)
        setSavedGuests(normalizedGuests)
      }

      setIsLoading(false)
    }

    loadGuests()
  }, [])

  function updateGuestField(guestId, field, value) {
    setGuests((currentGuests) =>
      currentGuests.map((guest) => (guest.id === guestId ? { ...guest, [field]: value } : guest)),
    )
  }

  function discardChanges() {
    setGuests(savedGuests)
    setIsEditing(false)
    setStatusMessage('')
  }

  async function saveChanges() {
    setIsSubmitting(true)
    setStatusMessage('')

    for (const guest of guests) {
      const guestRow = {
        name: guest.name,
        response: guest.response,
        allergies: guest.allergies || '',
        label: guest.label || null,
      }

      const { error: guestError } = await supabase.from('guests').update(guestRow).eq('id', guest.id)

      if (guestError) {
        setStatusMessage(`Nem sikerült menteni a vendéget: ${guestError.message}`)
        setIsSubmitting(false)
        return
      }

      if (guest.originalName !== guest.name) {
        const { error: seatingError } = await supabase
          .from('seating_assignments')
          .update({ guest_name: guest.name })
          .eq('guest_name', guest.originalName)

        if (seatingError) {
          setStatusMessage(
            `A vendég mentve, de az ülésrend frissítése nem sikerült: ${seatingError.message}`,
          )
          setIsSubmitting(false)
          return
        }
      }
    }

    const normalizedGuests = guests.map((guest) => ({ ...guest, originalName: guest.name }))
    setGuests(normalizedGuests)
    setSavedGuests(normalizedGuests)
    setIsSubmitting(false)
    setIsEditing(false)
    setStatusMessage('A vendéglista mentve.')
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

  return (
    <main className="auth-page">
      <section className="auth-card admin-card">
        <p className="eyebrow">Admin</p>
        <h1>Vendéglista</h1>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {hasAccess && (
          <div>
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
                </>
              )}
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Név</th>
                    <th>Válasz</th>
                    <th>Allergiák</th>
                    <th>Label</th>
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
                                updateGuestField(guest.id, 'response', event.target.value === 'yes')
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
                                  {label || 'Nincs label'}
                                </option>
                              ))}
                            </select>
                          ) : (
                            guest.label || 'Nincs label'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <a className="text-link" href="/">Vissza a főoldalra</a>
      </section>
    </main>
  )
}
