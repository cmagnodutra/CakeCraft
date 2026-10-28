'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button, buttonStyles } from '@/components/ui/button';
import { messages } from '@/content/messages';
import { useAuth } from '@/features/auth/auth-provider';
import { anonymizeMyAccount } from '@/lib/api/auth';
import { NetworkError } from '@/lib/api/errors';

const texts = messages.profile;
const XP_PER_LEVEL = 1000;

export function ProfileView() {
  const { user, isLoading, setUser, logout } = useAuth();
  const [confirmingAnonymize, setConfirmingAnonymize] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [anonymized, setAnonymized] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const anonymizedHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (anonymized) {
      anonymizedHeadingRef.current?.focus();
    }
  }, [anonymized]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleAnonymize() {
    setAnonymizing(true);
    setActionError(undefined);
    try {
      await anonymizeMyAccount();
      setUser(null);
      setAnonymized(true);
    } catch (error) {
      setActionError(
        error instanceof NetworkError ? texts.errors.network : texts.errors.anonymizeFailed,
      );
    } finally {
      setAnonymizing(false);
    }
  }

  if (anonymized) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-12 sm:py-20">
        <h1
          ref={anonymizedHeadingRef}
          tabIndex={-1}
          className="font-serif text-4xl leading-tight tracking-[-0.015em] outline-none"
        >
          {texts.privacySection.anonymizedTitle}
        </h1>
        <Alert variant="success" className="mt-6">
          {texts.privacySection.anonymizedMessage}
        </Alert>
        <Link href="/" className={`${buttonStyles({ size: 'lg', fullWidth: true })} mt-8`}>
          {texts.privacySection.backHome}
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-12 sm:py-20">
        <p role="status" className="text-ink-muted">
          {texts.loadingMessage}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-12 sm:py-20">
        <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">
          {texts.unauthenticatedTitle}
        </h1>
        <p className="mt-3 text-ink-muted">{texts.unauthenticatedBody}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/entrar" className={buttonStyles({ size: 'lg', fullWidth: true })}>
            {texts.goToLogin}
          </Link>
          <Link
            href="/cadastro"
            className={buttonStyles({ variant: 'secondary', size: 'lg', fullWidth: true })}
          >
            {texts.goToRegister}
          </Link>
        </div>
      </div>
    );
  }

  const currentLevelXp = user.xp % XP_PER_LEVEL;
  const remainingXp = XP_PER_LEVEL - currentLevelXp;
  const nextLevel = user.level + 1;
  const progressPercent = Math.round((currentLevelXp / XP_PER_LEVEL) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="font-serif text-4xl leading-tight tracking-[-0.015em]">{texts.title}</h1>

      {actionError && <Alert variant="error" className="mt-6" messages={[actionError]} />}

      {/* Dados cadastrais */}
      <section className="mt-8 rounded-control border border-line bg-surface p-6">
        <h2 className="font-serif text-2xl">{texts.accountSection.title}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">{texts.accountSection.nameLabel}</dt>
            <dd className="mt-1 font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{texts.accountSection.emailLabel}</dt>
            <dd className="mt-1 font-medium break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{texts.accountSection.roleLabel}</dt>
            <dd className="mt-1">
              <span className="inline-block rounded-control border border-line bg-sand-100 px-3 py-1 text-xs font-bold">
                {texts.roles[user.role]}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Gamificacao (RN04) */}
      <section className="mt-6 rounded-control border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl">{texts.gamificationSection.title}</h2>
          <span className="rounded-control bg-ink px-3 py-1 text-sm font-bold text-on-ink">
            {texts.gamificationSection.levelBadge(user.level)}
          </span>
        </div>

        <p className="mt-3 font-medium">{texts.gamificationSection.xpSummary(user.xp)}</p>

        <div
          role="progressbar"
          aria-label={texts.gamificationSection.title}
          aria-valuemin={0}
          aria-valuemax={XP_PER_LEVEL}
          aria-valuenow={currentLevelXp}
          className="mt-3 h-3 w-full overflow-hidden rounded-control bg-sand-200"
        >
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-ink-muted">
          {texts.gamificationSection.progressDetail(currentLevelXp, remainingXp, nextLevel)}
        </p>
        <p className="mt-2 text-xs text-ink-muted">{texts.gamificationSection.ruleHint}</p>
      </section>

      {/* Sessao */}
      <section className="mt-6 rounded-control border border-line bg-surface p-6">
        <h2 className="font-serif text-2xl">{texts.sessionSection.title}</h2>
        <div className="mt-4">
          <Button
            variant="secondary"
            loading={loggingOut}
            onClick={() => {
              void handleLogout();
            }}
          >
            {texts.sessionSection.logoutButton}
          </Button>
        </div>
      </section>

      {/* Privacidade e LGPD (Secao 6.1 do RFC) */}
      <section className="mt-6 rounded-control border border-danger-line bg-surface p-6">
        <h2 className="font-serif text-2xl text-danger">{texts.privacySection.title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{texts.privacySection.description}</p>

        {!confirmingAnonymize ? (
          <div className="mt-4">
            <Button variant="secondary" onClick={() => setConfirmingAnonymize(true)}>
              {texts.privacySection.requestButton}
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <Alert variant="info" messages={[texts.privacySection.confirmWarning]} />
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                loading={anonymizing}
                onClick={() => {
                  void handleAnonymize();
                }}
              >
                {texts.privacySection.confirmButton}
              </Button>
              <Button
                variant="ghost"
                disabled={anonymizing}
                onClick={() => setConfirmingAnonymize(false)}
              >
                {texts.privacySection.cancelButton}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
