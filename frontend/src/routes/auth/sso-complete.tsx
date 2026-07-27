import { createFileRoute } from '@tanstack/react-router';
import SsoComplete from '../../pages/SsoComplete';

export const Route = createFileRoute('/auth/sso-complete')({ component: SsoComplete });
