import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthForm from '../components/AuthForm';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    
    // Parse redirect query parameter if it exists
    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get('redirect');
    
    // Fallback to location state from React Router (pathname + search + hash)
    const from = location.state?.from;
    let fromPath = redirectParam 
      ? decodeURIComponent(redirectParam) 
      : from 
        ? `${from.pathname}${from.search}${from.hash}` 
        : '/?tab=products';
        
    if (fromPath === '/') {
      fromPath = '/?tab=products';
    }
        
    navigate(fromPath, { replace: true });
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
