'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ArrowBack } from '@/components/Chevron';
import { ClientGate } from '@/components/ClientGate';
import { Avatar } from '@/components/Avatar';
import {
  LeaveWorkspaceSheet,
  type LeaveChoice,
} from '@/components/LeaveWorkspaceSheet';
import { useAuth } from '@/lib/auth';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';
import {
  createWorkspaceHabit,
  deleteWorkspace,
  deleteWorkspaceHabit,
  leaveWorkspace,
  nextWorkspaceEntry,
  rotateInviteCode,
  setMyWorkspaceLog,
  subscribeMemberWorkspaceLog,
  subscribeWorkspace,
  subscribeWorkspaceEvents,
  subscribeWorkspaceHabits,
  subscribeWorkspaceMembers,
  updateWorkspaceHabit,
  workspaceEntryStatus,
} from '@/lib/workspaces';
import { todayKey } from '@/lib/dates';
import type {
  HabitLogStatus,
  HabitType,
  Workspace,
  WorkspaceDayLog,
  WorkspaceEvent,
  WorkspaceHabit,
  WorkspaceMember,
} from '@/domain/types';
import clsx from 'clsx';

export default function WorkspaceDetailPage() {
  return (
    <ClientGate>
      <Suspense>
        <WorkspaceDetail />
      </Suspense>
    </ClientGate>
  );
}

function WorkspaceDetail() {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const router = useRouter();
  const locale = useLocale();
  const auth = useAuth();
  const wsId = (useSearchParams().get('id') ?? '').trim();

  const [workspace, setWorkspace] = useState<Workspace | null | undefined>(
    undefined,
  );
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [busy, setBusy] = useState<'leave' | 'delete' | 'rotate' | null>(null);
  const [copied, setCopied] = useState(false);

  // Subscribe to the workspace doc.
  useEffect(() => {
    if (!wsId) return;
    const unsub = subscribeWorkspace(wsId, (ws) => setWorkspace(ws));
    return unsub;
  }, [wsId]);

  // Subscribe to the members subcollection.
  useEffect(() => {
    if (!wsId) return;
    const unsub = subscribeWorkspaceMembers(wsId, (list) => setMembers(list));
    return unsub;
  }, [wsId]);

  const currentUid = auth.status === 'signed-in' ? auth.uid : null;
  const isOwner = !!workspace && !!currentUid && workspace.ownerUid === currentUid;
  const isMember =
    !!workspace && !!currentUid && workspace.memberUids.includes(currentUid);

  // Build the invite link from current origin + locale + code.
  const inviteUrl = useMemo(() => {
    if (!workspace) return '';
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${locale}/workspaces/join?code=${workspace.inviteCode}`;
  }, [workspace, locale]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  const onRotate = async () => {
    if (!workspace) return;
    if (!confirm(t('workspaces.detail.invite.rotateConfirm'))) return;
    setBusy('rotate');
    await rotateInviteCode(workspace.id, workspace.inviteCode);
    setBusy(null);
  };

  const [showLeaveSheet, setShowLeaveSheet] = useState(false);
  const onLeave = () => {
    if (!workspace) return;
    if (isOwner) {
      alert(t('workspaces.detail.leave.ownerCant'));
      return;
    }
    setShowLeaveSheet(true);
  };
  const onLeaveConfirm = async (choice: LeaveChoice) => {
    if (!workspace) return;
    setBusy('leave');
    const ok = await leaveWorkspace(workspace.id, {
      wipeLogs: choice === 'wipe',
    });
    setBusy(null);
    setShowLeaveSheet(false);
    if (ok) router.replace('/workspaces');
  };

  const onDelete = async () => {
    if (!workspace) return;
    if (!confirm(t('workspaces.detail.delete.confirm'))) return;
    setBusy('delete');
    const ok = await deleteWorkspace(workspace.id);
    setBusy(null);
    if (ok) router.replace('/workspaces');
  };

  // Initial undefined = still loading. Null = subscription returned nothing.
  if (workspace === undefined) {
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="text-sm text-ink-500">{t('workspaces.detail.loading')}</p>
      </div>
    );
  }

  if (!workspace || !isMember) {
    return (
      <div className="space-y-3">
        <BackLink />
        <Card className="space-y-2 border-sand-200 bg-sand-50">
          <p className="text-sm font-semibold text-ink-800">
            {t('workspaces.detail.notFoundTitle')}
          </p>
          <p className="text-sm text-ink-700">
            {t('workspaces.detail.notFoundBody')}
          </p>
        </Card>
      </div>
    );
  }

  const memberCount = workspace.memberUids.length;
  const modeLabel =
    workspace.mode === 'pair'
      ? t('workspaces.detail.modePairLabel')
      : t('workspaces.detail.modeGroupLabel');

  return (
    <div className="space-y-5">
      <BackLink />

      <header className="flex items-start gap-3">
        <span className="text-4xl" aria-hidden>
          {workspace.icon || (workspace.mode === 'pair' ? '🤝' : '🌿')}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-tight text-ink-900">
            {workspace.title}
          </h1>
          <p className="numeral text-xs text-ink-500">
            {modeLabel} ·{' '}
            {t('workspaces.detail.membersCount', {
              n: fmt(memberCount),
              max: fmt(workspace.maxMembers),
            })}
          </p>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {t('workspaces.detail.members')}
        </h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.uid}
              className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2"
            >
              <Avatar name={m.displayName} photoURL={m.photoURL} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">
                  {m.displayName}
                </div>
                <div className="flex items-center gap-1.5">
                  {m.role === 'owner' && (
                    <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-medium text-leaf-700">
                      {t('workspaces.detail.ownerBadge')}
                    </span>
                  )}
                  {currentUid === m.uid && (
                    <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-medium text-sand-700">
                      {t('workspaces.detail.youBadge')}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
          {/* Members in memberUids but no subdoc yet (rare race during join). */}
          {workspace.memberUids
            .filter((uid) => !members.some((m) => m.uid === uid))
            .map((uid) => (
              <li
                key={uid}
                className="flex items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-3 py-2 opacity-60"
              >
                <Avatar name="·" size="md" />
                <span className="text-xs text-ink-500">{uid.slice(0, 8)}…</span>
              </li>
            ))}
        </ul>
      </section>

      {workspace.mode === 'pair' && (
        <PairTodaySection
          workspace={workspace}
          members={members}
          myUid={currentUid}
        />
      )}

      <SharedHabitsSection wsId={workspace.id} isOwner={isOwner} />

      <ActivitySection wsId={workspace.id} />

      <Card className="space-y-2 border-leaf-200 bg-leaf-50">
        <p className="text-xs uppercase tracking-wide text-leaf-700">
          {t('workspaces.detail.invite.title')}
        </p>
        <p className="text-xs text-ink-600">
          {t('workspaces.detail.invite.body', {
            max: fmt(workspace.maxMembers),
          })}
        </p>
        <div className="space-y-1.5">
          <label className="block text-xs text-ink-500">
            {t('workspaces.detail.invite.codeLabel')}
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-base font-semibold tracking-[0.2em] text-ink-900">
              {workspace.inviteCode}
            </code>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" onClick={copyInvite}>
            {copied
              ? t('workspaces.detail.invite.copied')
              : t('workspaces.detail.invite.copyLink')}
          </Button>
          {isOwner && (
            <Button
              type="button"
              variant="ghost"
              onClick={onRotate}
              disabled={busy === 'rotate'}
            >
              {t('workspaces.detail.invite.rotate')}
            </Button>
          )}
        </div>
      </Card>

      {!isOwner && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-ink-800">
            {t('workspaces.detail.leave.title')}
          </p>
          <p className="text-xs text-ink-600">
            {t('workspaces.detail.leave.body')}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={onLeave}
            disabled={busy === 'leave'}
            className="text-red-600 hover:bg-red-50"
          >
            {t('workspaces.detail.leave.button')}
          </Button>
        </Card>
      )}

      {isOwner && (
        <Card className="space-y-2 border-red-200">
          <p className="text-sm font-semibold text-red-700">
            {t('workspaces.detail.delete.title')}
          </p>
          <p className="text-xs text-ink-600">
            {t('workspaces.detail.delete.body')}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={busy === 'delete'}
            className="text-red-600 hover:bg-red-50"
          >
            {t('workspaces.detail.delete.button')}
          </Button>
        </Card>
      )}

      {showLeaveSheet && (
        <LeaveWorkspaceSheet
          workspaceTitle={workspace.title}
          onCancel={() => setShowLeaveSheet(false)}
          onConfirm={onLeaveConfirm}
        />
      )}
    </div>
  );
}

function BackLink() {
  const t = useTranslations();
  return (
    <Link
      href="/workspaces"
      className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
    >
      <ArrowBack /> {t('workspaces.detail.back')}
    </Link>
  );
}

/* ─────────────────── Shared habits section (phase 2a) ────────────────── */

/** The "Shared habits" panel that appears below the member list in the
 *  workspace detail. Members see a read-only list; owners see an inline
 *  "+ Add" CTA, plus per-row edit / delete affordances. The actual daily
 *  logging UI (tap to complete from the home checklist) lands in phase 2b
 *  — this PR only ships the CRUD surface so the owner can populate the
 *  habit set first.
 */
function SharedHabitsSection({
  wsId,
  isOwner,
}: {
  wsId: string;
  isOwner: boolean;
}) {
  const t = useTranslations();
  const unitLabel = useUnitLabel();
  const fmt = useNumberFormatter();
  const [habits, setHabits] = useState<WorkspaceHabit[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeWorkspaceHabits(wsId, (h) => setHabits(h));
    return unsub;
  }, [wsId]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-800">
            {t('workspaces.habits.title')}
          </h2>
          <p className="text-xs text-ink-500">
            {isOwner
              ? t('workspaces.habits.bodyOwner')
              : t('workspaces.habits.bodyMember')}
          </p>
        </div>
      </div>

      {habits === null ? (
        <p className="text-sm text-ink-500">
          {t('workspaces.detail.loading')}
        </p>
      ) : habits.length === 0 ? (
        <Card className="space-y-2 border-sand-200 bg-sand-50">
          <p className="text-sm text-ink-700">
            {isOwner
              ? t('workspaces.habits.emptyOwner')
              : t('workspaces.habits.emptyMember')}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {habits.map((h) =>
            editingId === h.id ? (
              <li key={h.id}>
                <HabitForm
                  initial={h}
                  onCancel={() => setEditingId(null)}
                  onSave={async (patch) => {
                    await updateWorkspaceHabit(wsId, h.id, patch);
                    setEditingId(null);
                  }}
                  onDelete={async () => {
                    if (!confirm(t('workspaces.habits.deleteConfirm'))) return;
                    await deleteWorkspaceHabit(wsId, h.id);
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2"
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium text-ink-900">
                    {h.name}
                  </span>
                  <span className="numeral block text-[11px] text-ink-500">
                    {summariseHabit(h, unitLabel, fmt, t)}
                  </span>
                </span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setEditingId(h.id)}
                    className="text-xs text-leaf-700 underline-offset-4 hover:underline"
                  >
                    {t('workspaces.habits.edit')}
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      )}

      {isOwner && !adding && editingId === null && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap-44 flex w-full items-center justify-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-leaf-400 hover:text-leaf-700"
        >
          {t('workspaces.habits.add')}
        </button>
      )}

      {isOwner && adding && (
        <HabitForm
          onCancel={() => setAdding(false)}
          onSave={async (patch) => {
            // patch from the form always supplies name/type/unit/target/limit
            await createWorkspaceHabit(wsId, {
              name: patch.name ?? '',
              type: patch.type ?? 'good',
              unit: patch.unit,
              target: patch.target,
              limit: patch.limit,
              frequency: patch.frequency,
            });
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

/** One-line summary of a habit's shape for the read-only list row.
 *  Mirrors the per-habit-row pattern from the home checklist so the
 *  visual rhythm is consistent. */
function summariseHabit(
  h: WorkspaceHabit,
  unitLabel: (u: string | undefined) => string,
  fmt: (n: number) => string,
  t: ReturnType<typeof useTranslations>,
): string {
  if (h.type === 'good' && h.target !== undefined && h.unit) {
    return `${fmt(h.target)} ${unitLabel(h.unit)} · ${t('workspaces.habits.typeGood')}`;
  }
  if (h.type === 'bad' && h.limit !== undefined && h.unit) {
    return `≤ ${fmt(h.limit)} ${unitLabel(h.unit)} · ${t('workspaces.habits.typeBad')}`;
  }
  return h.type === 'good'
    ? t('workspaces.habits.typeGood')
    : t('workspaces.habits.typeBad');
}

/** Inline create / edit form for a workspace habit. Used in two modes:
 *  no `initial` → creating; `initial` set → editing. Keeps the same
 *  shape as the personal habit form (`/habits/new`) so the cognitive
 *  load on the owner is minimal. Deliberately stays inline (not a
 *  modal) so the user can see the rest of the workspace context. */
function HabitForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: WorkspaceHabit;
  onSave: (
    patch: Partial<Omit<WorkspaceHabit, 'id' | 'createdByUid' | 'createdAt'>>,
  ) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}) {
  const t = useTranslations();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<HabitType>(initial?.type ?? 'good');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [target, setTarget] = useState(
    initial?.target !== undefined ? String(initial.target) : '',
  );
  const [limit, setLimit] = useState(
    initial?.limit !== undefined ? String(initial.limit) : '',
  );
  const [busy, setBusy] = useState(false);
  const canSubmit = name.trim().length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    await onSave({
      name: name.trim(),
      type,
      unit: unit.trim() || undefined,
      target: type === 'good' && target ? Number(target) : undefined,
      limit: type === 'bad' && limit ? Number(limit) : undefined,
    });
    setBusy(false);
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-leaf-200 bg-leaf-50 p-3"
    >
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink-700">
          {t('workspaces.habits.nameLabel')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('workspaces.habits.namePlaceholder')}
          maxLength={60}
          autoFocus
          required
          className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType('good')}
          className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            type === 'good'
              ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
              : 'border-ink-200 bg-white text-ink-700'
          }`}
          aria-pressed={type === 'good'}
        >
          {t('workspaces.habits.typeGood')}
        </button>
        <button
          type="button"
          onClick={() => setType('bad')}
          className={`tap-44 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            type === 'bad'
              ? 'border-red-500 bg-red-50 text-red-800'
              : 'border-ink-200 bg-white text-ink-700'
          }`}
          aria-pressed={type === 'bad'}
        >
          {t('workspaces.habits.typeBad')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink-700">
            {t('workspaces.habits.unitLabel')}
          </span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('workspaces.habits.unitPlaceholder')}
            maxLength={20}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
          />
        </label>
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink-700">
            {type === 'good'
              ? t('workspaces.habits.targetLabel')
              : t('workspaces.habits.limitLabel')}
          </span>
          {type === 'good' ? (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="numeral w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
            />
          ) : (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100000}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="numeral w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500"
            />
          )}
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="text-red-600 hover:bg-red-50"
          >
            {t('workspaces.habits.delete')}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('workspaces.habits.cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {initial
            ? t('workspaces.habits.save')
            : t('workspaces.habits.create')}
        </Button>
      </div>
    </form>
  );
}

/* ────────────────── Pair-mode "Today together" section ───────────────── */

/** Pair-specialised view of today's shared habits. Renders only when
 *  `workspace.mode === 'pair'`. Stacked layout per decision #4: each
 *  habit shows YOU on top, your partner below (or just one of you if
 *  the second member hasn't joined yet). Tap your row to toggle your
 *  own completion; your partner's row is read-only.
 *
 *  Why this lives on the detail page and not the home checklist:
 *  the home gets the compact "side-by-side avatars" view (phase 3).
 *  This is the deeper view — bigger rows, names visible, easier to
 *  scan for "did we both do it" with morning eyes.
 */
function PairTodaySection({
  workspace,
  members,
  myUid,
}: {
  workspace: Workspace;
  members: WorkspaceMember[];
  myUid: string | null;
}) {
  const t = useTranslations();
  const unitLabel = useUnitLabel();
  const fmt = useNumberFormatter();
  const today = todayKey();

  const [habits, setHabits] = useState<WorkspaceHabit[] | null>(null);
  const [memberLogs, setMemberLogs] = useState<
    Record<string, WorkspaceDayLog | null>
  >({});

  useEffect(() => {
    const unsub = subscribeWorkspaceHabits(workspace.id, (h) => setHabits(h));
    return unsub;
  }, [workspace.id]);

  const memberUidsKey = [...workspace.memberUids].sort().join(',');
  useEffect(() => {
    const uids = workspace.memberUids;
    const unsubs = uids.map((uid) =>
      subscribeMemberWorkspaceLog(workspace.id, uid, today, (log) =>
        setMemberLogs((prev) => ({ ...prev, [uid]: log })),
      ),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, memberUidsKey, today]);

  if (habits === null) return null;
  if (habits.length === 0) return null;

  // Order: me first, then the other member(s). Pair mode caps at 2, but
  // the same code handles a 1-member workspace gracefully.
  const ordered: WorkspaceMember[] = [];
  if (myUid) {
    const me = members.find((m) => m.uid === myUid);
    if (me) ordered.push(me);
  }
  for (const m of members) {
    if (m.uid !== myUid) ordered.push(m);
  }
  // Race fallback for memberUids without a subdoc yet.
  for (const uid of workspace.memberUids) {
    if (!ordered.some((m) => m.uid === uid)) {
      ordered.push({
        uid,
        displayName: uid.slice(0, 8),
        joinedAt: '',
        role: 'member',
      });
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">
          {t('workspaces.pairToday.title')}
        </h2>
        <p className="text-xs text-ink-500">
          {t('workspaces.pairToday.body')}
        </p>
      </div>

      <ul className="space-y-3">
        {habits.map((h) => (
          <li key={h.id}>
            <PairTodayHabitCard
              workspace={workspace}
              habit={h}
              members={ordered}
              memberLogs={memberLogs}
              myUid={myUid}
              unitLabel={unitLabel}
              fmt={fmt}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One habit card in the pair "Today together" section. Heading shows
 *  the habit + its target/limit; below, two stacked rows — yours
 *  (tappable) and your partner's (read-only). */
function PairTodayHabitCard({
  workspace,
  habit,
  members,
  memberLogs,
  myUid,
  unitLabel,
  fmt,
}: {
  workspace: Workspace;
  habit: WorkspaceHabit;
  members: WorkspaceMember[];
  memberLogs: Record<string, WorkspaceDayLog | null>;
  myUid: string | null;
  unitLabel: (u: string | undefined) => string;
  fmt: (n: number) => string;
}) {
  const today = todayKey();

  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink-900">{habit.name}</span>
        {habit.unit && (habit.target !== undefined || habit.limit !== undefined) && (
          <span className="numeral text-[11px] text-ink-500">
            {habit.type === 'good' && habit.target !== undefined
              ? `${fmt(habit.target)} ${unitLabel(habit.unit)}`
              : habit.limit !== undefined
              ? `≤ ${fmt(habit.limit)} ${unitLabel(habit.unit)}`
              : ''}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {members.map((m) => {
          const log = memberLogs[m.uid];
          const status = workspaceEntryStatus(log?.entries[habit.id]);
          const isMe = m.uid === myUid;
          return (
            <PairMemberRow
              key={m.uid}
              member={m}
              status={status}
              isMe={isMe}
              onToggle={
                isMe
                  ? () => {
                      // Cycle pending → completed → failed → pending,
                      // writing a full entry (explicit status) so the
                      // Firestore merge can't keep a stale mark.
                      void setMyWorkspaceLog(
                        workspace.id,
                        habit.id,
                        today,
                        nextWorkspaceEntry(status, habit),
                      );
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </Card>
  );
}

/** Single stacked row inside a PairTodayHabitCard. Yours is a tap target
 *  (cycles ✓/✗/—); your partner's is read-only and shows their current
 *  mark. Bigger than the home cross-member avatar, with names visible. */
function PairMemberRow({
  member,
  status,
  isMe,
  onToggle,
}: {
  member: WorkspaceMember;
  status: HabitLogStatus;
  isMe: boolean;
  onToggle?: () => void;
}) {
  const t = useTranslations();
  const labelKey =
    status === 'completed'
      ? 'workspaces.pairToday.doneAria'
      : status === 'failed'
      ? 'workspaces.pairToday.failedAria'
      : 'workspaces.pairToday.notDoneAria';
  const ariaLabel = t(labelKey, {
    name: isMe ? t('workspaces.crossMember.you') : member.displayName,
  });
  const className = clsx(
    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 transition',
    status === 'completed'
      ? 'border-leaf-500 bg-leaf-50'
      : status === 'failed'
      ? 'border-red-300 bg-red-50'
      : 'border-ink-200 bg-white',
    isMe && status === 'pending' && 'hover:border-ink-300',
  );

  const content = (
    <>
      <Avatar
        name={member.displayName}
        photoURL={member.photoURL}
        size="sm"
        className={clsx(status === 'pending' && 'opacity-60 grayscale')}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
        {isMe ? t('workspaces.crossMember.you') : member.displayName}
      </span>
      <span
        className={clsx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition',
          status === 'completed' && 'border-leaf-600 bg-leaf-600 text-white',
          status === 'failed' && 'border-red-500 bg-red-500 text-white',
          status === 'pending' && 'border-ink-300 bg-white text-ink-300',
        )}
        aria-hidden
      >
        {status === 'completed' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {status === 'failed' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {status === 'pending' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
            <path d="M6 12h12" strokeLinecap="round" />
          </svg>
        )}
      </span>
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={status === 'completed'}
        aria-label={ariaLabel}
        className={clsx('tap-44', className)}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={className} aria-label={ariaLabel} title={ariaLabel}>
      {content}
    </div>
  );
}

/* ─────────────────── Activity feed (Recent activity) ─────────────────── */

/** Subscribes to the workspace's events subcollection and renders a
 *  compact "Recent activity" panel — newest first, capped to the last 10
 *  events. Deliberately read-only: this is a "what happened" log, not a
 *  conversation. Empty state is friendly because brand-new workspaces
 *  will have one event ("you joined") but a member visiting an old
 *  workspace might see a long history that pre-dates them. */
function ActivitySection({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const [events, setEvents] = useState<WorkspaceEvent[] | null>(null);

  useEffect(() => {
    // Cap at 10 — anything older isn't worth rendering on a small phone
    // screen, and pulling the whole subcollection per workspace open is
    // wasteful as the feed grows.
    const unsub = subscribeWorkspaceEvents(wsId, (list) => setEvents(list), 10);
    return unsub;
  }, [wsId]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">
          {t('workspaces.activity.title')}
        </h2>
        <p className="text-xs text-ink-500">
          {t('workspaces.activity.body')}
        </p>
      </div>

      {events === null ? (
        <p className="text-sm text-ink-500">
          {t('workspaces.detail.loading')}
        </p>
      ) : events.length === 0 ? (
        <Card className="border-sand-200 bg-sand-50">
          <p className="text-sm text-ink-700">
            {t('workspaces.activity.empty')}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {events.map((evt) => (
            <li
              key={evt.id}
              className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2"
            >
              <span className="mt-0.5 text-base" aria-hidden>
                {iconForEvent(evt.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800">{labelForEvent(evt, t)}</p>
                <p className="numeral text-[11px] text-ink-500">
                  {relativeTime(evt.at, t, fmt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One-character glyph per event type. Kept inline (no icon component
 *  per type) because the set is tiny and unlikely to grow much. */
function iconForEvent(type: WorkspaceEvent['type']): string {
  switch (type) {
    case 'member-joined':
      return '👋';
    case 'member-left':
      return '👋';
    case 'habit-added':
      return '＋';
    default:
      return '·';
  }
}

/** Render the localised sentence for an event. Habit-added falls back
 *  to the no-name variant when the meta payload is missing (older
 *  events written before the meta field landed, or a race where the
 *  habit name was empty at write time). */
function labelForEvent(
  evt: WorkspaceEvent,
  t: ReturnType<typeof useTranslations>,
): string {
  const name = evt.actorName || '—';
  switch (evt.type) {
    case 'member-joined':
      return t('workspaces.activity.memberJoined', { name });
    case 'member-left':
      return t('workspaces.activity.memberLeft', { name });
    case 'habit-added': {
      const habit = evt.meta?.habitName?.trim();
      return habit
        ? t('workspaces.activity.habitAdded', { name, habit })
        : t('workspaces.activity.habitAddedNoName', { name });
    }
    default:
      return name;
  }
}

/** Pure relative-time formatter. Keeps everything in the user's current
 *  locale via the injected number formatter so Persian numerals render
 *  correctly inside the bucketed strings. Falls through to "Xd ago" for
 *  anything older than a week is good enough — this panel only ever
 *  shows the most recent 10 events, so the oldest is rarely very old. */
function relativeTime(
  iso: string,
  t: ReturnType<typeof useTranslations>,
  fmt: (n: number) => string,
): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < minute) return t('workspaces.activity.justNow');
  if (diffMs < hour) {
    return t('workspaces.activity.minutesAgo', {
      n: fmt(Math.floor(diffMs / minute)),
    });
  }
  if (diffMs < day) {
    return t('workspaces.activity.hoursAgo', {
      n: fmt(Math.floor(diffMs / hour)),
    });
  }
  if (diffMs < week) {
    return t('workspaces.activity.daysAgo', {
      n: fmt(Math.floor(diffMs / day)),
    });
  }
  return t('workspaces.activity.weeksAgo', {
    n: fmt(Math.floor(diffMs / week)),
  });
}
