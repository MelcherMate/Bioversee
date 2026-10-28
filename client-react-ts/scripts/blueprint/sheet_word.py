import math, re
from lib import Sheet, View, C, f, num, FS, HAIR
from sheet_mark import pmin, pmax
from measure import GLY, gbox, LETTERS_D

def subset(inner, glyphs):
    d = "".join(s['d'] for gname in glyphs for s in GLY[gname])
    return inner.replace(LETTERS_D, d)

def section(sh, g, inner, sx, oy, S, M, name, ytop, ybot):
    cx, cy, W = g['cx'], g['cy'], g['W']
    hw = 1.0
    vs = View(sh, S, sx - S * (cx - hw), oy, inner, clip=(cx - hw, ytop, 2 * hw, ybot - ytop), name=name)
    sh.text(vs.X(cx), vs.Y(ytop) - 6, "A–A", "middle", FS, C['aux'])
    acx, acy = g['acc_c']; aR = g['acc_R']
    top_o = acy - math.sqrt((aR + W / 2) ** 2 - (cx - acx) ** 2)
    top_i = acy - math.sqrt((aR - W / 2) ** 2 - (cx - acx) ** 2)
    ro, ri, ch = g['ring_outer'], g['ring_inner'], g['chord']
    E = [top_o, top_i, cy - ro, cy - ri, cy + ch, cy + ri, cy + ro]
    PR = [pmin('y', E[0], cx, 0.8, 0.3, 'acc'), pmax('y', E[1], cx, 0.8, 0.3, 'acc'), pmin('y', E[2], cx, 0.8, 0.3), pmax('y', E[3], cx, 0.8, 0.3),
          pmin('y', E[4], cx, 0.8, 0.3), pmax('y', E[5], cx, 0.8, 0.3, 'acc'), pmax('y', E[6], cx, 0.8, 0.3)]
    names = ["arc stroke", "gap", "ring", "", "liquid", "ring"]
    for i in range(6):
        lab = M(E[i + 1] - E[i]) + ("  " + names[i] if names[i] else "")
        sh.vdim(vs, E[i], E[i + 1], cx + hw, cx + hw, cx + hw + 18 / S, lab, probes=(PR[i], PR[i + 1]))
    xo = cx - hw - 30 / S
    for i, y in enumerate(E):
        if i != 4: sh.ordinate(vs, y, cx - hw, xo, "R%s" % num(abs(cy - y)), probe=PR[i])
    if abs(ch) * S >= 14:
        sh.ordinate(vs, cy, cx - hw, xo, "0", probe=None)
        sh.ordinate(vs, cy + ch, cx - hw, xo, "+%s chord" % num(ch), probe=PR[4])
    elif abs(ch) > 1e-6:
        sh.ordinate(vs, cy + ch, cx - hw, xo, "+%s chord" % num(ch), probe=PR[4])
    else:
        sh.ordinate(vs, cy, cx - hw, xo, "0 = chord", probe=PR[4])
    return vs

def build(g, inner, title, num_, name):
    H = 70.5; XH = 22.0; BL = 70.5
    M = lambda val: "%s · %sH" % (num(val), num(val / H, 3))
    sh = Sheet(1600, 1000)
    ink = [gbox('B')[0], gbox('i')[1], max(gbox(k)[2] for k in GLY), max(gbox(k)[3] for k in GLY)]
    ink[0] = min(ink[0], g['ink'][0])
    # ---------- row 1: full wordmark ----------
    S1 = 2.8
    v = View(sh, S1, 260 - S1 * ink[0], 120, inner, name=name)
    for y, lab in ((0, "cap height"), (XH, "x-height"), (BL, "baseline")):
        sh.cline(v, -50, y, 445, y, dash=None, op=0.35)
        sh.text(v.X(445) + 6, v.Y(y) + 0.37 * FS, lab, "start", FS, C['aux'])
    sh.add('cons', '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="%s" stroke-dasharray="4 3" stroke-opacity="0.7"/>' % (
        f(v.X(ink[0])), f(v.Y(ink[1])), f((ink[2] - ink[0]) * S1), f((ink[3] - ink[1]) * S1), C['aux'], HAIR))
    iy = gbox('i'); sy = gbox('s'); ex = gbox('e3')
    sh.hdim(v, ink[0], ink[2], ink[1], ink[1], ink[1] - 10, M(ink[2] - ink[0]) + "  ·  ratio %s : 1" % num((ink[2] - ink[0]) / (ink[3] - ink[1]), 3),
            probes=(pmin('x', ink[0], 35), pmax('x', ink[2], 45.2)))
    sh.vdim(v, ink[1], ink[3], ink[2], ink[2], ink[2] + 9, M(ink[3] - ink[1]),
            probes=(pmin('y', ink[1], 74.8), pmax('y', ink[3], 305.6)))
    sh.vdim(v, 0, BL, 0, 0, -46, M(H), lab="left", ext=(False, False), probes=(pmin('y', 0, 14), pmax('y', BL, 14)))
    sh.vdim(v, XH, BL, 0, 0, -6, M(BL - XH), lab="left", ext=(False, False), probes=(pmin('y', XH, 74.8), pmax('y', BL, 74.8)))
    # ---------- row 2: detail B i o ----------
    S2 = 5.0
    det = subset(inner, ['B', 'i'])
    oy2 = 480
    v2 = View(sh, S2, 260 - S2 * ink[0], oy2, det, name=name + "_det")
    cx, cy = g['cx'], g['cy']
    for y in (0, XH, BL):
        sh.cline(v2, ink[0] - 4, y, 152, y, dash=None, op=0.35)
    sh.cline(v2, cx - g['arc_outer'] - 3, cy, 152, cy)
    sh.cline(v2, cx, cy - g['arc_outer'] - 3, cx, BL + 3)
    sh.ccircle(v2, cx, cy, g['R']); sh.ccircle(v2, cx, cy, g['ring_r'])
    a0, a1 = g['ink'][0], g['ink'][2]
    sh.hdim(v2, a0, a1, cy + 2.4, cy + 2.4, BL + 9, M(a1 - a0) + "  o Ø", lab="below", probes=(pmin('x', a0, cy), pmax('x', a1, cy)))
    istem = 81.9
    sh.hdim(v2, istem, a0, BL, cy + 2.4, BL + 9, M(a0 - istem), lab="below", side="left", ext=(True, False),
            probes=(pmax('x', istem, cy), pmin('x', a0, cy)))
    top = g['ink'][1] if not g['dot_r'] else cy - g['arc_outer']
    capb = g['cap_bottom']; capx = g['capR'][0]
    xc = 150
    sh.vdim(v2, top, XH, cx + 4, 0, xc, M(XH - top) + "  overshoot", ext=(True, False), probes=(pmin('y', top, cx), pmin('y', XH, 74.8)))
    sh.vdim(v2, top, cy, cx + 4, 0, xc, M(cy - top) + "  R outer", ext=(False, False), probes=(None, None))
    sh.vdim(v2, cy, capb, 0, capx + 1.8, xc, M(capb - cy), ext=(False, True), probes=(None, pmax('y', capb, capx)))
    sh.vdim(v2, capb, BL, 0, 0, xc, M(BL - capb) + "  to baseline", ext=(False, False), probes=(None, pmax('y', BL, 74.8)))
    S3 = 8.0
    section(sh, g, det, 1340, v2.Y(cy) - S3 * cy, S3, M, name + "_sec", top - 3, cy + g['ring_outer'] + 3)
    return sh, v, ink
