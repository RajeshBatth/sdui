import { z } from 'zod';

export const TOKEN_NAME = /^[a-z][a-zA-Z0-9-]{0,39}$/;
export const ICON_NAME = /^(?=.{1,40}$)[a-z0-9]+(-[a-z0-9]+)*$/;
export const INPUT_NAME = /^[a-z][a-zA-Z0-9]*$/;
export const RESERVED_INPUT_NAMES = ['day', 'date', 'month'] as const;

export const tokenName = z.string().regex(TOKEN_NAME);
export const iconName = z.string().regex(ICON_NAME);
export const nonEmpty = z.string().min(1);

export function lenient<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}

const num = (min: number, max: number) => z.number().finite().min(min).max(max);
export const sizeValue = z.union([tokenName, num(0, 400)]);
export const spaceValue = z.union([tokenName, num(0, 64)]);
export const radiusValue = z.union([tokenName, num(0, 400)]);
export const aspectValue = z.union([tokenName, num(0.2, 5)]);

export const padding = z.union([
  spaceValue,
  z.object({ x: spaceValue.optional(), y: spaceValue.optional() }).strict(),
  z
    .object({
      top: spaceValue.optional(),
      right: spaceValue.optional(),
      bottom: spaceValue.optional(),
      left: spaceValue.optional(),
    })
    .strict(),
]);

export const align4 = z.enum(['start', 'center', 'end', 'stretch']);
export const align3 = z.enum(['start', 'center', 'end']);

export const viewImage = z.object({ url: nonEmpty, alt: z.string() });
export type ViewImage = z.infer<typeof viewImage>;

export const toggleLabels = z.object({ more: nonEmpty.optional(), less: nonEmpty.optional() });

export const styleRecord = lenient(z.record(z.string(), z.unknown()));
