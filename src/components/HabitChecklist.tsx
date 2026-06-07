'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from '@/i18n/routing';
import type { Habit, HabitLog } from '@/domain/types';
import { useAppStore } from '@/lib/store';
import { todayKey } from '@/lib/dates';
import { isLogSuccessful } from '@/lib/streaks';
import { useLiveCounts } from '@/lib/useLiveCounts';
import { useNumberFormatter } from '@/lib/format';
import { useUnitLabel } from '@/lib/units';
import { ChevronEnd } from './Chevron';
import { BookLogSheet } from './BookLogSheet';
import { CargoSlipSheet } from './CargoSlipSheet';

export function HabitChecklist({ habits }: { habits: Habit[] }) {
  const t = useTranslations();
  const fmt = useNumberFormatter();
  const today = todayKey();
  const logs = useAppStore((s) => s.logs[today] ?? {});
  const streaks = useAppStore((s) => s.streaks);
  const toggleHabit = useAppStore((s) => s.toggleHabit);
  const toggleHabitFailed = useAppStore((s) => s.toggleHabitFailed);
  const reorderHabits = useAppStore((s) => s.reorderHabits);
  const setReadingHabit = useAppStore((s) => s.setReadingHabit);
  const liveCounts = useLiveCounts();
  const unitLabel = useUnitLabel();

  const [showDone, setShowDone] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [bookSheetHabitId, setBookSheetHabitId] = useState<string | null>(null);
  const [cargoSlip, setCargoSlip] = useState<{ habitId: string; cargo: string } | null>(null);

  // dnd-kit sensors: pointer for desktop, touch for mobile (with a
  // small delay so plain taps still work and only a deliberate
  // press-and-drag initiates a reorder), keyboard for accessibility.
  // The 8px pointer activation distance also protects against an
  // accidental drag triggering when the user just wanted to tap the
  // row to open the detail page.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const isReadingHabit = (h: Habit) =>
    h.linksToBooks === true || h.presetKey === 'reading';

  // Resolve the tri-state of a habit today: explicit status when the user
  // tapped a button, else derive from success (legacy logs + book-driven
  // habits carry no status).
  const statusOf = (h: Habit): 'completed' | 'failed' | 'pending' => {
    const log = logs[h.id];
    return log?.status ?? (isLogSuccessful(h, log) ? 'completed' : 'pending');
  };

  // ✓ button. Reading habits open the book sheet (their "done" is driven by
  // logged pages, not a manual toggle). Everything else flips done↔pending,
  // and lifts a "failed" mark straight to done.
  const onMarkDone = (habit: Habit) => {
    if (isReadingHabit(habit)) {
      // Auto-link the books module the first time the user taps a reading
      // preset's check, so future book-page logs flow into this habit's
      // daily total + streak (spec §20.11).
      if (!habit.linksToBooks && habit.presetKey === 'reading') {
        setReadingHabit(habit.id);
      }
      setBookSheetHabitId(habit.id);
      return;
    }
    toggleHabit(habit.id);
  };

  // ✗ button. Toggles the explicit "failed" mark (failed→pending clears it,
  // anything-else→failed). Spec §24.2: marking a bad habit failed IS the
  // slip, so pair it with the user's "positive cargo" — but only when we're
  // entering failed, not when undoing it.
  const onMarkFailed = (habit: Habit) => {
    if (isReadingHabit(habit)) return; // book-driven habits have no ✗
    const wasFailed = statusOf(habit) === 'failed';
    toggleHabitFailed(habit.id);
    if (!wasFailed && habit.type === 'bad' && habit.positiveCargo?.trim()) {
      setCargoSlip({ habitId: habit.id, cargo: habit.positiveCargo.trim() });
    }
  };

  if (habits.length === 0) {
    return <p className="text-ink-500">{t('home.noHabits')}</p>;
  }

  // Three buckets. Pending stays draggable + at the top; completed and
  // failed drop into their own collapsible sections so the active list
  // only ever shows what's left to do today.
  const pending: Habit[] = [];
  const completed: Habit[] = [];
  const failed: Habit[] = [];
  for (const h of habits) {
    const s = statusOf(h);
    if (s === 'completed') completed.push(h);
    else if (s === 'failed') failed.push(h);
    else pending.push(h);
  }

  // Plain map — no useMemo because there's an early return above this and
  // hooks must run unconditionally. Daily habit counts rarely exceed ~20,
  // so the per-render allocation cost is irrelevant.
  const pendingIds = pending.map((h) => h.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = pendingIds.indexOf(String(active.id));
    const newIdx = pendingIds.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(pendingIds, oldIdx, newIdx);
    // Smart substitution: keep habits NOT in the pending list (completed +
    // failed) in their original slots; replace each pending slot with the
    // next id from the reordered sequence. Without this, reorderHabits
    // would shove all the done/failed habits to the end whenever the user
    // dragged a pending row.
    const pendingSet = new Set(pendingIds);
    let cursor = 0;
    const newFullIds = habits.map((h) => {
      if (pendingSet.has(h.id)) {
        const replacement = reordered[cursor];
        cursor += 1;
        return replacement ?? h.id;
      }
      return h.id;
    });
    reorderHabits(newFullIds);
  };

  // Shared row props builder — keeps the three render sites in sync.
  const rowPropsFor = (habit: Habit): RowProps => ({
    habit,
    log: logs[habit.id],
    status: statusOf(habit),
    streak: streaks[habit.id]?.current ?? 0,
    liveCount:
      habit.type === 'good' && habit.presetKey
        ? liveCounts[habit.presetKey] ?? 0
        : 0,
    showFail: !isReadingHabit(habit),
    onDone: () => onMarkDone(habit),
    onFailed: () => onMarkFailed(habit),
    unitLabel,
    fmt,
    t,
  });

  return (
    <div className="space-y-2">
      {pending.length === 0 && failed.length === 0 && completed.length > 0 && (
        <p className="rounded-xl border border-leaf-200 bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          {t('home.allDone')}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pendingIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {pending.map((habit) => (
              <SortableHabitRow key={habit.id} {...rowPropsFor(habit)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {completed.length > 0 && (
        <CollapsibleSection
          open={showDone}
          onToggle={() => setShowDone((v) => !v)}
          label={
            showDone
              ? t('home.hideDone', { n: fmt(completed.length) })
              : t('home.showDone', { n: fmt(completed.length) })
          }
        >
          {completed.map((habit) => (
            <PlainHabitRow key={habit.id} {...rowPropsFor(habit)} />
          ))}
        </CollapsibleSection>
      )}

      {failed.length > 0 && (
        <CollapsibleSection
          open={showFailed}
          onToggle={() => setShowFailed((v) => !v)}
          tone="failed"
          label={
            showFailed
              ? t('home.hideNotDone', { n: fmt(failed.length) })
              : t('home.showNotDone', { n: fmt(failed.length) })
          }
        >
          {failed.map((habit) => (
            <PlainHabitRow key={habit.id} {...rowPropsFor(habit)} />
          ))}
        </CollapsibleSection>
      )}

      {bookSheetHabitId && (
        <BookLogSheet
          habitId={bookSheetHabitId}
          onClose={() => setBookSheetHabitId(null)}
        />
      )}
      {cargoSlip && (
        <CargoSlipSheet
          cargo={cargoSlip.cargo}
          onClose={() => setCargoSlip(null)}
        />
      )}
    </div>
  );
}

type RowProps = {
  habit: Habit;
  log: HabitLog | undefined;
  status: 'completed' | 'failed' | 'pending';
  streak: number;
  liveCount: number;
  /** Hide the ✗ button for book-driven reading habits. */
  showFail: boolean;
  onDone: () => void;
  onFailed: () => void;
  unitLabel: (u: string | undefined) => string;
  fmt: (n: number) => string;
  t: ReturnType<typeof useTranslations>;
};

/** One of the two action circles on a row. The ✓ circle fills leaf-green
 *  when the habit is completed; the ✗ circle fills red when it's marked
 *  failed. Inactive circles show a faint outline icon so each button reads
 *  as "tap to mark done" / "tap to mark not done." */
function MarkCircle({ kind, active }: { kind: 'done' | 'fail'; active: boolean }) {
  const isDone = kind === 'done';
  return (
    <span
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
        active && isDone && 'border-leaf-600 bg-leaf-600 text-white animate-pop',
        active && !isDone && 'border-red-500 bg-red-500 text-white animate-pop',
        !active && 'border-ink-200 bg-white text-ink-300',
      )}
      aria-hidden
    >
      {isDone ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** A collapsible "Done (N)" / "Not done (N)" group under the active list.
 *  The toggle reads as a quiet centered link; rows render only when open. */
function CollapsibleSection({
  label,
  open,
  onToggle,
  tone = 'done',
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  tone?: 'done' | 'failed';
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={clsx(
          'block w-full text-center text-xs underline-offset-4 hover:underline',
          tone === 'failed' ? 'text-red-600' : 'text-leaf-700',
        )}
      >
        {label}
      </button>
      {open && <ul className="space-y-2">{children}</ul>}
    </div>
  );
}

/** The visual body of a habit row: two action circles (✓ / ✗), the habit
 *  name + today's progress, an optional streak chip, and a chevron into the
 *  detail page. Tapping the body (anywhere but a circle) navigates; the
 *  circles stopPropagation so they only toggle. Reading habits hide the ✗
 *  (their state is driven by logged pages — see onMarkDone). */
function RowBody({
  habit,
  log,
  status,
  streak,
  liveCount,
  showFail,
  onDone,
  onFailed,
  unitLabel,
  fmt,
  t,
}: RowProps) {
  const done = status === 'completed';
  return (
      <Link
        href={`/habits/detail?id=${habit.id}`}
        className={clsx(
          'tap-44 flex flex-1 items-center gap-2 rounded-xl border px-3 py-3 text-start transition',
          status === 'completed'
            ? 'border-leaf-500 bg-leaf-50'
            : status === 'failed'
            ? 'border-red-300 bg-red-50'
            : 'border-ink-200 bg-white hover:border-ink-300',
        )}
      >
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDone();
            }}
            aria-pressed={status === 'completed'}
            aria-label={`${habit.name} — ${t('home.markDone')}`}
            className="tap-44 flex items-center justify-center"
          >
            <MarkCircle kind="done" active={status === 'completed'} />
          </button>
          {showFail && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFailed();
              }}
              aria-pressed={status === 'failed'}
              aria-label={`${habit.name} — ${t('home.markFailed')}`}
              className="tap-44 flex items-center justify-center"
            >
              <MarkCircle kind="fail" active={status === 'failed'} />
            </button>
          )}
        </span>
        <span className="flex-1">
          <span className={clsx('block font-medium', done && 'text-leaf-800')}>
            {habit.name}
          </span>
          {habit.type === 'good' && habit.unit && habit.target !== undefined && (
            <span className="block text-xs text-ink-500">
              {log && log.value > 0 ? (
                <>
                  <span
                    className={clsx(
                      'numeral',
                      log.value > habit.target && 'font-semibold text-leaf-700',
                    )}
                  >
                    {log.value}
                  </span>{' '}
                  / <span className="numeral">{habit.target}</span> {unitLabel(habit.unit)}
                  {log.value > habit.target && (
                    <span className="ms-1 text-leaf-600" aria-hidden>
                      ✨
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="numeral">{habit.target}</span> {unitLabel(habit.unit)}
                </>
              )}
            </span>
          )}
          {habit.type === 'bad' && habit.unit && habit.limit !== undefined && (
            <span className="block text-xs text-ink-500">
              {log && log.value > 0 ? (
                <>
                  <span
                    className={clsx(
                      'numeral',
                      log.value > habit.limit && 'font-semibold text-red-600',
                    )}
                  >
                    {log.value}
                  </span>{' '}
                  / ≤ <span className="numeral">{habit.limit}</span> {unitLabel(habit.unit)}
                </>
              ) : (
                <>
                  ≤ <span className="numeral">{habit.limit}</span> {unitLabel(habit.unit)}
                </>
              )}
            </span>
          )}
          {liveCount > 0 && (
            <span className="numeral block text-[11px] text-leaf-700">
              🌱 {t('home.liveCount', { n: fmt(liveCount) })}
            </span>
          )}
        </span>
        {streak > 0 && (
          <span className="rounded-full bg-sand-100 px-2 py-1 text-xs text-sand-600">
            🔥 <span className="numeral">{streak}</span>
          </span>
        )}
        <ChevronEnd className="h-4 w-4 text-ink-300" />
      </Link>
  );
}

/** Pending row: draggable via a dedicated drag handle on the start edge.
 *  The handle owns the drag activator listeners so the rest of the row
 *  stays tap-to-navigate / tap-to-toggle — without this separation, every
 *  tap would risk being read as the start of a drag. PointerSensor's
 *  activation distance + the TouchSensor's press-delay (see parent) are the
 *  second line of defence. */
function SortableHabitRow(props: RowProps) {
  const { habit, t } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        'relative flex items-stretch gap-1 rounded-xl',
        isDragging && 'z-10 opacity-90 shadow-lg',
      )}
    >
      {/* Drag handle — owns the activator listeners so the row Link
          still navigates on a plain tap. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('home.dragHandle', { name: habit.name })}
        className="tap-44 -my-0.5 flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-300 hover:text-ink-600 active:cursor-grabbing"
      >
        <GripIcon className="h-4 w-4" />
      </button>
      <RowBody {...props} />
    </li>
  );
}

/** Non-draggable row for the Done / Not done sections. A spacer keeps the
 *  body aligned with the pending rows (which carry a drag handle). */
function PlainHabitRow(props: RowProps) {
  return (
    <li className="relative flex items-stretch gap-1 rounded-xl">
      <span className="w-7 shrink-0" aria-hidden />
      <RowBody {...props} />
    </li>
  );
}

function GripIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <circle cx="7" cy="5" r="1.4" />
      <circle cx="13" cy="5" r="1.4" />
      <circle cx="7" cy="10" r="1.4" />
      <circle cx="13" cy="10" r="1.4" />
      <circle cx="7" cy="15" r="1.4" />
      <circle cx="13" cy="15" r="1.4" />
    </svg>
  );
}
