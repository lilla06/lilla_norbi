import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getUserName(user) {
  return user?.user_metadata?.name || user?.email || ''
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setUser(session?.user || null)
        setIsPasswordRecovery(true)
        setStatusMessage('A folytatáshoz adj meg egy új jelszót.')
        setIsLoading(false)
      }
    })

    async function loadUser() {
      const { data } = await supabase.auth.getUser()
      const isRecoveryUrl =
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery')

      if (!data.user) {
        if (isRecoveryUrl) {
          setIsPasswordRecovery(true)
          setStatusMessage('A folytatáshoz adj meg egy új jelszót.')
          setIsLoading(false)
          return
        }

        navigate('/login')
        return
      }

      setUser(data.user)
      setIsPasswordRecovery(isRecoveryUrl)
      if (isRecoveryUrl) {
        setStatusMessage('A folytatáshoz adj meg egy új jelszót.')
      }
      setIsLoading(false)
    }

    loadUser()

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [navigate])

  function handleChange(event) {
    const { name, value } = event.target

    setPasswordData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatusMessage('')

    if (passwordData.password !== passwordData.confirmPassword) {
      setStatusMessage('A két jelszó nem egyezik.')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.updateUser({
      password: passwordData.password,
    })

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült módosítani a jelszót: ${error.message}`)
      return
    }

    setPasswordData({
      password: '',
      confirmPassword: '',
    })
    setIsPasswordRecovery(false)
    setStatusMessage('A jelszavad sikeresen módosítva.')
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">Profil</p>
          <h1>Betöltés...</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Profil</p>
        <h1>{isPasswordRecovery ? 'Új jelszó megadása' : 'Saját profil'}</h1>
        {isPasswordRecovery ? (
          <p className="auth-intro">
            A jelszó-visszaállítás befejezéséhez kötelező új jelszót megadnod.
          </p>
        ) : (
          <p className="auth-intro">
            Bejelentkezve: <strong>{getUserName(user)}</strong>
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="profile-password">Új jelszó</label>
          <input
            id="profile-password"
            name="password"
            type="password"
            placeholder="Új jelszó"
            autoComplete="new-password"
            value={passwordData.password}
            onChange={handleChange}
            required
          />

          <label htmlFor="profile-confirm-password">Új jelszó újra</label>
          <input
            id="profile-confirm-password"
            name="confirmPassword"
            type="password"
            placeholder="Új jelszó újra"
            autoComplete="new-password"
            value={passwordData.confirmPassword}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Mentés...'
              : isPasswordRecovery
                ? 'Új jelszó mentése'
                : 'Jelszó módosítása'}
          </button>
        </form>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        {!isPasswordRecovery && <Link className="text-link" to="/">Vissza a főoldalra</Link>}
      </section>
    </main>
  )
}
