'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  setMyWorkspaceLog,
  subscribeMyWorkspaceLog,
  subscribeMyWorkspaces,
  subscribeWorkspaceHabits,
} from '@/lib/workspaces';
import { todayKey } from '@/lib/dates';
import { useUnitLabel } from '@/lib/units';
import { useNumberFormatter } from '@/lib/format';
import { ChevronEnd } from './Chevron';
import type {
  Workspace,
  WorkspaceDayLog,
  WorkspaceHabit,
} from '@/domain/types';

/** Top-level renderer mounted on the home page below the personal habit
 *  checklist. Subscribes to every workspace the user is in and shows one
 *  collapsible section per workspace, each with its own shared habit
 *  checklist. Renders nothing while loading or when the user has no
 *  workspaces — the home page gracefully degrades to "personal habits
 *  only" for the common case.
 *
 *  Streaks / fire / rewards stay individual and currently reflect ONLY
 *  the personal habits — shared-habit completions don't yet roll into
 *  the user's overall fire. Wiring that up is a follow-up; for now the
 *  workspace section carries a soft caption explaining the boundary so
 *  users don't expect the home ring to climb when they tap a shared
 *  checkbox.
 */
export function WorkspacesHomeSection() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);

  useEffect(() => {
    const unsub = subscribeMyWorkspaces((list) => setWorkspaces(list));
    return unsub;
  }, []);

  if (!workspaces || workspaces.length === 0) return null;

  return (
    <div className="space-y-4">
      {workspaces.map((ws) => (
        <WorkspaceChecklist key={ws.id} workspace={ws} />
      ))}
    </div>
  );
}

/** One workspace's shared-habit section. Header chip shows the icon +
 *  title + member count, linking to the workspace detail page. Below
 *  it: a tap-to-toggle list of the workspace's shared habits, with
 *  each member writing only their own daily log.
 */
function WorkspaceChecklist({ workspace }: { workspace: Workspace }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const unitLabel = useUnitLabel();
  const today = todayKey();

  const [habits, setHabits] = useState<WorkspaceHabit[] | null>(null);
  const [log, setLog] = useState<WorkspaceDayLog | null>(null);

  useEffect(() => {
    const unsub = subscribeWorkspaceHabits(workspace.id, (list) =>
      setHabits(list),
    );
    return unsub;
  }, [workspace.id]);

  useEffect(() => {
    const unsub = subscribeMyWorkspaceLog(workspace.id, today, (l) =>
      setLog(l),
    );
    return unsub;
  }, [workspace.id, today]);

  if (habits === null) {
    return null; // Silent while the first read lands.
  }

  const memberCount = workspace.memberUids.length;
  const memberLine =
    workspace.mode === 'pair' && memberCount === 2
      ? t('workspaces.list.memberCountTwo')
      : memberCount === 1
      ? t('workspaces.list.memberCountOne')
      : t('workspaces.list.memberCount', { n: fmt(memberCount) });

  const headerHref = `/workspaces/detail?id=${workspace.id}`;

  return (
    <section className="space-y-2">
      <Link
        href={headerHref}
        className="tap-44 flex items-center gap-2 rounded-xl border border-leaf-200 bg-leaf-50/60 px-3 py-2 transition hover:border-leaf-300"
      >
        <span className="text-lg" aria-hidden>
          {workspace.icon || (workspace.mode === 'pair' ? '🤝' : '🌿')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-900">
            {workspace.title}
          </span>
          <span className="numeral block text-[11px] text-leaf-700">
            {memberLine}
          </span>
        </span>
        <ChevronEnd className="h-4 w-4 text-leaf-700/70" />
      </Link>

      {habits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-2 text-xs text-ink-500">
          {t('workspaces.home.noHabitsYet')}
        </p>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) => (
            <li key={h.id}>
              <WorkspaceHabitRow
                habit={h}
                entry={log?.entries[h.id]}
                onToggle={(next) =>
                  void setMyWorkspaceLog(workspace.id, h.id, today, next)
                }
                unitLabel={unitLabel}
                fmt={fmt}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Single row inside a workspace checklist. Tap-to-toggle semantics
 *  mirror the personal `toggleHabit` action: good-with-target snaps
 *  between value=target/completed=true and value=0/completed=false;
 *  bad-with-limit snaps between value=limit/completed=true and
 *  value=limit+1/completed=false; everything else is value=1/0.
 *  Numeric value editing on shared habits lands later (needs a
 *  workspace-habit detail page, deferred).
 */
function WorkspaceHabitRow({
  habit,
  entry,
  onToggle,
  unitLabel,
  fmt,
}: {
  habit: WorkspaceHabit;
  entry: { value: number; completed: boolean } | undefined;
  onToggle: (next: { value: number; completed: boolean }) => void;
  unitLabel: (u: string | undefined) => string;
  fmt: (n: number) => string;
}) {
  const t = useTranslations();
  const done = entry?.completed === true;

  const handle = () => {
    const nextCompleted = !done;
    let value: number;
    if (habit.type === 'good' && habit.target !== undefined) {
      value = nextCompleted ? habit.target : 0;
    } else if (habit.type === 'bad') {
      value = nextCompleted ? habit.limit ?? 0 : (habit.limit ?? 0) + 1;
    } else {
      value = nextCompleted ? 1 : 0;
    }
    onToggle({ value, completed: nextCompleted });
  };

  return (
    <div
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 transition',
        done
          ? 'border-leaf-500 bg-leaf-50'
          : 'border-ink-200 bg-white hover:border-ink-300',
      )}
    >
      <button
        type="button"
        onClick={handle}
        aria-pressed={done}
        aria-label={
          done
            ? `${habit.name} — ${t('common.done')}`
            : `${habit.name} — ${t('common.add')}`
        }
        className="tap-44 -m-2 flex items-center justify-center p-2"
      >
        <Checkmark active={done} />
      </button>
      <span className="flex-1">
        <span className={clsx('block font-medium', done && 'text-leaf-800')}>
          {habit.name}
        </span>
        {habit.type === 'good' && habit.unit && habit.target !== undefined && (
          <span className="block text-xs text-ink-500">
            <span className="numeral">{fmt(habit.target)}</span>{' '}
            {unitLabel(habit.unit)}
          </span>
        )}
        {habit.type === 'bad' && habit.unit && habit.limit !== undefined && (
          <span className="block text-xs text-ink-500">
            ≤ <span className="numeral">{fmt(habit.limit)}</span>{' '}
            {unitLabel(habit.unit)}
          </span>
        )}
      </span>
    </div>
  );
}

/** Duplicate of the personal-checklist `Checkmark` so workspace habits
 *  visually match without importing from `HabitChecklist` (which would
 *  pull in unrelated personal-habit logic). Same DOM, same animation. */
function Checkmark({ active }: { active: boolean }) {
  return (
    <span
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
        active
          ? 'border-leaf-600 bg-leaf-600 text-white animate-pop'
          : 'border-ink-300 bg-white',
      )}
      aria-hidden
    >
      {active && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="h-5 w-5"
        >
          <path
            d="M5 12l5 5L20 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
