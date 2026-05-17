'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  setMyWorkspaceLog,
  subscribeMemberWorkspaceLog,
  subscribeMyWorkspaceLog,
  subscribeMyWorkspaces,
  subscribeWorkspaceHabits,
  subscribeWorkspaceMembers,
} from '@/lib/workspaces';
import { todayKey } from '@/lib/dates';
import { useAuth } from '@/lib/auth';
import { useUnitLabel } from '@/lib/units';
import { useNumberFormatter } from '@/lib/format';
import { ChevronEnd } from './Chevron';
import { Avatar } from './Avatar';
import type {
  Workspace,
  WorkspaceDayLog,
  WorkspaceHabit,
  WorkspaceMember,
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
  const auth = useAuth();
  const myUid = auth.status === 'signed-in' ? auth.uid : null;
  const today = todayKey();

  const [habits, setHabits] = useState<WorkspaceHabit[] | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  /** Per-member day log for today, keyed by uid. Includes own log too so
   *  the cross-member widget renders a single uniform list. */
  const [memberLogs, setMemberLogs] = useState<
    Record<string, WorkspaceDayLog | null>
  >({});

  useEffect(() => {
    const unsub = subscribeWorkspaceHabits(workspace.id, (list) =>
      setHabits(list),
    );
    return unsub;
  }, [workspace.id]);

  useEffect(() => {
    const unsub = subscribeWorkspaceMembers(workspace.id, (list) =>
      setMembers(list),
    );
    return unsub;
  }, [workspace.id]);

  /** Subscribe to every member's log for today. Re-subscribes when the
   *  member list changes (someone joins or leaves). Keys depend on the
   *  sorted+joined uid list so React identity tracks the set, not the
   *  reference. */
  const memberUidsKey = [...workspace.memberUids].sort().join(',');
  useEffect(() => {
    const uids = workspace.memberUids;
    const unsubs = uids.map((uid) =>
      subscribeMemberWorkspaceLog(workspace.id, uid, today, (log) => {
        setMemberLogs((prev) => ({ ...prev, [uid]: log }));
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, memberUidsKey, today]);

  if (habits === null) {
    return null; // Silent while the first read lands.
  }

  /** Build a "members in display order" array — owner first, then
   *  joinedAt order, with the current user pulled to whichever side
   *  the locale-driven layout prefers (we keep them in their natural
   *  position so the avatar grid is stable across renders). */
  const orderedMembers: WorkspaceMember[] = [...members].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '');
  });
  // Fall-back for memberUids not yet in the subdoc list (rare race).
  for (const uid of workspace.memberUids) {
    if (!orderedMembers.some((m) => m.uid === uid)) {
      orderedMembers.push({
        uid,
        displayName: uid.slice(0, 8),
        joinedAt: '',
        role: 'member',
      });
    }
  }

  // Mine for the tap target on the row (already subscribed via per-member
  // logs map — pluck it out instead of running a parallel subscription).
  const myLog = myUid ? memberLogs[myUid] ?? null : null;

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
                entry={myLog?.entries[h.id]}
                onToggle={(next) =>
                  void setMyWorkspaceLog(workspace.id, h.id, today, next)
                }
                unitLabel={unitLabel}
                fmt={fmt}
                mode={workspace.mode}
                myUid={myUid}
                members={orderedMembers}
                memberLogs={memberLogs}
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
  mode,
  myUid,
  members,
  memberLogs,
}: {
  habit: WorkspaceHabit;
  entry: { value: number; completed: boolean } | undefined;
  onToggle: (next: { value: number; completed: boolean }) => void;
  unitLabel: (u: string | undefined) => string;
  fmt: (n: number) => string;
  mode: 'pair' | 'group';
  myUid: string | null;
  members: WorkspaceMember[];
  memberLogs: Record<string, WorkspaceDayLog | null>;
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
      <MemberGrid
        habitId={habit.id}
        mode={mode}
        myUid={myUid}
        members={members}
        memberLogs={memberLogs}
      />
    </div>
  );
}

/** Cross-member visibility — read-only view of every member's
 *  completion state for ONE habit today. Pair workspaces render two
 *  larger chips side-by-side; group workspaces render a compact
 *  avatar row. Tooltip / aria-label on each avatar names the member +
 *  their state so screen readers and hover-over both work.
 *
 *  The current user is included so the grid is uniform. The big tap
 *  target on the left of the row is what they USE to toggle; this
 *  grid is the consequence of that tap rendered alongside everyone
 *  else's. Removing self from the grid would make pair mode (just one
 *  avatar) feel lopsided.
 */
function MemberGrid({
  habitId,
  mode,
  myUid,
  members,
  memberLogs,
}: {
  habitId: string;
  mode: 'pair' | 'group';
  myUid: string | null;
  members: WorkspaceMember[];
  memberLogs: Record<string, WorkspaceDayLog | null>;
}) {
  const t = useTranslations();
  if (members.length === 0) return null;

  const isPair = mode === 'pair' && members.length === 2;

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center',
        isPair ? 'gap-2' : 'gap-0.5',
      )}
    >
      {members.map((m) => {
        const log = memberLogs[m.uid];
        const completed = log?.entries[habitId]?.completed === true;
        const isMe = m.uid === myUid;
        const label = t(
          completed
            ? 'workspaces.crossMember.done'
            : 'workspaces.crossMember.notDone',
          { name: isMe ? t('workspaces.crossMember.you') : m.displayName },
        );
        return (
          <span
            key={m.uid}
            title={label}
            aria-label={label}
            className={clsx(
              'relative inline-flex items-center justify-center',
              isPair ? '' : '-ms-1 first:ms-0',
            )}
          >
            <Avatar
              name={m.displayName}
              photoURL={m.photoURL}
              size={isPair ? 'sm' : 'xs'}
              className={clsx(
                completed
                  ? 'ring-2 ring-leaf-500 ring-offset-1'
                  : 'opacity-50 grayscale',
                isPair ? '' : 'ring-2 ring-white',
              )}
            />
            {completed && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-leaf-600 text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="h-2.5 w-2.5"
                >
                  <path
                    d="M5 12l5 5L20 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </span>
        );
      })}
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
