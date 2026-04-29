/**
 * Punishment safety validator (spec §5.5).
 *
 * The spec is explicit that punishments must never harm health: no skipping
 * meals, no extreme exercise, nothing that undermines health goals. Default
 * to charity-based for new users. We block obvious patterns in EN + FA at
 * input time so the user gets an immediate explanation, then they can pick
 * something safer.
 *
 * This is a guardrail, not a content filter — false positives are preferable
 * to false negatives. When in doubt, block and explain why.
 */

export type SafetyReason = 'meal' | 'extreme' | 'sleep' | 'harm';

export interface SafetyResult {
  ok: boolean;
  reason?: SafetyReason;
}

const PATTERNS: Array<{ reason: SafetyReason; re: RegExp }> = [
  // Skipping meals / fasting punitively / starvation
  {
    reason: 'meal',
    re: /(skip|miss|no)\s*(meal|breakfast|lunch|dinner|food|eating)|starv(e|ation)|don'?t\s+eat|fast\s+(extra|all\s+day|until)|نخوردن|گرسنه\s*ماندن|حذف\s*(غذا|وعده|صبحانه|ناهار|شام)|گرسنگی/i,
  },
  // Extreme/punitive exercise
  {
    reason: 'extreme',
    re: /extreme\s*(exercise|workout|run)|until\s+(i|you)?\s*(drop|faint|collapse|die|throw\s*up)|exhaust(ing|ion)|run\s+\d+\s*hours|۱۰۰\s*شنا|ورزش\s*(شدید|افراطی|تا\s*مرز)|تا\s*(از\s*حال|بیهوش|خسته‌گی)/i,
  },
  // Sleep deprivation
  {
    reason: 'sleep',
    re: /no\s+sleep|stay\s*up\s*all\s*night|skip\s*sleep|sleep\s+deprivation|بی(‌)?\s?خوابی|نخوابیدن|تا\s*صبح\s*بیدار/i,
  },
  // Self-harm
  {
    reason: 'harm',
    re: /(self[\s-]?harm|hurt\s+myself|hit\s+myself|cut\s+myself|punch\s+myself)|آسیب\s*به\s*خود|زدن\s*خود|آزار\s*رساندن/i,
  },
];

export function validatePunishment(label: string): SafetyResult {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, reason: 'harm' };
  for (const { reason, re } of PATTERNS) {
    if (re.test(trimmed)) return { ok: false, reason };
  }
  return { ok: true };
}
