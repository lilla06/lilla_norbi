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
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        navigate('/login')
        return
      }

      setUser(data.user)
      setIsLoading(false)
    }

    loadUser()
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
        <h1>Saját profil</h1>
        <p className="auth-intro">
          Bejelentkezve: <strong>{getUserName(user)}</strong>
        </p>

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
            {isSubmitting ? 'Mentés...' : 'Jelszó módosítása'}
          </button>
        </form>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
