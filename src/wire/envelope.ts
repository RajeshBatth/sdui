import { z } from 'zod';
import { nonEmpty } from './primitives';

const positiveInt = z.number().int().positive();
const budget = z.object({ nodes: positiveInt.optional(), depth: positiveInt.optional() });

export const viewLimitsSchema = z
  .object({ soft: budget.optional(), hard: budget.optional() })
  .superRefine((l, ctx) => {
    for (const d of ['nodes', 'depth'] as const) {
      const s = l.soft?.[d];
      const h = l.hard?.[d];
      if (s !== undefined && h !== undefined && s > h) {
        ctx.addIssue({ code: 'custom', path: ['soft', d], message: 'soft-above-hard' });
      }
    }
  });

export const viewEnvelopeSchema = z
  .object({
    type: z.literal('view'),
    version: z.union([z.string(), z.number()]),
    root: z.unknown().optional(),
    layout: z.unknown().optional(),
    layoutId: nonEmpty.optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    limits: viewLimitsSchema.optional(),
    fallbackText: nonEmpty.optional(),
    presentation: z.literal('sheet').optional(),
    tracking: z.unknown().optional(),
  })
  .superRefine((e, ctx) => {
    const hasRoot = 'root' in e;
    const hasLayout = e.layout !== undefined;
    if (hasRoot === hasLayout) ctx.addIssue({ code: 'custom', message: 'exactly one of root or layout' });
    if (e.props !== undefined && !hasLayout) ctx.addIssue({ code: 'custom', path: ['props'], message: 'props only beside layout' });
  });

export type ViewEnvelope = z.infer<typeof viewEnvelopeSchema>;
