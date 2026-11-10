export { VIEW_LIMITS, VIEW_CEILING, resolveViewLimits } from './limits';
export type { Budget, DeclaredLimits, ResolvedLimits } from './limits';
export { bindLayout, TOO_DEEP } from './binder';
export { parseView, parseViewPatch } from './parse/parse';
export type { ParsedTree, ViewPatchResult } from './parse/parse';
export type { ParseIssue, IssueReason } from './parse/issues';
export { createViewNodeRegistry } from './parse/registry';
export type { ViewNode, ViewNodeDefinition, ViewNodeRegistry } from './parse/registry';
export { NODE_DEFINITIONS, NODE_TYPES } from './nodes/schemas';
export type { ViewNodeType, TextSpan } from './nodes/schemas';
export { viewAction, ACTION_KINDS } from './wire/actions';
export type { ViewAction, MenuAction, ActionKind } from './wire/actions';
export { viewEnvelopeSchema } from './wire/envelope';
export type { ViewEnvelope } from './wire/envelope';

import { createViewNodeRegistry } from './parse/registry';
import { NODE_DEFINITIONS } from './nodes/schemas';
export const viewNodeRegistry = createViewNodeRegistry(NODE_DEFINITIONS);
