import { createFileRoute } from '@tanstack/react-router';
import Settings from '../pages/Settings';
import { ProtectedRoute } from './-guards';
const sections = ['profile', 'regional', 'notifications', 'security'] as const;

export const Route = createFileRoute('/settings')({
  validateSearch: (search): { tab?: (typeof sections)[number] } => ({ tab: typeof search.tab === 'string' && sections.includes(search.tab as (typeof sections)[number]) ? search.tab as (typeof sections)[number] : undefined }),
  component: () => <ProtectedRoute><Settings /></ProtectedRoute>,
});
