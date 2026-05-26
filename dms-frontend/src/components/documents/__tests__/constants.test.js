import { describe, it, expect } from 'vitest';
import { nextRev, countDescendants } from '../constants';

describe('nextRev', () => {
  it('returns A for empty/null input', () => {
    expect(nextRev('')).toBe('A');
    expect(nextRev(null)).toBe('A');
    expect(nextRev(undefined)).toBe('A');
  });

  it('increments single letters', () => {
    expect(nextRev('A')).toBe('B');
    expect(nextRev('C')).toBe('D');
    expect(nextRev('Z')).toBe('['); // edge case — past Z
  });

  it('handles lowercase by uppercasing', () => {
    expect(nextRev('a')).toBe('B');
  });

  it('returns multi-char strings as-is', () => {
    expect(nextRev('01')).toBe('01');
    expect(nextRev('P1')).toBe('P1');
  });
});

describe('countDescendants', () => {
  it('returns 0 for leaf node', () => {
    expect(countDescendants({ name: 'Leaf' })).toBe(0);
    expect(countDescendants({ name: 'Leaf', children: [] })).toBe(0);
  });

  it('counts direct children', () => {
    expect(countDescendants({
      name: 'Root',
      children: [
        { name: 'A', children: [] },
        { name: 'B', children: [] },
      ],
    })).toBe(2);
  });

  it('counts nested children recursively', () => {
    expect(countDescendants({
      name: 'Root',
      children: [
        { name: 'A', children: [
          { name: 'A1', children: [] },
          { name: 'A2', children: [] },
        ]},
        { name: 'B', children: [] },
      ],
    })).toBe(4); // A, A1, A2, B
  });
});
