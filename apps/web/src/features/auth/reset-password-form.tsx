'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { resetPassword } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { validatePasswordStrength } from './password-rules';

const texts = messages.auth.resetPassword;

interface ResetValues {
  newPassword: string;
  confirmPassword: string;
}

type ResetErrors = Partial<Record<keyof ResetValues, string>>;
type Status = 'idle' | 'submitting' | 'success';

const FIELD_ORDER = ['newPassword', 'confirmPassword'] as const;

function describeResetError(error: unknown): string {
  if (error instanceof NetworkError) {
    return texts.errors.network;
  }
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return texts.errors.invalidOrExpiredToken;
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

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [values, setValues] = useState<ResetValues>({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<ResetErrors>({});
  const [formError, setFormError] = useState<string>();
  const [status, setStatus] = useState<Status>('idle');

  const formRef = useRef<HTMLFormElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (status === 'success') {
      successHeadingRef.current?.focus();
    }
  }, [status]);

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">
          {texts.missingTokenTitle}
        </h1>
        <Alert variant="error" className="mt-6" messages={[texts.missingTokenBody]} />
        <Link
          href="/esqueci-senha"
          className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}
        >
          {texts.requestNewLink}
        </Link>
      </div>
    );
  }

  function focusField(name: keyof ResetValues) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      field.focus();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof ResetValues;
    const { value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!(name in current)) {
        return current;
      }
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    const found: ResetErrors = {};
    const passwordError = validatePasswordStrength(values.newPassword, {
      min: texts.validation.newPassword,
      max: texts.validation.newPasswordMax,
    });
    if (passwordError) {
      found.newPassword = passwordError;
    }
    if (values.confirmPassword !== values.newPassword || values.confirmPassword === '') {
      found.confirmPassword = texts.validation.confirmPassword;
    }

    const firstInvalid = FIELD_ORDER.find((name) => found[name]);
    if (firstInvalid) {
      setErrors(found);
      setFormError(undefined);
      focusField(firstInvalid);
      return;
    }

    submittingRef.current = true;
    setErrors({});
    setFormError(undefined);
    setStatus('submitting');

    try {
      await resetPassword({
        token,
        newPassword: values.newPassword,
      });
      setStatus('success');
    } catch (error) {
      setFormError(describeResetError(error));
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
          {texts.success.message}
        </Alert>
        <Link href="/entrar" className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}>
          {texts.success.goToLogin}
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
          label={texts.fields.newPassword}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          hint={texts.hints.newPassword}
          value={values.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
        />

        <Field
          label={texts.fields.confirmPassword}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <Button type="submit" size="lg" fullWidth loading={status === 'submitting'}>
          {texts.submit}
        </Button>
      </form>
    </div>
  );
}
