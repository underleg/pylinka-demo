// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindSelect } from './bindSelect';

function select(id: string, values: string[], selected: string): HTMLSelectElement {
  const element = document.createElement('select');
  element.id = id;
  for (const value of values) element.add(new Option(value, value, false, value === selected));
  return element;
}

describe('bindSelect', () => {
  it('applies the option the page opens on straight away', () => {
    const onChange = vi.fn();
    bindSelect(select('mode', ['spine', 'flipbook'], 'flipbook'), ['spine', 'flipbook'] as const, onChange);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('flipbook');
  });

  it('reports each change', () => {
    const element = select('mode', ['spine', 'flipbook'], 'flipbook');
    const onChange = vi.fn();
    bindSelect(element, ['spine', 'flipbook'] as const, onChange);
    element.value = 'spine';
    element.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenLastCalledWith('spine');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('fails fast when the HTML offers an option the code does not handle', () => {
    expect(() => bindSelect(select('mode', ['spine', 'canvas'], 'spine'), ['spine', 'flipbook'] as const, vi.fn())).toThrow(
      '#mode has an unexpected option "canvas"',
    );
  });
});
