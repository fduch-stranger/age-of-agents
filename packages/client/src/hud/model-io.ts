import { validateModelConfig, type ModelConfig } from '../theme/models';

/** Parsuje treść wgranego pliku → config albo błąd (bliźniak parseUploadedMapping). */
export function parseUploadedModelConfig(text: string):
  | { ok: true; config: ModelConfig }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  return validateModelConfig(parsed);
}

/** Pobiera config jako plik model-config.json (DOM-only; no-op bez document). */
export function downloadModelConfig(models: ModelConfig): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(models, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'model-config.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
