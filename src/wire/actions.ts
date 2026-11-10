import { z } from 'zod';
import { nonEmpty } from './primitives';
import { trackingEvent } from './tracking';

const common = {
  tracking: trackingEvent.optional(),
  closeOnAction: z.boolean().optional(),
};

const conversationTarget = z.union([z.literal('new'), z.object({ id: nonEmpty }).strict()]);

export const messageAction = z
  .object({ kind: z.literal('message'), text: nonEmpty, meta: z.record(z.string(), z.unknown()).optional(), ...common })
  .strict();
export const openDeeplinkAction = z.object({ kind: z.literal('open-deeplink'), url: nonEmpty, ...common }).strict();
export const navigateAction = z
  .object({
    kind: z.literal('navigate'),
    target: nonEmpty,
    params: z.record(z.string(), z.unknown()).optional(),
    conversation: conversationTarget.optional(),
    ...common,
  })
  .strict();
export const prefillComposerAction = z.object({ kind: z.literal('prefill-composer'), text: nonEmpty, ...common }).strict();
export const openConversationAction = z
  .object({
    kind: z.literal('open-conversation'),
    conversation: conversationTarget,
    message: nonEmpty.optional(),
    navType: z.enum(['push', 'replace']).optional(),
    ...common,
  })
  .strict();
export const openPageAction = z
  .object({
    kind: z.literal('open-page'),
    url: nonEmpty,
    heightFraction: z.number().gt(0).max(1).optional(),
    title: nonEmpty.optional(),
    ...common,
  })
  .strict();

export const sheetHeight = z.enum(['content', 'half', 'full']);
export const inlineSheet = z
  .object({
    title: nonEmpty.optional(),
    height: sheetHeight.optional(),
    dismissable: z.boolean().optional(),
    dismissConfirm: z
      .object({ title: nonEmpty, message: nonEmpty.optional(), stay: nonEmpty.optional(), close: nonEmpty.optional() })
      .strict()
      .optional(),
    onDismiss: z.object({ prompt: nonEmpty.optional() }).strict().optional(),
    tracking: z.object({ onShow: trackingEvent.optional(), onDismiss: trackingEvent.optional() }).strict().optional(),
    view: z.unknown(),
  })
  .strict();
export const openSheetAction = z.union([
  z.object({ kind: z.literal('open-sheet'), contentId: nonEmpty, ...common }).strict(),
  z.object({ kind: z.literal('open-sheet'), sheet: inlineSheet, ...common }).strict(),
]);
export const quoteAction = z
  .object({
    kind: z.literal('quote'),
    ref: nonEmpty.optional(),
    title: nonEmpty,
    subtitle: nonEmpty.optional(),
    thumbnail: nonEmpty.optional(),
    placeholder: nonEmpty.optional(),
    suggestions: z.array(nonEmpty).max(6).optional(),
    ...common,
  })
  .strict();
export const downloadAction = z
  .object({ kind: z.literal('download'), url: nonEmpty, filename: nonEmpty.optional(), ...common })
  .strict();
export const shareAction = z
  .object({ kind: z.literal('share'), url: nonEmpty.optional(), text: nonEmpty.optional(), title: nonEmpty.optional(), ...common })
  .strict()
  .refine((a) => a.url !== undefined || a.text !== undefined, 'share needs url or text');
export const startVoiceAction = z.object({ kind: z.literal('start-voice'), ...common }).strict();
export const stopVoiceAction = z.object({ kind: z.literal('stop-voice'), ...common }).strict();
export const feedbackAction = z
  .object({ kind: z.literal('feedback'), value: z.unknown().optional(), ...common })
  .strict();
export const requestAction = z
  .object({
    kind: z.literal('request'),
    endpoint: nonEmpty,
    body: z.unknown().optional(),
    onSuccess: z.object({ toast: nonEmpty.optional(), replaceWith: z.unknown().optional() }).strict().optional(),
    onError: z.object({ toast: nonEmpty.optional() }).strict().optional(),
    ...common,
  })
  .strict();

export const ACTION_KINDS = [
  'message',
  'open-deeplink',
  'navigate',
  'prefill-composer',
  'open-conversation',
  'open-page',
  'open-sheet',
  'quote',
  'download',
  'share',
  'start-voice',
  'stop-voice',
  'feedback',
  'request',
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const viewAction = z.union([
  messageAction,
  openDeeplinkAction,
  navigateAction,
  prefillComposerAction,
  openConversationAction,
  openPageAction,
  openSheetAction,
  quoteAction,
  downloadAction,
  shareAction,
  startVoiceAction,
  stopVoiceAction,
  feedbackAction,
  requestAction,
]);
export type ViewAction = z.infer<typeof viewAction>;

export const menuAction = viewAction;
export type MenuAction = ViewAction;

export const spanAction = z.union([messageAction, openDeeplinkAction]);

export const FORM_FILLED_KINDS: readonly ActionKind[] = [
  'message',
  'prefill-composer',
  'open-deeplink',
  'open-page',
  'open-conversation',
];
export const LATCHED_KINDS: readonly ActionKind[] = [
  'open-deeplink',
  'open-page',
  'open-sheet',
  'open-conversation',
  'navigate',
  'quote',
  'request',
];
export const CLOSES_SHEET_KINDS: readonly ActionKind[] = [
  'message',
  'open-conversation',
  'navigate',
  'quote',
  'prefill-composer',
  'open-page',
];
