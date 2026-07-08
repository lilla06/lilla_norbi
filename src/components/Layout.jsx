import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function getUserName(user) {
  return user?.user_metadata?.name || user?.email || ''
}

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

export default function Layout({ children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession()

      setUser(data.session?.user || null)
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
      },
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  function closeMenu() {
    setIsMenuOpen(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    closeMenu()
    window.location.href = '/'
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Lilla és Norbi főoldal">
          <span>Lilla & Norbi</span>
          <small>2027. június 5.</small>
        </a>

        <div className="header-actions">
          {user && (
            <div className="user-chip" aria-label={`Bejelentkezve: ${getUserName(user)}`}>
              <span className="user-icon" aria-hidden="true" />
              <span>{getUserName(user)}</span>
            </div>
          )}

          <button
            className="menu-toggle"
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="main-menu"
            aria-label="Menü megnyitása"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav
          id="main-menu"
          className={`main-menu ${isMenuOpen ? 'is-open' : ''}`}
          aria-label="Fő navigáció"
        >
          {user ? (
            <button type="button" onClick={handleSignOut}>Kijelentkezés</button>
          ) : (
            <a href="/login" onClick={closeMenu}>Bejelentkezés / regisztráció</a>
          )}
          <a href="/rsvp" onClick={closeMenu}>RSVP</a>
          {isAdmin(user) && <a href="/admin" onClick={closeMenu}>Admin vendéglista</a>}
          {isAdmin(user) && <a href="/admin/schedule" onClick={closeMenu}>Admin menetrend</a>}
          {isAdmin(user) && <a href="/admin/seating" onClick={closeMenu}>Admin ülésrend</a>}
          <a href="/#important-info" onClick={closeMenu}>Fontos információk</a>
          <a href="/#dress-code" onClick={closeMenu}>Dress code</a>
        </nav>
      </header>

      {children}

      <footer className="site-footer">
        <p>Kapcsolat</p>
        <a href="mailto:lilla@example.com">lilla@example.com</a>
        <a href="mailto:norbi@example.com">norbi@example.com</a>
      </footer>
    </>
  )
}
