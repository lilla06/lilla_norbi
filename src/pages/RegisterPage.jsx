import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    if (formData.password !== formData.confirmPassword) {
      setStatusMessage('A két jelszó nem egyezik.')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
        },
      },
    })

    setIsSubmitting(false)

    if (error) {
      setStatusMessage(`Nem sikerült a regisztráció: ${error.message}`)
      return
    }

    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    })
    setStatusMessage(
      'Sikeres regisztráció. Ha email megerősítés be van kapcsolva, nézd meg a postafiókodat.',
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Vendégkapu</p>
        <h1>Regisztráció</h1>
        <p className="auth-intro">
          Hozz létre egy fiókot, hogy később egyszerűen visszatérhess az
          esküvői információkhoz.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Név</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Teljes neved"
            autoComplete="name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <label htmlFor="register-email">Email cím</label>
          <input
            id="register-email"
            name="email"
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <label htmlFor="register-password">Jelszó</label>
          <input
            id="register-password"
            name="password"
            type="password"
            placeholder="Jelszó"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <label htmlFor="confirm-password">Jelszó újra</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            placeholder="Jelszó újra"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Mentés...' : 'Regisztrálok'}
          </button>
        </form>

        {statusMessage && <p className="form-message">{statusMessage}</p>}

        <p className="auth-switch">
          Már regisztráltál? <Link to="/login">Lépj be</Link>
        </p>

        <Link className="text-link" to="/">Vissza a főoldalra</Link>
      </section>
    </main>
  )
}
