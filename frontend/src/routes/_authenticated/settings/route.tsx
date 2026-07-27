import { createFileRoute, Outlet } from '@tanstack/react-router';
const sections = ['profile', 'regional', 'notifications', 'security'] as const;
export const Route = createFileRoute('/_authenticated/settings')({
  validateSearch: (search): { tab?: (typeof sections)[number] } => ({ tab: typeof search.tab === 'string' && sections.includes(search.tab as (typeof sections)[number]) ? search.tab as (typeof sections)[number] : undefined }),
  component: Outlet,
});
