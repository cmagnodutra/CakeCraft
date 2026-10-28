import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: messages.auth.login.title,
};

export default function LoginPage() {
  return <LoginForm />;
}
