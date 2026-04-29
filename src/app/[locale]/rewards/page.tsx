'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import type { PunishmentOption, RewardOption, RewardTier } from '@/domain/types';
import { validatePunishment, type SafetyReason } from '@/lib/safety';

const TIERS: RewardTier[] = ['small', 'medium', 'big', 'major'];

const REWARD_PRESETS: { presetKey: string; tier: RewardTier }[] = [
  { presetKey: 'favouriteCoffee', tier: 'small' },
  { presetKey: 'freeTime', tier: 'small' },
  { presetKey: 'halalDessert', tier: 'small' },
  { presetKey: 'hobbyHour', tier: 'medium' },
  { presetKey: 'movieNight', tier: 'medium' },
  { presetKey: 'walkOutside', tier: 'medium' },
  { presetKey: 'favouriteFood', tier: 'big' },
  { presetKey: 'smallGift', tier: 'big' },
  { presetKey: 'newBook', tier: 'major' },
];

const PUNISHMENT_PRESETS: string[] = [
  'charityDonation',
  'deepCleanKitchen',
  'cleanBathroom',
  'noSocialMediaDay',
  'earlyWakeup',
  'coldShower',
  'extraDhikr',
];

export default function RewardsPage() {
  return (
    <ClientGate>
      <Rewards />
    </ClientGate>
  );
}

function Rewards() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const profile = useAppStore((s) => s.profile);
  const habits = useAppStore((s) => s.habits);
  const rewards = useAppStore((s) => s.rewards);
  const punishments = useAppStore((s) => s.punishments);
  const pendingRewards = useAppStore((s) => s.pendingRewards);
  const activePunishments = useAppStore((s) => s.activePunishments);
  const addReward = useAppStore((s) => s.addReward);
  const removeReward = useAppStore((s) => s.removeReward);
  const setRewardTier = useAppStore((s) => s.setRewardTier);
  const addPunishment = useAppStore((s) => s.addPunishment);
  const removePunishment = useAppStore((s) => s.removePunishment);
  const setHabitCritical = useAppStore((s) => s.setHabitCritical);
  const claimReward = useAppStore((s) => s.claimReward);
  const resolvePunishment = useAppStore((s) => s.resolvePunishment);

  if (!profile?.onboardingComplete) {
    return (
      <div className="space-y-3">
        <Link href="/onboarding" className="text-leaf-700 underline">
          {t('common.next')}
        </Link>
      </div>
    );
  }

  const visiblePending = pendingRewards.filter((r) => !r.claimedAt);
  const visiblePunishments = activePunishments.filter((p) => !p.doneAt);
  const criticalHabits = habits.filter((h) => h.isCritical);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{t('rewards.title')}</h1>
        <p className="text-sm text-ink-500">{t('rewards.intro')}</p>
      </header>

      {/* Pending rewards */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('rewards.pendingTitle')}
        </h2>
        {visiblePending.length === 0 ? (
          <p className="text-sm text-ink-500">{t('rewards.pendingEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {visiblePending.map((p) => {
              const habit = p.habitId ? habits.find((h) => h.id === p.habitId) : undefined;
              const option = p.rewardOptionId
                ? rewards.find((r) => r.id === p.rewardOptionId)
                : undefined;
              const originLabel =
                p.origin === 'dailyComplete'
                  ? t('rewards.origin.dailyComplete')
                  : t(`rewards.origin.${p.origin}` as any, {
                      n:
                        p.origin === 'streak7'
                          ? fmt(7)
                          : p.origin === 'streak30'
                          ? fmt(30)
                          : fmt(100),
                      habit: habit?.name ?? '',
                    });
              return (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-leaf-200 bg-leaf-50 p-3"
                >
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wide text-leaf-700">
                      {t(`rewards.tier.${p.tier}` as any)}
                    </div>
                    <div className="font-medium text-ink-900">
                      {option ? optionLabel(option, t) : t('rewards.noOptionAssigned')}
                    </div>
                    <div className="text-xs text-ink-500">{originLabel}</div>
                  </div>
                  <Button onClick={() => claimReward(p.id)}>{t('rewards.claim')}</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Active punishments */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('rewards.activePunishmentsTitle')}
        </h2>
        {visiblePunishments.length === 0 ? (
          <p className="text-sm text-ink-500">{t('rewards.activePunishmentsEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {visiblePunishments.map((p) => {
              const habit = habits.find((h) => h.id === p.habitId);
              const option = p.punishmentOptionId
                ? punishments.find((x) => x.id === p.punishmentOptionId)
                : undefined;
              return (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3"
                >
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wide text-red-700">
                      {habit?.name ?? '—'}
                    </div>
                    <div className="font-medium text-ink-900">
                      {option ? punishmentLabel(option, t) : t('rewards.defaultCharity')}
                    </div>
                    <div className="text-xs text-ink-500">
                      {t('rewards.missed', { date: p.date })}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => resolvePunishment(p.id)}>
                    {t('common.done')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Rewards setup */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">
            {t('rewards.rewardsTitle')}
          </h2>
          <p className="text-xs text-ink-500">{t('rewards.rewardsHint')}</p>
        </div>
        <RewardEditor
          rewards={rewards}
          onAdd={addReward}
          onRemove={removeReward}
          onSetTier={setRewardTier}
        />
      </Card>

      {/* Punishments setup */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">
            {t('rewards.punishmentsTitle')}
          </h2>
          <p className="text-xs text-ink-500">{t('rewards.punishmentsHint')}</p>
        </div>
        <PunishmentEditor
          punishments={punishments}
          onAdd={addPunishment}
          onRemove={removePunishment}
        />
      </Card>

      {/* Critical habits */}
      <Card className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">
            {t('rewards.criticalTitle')}
          </h2>
          <p className="text-xs text-ink-500">{t('rewards.criticalHint')}</p>
        </div>
        {habits.length === 0 ? (
          <p className="text-sm text-ink-500">{t('rewards.noCriticalHabits')}</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {habits.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">{h.name}</span>
                <CriticalToggle
                  active={!!h.isCritical}
                  onChange={(v) => setHabitCritical(h.id, v)}
                  label={t('rewards.isCritical')}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function optionLabel(o: RewardOption, t: (k: string) => string) {
  return o.presetKey ? t(`rewards.presets.${o.presetKey}` as any) : o.label;
}

function punishmentLabel(o: PunishmentOption, t: (k: string) => string) {
  return o.presetKey ? t(`rewards.punishmentPresets.${o.presetKey}` as any) : o.label;
}

function RewardEditor({
  rewards,
  onAdd,
  onRemove,
  onSetTier,
}: {
  rewards: RewardOption[];
  onAdd: (label: string, tier: RewardTier, presetKey?: string) => void;
  onRemove: (id: string) => void;
  onSetTier: (id: string, tier: RewardTier) => void;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState('');
  const [tier, setTier] = useState<RewardTier>('small');

  const usedPresets = new Set(rewards.map((r) => r.presetKey).filter(Boolean) as string[]);
  const presetSuggestions = REWARD_PRESETS.filter((p) => !usedPresets.has(p.presetKey));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed, tier);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      {/* Existing rewards grouped by tier */}
      {TIERS.map((tt) => {
        const items = rewards.filter((r) => r.tier === tt);
        return (
          <div key={tt} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-600">
                {t(`rewards.tier.${tt}` as any)}
              </span>
              <span className="text-[11px] text-ink-400">
                {t(`rewards.tierHint.${tt}` as any)}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-ink-400">—</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs"
                  >
                    <span>{optionLabel(r, t)}</span>
                    <select
                      value={r.tier}
                      onChange={(e) => onSetTier(r.id, e.target.value as RewardTier)}
                      className="bg-transparent text-[11px] text-ink-500 focus:outline-none"
                      aria-label={t('rewards.tier.' + r.tier as any)}
                    >
                      {TIERS.map((tx) => (
                        <option key={tx} value={tx}>
                          {t(`rewards.tierShort.${tx}` as any)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemove(r.id)}
                      aria-label={t('rewards.delete')}
                      className="text-ink-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {/* Preset suggestions */}
      {presetSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-ink-500">+</div>
          <ul className="flex flex-wrap gap-1.5">
            {presetSuggestions.map((p) => (
              <li key={p.presetKey}>
                <button
                  type="button"
                  onClick={() => onAdd(t(`rewards.presets.${p.presetKey}` as any), p.tier, p.presetKey)}
                  className="rounded-full border border-dashed border-ink-300 px-2.5 py-1 text-xs text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
                >
                  + {t(`rewards.presets.${p.presetKey}` as any)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Custom add */}
      <form onSubmit={onSubmit} className="flex flex-wrap items-stretch gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('rewards.rewardLabelPlaceholder')}
          className="flex-1 rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as RewardTier)}
          className="rounded-xl border border-ink-200 bg-white px-2 py-2 text-sm"
        >
          {TIERS.map((tt) => (
            <option key={tt} value={tt}>
              {t(`rewards.tierShort.${tt}` as any)}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={!draft.trim()}>
          {t('rewards.addReward')}
        </Button>
      </form>
    </div>
  );
}

function PunishmentEditor({
  punishments,
  onAdd,
  onRemove,
}: {
  punishments: PunishmentOption[];
  onAdd: (
    label: string,
    presetKey?: string,
  ) => { ok: boolean; reason?: SafetyReason; added?: PunishmentOption };
  onRemove: (id: string) => void;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<SafetyReason | null>(null);

  const usedPresets = new Set(
    punishments.map((p) => p.presetKey).filter(Boolean) as string[],
  );
  const presetSuggestions = PUNISHMENT_PRESETS.filter((k) => !usedPresets.has(k));

  const tryAdd = (label: string, presetKey?: string) => {
    setError(null);
    const verdict = validatePunishment(label);
    if (!verdict.ok) {
      setError(verdict.reason ?? 'harm');
      return;
    }
    onAdd(label, presetKey);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    tryAdd(trimmed);
    setDraft('');
  };

  return (
    <div className="space-y-3">
      {punishments.length === 0 ? (
        <p className="text-xs text-ink-400">{t('rewards.defaultCharity')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {punishments.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs"
            >
              <span>{punishmentLabel(p, t)}</span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                aria-label={t('rewards.delete')}
                className="text-ink-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {presetSuggestions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {presetSuggestions.map((k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() =>
                  tryAdd(t(`rewards.punishmentPresets.${k}` as any), k)
                }
                className="rounded-full border border-dashed border-ink-300 px-2.5 py-1 text-xs text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
              >
                + {t(`rewards.punishmentPresets.${k}` as any)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="flex flex-wrap items-stretch gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('rewards.punishmentLabelPlaceholder')}
          className="flex-1 rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
        <Button type="submit" disabled={!draft.trim()}>
          {t('rewards.addPunishment')}
        </Button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <strong>{t('rewards.safety.blocked')}</strong>{' '}
          {t(`rewards.safety.${error}` as any)}
        </p>
      )}
    </div>
  );
}

function CriticalToggle({
  active,
  onChange,
  label,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={() => onChange(!active)}
      className={`relative h-6 w-11 rounded-full transition ${
        active ? 'bg-red-500' : 'bg-ink-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          active ? 'start-[22px]' : 'start-0.5'
        }`}
        aria-hidden
      />
    </button>
  );
}
