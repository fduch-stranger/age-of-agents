/**
 * Rejestr przyrostowego odczytu plikow sesji WEWNATRZ kontenerow. W odroznieniu
 * od TailRegistry nie czyta z FS — dostaje rozmiar i nowe bajty (pozyskane przez
 * `docker exec`) i wydobywa kompletne linie NDJSON, buforujac niedokonczona
 * koncowke. Klucz laczy id kontenera i sciezke separatorem NUL, by sciezki ze
 * spacja nie kolidowaly.
 */
export class ContainerTailRegistry {
  private offsets = new Map<string, number>();
  private remainders = new Map<string, string>();

  static key(containerId: string, file: string): string {
    return containerId + String.fromCharCode(0) + file;
  }

  getOffset(key: string): number {
    return this.offsets.get(key) ?? 0;
  }

  has(key: string): boolean {
    return this.offsets.has(key);
  }

  /** Rejestruje plik od biezacego konca (pomija historie) — dla duzych plikow. */
  registerAtEnd(key: string, size: number): void {
    this.offsets.set(key, size);
    this.remainders.set(key, '');
  }

  forget(key: string): void {
    this.offsets.delete(key);
    this.remainders.delete(key);
  }

  /**
   * Przyjmuje aktualny rozmiar pliku i NOWE bajty (od getOffset(key) do size).
   * Zwraca kompletne linie. Wykrywa skrocenie pliku (size < offset, reset).
   */
  feed(key: string, size: number, newBytes: string): string[] {
    let offset = this.offsets.get(key) ?? 0;
    if (size < offset) {
      offset = 0;
      this.remainders.set(key, '');
    }
    this.offsets.set(key, size);
    if (!newBytes) return [];
    const buffered = (this.remainders.get(key) ?? '') + newBytes;
    const parts = buffered.split('\n');
    const remainder = parts.pop() ?? '';
    this.remainders.set(key, remainder);
    return parts.filter((l) => l.trim().length > 0);
  }
}
