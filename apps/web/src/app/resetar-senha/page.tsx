import type { Metadata } from 'next';
import { Suspense } from 'react';

import { messages } from '@/content/messages';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = {
  title: messages.auth.resetPassword.title,
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-md px-5 py-12 text-ink-muted sm:py-20">
          {messages.common.loading}...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
