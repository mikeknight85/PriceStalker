import { createFileRoute } from '@tanstack/react-router';
import Admin from '../pages/Admin';
import { ProtectedRoute } from './-guards';
const sections = ['system', 'selectors', 'retailers', 'users', 'ai', 'logs', 'tokens', 'auth'] as const;

export const Route = createFileRoute('/admin')({
  validateSearch: (search): { tab?: (typeof sections)[number] } => ({ tab: typeof search.tab === 'string' && sections.includes(search.tab as (typeof sections)[number]) ? search.tab as (typeof sections)[number] : undefined }),
  component: () => <ProtectedRoute><Admin /></ProtectedRoute>,
});
