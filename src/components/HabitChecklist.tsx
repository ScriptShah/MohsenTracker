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
import type { Habit } from '@/domain/types';
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
  const cycleHabitStatus = useAppStore((s) => s.cycleHabitStatus);
  const reorderHabits = useAppStore((s) => s.reorderHabits);
  const setReadingHabit = useAppStore((s) => s.setReadingHabit);
  const liveCounts = useLiveCounts();
  const unitLabel = useUnitLabel();

  const [showDone, setShowDone] = useState(false);
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

  const onCheck = (habit: Habit) => {
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

    // Spec §24.2: bad-habit slips pair with the "positive cargo." Capture
    // the pre-cycle success state, then read post-cycle from the store
    // (the selector won't have re-rendered yet inside this handler). The
    // slip fires on the completed→failed step — a bad habit going from
    // "resisted" (success) to "gave in" (failed).
    const wasSuccessful = isLogSuccessful(habit, logs[habit.id]);
    cycleHabitStatus(habit.id);
    if (habit.type === 'bad' && habit.positiveCargo?.trim()) {
      const after = useAppStore.getState().logs[today]?.[habit.id];
      const isNowSuccessful = isLogSuccessful(habit, after);
      if (wasSuccessful && !isNowSuccessful) {
        setCargoSlip({ habitId: habit.id, cargo: habit.positiveCargo.trim() });
      }
    }
  };

  if (habits.length === 0) {
    return <p className="text-ink-500">{t('home.noHabits')}</p>;
  }

  const pending: Habit[] = [];
  const done: Habit[] = [];
  for (const h of habits) {
    if (isLogSuccessful(h, logs[h.id])) done.push(h);
    else pending.push(h);
  }

  const visibleHabits = showDone ? habits : pending;
  // Plain map — no useMemo because there's an early return above this
  // and hooks must be called unconditionally. The visible list is
  // small in practice (a daily habit count rarely exceeds ~20), so
  // the per-render allocation cost is irrelevant.
  const visibleIds = visibleHabits.map((h) => h.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = visibleIds.indexOf(String(active.id));
    const newIdx = visibleIds.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const reorderedVisible = arrayMove(visibleIds, oldIdx, newIdx);
    // Smart substitution: keep habits NOT in the visible list (e.g.
    // done-but-hidden habits, weeklies) in their original positions;
    // replace each visible slot with the next id from the reordered
    // sequence. Without this, the store-level reorderHabits would
    // move all hidden habits to the end whenever the user dragged a
    // pending row, which is unexpected.
    const visibleSet = new Set(visibleIds);
    let cursor = 0;
    const newFullIds = habits.map((h) => {
      if (visibleSet.has(h.id)) {
        const replacement = reorderedVisible[cursor];
        cursor += 1;
        return replacement ?? h.id;
      }
      return h.id;
    });
    reorderHabits(newFullIds);
  };

  return (
    <div className="space-y-2">
      {pending.length === 0 && !showDone && (
        <p className="rounded-xl border border-leaf-200 bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          {t('home.allDone')}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {visibleHabits.map((habit) => {
              const log = logs[habit.id];
              const done = isLogSuccessful(habit, log);
              // Tri-state: explicit status when the user cycled, else derive
              // from success (legacy logs + binary toggles have no status).
              const status: 'completed' | 'failed' | 'pending' =
                log?.status ?? (done ? 'completed' : 'pending');
              const streak = streaks[habit.id]?.current ?? 0;
              const liveCount =
                habit.type === 'good' && habit.presetKey
                  ? liveCounts[habit.presetKey] ?? 0
                  : 0;
              return (
                <SortableHabitRow
                  key={habit.id}
                  habit={habit}
                  log={log}
                  done={done}
                  status={status}
                  streak={streak}
                  liveCount={liveCount}
                  onCheck={onCheck}
                  unitLabel={unitLabel}
                  fmt={fmt}
                  t={t}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      {done.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="block w-full text-center text-xs text-leaf-700 underline-offset-4 hover:underline"
        >
          {showDone
            ? t('home.hideDone', { n: fmt(done.length) })
            : t('home.showDone', { n: fmt(done.length) })}
        </button>
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

/** Tri-state mark for the checklist:
 *  - completed → leaf-filled circle with a white ✓
 *  - failed    → red-filled circle with a white ✗
 *  - pending   → grey outline with a faint — (minus)
 *  Tapping cycles pending → completed → failed → pending. */
function Checkmark({ status }: { status: 'completed' | 'failed' | 'pending' }) {
  return (
    <span
      className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition',
        status === 'completed' && 'border-leaf-600 bg-leaf-600 text-white animate-pop',
        status === 'failed' && 'border-red-500 bg-red-500 text-white animate-pop',
        status === 'pending' && 'border-ink-300 bg-white text-ink-300',
      )}
      aria-hidden
    >
      {status === 'completed' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {status === 'failed' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-5 w-5">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {status === 'pending' && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4">
          <path d="M6 12h12" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/** Single habit row, sortable via a dedicated drag handle on the
 *  start edge. The handle owns the drag activator listeners so the
 *  rest of the row stays tap-to-navigate / tap-to-check — without
 *  this separation, every tap would risk being interpreted as the
 *  start of a drag. PointerSensor's activation distance + the
 *  TouchSensor's press-delay (see parent) are the second line of
 *  defence. */
function SortableHabitRow({
  habit,
  log,
  done,
  status,
  streak,
  liveCount,
  onCheck,
  unitLabel,
  fmt,
  t,
}: {
  habit: Habit;
  log: ReturnType<typeof useAppStore.getState>['logs'][string][string] | undefined;
  done: boolean;
  status: 'completed' | 'failed' | 'pending';
  streak: number;
  liveCount: number;
  onCheck: (habit: Habit) => void;
  unitLabel: (u: string | undefined) => string;
  fmt: (n: number) => string;
  t: ReturnType<typeof useTranslations>;
}) {
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
      <Link
        href={`/habits/detail?id=${habit.id}`}
        className={clsx(
          'tap-44 flex flex-1 items-center gap-3 rounded-xl border px-3 py-3 text-start transition',
          status === 'completed'
            ? 'border-leaf-500 bg-leaf-50'
            : status === 'failed'
            ? 'border-red-300 bg-red-50'
            : 'border-ink-200 bg-white hover:border-ink-300',
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCheck(habit);
          }}
          aria-pressed={status === 'completed'}
          aria-label={`${habit.name} — ${t(
            status === 'completed'
              ? 'home.statusCompleted'
              : status === 'failed'
              ? 'home.statusFailed'
              : 'home.statusPending',
          )}`}
          className="tap-44 -m-2 flex items-center justify-center p-2"
        >
          <Checkmark status={status} />
        </button>
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
