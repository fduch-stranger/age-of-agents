import { validateMapping, type MappingConfig } from '../theme/mapping';

/** Parsuje treść wgranego pliku → config albo błąd (do komunikatu). */
export function parseUploadedMapping(text: string):
  | { ok: true; config: MappingConfig }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  return validateMapping(parsed);
}

/** Pobiera config jako plik tool-mapping.json (DOM-only; no-op bez document). */
export function downloadMapping(mapping: MappingConfig): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tool-mapping.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
