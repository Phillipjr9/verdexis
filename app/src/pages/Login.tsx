import { useNavigate, useLocation } from 'react-router-dom'
import AuthModal from '../components/AuthModal'
import { getToken } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname === '/signup' ? 'signup' : 'login'

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <AuthModal
        isOpen
        onClose={() => {
          // If auth already succeeded, AuthModal handles navigation itself.
          if (getToken()) return
          navigate('/', { replace: true })
        }}
        defaultMode={mode}
      />
    </div>
  )
}
