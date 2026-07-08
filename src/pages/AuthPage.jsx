import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [resetEmail, setResetEmail] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetSubmitting, setIsResetSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatusMessage('')
    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült a belépés: ${error.message}`)
      return
    }

    navigate(data.user?.app_metadata?.role === 'admin' ? '/admin' : '/rsvp')
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setResetMessage('')
    setIsResetSubmitting(true)

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}profile`
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo,
    })

    setIsResetSubmitting(false)

    if (error) {
      setResetMessage(`Nem sikerült elküldeni a visszaállító emailt: ${error.message}`)
      return
    }

    setResetMessage('Elküldtük a jelszó-visszaállító emailt, kérlek nézd meg a postafiókodat.')
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Vendégkapu</p>
        <h1>Bejelentkezés</h1>
        <p className="auth-intro">
          Lépj be, hogy később elérhesd az RSVP-t és a vendégeknek szóló
          részleteket.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email cím</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <label htmlFor="password">Jelszó</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Jelszó"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Belépés...' : 'Belépek'}
          </button>
        </form>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        <form className="auth-form password-reset-card" onSubmit={handleResetPassword}>
          <h2>Elfelejtett jelszó</h2>
          <p>
            Add meg az email címedet, és küldünk egy linket, amivel a profil oldalon
            új jelszót adhatsz meg.
          </p>
          <label htmlFor="reset-email">Email cím</label>
          <input
            id="reset-email"
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            required
          />
          <button type="submit" disabled={isResetSubmitting}>
            {isResetSubmitting ? 'Küldés...' : 'Jelszó-visszaállító email küldése'}
          </button>
        </form>

        {resetMessage && <p className="form-message">{resetMessage}</p>}

        <p className="auth-switch">
          Még nem jártál itt? <Link to="/register">Regisztrálj</Link>
        </p>

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
