import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const allergyOptions = ['gluténérzékeny', 'laktózérzékeny', 'egyéb']

function createGuest(name = '', allergiesText = '') {
  const allergyList = allergiesText
    .split(',')
    .map((allergy) => allergy.trim())
    .filter(Boolean)
  const knownAllergies = allergyList.filter((allergy) =>
    allergyOptions.includes(allergy),
  )
  const otherAllergies = allergyList.filter(
    (allergy) => !allergyOptions.includes(allergy),
  )

  return {
    name,
    allergies: otherAllergies.length > 0 ? [...knownAllergies, 'egyéb'] : knownAllergies,
    otherAllergy: otherAllergies.join(', '),
  }
}

function formatAllergies(guest) {
  return guest.allergies
    .map((allergy) => {
      if (allergy === 'egyéb') {
        return guest.otherAllergy.trim()
      }

      return allergy
    })
    .filter(Boolean)
    .join(', ')
}

export default function RsvpPage() {
  const [currentUser, setCurrentUser] = useState(null)
  const [response, setResponse] = useState('')
  const [guestCount, setGuestCount] = useState(1)
  const [guests, setGuests] = useState([createGuest()])
  const [hasResponded, setHasResponded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    async function loadRsvp() {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        window.location.href = '/login'
        return
      }

      const userName = user.user_metadata?.name || user.email || ''

      setCurrentUser(user)
      setGuests([createGuest(userName)])

      const { data } = await supabase
        .from('guests')
        .select('name, response, allergies')
        .eq('user_id', user.id)

      if (data?.length > 0) {
        const isAttending = data.some((guest) => guest.response)

        setHasResponded(true)
        setIsEditing(false)
        setResponse(isAttending ? 'yes' : 'no')
        setGuestCount(isAttending ? data.length : 1)
        setGuests(
          isAttending
            ? data.map((guest) => createGuest(guest.name, guest.allergies || ''))
            : [createGuest(userName)],
        )
      } else {
        setIsEditing(true)
      }

      setIsLoading(false)
    }

    loadRsvp()
  }, [])

  function handleResponseChange(nextResponse) {
    setResponse(nextResponse)
    setStatusMessage('')

    if (nextResponse === 'no') {
      setGuestCount(1)
      setGuests([createGuest(currentUser?.user_metadata?.name || currentUser?.email || '')])
    }
  }

  function handleGuestCountChange(event) {
    const nextCount = Number(event.target.value)

    setGuestCount(nextCount)
    setGuests((currentGuests) => {
      const nextGuests = [...currentGuests]

      while (nextGuests.length < nextCount) {
        nextGuests.push(createGuest())
      }

      return nextGuests.slice(0, nextCount)
    })
  }

  function updateGuest(index, field, value) {
    setGuests((currentGuests) =>
      currentGuests.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, [field]: value } : guest,
      ),
    )
  }

  function toggleAllergy(index, allergy) {
    setGuests((currentGuests) =>
      currentGuests.map((guest, guestIndex) => {
        if (guestIndex !== index) {
          return guest
        }

        const allergies = guest.allergies.includes(allergy)
          ? guest.allergies.filter((currentAllergy) => currentAllergy !== allergy)
          : [...guest.allergies, allergy]

        return { ...guest, allergies }
      }),
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatusMessage('')

    if (!response) {
      setStatusMessage('Kérlek válaszd ki, hogy részt tudsz-e venni.')
      return
    }

    if (!currentUser) {
      setStatusMessage('A beküldéshez be kell jelentkezned.')
      return
    }

    const attending = response === 'yes'
    const guestsToSave = attending ? guests : [guests[0]]

    if (guestsToSave.some((guest) => !guest.name.trim())) {
      setStatusMessage('Kérlek add meg minden vendég nevét.')
      return
    }

    setIsSubmitting(true)

    const { error: deleteError } = await supabase
      .from('guests')
      .delete()
      .eq('user_id', currentUser.id)

    if (deleteError) {
      setIsSubmitting(false)
      setStatusMessage(`Nem sikerült módosítani a korábbi választ: ${deleteError.message}`)
      return
    }

    const rows = guestsToSave.map((guest) => ({
      user_id: currentUser.id,
      name: guest.name.trim(),
      response: attending,
      allergies: attending ? formatAllergies(guest) : '',
    }))

    const { error } = await supabase.from('guests').insert(rows)

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült menteni az RSVP választ: ${error.message}`)
      return
    }

    setHasResponded(true)
    setIsEditing(false)
    setStatusMessage('Köszönjük, hogy visszajeleztél.')
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">RSVP</p>
          <h1>Betöltés...</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page rsvp-page">
      <section className="auth-card rsvp-card">
        <p className="eyebrow">Visszajelzés</p>
        <h1>RSVP</h1>

        {hasResponded && !isEditing ? (
          <div className="rsvp-summary">
            <p className="form-message">Már válaszoltál. Köszönjük, hogy visszajeleztél.</p>
            <button type="button" onClick={() => setIsEditing(true)}>
              Válasz módosítása
            </button>
          </div>
        ) : (
          <form className="auth-form rsvp-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>Részt tudsz venni az esküvőn?</legend>
              <label className="choice-card">
                <input
                  type="radio"
                  name="response"
                  checked={response === 'yes'}
                  onChange={() => handleResponseChange('yes')}
                />
                Ott leszek
              </label>
              <label className="choice-card">
                <input
                  type="radio"
                  name="response"
                  checked={response === 'no'}
                  onChange={() => handleResponseChange('no')}
                />
                Sajnos nem tudok részt venni az esküvőn
              </label>
            </fieldset>

            {response === 'yes' && (
              <>
                <label htmlFor="guest-count">Hányan érkeztek?</label>
                <input
                  id="guest-count"
                  type="number"
                  min="1"
                  max="10"
                  value={guestCount}
                  onChange={handleGuestCountChange}
                />

                <div className="guest-list">
                  {guests.map((guest, index) => (
                    <fieldset className="guest-card" key={`guest-${index + 1}`}>
                      <legend>{index + 1}. vendég</legend>

                      <label htmlFor={`guest-name-${index}`}>Név</label>
                      <input
                        id={`guest-name-${index}`}
                        type="text"
                        value={guest.name}
                        onChange={(event) => updateGuest(index, 'name', event.target.value)}
                        required
                      />

                      <p>Ételallergia</p>
                      <div className="allergy-options">
                        {allergyOptions.map((allergy) => (
                          <label key={allergy} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={guest.allergies.includes(allergy)}
                              onChange={() => toggleAllergy(index, allergy)}
                            />
                            {allergy}
                          </label>
                        ))}
                      </div>

                      {guest.allergies.includes('egyéb') && (
                        <input
                          type="text"
                          placeholder="Egyéb allergia"
                          value={guest.otherAllergy}
                          onChange={(event) =>
                            updateGuest(index, 'otherAllergy', event.target.value)
                          }
                        />
                      )}
                    </fieldset>
                  ))}
                </div>
              </>
            )}

            {statusMessage && <p className="form-message">{statusMessage}</p>}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Beküldés...' : 'Beküldés'}
            </button>
          </form>
        )}

        <a className="text-link" href="/">Vissza a főoldalra</a>
      </section>
    </main>
  )
}
