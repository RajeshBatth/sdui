import type { Manifest } from '../types';

export type ThemePatch = { [K in keyof Manifest]?: K extends 'look' ? Manifest['look'] : Partial<Manifest[K]> };

export function mergeTheme(base: Manifest, patches: readonly ThemePatch[]): Manifest {
  const out: Manifest = { ...base, look: { ...base.look } };
  for (const patch of patches) {
    for (const [scale, table] of Object.entries(patch) as [keyof Manifest, Record<string, unknown>][]) {
      if (scale === 'look') {
        for (const [type, looks] of Object.entries(table as Manifest['look'])) {
          out.look[type] = { ...out.look[type], ...looks };
        }
      } else {
        (out as unknown as Record<string, unknown>)[scale] = { ...(out[scale] as object), ...table };
      }
    }
  }
  return out;
}
