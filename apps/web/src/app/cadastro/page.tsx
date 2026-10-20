import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { RegisterForm } from '@/features/auth/register-form';

export const metadata: Metadata = {
  // O layout acrescenta " | CakeCraft" (title.template).
  title: messages.auth.register.title,
};

export default function RegisterPage() {
  return <RegisterForm />;
}
