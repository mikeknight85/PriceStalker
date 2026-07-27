import { createFileRoute } from '@tanstack/react-router';
import NotificationHistory from '../../pages/NotificationHistory';
export const Route = createFileRoute('/_authenticated/notifications')({ component: NotificationHistory });
