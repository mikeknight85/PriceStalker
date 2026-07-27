import { useRouterState } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import AuthForm from '../components/AuthForm';
import { postAuthDestination } from '../utils/postAuthDestination';

export default function Register() {
  const { register } = useAuth();
  const location = useRouterState({ select: (state) => state.location });

  const handleRegister = async (email: string, password: string) => {
    await register(email, password);
    
    window.location.replace(postAuthDestination(location.searchStr));
  };

  return <AuthForm mode="register" onSubmit={handleRegister} />;
}
