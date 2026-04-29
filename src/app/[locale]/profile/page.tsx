'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
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
  const pendingCount = useAppStore(
    (s) => s.pendingRewards.filter((r) => !r.claimedAt).length,
  );
  const punishmentCount = useAppStore(
    (s) => s.activePunishments.filter((p) => !p.doneAt).length,
  );
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

      <Link href="/rewards" className="block">
        <Card className="flex items-center gap-3 transition hover:border-ink-300">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-white"
            aria-hidden
          >
            ✦
          </span>
          <div className="flex-1">
            <div className="font-medium">{t('rewards.title')}</div>
            <div className="numeral text-xs text-ink-500">
              {pendingCount > 0 || punishmentCount > 0
                ? [
                    pendingCount > 0 ? `${pendingCount} ✓` : null,
                    punishmentCount > 0 ? `${punishmentCount} ✗` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : '—'}
            </div>
          </div>
          <span className="text-ink-300" aria-hidden>
            ›
          </span>
        </Card>
      </Link>

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
