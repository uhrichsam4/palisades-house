#!/usr/bin/env python3
# Camera-matching sheet: REF | OURS | OVERLAY (50% mix + our edges in yellow). Any size; ours is resized to ref.
#   match_compose.py <ref.jpg> <ours.png> <out.jpg>
import sys
from PIL import Image, ImageChops, ImageFilter, ImageDraw, ImageFont, ImageOps
ref = Image.open(sys.argv[1]).convert('RGB'); ours = Image.open(sys.argv[2]).convert('RGB').resize(ref.size, Image.LANCZOS)
mix = Image.blend(ref, ours, 0.5)
edges = ImageOps.autocontrast(ours.convert('L').filter(ImageFilter.FIND_EDGES)).point(lambda v: 255 if v > 90 else 0)
ov = mix.copy(); ov.paste(Image.new('RGB', ref.size, (255, 230, 0)), (0, 0), edges)
w, h = ref.size; s = Image.new('RGB', (w * 3, h)); s.paste(ref, (0, 0)); s.paste(ours, (w, 0)); s.paste(ov, (2 * w, 0))
d = ImageDraw.Draw(s)
try: f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
except Exception: f = ImageFont.load_default()
for i, t in enumerate(['VIDEO', 'OURS', 'OVERLAY']): d.rectangle([i * w, 0, i * w + 20 + 16 * len(t), 36], fill=(0, 0, 0)); d.text((i * w + 8, 4), t, fill=(255, 255, 0), font=f)
s.save(sys.argv[3], quality=86)
