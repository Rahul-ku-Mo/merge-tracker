export function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el as T;
}

export function requireInput(id: string): HTMLInputElement {
  return requireElement<HTMLInputElement>(id);
}

export function requireSelect(id: string): HTMLSelectElement {
  return requireElement<HTMLSelectElement>(id);
}

export function requireForm(id: string): HTMLFormElement {
  return requireElement<HTMLFormElement>(id);
}
