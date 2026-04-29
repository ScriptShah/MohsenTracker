'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';

export default function ProfilePage() {
  return (
    <ClientGate>
      <Profile />
    </ClientGate>
  );
}

function Profile() {
  const t = useTranslations();
  const profile = useAppStore((s) => s.profile);
  const reset = useAppStore((s) => s.reset);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('nav.profile')}</h1>
      {profile && (
        <Card className="space-y-2">
          <div className="text-sm text-ink-500">{t('common.language')}</div>
          <div className="font-medium">
            {profile.language === 'fa' ? 'فارسی' : 'English'}
          </div>
        </Card>
      )}
      <Button
        variant="danger"
        onClick={() => {
          if (confirm('Reset all data?')) reset();
        }}
      >
        Reset all data
      </Button>
    </div>
  );
}
