import { format, parseISO, differenceInCalendarDays, subDays, addDays, startOfYear } from 'date-fns';

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

export function previousDayKey(key: string): string {
  return dateKey(subDays(parseISO(key), 1));
}

export function nextDayKey(key: string): string {
  return dateKey(addDays(parseISO(key), 1));
}

/** 52-week heatmap: returns 7 rows × 53 columns of date keys ending today. */
export function heatmapGrid(today: Date = new Date()): (string | null)[][] {
  const cols = 53;
  const rows = 7;
  const todayDow = today.getDay(); // Sun=0..Sat=6
  const lastSaturday = addDays(today, 6 - todayDow); // pad forward to next Saturday
  const start = subDays(lastSaturday, cols * 7 - 1);
  // grid[dow][week]
  const grid: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let week = 0; week < cols; week++) {
    for (let dow = 0; dow < rows; dow++) {
      const d = addDays(start, week * 7 + dow);
      // Mask out future days.
      if (d > today) {
        grid[dow][week] = null;
      } else {
        grid[dow][week] = dateKey(d);
      }
    }
  }
  return grid;
}

export function startOfYearKey(): string {
  return dateKey(startOfYear(new Date()));
}
