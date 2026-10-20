'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { messages } from '@/content/messages';
import { registerUser } from '@/lib/api/auth';

import { describeRegisterError } from './register-errors';
import { toRegisterPayload, validateRegister } from './register-validation';
import type { RegisterErrors, RegisterValues } from './register-validation';

const texts = messages.auth.register;

// Ordem visual dos campos: define qual e o "primeiro invalido" a receber foco.
const FIELD_ORDER = ['name', 'email', 'phone', 'password'] as const;

const EMPTY: RegisterValues = { name: '', email: '', phone: '', password: '' };

type Status = 'idle' | 'submitting' | 'success';

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/**
 * Tela de cadastro completa: titulo, formulario e, apos o sucesso, a
 * confirmacao. O titulo (h1) fica aqui dentro porque ele muda junto com o
 * estado; a pagina so fornece o contorno.
 */
export function RegisterForm() {
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string>();
  const [status, setStatus] = useState<Status>('idle');
  const [createdName, setCreatedName] = useState('');

  const formRef = useRef<HTMLFormElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  // Guarda contra envio duplo. O estado do React so atualiza no proximo
  // render, e dois cliques rapidos podem passar antes dele; a ref e imediata.
  const submittingRef = useRef(false);

  // O formulario some no sucesso: sem mover o foco, ele se perderia no <body>.
  useEffect(() => {
    if (status === 'success') {
      successHeadingRef.current?.focus();
    }
  }, [status]);

  function focusField(name: keyof RegisterValues) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      field.focus();
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof RegisterValues;
    const { value } = event.target;

    setValues((current) => ({ ...current, [name]: value }));
    // Corrigir um campo apaga o erro dele, e so dele.
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

    const found = validateRegister(values);
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
      const user = await registerUser(toRegisterPayload(values));
      setCreatedName(user.name);
      setStatus('success');
    } catch (error) {
      const { field, message } = describeRegisterError(error);
      setStatus('idle');
      if (field) {
        // Erro que pertence a um campo aparece nele, e o foco vai para la.
        setErrors({ [field]: message });
        // Espera o React redesenhar o botao habilitado antes de focar.
        queueMicrotask(() => focusField(field));
      } else {
        setFormError(message);
      }
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
          {texts.success.welcome(firstNameOf(createdName))}
        </Alert>
        <Link href="/" className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}>
          {texts.success.backHome}
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
          // handleSubmit trata os proprios erros; 'void' deixa explicito que
          // a promessa nao e esperada aqui (no-floating-promises).
          void handleSubmit(event);
        }}
        noValidate
        className="mt-8 flex flex-col gap-5"
      >
        {formError && <Alert variant="error" messages={[formError]} />}

        <Field
          label={texts.fields.name}
          name="name"
          autoComplete="name"
          required
          value={values.name}
          onChange={handleChange}
          error={errors.name}
        />
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
          label={texts.fields.phone}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint={texts.hints.phone}
          value={values.phone}
          onChange={handleChange}
          error={errors.phone}
        />
        <Field
          label={texts.fields.password}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint={texts.hints.password}
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />

        <Button type="submit" size="lg" fullWidth loading={status === 'submitting'}>
          {texts.submit}
        </Button>
      </form>
    </div>
  );
}
