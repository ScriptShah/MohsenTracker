/**
 * Hijri (Islamic) calendar math, computed locally so the app works offline.
 * Implements the Kuwaiti algorithm — accurate within ±1 day vs the official
 * Umm al-Qura table for current and near-future dates. The user has a
 * manual override (Profile.ramadanMode = 'on' | 'off') for the rare cases
 * where the local computation disagrees with their local moon-sighting
 * authority.
 *
 * Eventually swap the offline computation for the Aladhan API once
 * networked prayer-times integration ships (spec §12, Phase 3).
 */

export interface HijriDate {
  year: number;
  month: number; // 1 = Muharram … 9 = Ramadan … 10 = Shawwal … 12 = Dhul Hijjah
  day: number;
}

export type RamadanPhase = 'off' | 'pre' | 'active' | 'lastTen' | 'shawwal';

export interface PhaseInfo {
  phase: RamadanPhase;
  hijri: HijriDate;
  /** Defined when phase === 'pre'. Days until Sha'ban ends (≈ Ramadan 1). */
  daysUntilRamadan?: number;
  /** Defined when phase === 'active' or 'lastTen'. 1..30. */
  dayOfRamadan?: number;
  /** Defined when phase === 'shawwal'. 1..30. */
  dayOfShawwal?: number;
}

export function gregorianToHijri(date: Date = new Date()): HijriDate {
  let y = date.getFullYear();
  let m = date.getMonth() + 1;
  const d = date.getDate();

  if (m < 3) {
    y -= 1;
    m += 12;
  }

  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    d +
    b -
    1524;

  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;

  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  return { year, month, day };
}

export function ramadanPhase(date: Date = new Date()): PhaseInfo {
  const hijri = gregorianToHijri(date);

  if (hijri.month === 9) {
    if (hijri.day >= 21) {
      return { phase: 'lastTen', hijri, dayOfRamadan: hijri.day };
    }
    return { phase: 'active', hijri, dayOfRamadan: hijri.day };
  }

  if (hijri.month === 8 && hijri.day >= 15) {
    // Sha'ban is 29 or 30 days; we approximate with 30 for the countdown.
    return {
      phase: 'pre',
      hijri,
      daysUntilRamadan: Math.max(1, 30 - hijri.day + 1),
    };
  }

  if (hijri.month === 10) {
    return { phase: 'shawwal', hijri, dayOfShawwal: hijri.day };
  }

  return { phase: 'off', hijri };
}

const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhul Qa'dah",
  'Dhul Hijjah',
];

export function hijriMonthName(monthIndex: number): string {
  return HIJRI_MONTHS_EN[Math.max(1, Math.min(12, monthIndex)) - 1];
}

/** Returns true when Ramadan / lastTen is active (the dashboard shifts). */
export function isRamadanModeActive(
  ramadanMode: 'auto' | 'on' | 'off',
  now: Date = new Date(),
): boolean {
  if (ramadanMode === 'on') return true;
  if (ramadanMode === 'off') return false;
  const { phase } = ramadanPhase(now);
  return phase === 'active' || phase === 'lastTen';
}

/** Laylat al-Qadr odd nights of last 10 (21st, 23rd, 25th, 27th, 29th). */
export function isLaylatQadrCandidate(dayOfRamadan: number): boolean {
  return dayOfRamadan % 2 === 1 && dayOfRamadan >= 21;
}
