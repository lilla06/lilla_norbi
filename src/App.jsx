import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import AdminSchedulePage from './pages/AdminSchedulePage'
import AdminSeatingPage from './pages/AdminSeatingPage'
import AuthPage from './pages/AuthPage'
import RegisterPage from './pages/RegisterPage'
import RsvpPage from './pages/RsvpPage'

function App() {
  const path = window.location.pathname
  let page = <HomePage />

  if (path === '/login') {
    page = <AuthPage />
  }

  if (path === '/register') {
    page = <RegisterPage />
  }

  if (path === '/rsvp') {
    page = <RsvpPage />
  }

  if (path === '/admin') {
    page = <AdminPage />
  }

  if (path === '/admin/schedule') {
    page = <AdminSchedulePage />
  }

  if (path === '/admin/seating') {
    page = <AdminSeatingPage />
  }

  return <Layout>{page}</Layout>
}

export default App