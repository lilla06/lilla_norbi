import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [resetEmail, setResetEmail] = useState('')
  const [newPasswordData, setNewPasswordData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetSubmitting, setIsResetSubmitting] = useState(false)
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setStatusMessage('')
        setResetMessage('Add meg az új jelszavadat.')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleNewPasswordChange(event) {
    const { name, value } = event.target

    setNewPasswordData((current) => ({
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

    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}login`
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

  async function handleUpdatePassword(event) {
    event.preventDefault()
    setResetMessage('')

    if (newPasswordData.password !== newPasswordData.confirmPassword) {
      setResetMessage('A két jelszó nem egyezik.')
      return
    }

    setIsPasswordSubmitting(true)

    const { error } = await supabase.auth.updateUser({
      password: newPasswordData.password,
    })

    setIsPasswordSubmitting(false)

    if (error) {
      setResetMessage(`Nem sikerült frissíteni a jelszót: ${error.message}`)
      return
    }

    setNewPasswordData({
      password: '',
      confirmPassword: '',
    })
    setIsPasswordRecovery(false)
    setResetMessage('Az új jelszó mentve. Most már be tudsz lépni vele.')
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

        {isPasswordRecovery ? (
          <form className="auth-form password-reset-card" onSubmit={handleUpdatePassword}>
            <h2>Új jelszó megadása</h2>
            <label htmlFor="new-password">Új jelszó</label>
            <input
              id="new-password"
              name="password"
              type="password"
              placeholder="Új jelszó"
              autoComplete="new-password"
              value={newPasswordData.password}
              onChange={handleNewPasswordChange}
              required
            />

            <label htmlFor="confirm-new-password">Új jelszó újra</label>
            <input
              id="confirm-new-password"
              name="confirmPassword"
              type="password"
              placeholder="Új jelszó újra"
              autoComplete="new-password"
              value={newPasswordData.confirmPassword}
              onChange={handleNewPasswordChange}
              required
            />

            <button type="submit" disabled={isPasswordSubmitting}>
              {isPasswordSubmitting ? 'Mentés...' : 'Új jelszó mentése'}
            </button>
          </form>
        ) : (
          <form className="auth-form password-reset-card" onSubmit={handleResetPassword}>
            <h2>Elfelejtett jelszó</h2>
            <p>Add meg az email címedet, és küldünk egy jelszó-visszaállító linket.</p>
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
        )}

        {resetMessage && <p className="form-message">{resetMessage}</p>}

        <p className="auth-switch">
          Még nem jártál itt? <Link to="/register">Regisztrálj</Link>
        </p>

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
