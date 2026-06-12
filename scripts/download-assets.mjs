#!/usr/bin/env node
/**
 * Półautomatyczny instalator assetów.
 *
 * Itch.io nie udostępnia stabilnych bezpośrednich URL-i (pobranie wymaga
 * kliknięcia na stronie paczki), więc przepływ jest następujący:
 *   1. Pobierz zip ze strony paczki (pole "page" w assets-manifest.json)
 *   2. Zapisz go jako downloads/<id>.zip
 *   3. Uruchom `npm run assets` — skrypt rozpakuje wszystko co znajdzie
 *      do packages/client/public/assets/<target> i wypisze czego brakuje.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'assets-manifest.json'), 'utf8'));
const downloadsDir = join(root, 'downloads');
const assetsDir = join(root, 'packages/client/public/assets');

mkdirSync(downloadsDir, { recursive: true });

const missing = [];
let installed = 0;

for (const pack of manifest.packs) {
  const zipPath = join(downloadsDir, `${pack.id}.zip`);
  const targetDir = join(assetsDir, pack.target);

  if (existsSync(targetDir)) {
    console.log(`✓ ${pack.name} — już zainstalowana (${pack.target})`);
    installed++;
    continue;
  }
  if (!existsSync(zipPath)) {
    missing.push(pack);
    continue;
  }
  mkdirSync(targetDir, { recursive: true });
  execFileSync('unzip', ['-oq', zipPath, '-d', targetDir]);
  console.log(`✓ ${pack.name} — rozpakowano do ${pack.target}`);
  installed++;
}

if (missing.length > 0) {
  console.log('\nBrakujące paczki — pobierz ręcznie (przycisk Download na stronie):');
  for (const pack of missing) {
    console.log(`\n  ${pack.name} (${pack.license.split('—')[0].trim()})`);
    console.log(`    strona:  ${pack.page}`);
    console.log(`    zapisz:  downloads/${pack.id}.zip`);
    console.log(`    rola:    ${pack.role}`);
  }
  console.log('\nPotem uruchom ponownie: npm run assets');
} else {
  console.log(`\nKomplet: ${installed}/${manifest.packs.length} paczek zainstalowanych.`);
}
