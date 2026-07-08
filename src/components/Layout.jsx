import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getUserName(user) {
  return user?.user_metadata?.name || user?.email || ''
}

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin'
}

export default function Layout({ children }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

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

  useEffect(() => {
    if (!location.hash) {
      return
    }

    requestAnimationFrame(() => {
      document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [location])

  function closeMenu() {
    setIsMenuOpen(false)
    setIsAdminMenuOpen(false)
  }

  function navigateFromMenu(path) {
    closeMenu()
    navigate(path)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    closeMenu()
    navigate('/')
  }

  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Lilla és Norbi főoldal">
          <span>Lilla & Norbi</span>
          <small>2027. június 5.</small>
        </Link>

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
            <>
              <Link to="/profile" onClick={closeMenu}>Profil</Link>
              <button type="button" onClick={handleSignOut}>Kijelentkezés</button>
            </>
          ) : (
            <Link to="/login" onClick={closeMenu}>Bejelentkezés / regisztráció</Link>
          )}
          <Link to="/rsvp" onClick={closeMenu}>RSVP</Link>
          {isAdmin(user) && (
            <div className="menu-group">
              <button
                type="button"
                aria-expanded={isAdminMenuOpen}
                aria-controls="admin-submenu"
                onClick={() => setIsAdminMenuOpen((current) => !current)}
              >
                Admin oldalak
              </button>
              <div
                id="admin-submenu"
                className={`submenu ${isAdminMenuOpen ? 'is-open' : ''}`}
              >
                <button type="button" onClick={() => navigateFromMenu('/admin')}>Vendéglista</button>
                <button type="button" onClick={() => navigateFromMenu('/admin/rooms')}>
                  Szobabeosztás
                </button>
                <button type="button" onClick={() => navigateFromMenu('/admin/schedule')}>
                  Menetrend
                </button>
                <button type="button" onClick={() => navigateFromMenu('/admin/seating')}>
                  Ülésrend
                </button>
              </div>
            </div>
          )}
          <Link to="/#important-info" onClick={closeMenu}>Fontos információk</Link>
          <Link to="/#dress-code" onClick={closeMenu}>Dress code</Link>
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
