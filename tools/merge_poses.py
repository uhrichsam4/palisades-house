#!/usr/bin/env python3
# Paste matched cameras/people from shots/videoref/poses_*.json into src/videos/spots.js (in place).
import json, re, glob, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
poses = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'shots/videoref/poses_*.json'))):
    poses.update(json.load(open(f)))
p = os.path.join(ROOT, 'src/videos/spots.js'); s = open(p).read()
r = lambda v: [round(float(x), 3) for x in v]
for vid, d in poses.items():
    c = d['cam']
    cam = "cam: { pos: %s, look: %s, fov: %s, roll: %s, t: %s }" % (json.dumps(r(c['pos'])), json.dumps(r(c['look'])), round(float(c['fov']), 2), round(float(c.get('roll', 0)), 2), round(float(c.get('t', 0.4)), 2))
    ppl = ', '.join('{ pos: %s, yaw: %s, pose: %s }' % (json.dumps(r(q['pos'])), round(float(q.get('yaw', 0)), 3), json.dumps(q.get('pose', 'stand'))) for q in d.get('people', []))
    pat = re.compile(r"(\{ id: '%s'.*?\n\s*)cam: \{[^}]*\}, people: \[.*?\], matched: (true|false) \}" % vid, re.S)
    new, n = pat.subn(lambda m: m.group(1) + cam + ", people: [" + ppl + "], matched: true }", s)
    if n != 1: print('could not place', vid, file=sys.stderr); continue
    s = new; print(vid, d.get('quality'), '-', (d.get('notes') or '')[:110])
open(p, 'w').write(s)
