export interface Budget {
  nodes: number;
  depth: number;
}
export interface DeclaredLimits {
  soft?: Partial<Budget>;
  hard?: Partial<Budget>;
}
export interface ResolvedLimits {
  hard: Budget;
  soft?: Partial<Budget>;
  clamped: (keyof Budget)[];
}

export const VIEW_LIMITS: Budget = { nodes: 200, depth: 12 };
export const VIEW_CEILING: Budget = { nodes: 1000, depth: 16 };

const DIMENSIONS = ['nodes', 'depth'] as const;

export function resolveViewLimits(declared: DeclaredLimits | undefined, base: Budget = VIEW_LIMITS): ResolvedLimits | null {
  const hard = { ...base };
  const clamped: (keyof Budget)[] = [];
  for (const d of DIMENSIONS) {
    const want = declared?.hard?.[d];
    if (want === undefined) continue;
    if (want > VIEW_CEILING[d]) {
      hard[d] = VIEW_CEILING[d];
      clamped.push(d);
    } else {
      hard[d] = want;
    }
  }
  const soft = declared?.soft;
  for (const d of DIMENSIONS) {
    const s = soft?.[d];
    if (s !== undefined && s > hard[d]) return null;
  }
  return soft ? { hard, soft, clamped } : { hard, clamped };
}
