import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AdminBudgetPage from './pages/AdminBudgetPage'
import AdminPage from './pages/AdminPage'
import AdminRoomsPage from './pages/AdminRoomsPage'
import AdminSchedulePage from './pages/AdminSchedulePage'
import AdminSeatingPage from './pages/AdminSeatingPage'
import AdminTaskDetailPage from './pages/AdminTaskDetailPage'
import AdminTasksPage from './pages/AdminTasksPage'
import AdminWishlistItemPage from './pages/AdminWishlistItemPage'
import AdminWishlistPage from './pages/AdminWishlistPage'
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
        <Route path="/admin/budget" element={<AdminBudgetPage />} />
        <Route path="/admin/tasks" element={<AdminTasksPage />} />
        <Route path="/admin/tasks/:taskId" element={<AdminTaskDetailPage />} />
        <Route path="/admin/wishlist" element={<AdminWishlistPage />} />
        <Route path="/admin/wishlist/:materialId" element={<AdminWishlistItemPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Layout>
  )
}

export default App