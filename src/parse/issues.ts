export const ISSUE_REASONS = [
  'not-a-node',
  'unknown-type',
  'invalid-fields',
  'too-deep',
  'too-many-nodes',
  'soft-above-hard',
  'unknown-menu',
  'form-scope',
  'duplicate-id',
  'tracking-unsupported',
  'tracking-duplicate',
] as const;
export type IssueReason = (typeof ISSUE_REASONS)[number];

export interface ParseIssue {
  path: string;
  reason: IssueReason;
  detail?: string;
  fellBack?: boolean;
  type?: string;
}

export const isTrackingOnly = (issues: readonly ParseIssue[]) =>
  issues.length > 0 && issues.every((i) => i.reason === 'tracking-unsupported' || i.reason === 'tracking-duplicate' || (i.reason === 'invalid-fields' && i.detail?.startsWith('tracking')));
