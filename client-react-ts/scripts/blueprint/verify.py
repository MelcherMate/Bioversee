import io, numpy as np, cairosvg
from PIL import Image
import lib
from lib import f
def render(svg, scale=2.0):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), scale=scale))).convert("RGBA")
def logo_raster(inner_svg, bbox, R=40, mode=True):
    x0, y0, x1, y1 = bbox
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="%s %s %s %s">%s</svg>' % (
        round((x1 - x0) * R), round((y1 - y0) * R), f(x0), f(y0), f(x1 - x0), f(y1 - y0), lib.colorize(inner_svg, mode))
    a = np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert("RGBA"))[:, :, 3] > 127
    return a, (x0, y0, R)
def probe_edge(rast, pr):
    a, (x0, y0, R) = rast
    kind, axis, (wx0, wy0, wx1, wy1) = pr[:3]
    c0, c1 = int(round((wx0 - x0) * R)), int(round((wx1 - x0) * R))
    r0, r1 = int(round((wy0 - y0) * R)), int(round((wy1 - y0) * R))
    sub = a[r0:r1, c0:c1]
    if not sub.any(): return None, "no-ink"
    ax = 0 if axis == 'x' else 1
    idxs = np.where(sub.any(axis=ax))[0]
    idx = idxs[0] if kind == 'min' else idxs[-1] + 1
    n = sub.shape[1] if axis == 'x' else sub.shape[0]
    edge = (x0 + (c0 + idx) / R) if axis == 'x' else (y0 + (r0 + idx) / R)
    return edge, ("window-border" if idx in (0, n) else "ok")
def check(sheet, logo_bbox):
    rep = []; bad = 0; cache = {}; maxd = 0
    for p in sheet.probes:
        v = p['view']
        if p['probe'] is None:
            rep.append("  [ref ] %-30s %s=%-8s (guide / centre-line reference)" % (p['label'][:30], p['axis'], f(p['val']))); continue
        mode = p['probe'][3] if len(p['probe']) > 3 else True
        key = (id(v.logo), mode)
        if key not in cache: cache[key] = logo_raster(v.logo, logo_bbox, 40, mode)
        e, st = probe_edge(cache[key], p['probe'])
        d = None if e is None else abs(e - p['val'])
        ok = st == "ok" and d is not None and d <= 0.5
        if d is not None: maxd = max(maxd, d)
        bad += (not ok)
        rep.append("  [%s] %-30s %s=%-8s ink edge=%-8s |d|=%s %s" % ("ok  " if ok else "FAIL", p['label'][:30], p['axis'], f(p['val']), f(e) if e is not None else "-", f(d) if d is not None else "-", "" if st == "ok" else st))
    S = 2.0
    logo = np.array(render(sheet.svg(("logo",), mask=True, bg=False), S))[:, :, 3] > 30
    dims = np.array(render(sheet.svg(("dims",), bg=False), S))[:, :, 3] > 30
    hit = logo & dims
    if hit.any():
        ys, xs = np.where(hit); bad += 1
        rep.append("  [FAIL] dimension lines touch logo ink at %d px, e.g. sheet (%.1f,%.1f)" % (hit.sum(), xs[0] / S, ys[0] / S))
    else: rep.append("  [ok  ] no dimension/extension line touches logo ink")
    labs = sheet.labels
    for i, (s, b) in enumerate(labs):
        x0, y0, x1, y1 = [int(round(c * S)) for c in b]
        reg = (slice(max(y0 - 2, 0), y1 + 2), slice(max(x0 - 2, 0), x1 + 2))
        if logo[reg].any(): bad += 1; rep.append("  [FAIL] label '%s' overlaps logo" % s)
        if dims[reg].any(): bad += 1; rep.append("  [FAIL] label '%s' overlaps a dimension line" % s)
        for s2, b2 in labs[i + 1:]:
            if b[0] < b2[2] + 3 and b2[0] < b[2] + 3 and b[1] < b2[3] + 2 and b2[1] < b[3] + 2:
                bad += 1; rep.append("  [FAIL] labels overlap: '%s' / '%s'" % (s, s2))
        if b[0] < 4 or b[2] > sheet.W - 4 or b[1] < 4 or b[3] > sheet.H - 50: bad += 1; rep.append("  [FAIL] label '%s' off sheet" % s)
    rep.append("  labels checked: %d   max tick deviation: %s units" % (len(labs), f(maxd)))
    return bad, "\n".join(rep)
