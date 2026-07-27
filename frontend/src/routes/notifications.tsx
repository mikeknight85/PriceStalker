import { createFileRoute } from '@tanstack/react-router';
import NotificationHistory from '../pages/NotificationHistory';
import { ProtectedRoute } from './-guards';

export const Route = createFileRoute('/notifications')({
  component: () => <ProtectedRoute><NotificationHistory /></ProtectedRoute>,
});
