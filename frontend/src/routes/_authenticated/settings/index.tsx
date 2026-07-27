import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_authenticated/settings/')({
  beforeLoad: ({ search }) => { throw redirect({ to: `/settings/${search.tab || 'profile'}`, replace: true }); },
});
