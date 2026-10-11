import { cx } from './cx';

describe('cx', () => {
  it('junta as classes informadas com espaco', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('ignora valores falsos (condicionais)', () => {
    expect(cx('a', false, undefined, null, '', 'b')).toBe('a b');
  });
});
