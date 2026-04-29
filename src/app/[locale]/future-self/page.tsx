'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';

export default function FutureSelfPage() {
  return (
    <ClientGate>
      <FutureSelf />
    </ClientGate>
  );
}

function FutureSelf() {
  const t = useTranslations();
  const profile = useAppStore((s) => s.profile);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('nav.futureSelf')}</h1>
      {profile?.futureSelfVision ? (
        <Card>
          <p className="text-xs uppercase tracking-wide text-leaf-700">
            {t('home.futureSelfReminder')}
          </p>
          <p className="pt-2 leading-relaxed text-ink-700">{profile.futureSelfVision}</p>
        </Card>
      ) : (
        <p className="text-ink-500">—</p>
      )}
    </div>
  );
}
