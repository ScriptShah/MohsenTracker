'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LeafLogo } from '@/components/LeafLogo';
import { SignInForm } from '@/components/SignInForm';
import { useAppStore } from '@/lib/store';
import { presetHabits, seedCategories } from '@/domain/seed';
import { useAuth, emailUsername } from '@/lib/auth';
import { firebaseEnabled } from '@/lib/firebase';
import { useRandomPlaceholder } from '@/lib/placeholders';
import type { CategoryKey, Profile } from '@/domain/types';

const TOTAL_STEPS = 8;

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale() as 'en' | 'fa';
  const initFromOnboarding = useAppStore((s) => s.initFromOnboarding);

  const auth = useAuth();
  const authActive = firebaseEnabled();
  const visionPlaceholder = useRandomPlaceholder('vision');
  const whyPlaceholder = useRandomPlaceholder('why');

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');

  // Pre-fill the user's name from Google displayName or email local-part
  // when sign-in completes.
  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    if (name.trim().length > 0) return;
    const suggested = auth.displayName || emailUsername(auth.email);
    if (suggested) setName(suggested);
  }, [auth, name]);
  const [futureSelfName, setFutureSelfName] = useState('');
  const [vision, setVision] = useState('');
  const [why, setWhy] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<CategoryKey[]>(
    seedCategories.map((c) => c.key),
  );
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(
    () => new Set(presetHabits.map((p) => p.presetKey)),
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
      soundEnabled: true,
      onboardingComplete: true,
      createdAt: new Date().toISOString(),
    };
    // Only keep presets whose category is still selected.
    const finalPresets = [...selectedPresets].filter((k) => {
      const p = presetHabits.find((p) => p.presetKey === k);
      return p && selectedKeys.includes(p.category);
    });
    initFromOnboarding({
      profile,
      selectedCategoryKeys: selectedKeys,
      selectedPresetKeys: finalPresets,
      presetTranslate: (key) => t(`presets.${key}` as any),
      categoryTranslate: (key) => t(`categories.names.${key}` as any),
    });
    router.replace('/');
  };

  const toggleCategory = (key: CategoryKey) => {
    setSelectedKeys((arr) => {
      const had = arr.includes(key);
      // Sync the preset set so toggling a category cleanly adds/removes
      // every preset under it. The user can then fine-tune in step 6.
      setSelectedPresets((ps) => {
        const next = new Set(ps);
        for (const p of presetHabits) {
          if (p.category !== key) continue;
          if (had) next.delete(p.presetKey);
          else next.add(p.presetKey);
        }
        return next;
      });
      return had ? arr.filter((k) => k !== key) : [...arr, key];
    });
  };

  const togglePreset = (key: string) => {
    setSelectedPresets((ps) => {
      const next = new Set(ps);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>{t('onboarding.step', { n: step + 1, total: TOTAL_STEPS })}</span>
        <LanguageToggle />
      </div>

      <ProgressBar value={(step + 1) / TOTAL_STEPS} />

      {step === 0 && (
        <Card className="space-y-3 text-center">
          <div className="flex justify-center pb-1">
            <LeafLogo size={72} />
          </div>
          <h1 className="text-2xl font-semibold">{t('onboarding.welcomeTitle')}</h1>
          <p className="text-ink-600">{t('onboarding.welcomeBody')}</p>
          <p className="pt-2 text-sm italic text-leaf-700">{t('app.tagline')}</p>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Card className="space-y-2">
            <h2 className="text-xl font-semibold">{t('onboarding.signInTitle')}</h2>
            <p className="text-ink-600">{t('onboarding.signInBody')}</p>
          </Card>
          {authActive ? (
            auth.status === 'signed-in' ? (
              <Card className="border-leaf-200 bg-leaf-50">
                <p className="text-xs uppercase tracking-wide text-leaf-700">
                  {auth.isAnonymous
                    ? t('auth.guestSignedIn')
                    : t('onboarding.signedInLead')}
                </p>
                <p className="pt-1 font-medium">
                  {auth.isAnonymous
                    ? t('auth.guestLabel')
                    : emailUsername(auth.email) || auth.displayName || ''}
                </p>
                {auth.email && !auth.isAnonymous && (
                  <p className="text-xs text-ink-500">{auth.email}</p>
                )}
              </Card>
            ) : (
              <SignInForm />
            )
          ) : (
            <Card className="border-sand-200 bg-sand-50 text-sm text-sand-700">
              {t('onboarding.signInDisabled')}
            </Card>
          )}
        </div>
      )}

      {step === 2 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.profileTitle')}</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
            maxLength={50}
            required
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 3 && (
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
            maxLength={50}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.visionTitle')}</h2>
          <p className="text-ink-600">{t('onboarding.visionBody')}</p>
          <textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            rows={5}
            placeholder={visionPlaceholder}
            maxLength={500}
            required
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 5 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.whyTitle')}</h2>
          <p className="text-ink-600">{t('onboarding.whyBody')}</p>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={5}
            placeholder={whyPlaceholder}
            maxLength={500}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 text-base outline-none focus:border-leaf-500"
            autoFocus
          />
        </Card>
      )}

      {step === 6 && (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">{t('onboarding.categoriesTitle')}</h2>
          <p className="text-ink-600">{t('onboarding.categoriesBody')}</p>
          <ul className="space-y-2">
            {seedCategories.map((c) => {
              const active = selectedKeys.includes(c.key);
              const inCat = presetHabits.filter((p) => p.category === c.key).length;
              const picked = presetHabits.filter(
                (p) => p.category === c.key && selectedPresets.has(p.presetKey),
              ).length;
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
                    <span className="flex-1">
                      <span className="block font-medium">
                        {t(`categories.names.${c.key}` as any)}
                      </span>
                      {active && inCat > 0 && (
                        <span className="numeral block text-[11px] text-ink-500">
                          {t('onboarding.habitsSelected', {
                            picked,
                            total: inCat,
                          })}
                        </span>
                      )}
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

      {step === 7 && (
        <HabitsPicker
          selectedKeys={selectedKeys}
          selectedPresets={selectedPresets}
          togglePreset={togglePreset}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={back} disabled={step === 0}>
          {t('common.back')}
        </Button>
        {step < TOTAL_STEPS - 1 ? (
          <Button
            onClick={next}
            disabled={!stepValid(step, { name, vision, selectedKeys })}
          >
            {t('common.next')}
          </Button>
        ) : (
          <Button
            onClick={finish}
            disabled={
              selectedKeys.length === 0 ||
              !stepValid(step, { name, vision, selectedKeys })
            }
          >
            {t('onboarding.finish')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Per-step required-field gate. Necessary fields:
 *  - step 2: name (≥1 trimmed char)
 *  - step 4: future-self vision (≥1 trimmed char) — the spec calls this
 *    the emotional core, so don't let users skip it.
 *  - step 6: at least one category picked.
 *  Other steps (sign-in, future-self name, why-it-matters, habits picker)
 *  are all skippable. */
function stepValid(
  step: number,
  s: { name: string; vision: string; selectedKeys: CategoryKey[] },
): boolean {
  if (step === 2) return s.name.trim().length > 0;
  if (step === 4) return s.vision.trim().length > 0;
  if (step === 6) return s.selectedKeys.length > 0;
  return true;
}

function HabitsPicker({
  selectedKeys,
  selectedPresets,
  togglePreset,
}: {
  selectedKeys: CategoryKey[];
  selectedPresets: Set<string>;
  togglePreset: (key: string) => void;
}) {
  const t = useTranslations();
  const grouped = useMemo(() => {
    return selectedKeys
      .map((k) => ({
        key: k,
        seed: seedCategories.find((c) => c.key === k)!,
        presets: presetHabits.filter((p) => p.category === k),
      }))
      .filter((g) => g.presets.length > 0);
  }, [selectedKeys]);

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t('onboarding.habitsTitle')}</h2>
        <p className="text-ink-600">{t('onboarding.habitsBody')}</p>
      </div>
      {grouped.length === 0 ? (
        <p className="text-sm text-ink-500">{t('onboarding.habitsNoCategories')}</p>
      ) : (
        grouped.map(({ key, seed, presets }) => (
          <section key={key} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <span aria-hidden>{seed.icon}</span>
              {t(`categories.names.${key}` as any)}
            </h3>
            <ul className="space-y-1.5">
              {presets.map((p) => {
                const checked = selectedPresets.has(p.presetKey);
                return (
                  <li key={p.presetKey}>
                    <button
                      type="button"
                      onClick={() => togglePreset(p.presetKey)}
                      className={`tap-44 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-start ${
                        checked
                          ? 'border-leaf-500 bg-leaf-50'
                          : 'border-ink-200 bg-white'
                      }`}
                    >
                      <span className="flex-1 text-sm">
                        {t(`presets.${p.presetKey}` as any)}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] ${
                          checked
                            ? 'border-leaf-500 bg-leaf-500 text-white'
                            : 'border-ink-300'
                        }`}
                        aria-hidden
                      >
                        {checked ? '✓' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Card>
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
