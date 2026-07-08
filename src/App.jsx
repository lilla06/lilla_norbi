import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import AdminRoomsPage from './pages/AdminRoomsPage'
import AdminSchedulePage from './pages/AdminSchedulePage'
import AdminSeatingPage from './pages/AdminSeatingPage'
import AuthPage from './pages/AuthPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import RsvpPage from './pages/RsvpPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/rsvp" element={<RsvpPage />} />
        <Route path="/rooms" element={<AdminRoomsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/rooms" element={<AdminRoomsPage />} />
        <Route path="/admin/schedule" element={<AdminSchedulePage />} />
        <Route path="/admin/seating" element={<AdminSeatingPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Layout>
  )
}

export default App