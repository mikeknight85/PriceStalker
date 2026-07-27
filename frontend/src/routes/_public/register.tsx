import { createFileRoute } from '@tanstack/react-router';
import Register from '../../pages/Register';

export const Route = createFileRoute('/_public/register')({
  validateSearch: (search): { redirect?: string } => ({ redirect: typeof search.redirect === 'string' ? search.redirect : undefined }),
  component: Register,
});
