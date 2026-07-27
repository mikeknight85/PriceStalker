import { createFileRoute } from '@tanstack/react-router';
import { InsightsPage } from '../../features/products';

export const Route = createFileRoute('/_authenticated/insights')({ component: InsightsPage });
