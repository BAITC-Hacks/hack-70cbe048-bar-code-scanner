import { describe, expect, it } from 'vitest';
import { validEan } from '../server/src/validation.js';

function withCheck(body: string) {
  let sum = 0;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    const positionFromRight = body.length - i;
    sum += Number(body[i]) * (positionFromRight % 2 === 1 ? 3 : 1);
  }
  return body + String((10 - (sum % 10)) % 10);
}

describe('EAN/GTIN validation', () => {
  it('accepts valid EAN-13', () => {
    expect(validEan('4870207314301')).toBe(true);
  });

  it('rejects invalid checksum', () => {
    expect(validEan('4870207314302')).toBe(false);
  });

  it('rejects invalid length', () => {
    expect(validEan('1234567')).toBe(false);
    expect(validEan('123456789')).toBe(false);
  });

  it('validates GTIN-14 checksum instead of accepting every 14-digit number', () => {
    const valid = withCheck('1487020731430');
    expect(valid).toHaveLength(14);
    expect(validEan(valid)).toBe(true);
    const invalid = valid.slice(0, -1) + String((Number(valid.at(-1)) + 1) % 10);
    expect(validEan(invalid)).toBe(false);
  });
});
