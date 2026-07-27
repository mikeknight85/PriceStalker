import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/debug')({ beforeLoad: () => { throw redirect({ to: '/admin/debug', replace: true }); } });
