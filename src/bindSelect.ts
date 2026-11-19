// Wires a menu pulldown to `onChange`, which runs once straight away to apply the option the page opens on, then on
// every change. `allowed` is checked against the pulldown's options so the HTML and the code can't drift apart.
export function bindSelect<T extends string>(
  select: HTMLSelectElement,
  allowed: readonly T[],
  onChange: (value: T) => void,
): void {
  const isAllowed = (value: string): value is T => (allowed as readonly string[]).includes(value);
  for (const option of select.options) {
    if (!isAllowed(option.value)) throw new Error(`#${select.id} has an unexpected option "${option.value}"`);
  }
  const apply = () => {
    const value = select.value;
    if (!isAllowed(value)) throw new Error(`#${select.id} has an unexpected value "${value}"`);
    onChange(value);
  };
  select.addEventListener('change', apply);
  apply();
}
