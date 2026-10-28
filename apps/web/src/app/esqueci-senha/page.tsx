import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = {
  title: messages.auth.forgotPassword.title,
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
