'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import { todayKey } from '@/lib/dates';
import type { SavingEntry } from '@/domain/types';

export default function SavingsPage() {
  return (
    <ClientGate>
      <Savings />
    </ClientGate>
  );
}

type Direction = 'in' | 'out';

function Savings() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const entries = useAppStore((s) => s.savings);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries],
  );

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + e.amount, 0),
    [entries],
  );
  const last30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    return entries
      .filter((e) => e.date >= cutoffKey)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  // Naive projection: extrapolate the last-30-day net deposit pace to a year.
  // Negative paces mean the user is spending down — show as a withdrawal pace.
  const yearlyPace = Math.round(last30 * (365 / 30));

  return (
    <div className="space-y-4">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('common.back')}
      </Link>
      <h1 className="text-2xl font-semibold">{t('savings.title')}</h1>
      <p className="text-sm text-ink-600">{t('savings.intro')}</p>

      <Card
        className={
          total >= 0
            ? 'border-leaf-200 bg-leaf-50'
            : 'border-red-200 bg-red-50'
        }
      >
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-ink-600">
            {t('savings.balance')}
          </span>
          <span
            className={`numeral text-2xl font-semibold ${
              total >= 0 ? 'text-leaf-700' : 'text-red-700'
            }`}
          >
            {fmt(Math.round(total))}
          </span>
        </div>
        {entries.length > 0 && (
          <div className="mt-2 flex items-baseline justify-between text-xs text-ink-600">
            <span>{t('savings.last30')}</span>
            <span
              className={`numeral font-medium ${
                last30 >= 0 ? 'text-leaf-700' : 'text-red-700'
              }`}
            >
              {last30 >= 0 ? '+' : '−'}
              {fmt(Math.abs(Math.round(last30)))}
            </span>
          </div>
        )}
        {entries.length > 0 && (
          <p className="numeral mt-1 text-xs text-ink-500">
            {yearlyPace >= 0
              ? t('savings.yearlyPace', { value: fmt(yearlyPace) })
              : t('savings.yearlyDrain', { value: fmt(Math.abs(yearlyPace)) })}
          </p>
        )}
      </Card>

      <AddSavingForm />

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-sm text-ink-500">
          {t('savings.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((e) => (
            <li key={e.id}>
              <EntryRow entry={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddSavingForm() {
  const t = useTranslations();
  const addSavingEntry = useAppStore((s) => s.addSavingEntry);

  const [direction, setDirection] = useState<Direction>('in');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());

  const canSubmit = Number(amount) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const raw = Math.round(Number(amount));
    addSavingEntry({
      amount: direction === 'in' ? raw : -raw,
      date,
      note: note.trim() || undefined,
    });
    setAmount('');
    setNote('');
    setDate(todayKey());
    setDirection('in');
  };

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('savings.addTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium ${
              direction === 'in'
                ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                : 'border-ink-200 bg-white text-ink-700'
            }`}
          >
            {t('savings.deposit')}
          </button>
          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium ${
              direction === 'out'
                ? 'border-red-500 bg-red-50 text-red-800'
                : 'border-ink-200 bg-white text-ink-700'
            }`}
          >
            {t('savings.withdrawal')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-ink-600">{t('savings.amountLabel')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100000000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="numeral w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              required
            />
          </label>
          <label className="col-span-2 block space-y-1">
            <span className="text-xs text-ink-600">{t('savings.dateLabel')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="numeral w-full rounded-xl border border-ink-200 bg-white px-3 py-2 outline-none focus:border-leaf-500"
              required
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-ink-600">{t('savings.noteLabel')}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('savings.notePlaceholder')}
            maxLength={140}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit}>
            {t('savings.addSubmit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EntryRow({ entry }: { entry: SavingEntry }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const deleteSavingEntry = useAppStore((s) => s.deleteSavingEntry);

  const isDeposit = entry.amount >= 0;
  const tone = isDeposit
    ? 'border-leaf-200 bg-leaf-50/40'
    : 'border-red-200 bg-red-50/40';
  const sign = isDeposit ? '+' : '−';
  const amountTone = isDeposit ? 'text-leaf-700' : 'text-red-700';

  return (
    <Card className={tone}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="numeral text-xs text-ink-500">{entry.date}</span>
        <span className={`numeral text-base font-semibold ${amountTone}`}>
          {sign}
          {fmt(Math.abs(entry.amount))}
        </span>
      </div>
      {entry.note && (
        <p className="pt-1 text-sm text-ink-700">{entry.note}</p>
      )}
      <div className="mt-2 flex">
        <button
          type="button"
          onClick={() => {
            if (confirm(t('savings.deleteConfirm'))) deleteSavingEntry(entry.id);
          }}
          className="ms-auto text-xs text-red-600 underline-offset-4 hover:underline"
        >
          {t('common.delete')}
        </button>
      </div>
    </Card>
  );
}
