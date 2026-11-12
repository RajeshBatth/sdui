import { describe, expect, it } from 'vitest';
import { parseFigmaUrl } from '../playground/server/figma';

describe('parseFigmaUrl', () => {
  it('reads the file key and node id', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/AbC123/My-File?node-id=12-345&m=dev')).toEqual({ file: 'AbC123', node: '12:345' });
  });
  it('uses the branch key for branch links', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/AbC123/branch/BrX9/My-File?node-id=1-2')).toEqual({ file: 'BrX9', node: '1:2' });
  });
  it('rejects links without a node or off figma.com', () => {
    expect(() => parseFigmaUrl('https://www.figma.com/design/AbC123/My-File')).toThrow(/node-id/);
    expect(() => parseFigmaUrl('https://example.com/design/AbC123/X?node-id=1-2')).toThrow(/figma.com/);
  });
});
