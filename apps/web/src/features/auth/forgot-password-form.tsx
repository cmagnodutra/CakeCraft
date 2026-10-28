'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { requestPasswordReset } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { isValidEmailShape } from './password-rules';

const texts = messages.auth.forgotPassword;

type Status = 'idle' | 'submitting' | 'success';

function describeForgotError(error: unknown): string {
  if (error instanceof NetworkError) {
    return texts.errors.network;
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return texts.errors.invalidData;
    }
    if (error.status === 429) {
      return texts.errors.tooManyRequests;
    }
    if (error.status >= 500) {
      return texts.errors.server;
    }
  }
  return texts.errors.unexpected;
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [status, setStatus] = useState<Status>('idle');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const formRef = useRef<HTMLFormElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (status === 'success') {
      successHeadingRef.current?.focus();
    }
  }, [status]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    if (emailError) {
      setEmailError(undefined);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    if (!isValidEmailShape(email)) {
      setEmailError(texts.validation.email);
      setFormError(undefined);
      const input = formRef.current?.elements.namedItem('email');
      if (input instanceof HTMLElement) {
        input.focus();
      }
      return;
    }

    const normalizedEmail = email.trim();
    submittingRef.current = true;
    setEmailError(undefined);
    setFormError(undefined);
    setStatus('submitting');

    try {
      await requestPasswordReset(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setStatus('success');
    } catch (error) {
      setFormError(describeForgotError(error));
      setStatus('idle');
    } finally {
      submittingRef.current = false;
    }
  }

  if (status === 'success') {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
        <h1
          ref={successHeadingRef}
          tabIndex={-1}
          className="font-serif text-4xl leading-tight tracking-[-0.015em] outline-none"
        >
          {texts.success.title}
        </h1>
        <Alert variant="success" className="mt-6">
          {texts.success.message(submittedEmail)}
        </Alert>
        <Link href="/entrar" className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}>
          {texts.success.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
      <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">{texts.title}</h1>
      <p className="mt-3 text-ink-muted">{texts.intro}</p>

      <form
        ref={formRef}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
        className="mt-8 flex flex-col gap-5"
      >
        {formError && <Alert variant="error" messages={[formError]} />}

        <Field
          label={texts.fields.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={handleChange}
          error={emailError}
        />

        <Button type="submit" size="lg" fullWidth loading={status === 'submitting'}>
          {texts.submit}
        </Button>

        <Link
          href="/entrar"
          className={`${buttonStyles({ variant: 'ghost', size: 'md', fullWidth: true })}`}
        >
          {texts.backToLogin}
        </Link>
      </form>
    </div>
  );
}
