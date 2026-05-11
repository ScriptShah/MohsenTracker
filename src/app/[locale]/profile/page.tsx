'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useUnitLabel } from '@/lib/units';
import { useAuth, deleteAccount, emailUsername, signOutUser } from '@/lib/auth';
import { firebaseEnabled } from '@/lib/firebase';
import { SignInForm } from '@/components/SignInForm';
import type {
  CalendarPreference,
  ConsequenceSensitivity,
  Habit,
  PrayerCalcMethod,
  Profile as ProfileT,
  ThemeMode,
} from '@/domain/types';

const CONSEQUENCE_LEVELS: ConsequenceSensitivity[] = ['off', 'mild', 'honest', 'full'];
const PRAYER_METHODS: PrayerCalcMethod[] = ['mwl', 'isna', 'tehran', 'umm-al-qura'];
const CALENDARS: CalendarPreference[] = ['gregorian', 'jalali', 'hijri'];
const THEMES: ThemeMode[] = ['auto', 'light', 'dark'];
const CITY_KEYS = [
  'tehran',
  'mashhad',
  'isfahan',
  'tabriz',
  'shiraz',
  'kabul',
  'herat',
  'mazar',
  'mecca',
  'medina',
  'istanbul',
  'cairo',
  'riyadh',
  'london',
  'newYork',
] as const;

export default function ProfilePage() {
  return (
    <ClientGate>
      <Profile />
    </ClientGate>
  );
}

function Profile() {
  const t = useTranslations();
  const unitLabel = useUnitLabel();
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const habits = useAppStore((s) => s.habits);
  const setProfile = useAppStore((s) => s.setProfile);
  const setReadingHabit = useAppStore((s) => s.setReadingHabit);
  const reset = useAppStore((s) => s.reset);
  const pendingCount = useAppStore(
    (s) => s.pendingRewards.filter((r) => !r.claimedAt).length,
  );
  const punishmentCount = useAppStore(
    (s) => s.activePunishments.filter((p) => !p.doneAt).length,
  );

  if (!profile?.onboardingComplete) {
    return (
      <div>
        <Link href="/onboarding" className="text-leaf-700 underline">
          {t('common.next')}
        </Link>
      </div>
    );
  }

  const onSignOut = () => {
    if (!confirm(t('settings.resetProgressConfirm'))) return;
    reset();
    router.replace('/onboarding');
  };

  const onExport = () => {
    const snapshot = useAppStore.getState();
    // Strip non-serialisable fields and Zustand internals just in case.
    const data = {
      profile: snapshot.profile,
      categories: snapshot.categories,
      habits: snapshot.habits,
      logs: snapshot.logs,
      summaries: snapshot.summaries,
      streaks: snapshot.streaks,
      rewards: snapshot.rewards,
      punishments: snapshot.punishments,
      pendingRewards: snapshot.pendingRewards,
      activePunishments: snapshot.activePunishments,
      lastReconciledDate: snapshot.lastReconciledDate,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = t('settings.exportFilename');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

      <AuthSection />

      <ProfileEditCard profile={profile} setProfile={setProfile} />

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.languageSection')}
        </h2>

        <Field label={t('settings.language')}>
          <SegmentedTwo
            value={profile.language}
            options={[
              { value: 'en', label: 'English' },
              { value: 'fa', label: 'فارسی' },
            ]}
            onChange={(v) => {
              setProfile({ language: v as 'en' | 'fa' });
              if (typeof window !== 'undefined') {
                const path = window.location.pathname.replace(
                  /^\/(en|fa)/,
                  `/${v}`,
                );
                window.location.href = path;
              }
            }}
          />
        </Field>

        <Field label={t('settings.calendar')}>
          <select
            value={profile.calendar}
            onChange={(e) =>
              setProfile({ calendar: e.target.value as CalendarPreference })
            }
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
          >
            {CALENDARS.map((c) => (
              <option key={c} value={c}>
                {t(`settings.calendar${cap(c)}` as any)}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.themeSection')}
        </h2>
        <Field label={t('settings.theme')}>
          <select
            value={profile.theme}
            onChange={(e) => setProfile({ theme: e.target.value as ThemeMode })}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
          >
            {THEMES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`settings.theme${cap(tt)}` as any)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('settings.ramadanAuto')} hint={t('settings.ramadanAutoBody')}>
          <SegmentedThree
            value={profile.ramadanMode}
            options={[
              { value: 'auto', label: t('settings.ramadanModes.auto') },
              { value: 'on', label: t('settings.ramadanModes.on') },
              { value: 'off', label: t('settings.ramadanModes.off') },
            ]}
            onChange={(v) => setProfile({ ramadanMode: v as 'auto' | 'on' | 'off' })}
          />
        </Field>

        <Field label={t('settings.sound')} hint={t('settings.soundHint')}>
          <Toggle
            active={profile.soundEnabled}
            onChange={(v) => setProfile({ soundEnabled: v })}
          />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.prayerSection')}
        </h2>
        <p className="text-xs text-ink-500">{t('settings.prayerNote')}</p>

        <Field label={t('settings.prayerCity')}>
          <select
            value={CITY_KEYS.includes(profile.prayerCity as any) ? profile.prayerCity : ''}
            onChange={(e) => setProfile({ prayerCity: e.target.value || undefined })}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
          >
            <option value="">{t('settings.prayerCityCustom')}</option>
            {CITY_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`settings.cities.${k}` as any)}
              </option>
            ))}
          </select>
          {!CITY_KEYS.includes(profile.prayerCity as any) && (
            <input
              value={profile.prayerCity ?? ''}
              onChange={(e) =>
                setProfile({ prayerCity: e.target.value.trim() || undefined })
              }
              placeholder={t('settings.prayerCityPlaceholder')}
              className="mt-2 w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
            />
          )}
        </Field>

        <Field label={t('settings.prayerMethod')}>
          <select
            value={profile.prayerMethod}
            onChange={(e) =>
              setProfile({ prayerMethod: e.target.value as PrayerCalcMethod })
            }
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
          >
            {PRAYER_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`settings.prayerMethods.${m}` as any)}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.notifSection')}
        </h2>
        <p className="text-xs text-ink-500">{t('settings.notifNote')}</p>

        <Field label={t('settings.notifEnabled')}>
          <Toggle
            active={profile.notifications.enabled}
            onChange={(v) =>
              setProfile({
                notifications: { ...profile.notifications, enabled: v },
              })
            }
          />
        </Field>

        <Field label={t('settings.notifTime')}>
          <input
            type="time"
            value={profile.notifications.dailyTime}
            disabled={!profile.notifications.enabled}
            onChange={(e) =>
              setProfile({
                notifications: {
                  ...profile.notifications,
                  dailyTime: e.target.value,
                },
              })
            }
            className="numeral rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500 disabled:opacity-50"
          />
        </Field>

        {habits.length > 0 && (
          <Field label={t('settings.notifPerHabit')}>
            <ul className="divide-y divide-ink-100">
              {habits.map((h) => (
                <PerHabitNotifRow
                  key={h.id}
                  habit={h}
                  enabled={profile.notifications.perHabit[h.id] ?? true}
                  globalDisabled={!profile.notifications.enabled}
                  onChange={(v) =>
                    setProfile({
                      notifications: {
                        ...profile.notifications,
                        perHabit: { ...profile.notifications.perHabit, [h.id]: v },
                      },
                    })
                  }
                />
              ))}
            </ul>
          </Field>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.consequenceSection')}
        </h2>
        <p className="text-xs text-ink-500">{t('settings.consequenceBody')}</p>
        <div className="grid grid-cols-2 gap-2">
          {CONSEQUENCE_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setProfile({ consequenceSensitivity: lvl })}
              className={`tap-44 rounded-xl border px-3 py-2 text-start ${
                profile.consequenceSensitivity === lvl
                  ? 'border-leaf-500 bg-leaf-50'
                  : 'border-ink-200 bg-white'
              }`}
            >
              <div className="text-sm font-medium">
                {t(`settings.consequence.${lvl}` as any)}
              </div>
              <div className="text-[11px] text-ink-500">
                {t(`settings.consequenceHints.${lvl}` as any)}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.readingHabitSection')}
        </h2>
        <p className="text-xs text-ink-500">{t('settings.readingHabitBody')}</p>
        <select
          value={profile.readingHabitId ?? ''}
          onChange={(e) => setReadingHabit(e.target.value || undefined)}
          className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
        >
          <option value="">{t('settings.readingHabitNone')}</option>
          {habits
            .filter((h) => h.type === 'good')
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {h.unit ? ` (${unitLabel(h.unit)})` : ''}
              </option>
            ))}
        </select>
      </Card>

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
          <ChevronEnd className="h-4 w-4 text-ink-300" />
        </Card>
      </Link>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.dataSection')}
        </h2>
        <p className="text-xs text-ink-500">{t('settings.exportHint')}</p>
        <Button variant="secondary" onClick={onExport}>
          {t('settings.exportButton')}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('settings.resetProgressTitle')}
        </h2>
        <p className="text-xs text-ink-500">
          {t('settings.resetProgressHint')}
        </p>
        <Button variant="danger" onClick={onSignOut}>
          {t('settings.resetProgress')}
        </Button>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}

function DeleteAccountCard() {
  const t = useTranslations();
  const router = useRouter();
  const auth = useAuth();
  const reset = useAppStore((s) => s.reset);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!firebaseEnabled() || auth.status !== 'signed-in') return null;

  const onDelete = async () => {
    if (!confirm(t('settings.deleteAccountConfirm'))) return;
    setErr(null);
    setBusy(true);
    const res = await deleteAccount();
    if (!res.ok) {
      setBusy(false);
      if (res.error.includes('requires-recent-login')) {
        setErr(t('settings.deleteAccountReauth'));
        return;
      }
      setErr(t('settings.deleteAccountFailed'));
      return;
    }
    // Wipe local store too so the next visitor sees a clean state.
    reset();
    router.replace('/onboarding');
  };

  return (
    <Card className="space-y-3 border-red-200 bg-red-50">
      <h2 className="text-sm font-semibold text-red-800">
        {t('settings.deleteAccountTitle')}
      </h2>
      <p className="text-xs text-red-700">{t('settings.deleteAccountHint')}</p>
      {err && <p className="text-xs font-medium text-red-700">{err}</p>}
      <Button variant="danger" onClick={onDelete} disabled={busy}>
        {t('settings.deleteAccount')}
      </Button>
    </Card>
  );
}

function AuthSection() {
  const t = useTranslations();
  const auth = useAuth();
  if (!firebaseEnabled()) return null;
  if (auth.status === 'loading') return null;

  if (auth.status === 'signed-in') {
    const username = auth.isAnonymous
      ? t('auth.guestLabel')
      : emailUsername(auth.email) || auth.displayName || '';
    return (
      <Card className="space-y-2 border-leaf-200 bg-leaf-50">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-leaf-700">
              {auth.isAnonymous ? t('auth.guestSignedIn') : t('auth.username')}
            </p>
            <p className="truncate font-medium">{username}</p>
            {auth.email && !auth.isAnonymous && (
              <p className="truncate text-xs text-ink-500">{auth.email}</p>
            )}
            {auth.isAnonymous && (
              <p className="text-xs text-ink-500">{t('auth.guestHint')}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => signOutUser()}
            className="shrink-0 text-red-600 hover:bg-red-50"
          >
            {t('auth.signOut')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-sand-600">
          {t('auth.notSignedInTitle')}
        </p>
        <p className="pt-1 text-ink-700">{t('auth.notSignedInBody')}</p>
      </div>
      <SignInForm />
    </div>
  );
}

function ProfileEditCard({
  profile,
  setProfile,
}: {
  profile: ProfileT;
  setProfile: (patch: Partial<ProfileT>) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [futureSelfName, setFutureSelfName] = useState(profile.futureSelfName ?? '');
  const [vision, setVision] = useState(profile.futureSelfVision);
  const [why, setWhy] = useState(profile.whyItMatters ?? '');

  const save = () => {
    setProfile({
      name: name.trim() || profile.name,
      futureSelfName: futureSelfName.trim() || undefined,
      futureSelfVision: vision.trim(),
      whyItMatters: why.trim() || undefined,
    });
    setEditing(false);
  };

  const cancel = () => {
    setName(profile.name);
    setFutureSelfName(profile.futureSelfName ?? '');
    setVision(profile.futureSelfVision);
    setWhy(profile.whyItMatters ?? '');
    setEditing(false);
  };

  if (!editing) {
    return (
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('settings.profileSection')}
          </h2>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t('common.edit')}
          </Button>
        </div>
        <Readout label={t('settings.name')} value={profile.name} />
        <Readout
          label={t('settings.futureSelfName')}
          value={profile.futureSelfName ?? '—'}
        />
        <Readout label={t('settings.futureSelfVision')} value={profile.futureSelfVision || '—'} multiline />
        <Readout label={t('settings.why')} value={profile.whyItMatters ?? '—'} multiline />
        <Link
          href="/future-self"
          className="inline-flex items-center gap-1 text-sm text-leaf-700 underline"
        >
          {t('settings.openFutureSelf')} <ChevronEnd className="h-3.5 w-3.5" />
        </Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-ink-800">
        {t('settings.profileSection')}
      </h2>
      <Field label={t('settings.name')}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
      </Field>
      <Field label={t('settings.futureSelfName')}>
        <input
          value={futureSelfName}
          onChange={(e) => setFutureSelfName(e.target.value)}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
      </Field>
      <Field label={t('settings.futureSelfVision')}>
        <textarea
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
      </Field>
      <Field label={t('settings.why')}>
        <textarea
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={cancel}>
          {t('settings.profileEditCancel')}
        </Button>
        <Button onClick={save}>{t('settings.profileEditSave')}</Button>
      </div>
    </Card>
  );
}

function PerHabitNotifRow({
  habit,
  enabled,
  globalDisabled,
  onChange,
}: {
  habit: Habit;
  enabled: boolean;
  globalDisabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm">{habit.name}</span>
      <Toggle active={enabled} disabled={globalDisabled} onChange={onChange} />
    </li>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function Readout({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className={multiline ? 'whitespace-pre-line text-sm text-ink-800' : 'text-sm text-ink-800'}>
        {value}
      </div>
    </div>
  );
}

function SegmentedTwo<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`tap-44 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? 'bg-leaf-600 text-white' : 'text-ink-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SegmentedThree<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`tap-44 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? 'bg-leaf-600 text-white' : 'text-ink-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  active,
  onChange,
  disabled,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${
        active ? 'bg-leaf-500' : 'bg-ink-200'
      }`}
    >
      <span
        className={`toggle-knob absolute top-0.5 h-5 w-5 rounded-full shadow transition-all ${
          active ? 'start-[22px]' : 'start-0.5'
        }`}
        aria-hidden
      />
    </button>
  );
}

function cap(s: string): string {
  return s
    .split('-')
    .map((p, i) => (i === 0 ? p[0]?.toUpperCase() + p.slice(1) : p[0]?.toUpperCase() + p.slice(1)))
    .join('');
}
