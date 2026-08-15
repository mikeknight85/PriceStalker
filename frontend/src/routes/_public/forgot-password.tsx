import { createFileRoute } from '@tanstack/react-router';
import ForgotPassword from '../../pages/ForgotPassword';

export const Route = createFileRoute('/_public/forgot-password')({
  component: ForgotPassword,
});
