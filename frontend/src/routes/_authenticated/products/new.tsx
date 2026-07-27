import { createFileRoute } from '@tanstack/react-router';
import { AddProductPage } from '../../../features/products';

export const Route = createFileRoute('/_authenticated/products/new')({ component: AddProductPage });
