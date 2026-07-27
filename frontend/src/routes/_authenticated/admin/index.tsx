import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_authenticated/admin/')({
  beforeLoad: ({ search }) => { throw redirect({ to: `/admin/${search.tab || 'system'}`, replace: true }); },
});
