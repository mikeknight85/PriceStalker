import { createFileRoute } from '@tanstack/react-router';
import ResetPassword from '../../pages/ResetPassword';

export const Route = createFileRoute('/_public/reset-password')({
  validateSearch: (search): { token?: string } => ({ token: typeof search.token === 'string' ? search.token : undefined }),
  component: ResetPassword,
});
