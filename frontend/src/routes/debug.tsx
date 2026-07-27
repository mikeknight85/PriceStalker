import { createFileRoute } from '@tanstack/react-router';
import Debug from '../pages/Debug';

export const Route = createFileRoute('/debug')({ component: Debug });
