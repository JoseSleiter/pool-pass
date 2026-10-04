/** Quick presets for capacity_overrides.reason (still free text in the DB). */
export const REASON_PRESETS = ['Mantenimiento', 'Evento privado', 'Feriado'] as const;

export type ReasonPreset = (typeof REASON_PRESETS)[number];
export type ReasonKind = ReasonPreset | 'Otro';

/** Which chip a stored reason belongs to; null when there is no reason. */
export function reasonKind(reason: string | null | undefined): ReasonKind | null {
  const r = reason?.trim() ?? '';
  if (r === '') return null;
  return REASON_PRESETS.find((p) => p.toLowerCase() === r.toLowerCase()) ?? 'Otro';
}

export const REASON_CHIP_CLASS: Record<ReasonKind, string> = {
  Mantenimiento: 'bg-amber-100 text-amber-900',
  'Evento privado': 'bg-violet-100 text-violet-900',
  Feriado: 'bg-teal/20 text-navy',
  Otro: 'bg-slate-100 text-slate-700',
};
