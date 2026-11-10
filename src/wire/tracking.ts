import { z } from 'zod';
import { nonEmpty } from './primitives';

export const trackingEvent = z
  .object({
    event: nonEmpty,
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict();
export type TrackingEvent = z.infer<typeof trackingEvent>;

export type TrackingKey = 'onShow' | 'onSelect' | 'onInspect' | 'onExpand' | 'onDismiss';
export type TrackingMap = Partial<Record<TrackingKey, TrackingEvent>>;
