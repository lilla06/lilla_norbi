import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült a belépés: ${error.message}`)
      return
    }

    window.location.href = '/rsvp'
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

        <p className="auth-switch">
          Még nem jártál itt? <a href="/register">Regisztrálj</a>
        </p>

        <a className="text-link" href="/">Vissza a főoldalra</a>
      </section>
    </main>
  )
}
