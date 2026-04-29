'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ClientGate } from '@/components/ClientGate';
import { IftarCountdown } from '@/components/IftarCountdown';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import {
  isLaylatQadrCandidate,
  isRamadanModeActive,
  ramadanPhase,
  type RamadanPhase,
} from '@/lib/hijri';
import { todayKey } from '@/lib/dates';

const PRAYER_KEYS = [
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
  'taraweeh',
  'tahajjud',
] as const;

const PREP_ITEMS = [
  'fastMondaysThursdays',
  'increaseQuran',
  'reduceScreens',
  'settleDebts',
  'stockKitchen',
  'setRamadanGoals',
] as const;

export default function RamadanPage() {
  return (
    <ClientGate>
      <RamadanHub />
    </ClientGate>
  );
}

function RamadanHub() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const profile = useAppStore((s) => s.profile);
  const ensure = useAppStore((s) => s.ensureRamadanRecord);
  const setIftar = useAppStore((s) => s.setIftarTime);
  const setFasts = useAppStore((s) => s.setRamadanFasts);
  const setJuz = useAppStore((s) => s.setJuzRead);
  const setTaraweeh = useAppStore((s) => s.setTaraweehNights);
  const addSadaqah = useAppStore((s) => s.addSadaqah);
  const toggleLaylat = useAppStore((s) => s.toggleLaylatNight);
  const setShawwal = useAppStore((s) => s.setShawwalFasts);
  const togglePrayer = useAppStore((s) => s.toggleRamadanPrayer);

  const phaseInfo = useMemo(() => ramadanPhase(), []);
  const hijriYear = phaseInfo.hijri.year;

  // Lazy-create the per-year record on first visit.
  useEffect(() => {
    ensure(hijriYear);
  }, [ensure, hijriYear]);

  const record = useAppStore((s) =>
    s.ramadan.find((r) => r.hijriYear === hijriYear),
  );
  const ramadanActive = profile
    ? isRamadanModeActive(profile.ramadanMode)
    : false;

  if (!record) return null;

  const today = todayKey();
  const todayPrayers = record.prayersByDate[today] ?? [];
  const effectivePhase: RamadanPhase = ramadanActive
    ? phaseInfo.phase === 'pre' || phaseInfo.phase === 'shawwal' || phaseInfo.phase === 'off'
      ? 'active'
      : phaseInfo.phase
    : phaseInfo.phase;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t(`ramadan.phase.${effectivePhase}` as any)}
        </p>
        <h1 className="text-2xl font-semibold leading-tight">
          {t('ramadan.title')}
        </h1>
        {effectivePhase === 'active' || effectivePhase === 'lastTen' ? (
          <p className="numeral pt-1 text-sm text-ink-500">
            {t('ramadan.dayOf', { n: fmt(phaseInfo.dayOfRamadan ?? 1) })}
          </p>
        ) : effectivePhase === 'shawwal' ? (
          <p className="numeral pt-1 text-sm text-ink-500">
            {t('ramadan.dayOfShawwal', { n: fmt(phaseInfo.dayOfShawwal ?? 1) })}
          </p>
        ) : effectivePhase === 'pre' ? (
          <p className="numeral pt-1 text-sm text-ink-500">
            {phaseInfo.daysUntilRamadan === 1
              ? t('ramadan.preBanner.titleOne')
              : t('ramadan.preBanner.title', {
                  n: fmt(phaseInfo.daysUntilRamadan ?? 14),
                })}
          </p>
        ) : null}
      </header>

      {/* Iftar countdown — only when actively in Ramadan or override on. */}
      {(effectivePhase === 'active' || effectivePhase === 'lastTen') && (
        <Card className="space-y-3 border-leaf-200 bg-gradient-to-br from-leaf-50 via-white to-sand-50">
          <IftarCountdown iftarTime={record.iftarTime} />
          <div>
            <label className="block text-xs font-medium text-ink-700">
              {t('ramadan.iftar.set')}
            </label>
            <input
              type="time"
              value={record.iftarTime}
              onChange={(e) => setIftar(hijriYear, e.target.value)}
              className="numeral mt-1 rounded-xl border border-ink-200 bg-white px-3 py-1.5 outline-none focus:border-leaf-500"
            />
          </div>
        </Card>
      )}

      {/* Last 10 nights special section */}
      {effectivePhase === 'lastTen' && (
        <Card className="space-y-3 border-sand-200 bg-sand-50">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('ramadan.lastTenBanner.title')}
          </h2>
          <p className="text-sm text-ink-700">{t('ramadan.lastTenBanner.body')}</p>

          <div>
            <h3 className="text-xs font-medium text-ink-700">
              {t('ramadan.lastTenSection.title')}
            </h3>
            <p className="text-xs text-ink-500">
              {t('ramadan.lastTenSection.body')}
            </p>
            <ul className="mt-2 grid grid-cols-5 gap-2">
              {[21, 23, 25, 27, 29].map((d) => {
                // Try to map this odd Ramadan day to the Gregorian YYYY-MM-DD
                // by stepping forward from "today" if we're in lastTen.
                const offset = d - (phaseInfo.dayOfRamadan ?? 21);
                const date = new Date();
                date.setDate(date.getDate() + offset);
                const key = date.toISOString().slice(0, 10);
                const marked = record.laylatNights[key] === true;
                const isToday =
                  isLaylatQadrCandidate(phaseInfo.dayOfRamadan ?? 0) &&
                  d === (phaseInfo.dayOfRamadan ?? 0);
                return (
                  <li key={d}>
                    <button
                      type="button"
                      onClick={() => toggleLaylat(hijriYear, key)}
                      className={`tap-44 w-full rounded-xl border px-2 py-2 text-center transition ${
                        marked
                          ? 'border-sand-500 bg-sand-100 text-sand-700'
                          : 'border-ink-200 bg-white text-ink-700'
                      } ${isToday ? 'ring-2 ring-leaf-400' : ''}`}
                    >
                      <span className="numeral block text-sm font-semibold">
                        {fmt(d)}
                      </span>
                      <span className="block text-[10px] text-ink-500">
                        {key.slice(5)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-sand-600">
              {t('ramadan.lastTenSection.duaTitle')}
            </p>
            <p
              dir="rtl"
              className="pt-1 font-persian text-lg leading-loose text-ink-900"
            >
              {t('ramadan.lastTenSection.duaArabic')}
            </p>
            <p className="pt-1 text-sm italic text-ink-700">
              {t('ramadan.lastTenSection.duaTranslit')}
            </p>
            <p className="pt-1 text-sm text-ink-700">
              {t('ramadan.lastTenSection.duaTranslation')}
            </p>
            <p className="pt-2 text-xs text-ink-500">
              — {t('ramadan.lastTenSection.duaSource')}
            </p>
          </div>
        </Card>
      )}

      {/* Today's prayers */}
      {(effectivePhase === 'active' || effectivePhase === 'lastTen') && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('ramadan.prayers.title')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRAYER_KEYS.map((p) => {
              const done = todayPrayers.includes(p);
              return (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => togglePrayer(hijriYear, today, p)}
                    aria-pressed={done}
                    className={`tap-44 w-full rounded-xl border px-3 py-2 text-start text-sm transition ${
                      done
                        ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                        : 'border-ink-200 bg-white text-ink-700'
                    }`}
                  >
                    {t(`ramadan.prayers.${p}` as any)}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Trackers */}
      {(effectivePhase === 'active' || effectivePhase === 'lastTen') && (
        <Card className="space-y-4">
          <CounterRow
            label={t('ramadan.trackers.fasts')}
            hint={t('ramadan.trackers.fastsHint')}
            value={record.fastsCompleted}
            max={30}
            onChange={(v) => setFasts(hijriYear, v)}
            fmt={fmt}
          />
          <CounterRow
            label={t('ramadan.trackers.juz')}
            hint={t('ramadan.trackers.juzHint')}
            value={record.juzRead}
            max={30}
            onChange={(v) => setJuz(hijriYear, v)}
            fmt={fmt}
          />
          <CounterRow
            label={t('ramadan.trackers.taraweeh')}
            value={record.taraweehNights}
            max={30}
            onChange={(v) => setTaraweeh(hijriYear, v)}
            fmt={fmt}
          />
          <SadaqahRow
            label={t('ramadan.trackers.sadaqah')}
            hint={t('ramadan.trackers.sadaqahHint')}
            total={record.sadaqahTotal}
            onAdd={(amount) => addSadaqah(hijriYear, amount)}
            fmt={fmt}
            addLabel={t('ramadan.trackers.sadaqahAdd')}
          />
        </Card>
      )}

      {/* Pre-Ramadan prep */}
      {effectivePhase === 'pre' && (
        <Card className="space-y-3 border-sand-200 bg-sand-50">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('ramadan.preSection.title')}
          </h2>
          <ul className="space-y-1 text-sm text-ink-700">
            {PREP_ITEMS.map((k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sand-500" />
                <span className="leading-relaxed">
                  {t(`ramadan.preSection.items.${k}` as any)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Shawwal six fasts */}
      {effectivePhase === 'shawwal' && (
        <Card className="space-y-3 border-sand-200 bg-sand-50">
          <h2 className="text-sm font-semibold text-ink-800">
            {t('ramadan.shawwalBanner.title')}
          </h2>
          <p className="text-sm text-ink-700">{t('ramadan.shawwalBanner.body')}</p>
          <CounterRow
            label={t('ramadan.trackers.shawwalFasts')}
            value={record.shawwalFasts}
            max={6}
            onChange={(v) => setShawwal(hijriYear, v)}
            fmt={fmt}
          />
        </Card>
      )}

      {effectivePhase === 'off' && (
        <Card>
          <p className="text-sm text-ink-600">{t('ramadan.noActiveBody')}</p>
        </Card>
      )}
    </div>
  );
}

function CounterRow({
  label,
  hint,
  value,
  max,
  onChange,
  fmt,
}: {
  label: string;
  hint?: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  fmt: (n: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-ink-800">{label}</div>
          {hint && <div className="text-[11px] text-ink-500">{hint}</div>}
        </div>
        <div className="numeral text-sm text-ink-700">
          {fmt(value)} / {fmt(max)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
          className="tap-44 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-lg disabled:opacity-50"
          aria-label="-"
        >
          −
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-leaf-500 transition-all"
            style={{ width: `${Math.round((value / max) * 100)}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="tap-44 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-lg disabled:opacity-50"
          aria-label="+"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SadaqahRow({
  label,
  hint,
  total,
  onAdd,
  fmt,
  addLabel,
}: {
  label: string;
  hint?: string;
  total: number;
  onAdd: (amount: number) => void;
  fmt: (n: number) => string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-ink-800">{label}</div>
          {hint && <div className="text-[11px] text-ink-500">{hint}</div>}
        </div>
        <div className="numeral text-sm text-ink-700">{fmt(total)}</div>
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Math.max(0, Math.floor(Number(draft) || 0));
          if (n > 0) onAdd(n);
          setDraft('');
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="numeral w-24 rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
        />
        <Button type="submit" disabled={!draft.trim()}>
          {addLabel}
        </Button>
      </form>
    </div>
  );
}
