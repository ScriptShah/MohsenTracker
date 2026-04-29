'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAppStore } from '@/lib/store';
import { seedCategories } from '@/domain/seed';
import type { CategoryKey, Profile } from '@/domain/types';

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale() as 'en' | 'fa';
  const initFromOnboarding = useAppStore((s) => s.initFromOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [futureSelfName, setFutureSelfName] = useState('');
  const [vision, setVision] = useState('');
  const [why, setWhy] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<CategoryKey[]>(
    seedCategories.map((c) => c.key),
  );

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    const profile: Profile = {
      name: name.trim() || (locale === 'fa' ? 'دوست' : 'friend'),
      futureSelfName: futureSelfName.trim() || undefined,
      futureSelfVision: vision.trim(),
      whyItMatters: why.trim() || undefined,
      language: locale,
      numeralSystem: locale === 'fa' ? 'persian' : 'western',
      theme: 'auto',
      ramadanMode: 'auto',
      prayerMethod: locale === 'fa' ? 'tehran' : 'mwl',
      calendar: locale === 'fa' ? 'jalali' : 'gregorian',
      consequenceSensitivity: 'honest',
      notifications: { enabled: false, dailyTime: '09:00', perHabit: {} },
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    };
    initFromOnboarding({
      profile,
      selectedCategoryKeys: selectedKeys,
      presetTranslate: (key) => t(`presets.${key}` as any),
      categoryTranslate: (key) => t(`categories.names.${key}` as any),
    });
    router.replace('/');
  };

  const toggleCategory = (key: CategoryKey) => {
    setSelectedKeys((arr) =>
      arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>{t('onboarding.step', { n: step + 1, total: TOTAL_STEPS })}</span>
        <LanguageToggle />
      </div>

      <ProgressBar value={(step + 1) / TOTAL_STEPS} />

      {step === 0 && (
        <Card className="space-y-3">
          <h1 className="text-2xl font-semibold">{t('onboarding.welcomeTitle')}</h1>
          <p className="text-ink-600">{t('onboarding.welcomeBody')}</p>
          <p className="pt-2 text-sm italic text-leaf-700">{t('app.tagline')}</p>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.profileTitle')}</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.futureSelfNameTitle')}</h2>
          <p className="text-ink-600">
            {t('onboarding.futureSelfNameBody', {
              example: t('onboarding.futureSelfNameExample'),
            })}
          </p>
          <input
            value={futureSelfName}
            onChange={(e) => setFutureSelfName(e.target.value)}
            placeholder={t('onboarding.futureSelfNamePlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.visionTitle')}</h2>
          <p className="text-ink-600">{t('onboarding.visionBody')}</p>
          <textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            rows={5}
            placeholder={t('onboarding.visionPlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.whyTitle')}</h2>
          <p className="text-ink-600">{t('onboarding.whyBody')}</p>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={5}
            placeholder={t('onboarding.whyPlaceholder')}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 5 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.categoriesTitle')}</h2>
          <p className="text-ink-600">{t('onboarding.categoriesBody')}</p>
          <ul className="space-y-2">
            {seedCategories.map((c) => {
              const active = selectedKeys.includes(c.key);
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(c.key)}
                    className={`tap-44 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-start ${
                      active
                        ? 'border-leaf-500 bg-leaf-50'
                        : 'border-ink-200 bg-white'
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    >
                      {c.icon}
                    </span>
                    <span className="flex-1 font-medium">
                      {t(`categories.names.${c.key}` as any)}
                    </span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        active ? 'border-leaf-500 bg-leaf-500 text-white' : 'border-ink-300'
                      }`}
                      aria-hidden
                    >
                      {active ? '✓' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={back} disabled={step === 0}>
          {t('common.back')}
        </Button>
        {step < TOTAL_STEPS - 1 ? (
          <Button onClick={next}>{t('common.next')}</Button>
        ) : (
          <Button onClick={finish} disabled={selectedKeys.length === 0}>
            {t('onboarding.finish')}
          </Button>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
      <div
        className="h-full bg-leaf-500 transition-all"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function LanguageToggle() {
  const locale = useLocale();
  const switchTo = locale === 'en' ? 'fa' : 'en';
  const label = switchTo === 'fa' ? 'فارسی' : 'English';
  const onClick = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\/(en|fa)/, `/${switchTo}`);
      window.location.href = path;
    }
  };
  return (
    <button onClick={onClick} className="text-leaf-700 underline">
      {label}
    </button>
  );
}
