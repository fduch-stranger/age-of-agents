/** Predykat: czy logiczna komórka (gx,gy) należy do terenu "upper" danej pary. */
export type IsUpper = (gx: number, gy: number) => boolean;

/**
 * Maska 4 narożników dla render-kafla siatki display (dx,dy).
 * Bity: NW=1, NE=2, SW=4, SE=8. Poza siatką = baza (false).
 * Render-kafel leży na styku 4 komórek logicznych przesuniętych o -1 w NW.
 */
export function cornerMask(dx: number, dy: number, isUpper: IsUpper): number {
  const nw = isUpper(dx - 1, dy - 1) ? 1 : 0;
  const ne = isUpper(dx, dy - 1) ? 2 : 0;
  const sw = isUpper(dx - 1, dy) ? 4 : 0;
  const se = isUpper(dx, dy) ? 8 : 0;
  return nw + ne + sw + se;
}

/**
 * Lookup maska(0..15) → indeks klatki w atlasie tilesetu.
 * DOMYŚLNIE tożsamościowy (klatka == maska) — zakłada atlas ułożony wg maski.
 * Po wygenerowaniu prawdziwego tilesetu PixelLab (Task 6) podmieniany na
 * realne mapowanie i ZAMYKANY testem na faktycznym sheecie.
 */
export const DUAL_GRID_LOOKUP: readonly number[] = Object.freeze(
  Array.from({ length: 16 }, (_, m) => m),
);

export function frameForMask(mask: number): number {
  return DUAL_GRID_LOOKUP[mask] ?? 0;
}
