#!/usr/bin/env node
// Walkability audit: loads the house (no probes/post), sweeps a player capsule over every room and opening,
// prints rooms with blocked floor and the colliders responsible (tagged by piece).
//   node tools/walk_audit.mjs [--min=15]   (only list rooms with >= min % blocked; default 0 = all with blockers)
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['tools/shot.mjs', '--cam=9.8,1.6,6.6,9.8,1.5,15,62', '--name=audit', '--nopost', '--audit'], { encoding: 'utf8', env: { ...process.env, SHOT_COOLDOWN_MS: '0' } });
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
