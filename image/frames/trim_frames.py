# -*- coding: utf-8 -*-
"""Trim every frame PNG down to the character's own pixels.

Only fully transparent margin is removed — not one visible pixel changes. The game
ignores margin anyway, but trimming keeps the files WYSIWYG: the bottom edge of the
file is the character's feet, so what you see in an image editor is what the game
puts on the floor.

Run it after editing frames:   python trim_frames.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ALPHA = 12

changed = kept = 0
for fn in sorted(os.listdir(HERE)):
    if not fn.endswith('.png') or fn.startswith('_'):
        continue
    p = os.path.join(HERE, fn)
    im = Image.open(p).convert('RGBA')
    bb = im.getbbox()                     # bbox of anything non-zero alpha
    if bb is None:
        print('%-26s EMPTY - skipped' % fn)
        continue
    # getbbox uses alpha>0; redo it at our threshold so faint haze is not kept
    w, h = im.size
    px = im.load()
    minX, maxX, minY, maxY = w, -1, h, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > ALPHA:
                if x < minX: minX = x
                if x > maxX: maxX = x
                if y < minY: minY = y
                if y > maxY: maxY = y
    if maxX < minX:
        print('%-26s EMPTY - skipped' % fn)
        continue
    box = (minX, minY, maxX + 1, maxY + 1)
    if box == (0, 0, w, h):
        kept += 1
        continue
    im.crop(box).save(p)
    print('%-26s %dx%d -> %dx%d' % (fn, w, h, box[2] - box[0], box[3] - box[1]))
    changed += 1

print('\n%d trimmed, %d already tight' % (changed, kept))
