'use client';

import { useTranslations } from 'next-intl';
import { LeafLogo } from './LeafLogo';
import { SignInForm } from './SignInForm';

/** What a signed-out user sees: logo, tagline, sign-in form. No top
 *  bar, no bottom nav, no protected routing. The splash screen still
 *  plays at the AppShell level above this. */
export function PublicLayout() {
  const t = useTranslations();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <LeafLogo size={88} />
        <h1 className="text-2xl font-semibold text-ink-900">
          {t('app.name')}
        </h1>
        <p className="text-sm italic text-leaf-700">{t('app.tagline')}</p>
      </div>
      <div className="w-full max-w-sm">
        <SignInForm />
      </div>
    </main>
  );
}
