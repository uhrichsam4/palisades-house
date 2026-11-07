#!/usr/bin/env python3
# Comparison images for the critic loop.
#   compose.py vs  <photo.jpg> <ours.png> <out.jpg>          -> labelled side by side: PHOTO | OURS
#   compose.py ab  <photo.jpg> <ours.png> <out.jpg> <seed>   -> blind A | B (seeded order), prints key JSON
# The MLS watermark (bottom-right) is masked on BOTH images so it can't give the photo away.
import sys, json, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def load(p):
    im = Image.open(p).convert('RGB')
    if im.size != (1080, 720): im = im.resize((1080, 720), Image.LANCZOS)
    return im

def mask_logo(im):
    # cover the MLS logo with a softened copy of the floor just left of it (never blur the red logo itself,
    # which leaves a pink smudge that gives the real photo away in the blind test)
    box = (972, 645, 1080, 720); w = box[2] - box[0]
    src = im.crop((box[0] - w - 4, box[1], box[0] - 4, box[3])).transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(3))
    im.paste(src, box); return im

def font(sz):
    for f in ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/SFNS.ttf']:
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()

def label(im, text):
    d = ImageDraw.Draw(im); f = font(30)
    d.rectangle([0, 0, 16 + 20 * len(text), 44], fill=(0, 0, 0)); d.text((10, 5), text, fill=(255, 255, 0), font=f); return im

mode = sys.argv[1]
photo, ours, out = sys.argv[2], sys.argv[3], sys.argv[4]
P, O = mask_logo(load(photo)), mask_logo(load(ours))
if mode == 'vs':
    s = Image.new('RGB', (2160, 720)); s.paste(label(P, 'PHOTO'), (0, 0)); s.paste(label(O, 'OURS'), (1080, 0)); s.save(out, quality=88)
else:
    rnd = random.Random(int(sys.argv[5]) * 7919 + sum(map(ord, out)))
    ours_is = rnd.choice(['A', 'B'])
    A, B = (O, P) if ours_is == 'A' else (P, O)
    s = Image.new('RGB', (2160, 720)); s.paste(label(A.copy(), 'A'), (0, 0)); s.paste(label(B.copy(), 'B'), (1080, 0)); s.save(out, quality=88)
    print(json.dumps({'ours': ours_is}))
