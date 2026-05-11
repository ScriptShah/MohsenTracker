'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack, ChevronEnd } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { useAppStore } from '@/lib/store';
import { useNumberFormatter } from '@/lib/format';
import type { Debt, DebtDirection } from '@/domain/types';

export default function DebtsPage() {
  return (
    <ClientGate>
      <Debts />
    </ClientGate>
  );
}

function Debts() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const debts = useAppStore((s) => s.debts);

  const active = useMemo(() => debts.filter((d) => !d.settledAt), [debts]);
  const settled = useMemo(
    () =>
      debts
        .filter((d) => d.settledAt)
        .sort((a, b) => (a.settledAt! < b.settledAt! ? 1 : -1)),
    [debts],
  );

  const theyOwe = useMemo(
    () =>
      active
        .filter((d) => d.direction === 'theyOwe')
        .reduce((sum, d) => sum + d.amount, 0),
    [active],
  );
  const youOwe = useMemo(
    () =>
      active
        .filter((d) => d.direction === 'youOwe')
        .reduce((sum, d) => sum + d.amount, 0),
    [active],
  );
  const net = theyOwe - youOwe;

  const [showSettled, setShowSettled] = useState(false);

  return (
    <div className="space-y-4">
      <Link
        href="/categories"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowBack /> {t('common.back')}
      </Link>
      <h1 className="text-2xl font-semibold">{t('debts.title')}</h1>
      <p className="text-sm text-ink-600">{t('debts.intro')}</p>

      <div className="grid grid-cols-2 gap-2">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-leaf-700">
            {t('debts.theyOwe')}
          </p>
          <p className="numeral text-2xl font-semibold text-ink-900">
            {fmt(Math.round(theyOwe))}
          </p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-red-600">
            {t('debts.youOwe')}
          </p>
          <p className="numeral text-2xl font-semibold text-ink-900">
            {fmt(Math.round(youOwe))}
          </p>
        </Card>
      </div>
      <Card
        className={
          net >= 0
            ? 'border-leaf-200 bg-leaf-50'
            : 'border-red-200 bg-red-50'
        }
      >
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-ink-600">
            {t('debts.net')}
          </span>
          <span
            className={`numeral text-xl font-semibold ${
              net >= 0 ? 'text-leaf-700' : 'text-red-700'
            }`}
          >
            {net >= 0 ? '+' : '−'}
            {fmt(Math.abs(Math.round(net)))}
          </span>
        </div>
      </Card>

      <AddDebtForm />

      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-sm text-ink-500">
          {t('debts.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-700">
            {t('debts.activeTitle')}
          </h2>
          <ul className="space-y-2">
            {active.map((d) => (
              <li key={d.id}>
                <DebtRow debt={d} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {settled.length > 0 && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => setShowSettled((v) => !v)}
            className="text-sm text-leaf-700 underline-offset-4 hover:underline"
          >
            {showSettled
              ? t('debts.hideSettled', { n: fmt(settled.length) })
              : t('debts.showSettled', { n: fmt(settled.length) })}
          </button>
          {showSettled && (
            <ul className="space-y-2">
              {settled.map((d) => (
                <li key={d.id}>
                  <DebtRow debt={d} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AddDebtForm() {
  const t = useTranslations();
  const addDebt = useAppStore((s) => s.addDebt);

  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('theyOwe');
  const [notes, setNotes] = useState('');

  const canSubmit = counterparty.trim().length > 0 && Number(amount) > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    addDebt({
      counterparty: counterparty.trim(),
      amount: Math.max(0, Math.round(Number(amount))),
      direction,
      notes: notes.trim() || undefined,
    });
    setCounterparty('');
    setAmount('');
    setNotes('');
    setDirection('theyOwe');
  };

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('debts.addTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection('theyOwe')}
            className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium ${
              direction === 'theyOwe'
                ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                : 'border-ink-200 bg-white text-ink-700'
            }`}
          >
            {t('debts.directionTheyOwe')}
          </button>
          <button
            type="button"
            onClick={() => setDirection('youOwe')}
            className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium ${
              direction === 'youOwe'
                ? 'border-red-500 bg-red-50 text-red-800'
                : 'border-ink-200 bg-white text-ink-700'
            }`}
          >
            {t('debts.directionYouOwe')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 block space-y-1">
            <span className="text-xs text-ink-600">
              {t('debts.counterpartyLabel')}
            </span>
            <input
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={t('debts.counterpartyPlaceholder')}
              maxLength={60}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-ink-600">{t('debts.amountLabel')}</span>
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
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-ink-600">{t('debts.notesLabel')}</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('debts.notesPlaceholder')}
            maxLength={140}
            className="w-full rounded-xl border border-ink-200 px-3 py-2 outline-none focus:border-leaf-500"
          />
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit}>
            {t('debts.addSubmit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}


function DebtRow({ debt }: { debt: Debt }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const settleDebt = useAppStore((s) => s.settleDebt);
  const unsettleDebt = useAppStore((s) => s.unsettleDebt);
  const deleteDebt = useAppStore((s) => s.deleteDebt);

  const settled = !!debt.settledAt;
  const tone =
    debt.direction === 'theyOwe'
      ? 'border-leaf-200 bg-leaf-50/40'
      : 'border-red-200 bg-red-50/40';
  const sign = debt.direction === 'theyOwe' ? '+' : '−';
  const amountTone =
    debt.direction === 'theyOwe' ? 'text-leaf-700' : 'text-red-700';

  return (
    <Card className={`${tone} ${settled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`font-medium ${settled ? 'line-through' : ''}`}>
              {debt.counterparty}
            </span>
            <span className={`numeral text-base font-semibold ${amountTone}`}>
              {sign}
              {fmt(debt.amount)}
            </span>
          </div>
          <div className="text-xs text-ink-500">
            {debt.direction === 'theyOwe'
              ? t('debts.directionTheyOwe')
              : t('debts.directionYouOwe')}
          </div>
          {debt.notes && (
            <p className="pt-1 text-xs text-ink-600">{debt.notes}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {settled ? (
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => unsettleDebt(debt.id)}
          >
            {t('debts.unsettle')}
          </Button>
        ) : (
          <Button
            type="button"
            className="text-xs"
            onClick={() => settleDebt(debt.id)}
          >
            {t('debts.markSettled')}
          </Button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(t('debts.deleteConfirm'))) deleteDebt(debt.id);
          }}
          className="ms-auto text-xs text-red-600 underline-offset-4 hover:underline"
        >
          {t('common.delete')}
        </button>
      </div>
    </Card>
  );
}
