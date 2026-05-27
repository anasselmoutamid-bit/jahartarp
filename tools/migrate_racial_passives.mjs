#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   tools/migrate_racial_passives.mjs — Migration one-shot D1
   ═══════════════════════════════════════════════════════════════════════

   Refactor 2026-05 : passifs raciaux/axiome désormais calculés en DÉRIVÉ
   au read-time (cf. docs/js/racial-passives.js côté site,
   utils/racial_passives.py::apply_racial_passives_to_buffs côté bot).

   Ce script effectue :
     1. Mise à jour des descriptions `config/racial_powers` pour aligner
        les multiplicateurs affichés sur le vrai comportement (×1.1 partout
        pour charming/hopper/force_of_nature/artisan_ne — le code utilise
        0.1 depuis le départ, les desc disaient ×1.3/×1.2/×1.5/×1.2 par
        erreur).
     2. Purge des entrées `racial_passive_*` et `axiome_passive_*` de
        toutes les documents de la collection `buffs`. Si la liste devient
        vide, le document entier est supprimé.

   USAGE :
     cd worker
     node ../tools/migrate_racial_passives.mjs [--dry-run]

   Le script utilise `npx wrangler d1 execute` en interne — pas besoin
   d'auth supplémentaire si tu es déjà loggé via `wrangler login`.
   ═══════════════════════════════════════════════════════════════════════ */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DB_NAME = 'jaharta-d1';
const DRY_RUN = process.argv.includes('--dry-run');
const TMP_DIR = mkdtempSync(join(tmpdir(), 'migr-rp-'));

const DESC_PATCHES = {
  charming:        'Passif: CHA/MAN alloc ×2, buffs CHA/MAN ×1.1.',
  hopper:          'Passif: buffs AGI/SPD ×1.1. INT cap 500.',
  force_of_nature: 'Passif: RES ×1.1 (sur base). INT cap 350.',
  artisan_ne:      'Passif: buffs items Legendary+ ×1.1.',
};

function _extractJson(out){
  const start = Math.min(...['[','{'].map(c => {
    const i = out.indexOf(c); return i === -1 ? Infinity : i;
  }));
  if (!isFinite(start)) throw new Error('No JSON in wrangler output: ' + out.slice(0, 200));
  return out.slice(start);
}

// SELECTs : --command, single quotes simples → marche sous Windows cmd
//           (les SELECTs de ce script n'ont pas de quoting complexe).
function d1Query(sql){
  const escaped = sql.replace(/"/g, '\\"');
  const out = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --json --command "${escaped}"`,
                       { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const json = JSON.parse(_extractJson(out));
  if (json && json[0] && json[0].error) throw new Error('D1 error: ' + JSON.stringify(json[0].error));
  return json[0]?.results || [];
}

// UPDATEs/DELETEs : --file= → contourne tous les problèmes d'escaping. Wrangler
// retourne juste un résumé (metadata), pas de résultats — on s'en fiche pour
// ces opérations d'écriture.
let _tmpCounter = 0;
function d1Exec(sql){
  if (DRY_RUN){
    console.log('  [DRY-RUN] ' + sql.slice(0, 200) + (sql.length > 200 ? '…' : ''));
    return;
  }
  const path = join(TMP_DIR, `q${_tmpCounter++}.sql`);
  writeFileSync(path, sql, 'utf8');
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --json --file=${path}`,
             { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } finally {
    try { unlinkSync(path); } catch(_){}
  }
}

function sqlString(v){
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function isManagedSource(source){
  const s = String(source||'');
  return s.indexOf('racial_passive_') === 0 || s.indexOf('axiome_passive_') === 0;
}

// ── 1) Patch descriptions ─────────────────────────────────────────────────
console.log('═══ STEP 1/2 : Update config/racial_powers descriptions ═══');
const rpRows = d1Query("SELECT data FROM documents WHERE collection='config' AND doc_id='racial_powers'");
if (!rpRows.length){
  console.log('  ⚠ config/racial_powers introuvable, skip step 1.');
} else {
  const data = JSON.parse(rpRows[0].data);
  let changes = 0;
  for (const [k, desc] of Object.entries(DESC_PATCHES)){
    if (!data[k]){ console.log(`  ⚠ ${k} absent du registre`); continue; }
    const oldDesc = data[k].desc;
    if (oldDesc === desc){ console.log(`  · ${k} déjà à jour`); continue; }
    console.log(`  · ${k}\n      old: ${oldDesc}\n      new: ${desc}`);
    data[k].desc = desc;
    changes++;
  }
  if (changes){
    const newData = JSON.stringify(data);
    d1Exec(`UPDATE documents SET data=${sqlString(newData)}, updated_at=unixepoch() WHERE collection='config' AND doc_id='racial_powers'`);
    console.log(`  ✓ ${changes} description(s) mise(s) à jour.`);
  } else {
    console.log('  · aucune modification nécessaire');
  }
}

// ── 2) Purge buffs racial_passive_* / axiome_passive_* ─────────────────────
console.log('');
console.log('═══ STEP 2/2 : Purge racial_passive_* / axiome_passive_* in `buffs` ═══');
const buffsRows = d1Query("SELECT doc_id, data FROM documents WHERE collection='buffs'");
console.log(`  ${buffsRows.length} document(s) buffs trouvés.`);

let docsTouched = 0, docsDeleted = 0, entriesRemoved = 0;
for (const row of buffsRows){
  let parsed;
  try { parsed = JSON.parse(row.data); }
  catch(_){ console.log(`  ⚠ ${row.doc_id} : JSON invalide, skip`); continue; }
  const list = Array.isArray(parsed.buffs) ? parsed.buffs : [];
  const cleaned = list.filter(b => {
    if (!b) return false;
    if (b.racial_passive || b.axiome_passive) return false;
    if (isManagedSource(b.source)) return false;
    return true;
  });
  const removed = list.length - cleaned.length;
  if (!removed) continue;
  entriesRemoved += removed;
  if (cleaned.length === 0){
    console.log(`  · ${row.doc_id} → ${removed} entrée(s) retirée(s), doc devient vide → DELETE`);
    d1Exec(`DELETE FROM documents WHERE collection='buffs' AND doc_id=${sqlString(row.doc_id)}`);
    docsDeleted++;
  } else {
    console.log(`  · ${row.doc_id} → ${removed} entrée(s) retirée(s), ${cleaned.length} restant(es)`);
    parsed.buffs = cleaned;
    const newData = JSON.stringify(parsed);
    d1Exec(`UPDATE documents SET data=${sqlString(newData)}, updated_at=unixepoch() WHERE collection='buffs' AND doc_id=${sqlString(row.doc_id)}`);
    docsTouched++;
  }
}

console.log('');
console.log('═══ RÉCAP ═══');
console.log(`  · entrées passives retirées       : ${entriesRemoved}`);
console.log(`  · documents buffs mis à jour      : ${docsTouched}`);
console.log(`  · documents buffs supprimés       : ${docsDeleted}`);
if (DRY_RUN) console.log('\n  (DRY-RUN — rien n\'a été modifié en DB. Relance sans --dry-run pour appliquer.)');
else        console.log('\n  ✓ Migration terminée.');
