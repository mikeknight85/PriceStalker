import { useRouterState } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import AuthForm from '../components/AuthForm';
import { postAuthDestination } from '../utils/postAuthDestination';

export default function Login() {
  const { login } = useAuth();
  const location = useRouterState({ select: (state) => state.location });

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    
    window.location.replace(postAuthDestination(location.searchStr));
  };

  return <AuthForm mode="login" onSubmit={handleLogin} />;
}
