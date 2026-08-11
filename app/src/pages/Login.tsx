import { useNavigate, useLocation } from 'react-router-dom'
import AuthModal from '../components/AuthModal'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname === '/signup' ? 'signup' : 'login'

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <AuthModal isOpen onClose={() => navigate('/')} defaultMode={mode} />
    </div>
  )
}
