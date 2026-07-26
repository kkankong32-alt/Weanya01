# -*- coding: utf-8 -*-
"""Cut each player sheet into individual frame PNGs.

The sheets are not even grids: poses sit at irregular x positions and neighbours
often touch, so neither a 6-way split nor plain gap-finding works. Strategy:

 1. find runs of inked columns (blobs);
 2. estimate ONE character's width from the run sheet, which is reliably six
    separate poses, and reuse it for that character's other sheets;
 3. a blob wider than ~1.5 characters holds several poses, so split it at the
    emptiest columns near the expected boundaries;
 4. trim each result and flag anything still implausibly narrow or wide.

Writes:  image/frames/<char>_<anim>_<n>.png
         image/frames/_contact_<char>_<anim>.png   (red = frame, cyan = cut)
         image/frames/frames.json
"""
import sys, os, json
from PIL import Image, ImageDraw

BASE = sys.argv[1]
IMG = os.path.join(BASE, 'image')
OUT = os.path.join(IMG, 'frames')
os.makedirs(OUT, exist_ok=True)
ALPHA = 12
CHARS = ['yeminhye', 'shinjunghan', 'yonggamhui']
ANIMS = ['run', 'jump', 'misc']


def load(ch, anim):
    p = os.path.join(IMG, 'player_%s_%s_sheet.png' % (ch, anim))
    if not os.path.exists(p):
        return None, None, None, None
    im = Image.open(p).convert('RGBA')
    px = im.load()
    w, h = im.size
    counts = []
    for x in range(w):
        c = 0
        for y in range(h):
            if px[x, y][3] > ALPHA:
                c += 1
        counts.append(c)
    return im, px, (w, h), counts


def blobs_of(counts):
    out, start = [], None
    for x, c in enumerate(counts):
        if c and start is None:
            start = x
        elif not c and start is not None:
            out.append((start, x - 1)); start = None
    if start is not None:
        out.append((start, len(counts) - 1))
    return out


def valley(counts, a, b, centre):
    best, bestc = centre, None
    for x in range(max(a, 0), min(b, len(counts) - 1) + 1):
        c = counts[x]
        if bestc is None or c < bestc or (c == bestc and abs(x - centre) < abs(best - centre)):
            best, bestc = x, c
    return best


def split_blob(counts, x0, x1, n):
    """cut [x0,x1] into n parts at the emptiest columns near even boundaries"""
    if n <= 1:
        return [(x0, x1)]
    span = x1 - x0 + 1
    cell = span / float(n)
    edges = [x0]
    for i in range(1, n):
        centre = int(x0 + cell * i)
        win = max(5, int(cell * 0.34))
        edges.append(valley(counts, centre - win, centre + win, centre))
    edges.append(x1)
    parts = []
    for i in range(n):
        a = edges[i] if i == 0 else edges[i] + 1
        parts.append((a, edges[i + 1]))
    return parts


def bbox(px, size, x0, x1):
    w, h = size
    minX, maxX, minY, maxY = x1, x0 - 1, h, -1
    for y in range(h):
        for x in range(x0, x1 + 1):
            if px[x, y][3] > ALPHA:
                if x < minX: minX = x
                if x > maxX: maxX = x
                if y < minY: minY = y
                if y > maxY: maxY = y
    if maxX < minX or maxY < minY:
        return None
    return (minX, minY, maxX + 1, maxY + 1)


def frames_for(px, size, counts, charw):
    """segment a whole sheet into single-pose boxes"""
    out = []
    for (x0, x1) in blobs_of(counts):
        n = max(1, int(round((x1 - x0 + 1) / float(charw))))
        for (a, b) in split_blob(counts, x0, x1, n):
            bb = bbox(px, size, a, b)
            if bb:
                out.append(bb)
    return out


manifest, report = {}, []
for ch in CHARS:
    # --- step 2: one character's width, from the run sheet ---
    im, px, size, counts = load(ch, 'run')
    if im is None:
        print('MISSING run sheet for', ch); continue
    runblobs = blobs_of(counts)
    # six poses on the run sheet, so total ink width / 6 is a good unit
    total = sum(b[1] - b[0] + 1 for b in runblobs)
    charw = total / 6.0
    print('%s: run-sheet ink %dpx over 6 poses -> one pose ~%.0fpx' % (ch, total, charw))

    for anim in ANIMS:
        im, px, size, counts = load(ch, anim)
        if im is None:
            print('  MISSING', anim); continue
        boxes = frames_for(px, size, counts, charw)
        preview = im.copy()
        dr = ImageDraw.Draw(preview)
        frames = []
        for i, bb in enumerate(boxes):
            sub = im.crop(bb)
            fn = '%s_%s_%d.png' % (ch, anim, i)
            sub.save(os.path.join(OUT, fn))
            ratio = sub.width / float(charw)
            bad = 'SLIVER' if ratio < 0.5 else ('MERGED' if ratio > 1.55 else '')
            frames.append({'file': fn, 'w': sub.width, 'h': sub.height, 'flag': bad})
            col = (255, 60, 60, 255) if bad else (60, 255, 120, 255)
            dr.rectangle([bb[0], bb[1], bb[2] - 1, bb[3] - 1], outline=col, width=5)
            if bad:
                report.append('%s_%s frame %d: %dx%d %s' % (ch, anim, i, sub.width, sub.height, bad))
        preview.save(os.path.join(OUT, '_contact_%s_%s.png' % (ch, anim)))
        manifest['%s_%s' % (ch, anim)] = frames
        print('  %-5s -> %d frames  %s' % (anim, len(frames),
              ' '.join('%dx%d%s' % (f['w'], f['h'], '!' + f['flag'] if f['flag'] else '')
                       for f in frames)))

with open(os.path.join(OUT, 'frames.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)

print('\n--- needs a human eye ---')
print('\n'.join(report) if report else 'none: every frame looks like a single pose')
