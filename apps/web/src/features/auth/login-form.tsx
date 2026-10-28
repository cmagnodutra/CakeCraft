'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { loginUser } from '@/lib/api/auth';
import { ApiError, NetworkError } from '@/lib/api/errors';

import { useAuth } from './auth-provider';
import { isValidEmailShape, validatePasswordStrength } from './password-rules';

const texts = messages.auth.login;

interface LoginValues {
  email: string;
  password: string;
}

type LoginErrors = Partial<Record<keyof LoginValues, string>>;

const FIELD_ORDER = ['email', 'password'] as const;

function describeLoginError(error: unknown): string {
  if (error instanceof NetworkError) {
    return texts.errors.network;
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return texts.errors.invalidCredentials;
    }
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

export function LoginForm() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  function focusField(name: keyof LoginValues) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      field.focus();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof LoginValues;
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

    const found: LoginErrors = {};
    if (!isValidEmailShape(values.email)) {
      found.email = texts.validation.email;
    }
    const passwordError = validatePasswordStrength(values.password, {
      min: texts.validation.password,
      max: texts.validation.passwordMax,
    });
    if (passwordError) {
      found.password = passwordError;
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
    setSubmitting(true);

    try {
      const user = await loginUser({
        email: values.email.trim(),
        password: values.password,
      });
      setUser(user);
      router.push('/perfil');
    } catch (error) {
      setFormError(describeLoginError(error));
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
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
          value={values.email}
          onChange={handleChange}
          error={errors.email}
        />

        <Field
          label={texts.fields.password}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />

        <div className="flex justify-end">
          <Link
            href="/esqueci-senha"
            className="rounded-control text-sm font-medium text-accent underline underline-offset-4 hover:text-ink"
          >
            {texts.forgotPasswordLink}
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {texts.submit}
        </Button>

        <p className="text-center text-sm text-ink-muted">
          {texts.noAccount}{' '}
          <Link
            href="/cadastro"
            className="rounded-control font-bold text-ink underline underline-offset-4 hover:text-accent"
          >
            {texts.registerLink}
          </Link>
        </p>
      </form>
    </div>
  );
}
