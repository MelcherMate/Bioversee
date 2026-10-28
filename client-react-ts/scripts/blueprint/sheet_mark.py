import math
from lib import Sheet, View, C, f, num, FS, HAIR, AL
def pmin(axis, at, pos, w=1.2, h=0.8, mode=True):
    return ('min', axis, (at - w, pos - h, at + w, pos + h) if axis == 'x' else (pos - h, at - w, pos + h, at + w), mode)
def pmax(axis, at, pos, w=1.2, h=0.8, mode=True):
    return ('max', axis, (at - w, pos - h, at + w, pos + h) if axis == 'x' else (pos - h, at - w, pos + h, at + w), mode)
def P(cx, cy, r, a):
    return cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))
def angle_arc(sh, v, cx, cy, ra, a0, a1, label):
    X0, Y0 = v.X(P(cx, cy, ra, a0)[0]), v.Y(P(cx, cy, ra, a0)[1])
    X1, Y1 = v.X(P(cx, cy, ra, a1)[0]), v.Y(P(cx, cy, ra, a1)[1])
    sh.add('dims', '<path d="M%s %sA%s %s 0 0 0 %s %s" fill="none" stroke="%s" stroke-width="%s"/>' % (f(X0), f(Y0), f(ra * v.S), f(ra * v.S), f(X1), f(Y1), C['dim'], HAIR))
    for a, sgn in ((a0, -1), (a1, 1)):
        x, y = P(cx, cy, ra, a); r = math.radians(a)
        sh.arrow(v.X(x), v.Y(y), -math.sin(r) * sgn, -math.cos(r) * sgn)
    lx, ly = P(cx, cy, ra, (a0 + a1) / 2)
    sh.text(v.X(lx), v.Y(ly) + 5 + 0.74 * FS, label, "middle")
def ray(sh, v, cx, cy, r0, r1, a):
    (x0, y0), (x1, y1) = P(cx, cy, r0, a), P(cx, cy, r1, a)
    n = math.hypot(x1 - x0, y1 - y0)
    gx, gy = (x1 - x0) / n * 3 / v.S, (y1 - y0) / n * 3 / v.S
    sh.line('dims', v.X(x0 + gx), v.Y(y0 + gy), v.X(x1), v.Y(y1))

def build(g, inner, title, num_, m=4.0, fname="mark", dial_desc=""):
    S = 10.5
    sh = Sheet(1480, 960)
    v = View(sh, S, 330, 70, inner, name=fname)
    cx, cy, R, W = g['cx'], g['cy'], g['R'], g['W']
    ink = g['ink']
    M = lambda val: "%s · %sm" % (num(val), num(val / m, 3))
    sh.grid(v, 0, 0, 64, 64, m, 4)
    sh.cline(v, cx - 31, cy, cx + 31, cy)
    sh.cline(v, cx, cy - 31, cx, cy + g['ring_outer'] + 3)
    sh.ccircle(v, cx, cy, R); sh.ccircle(v, cx, cy, g['ring_r'])
    if abs(g['chord']) > 1e-6:
        hc = math.sqrt(g['liq_r'] ** 2 - g['chord'] ** 2)
        sh.cline(v, cx - hc - 2, cy + g['chord'], cx + hc + 2, cy + g['chord'], dash="4 3")
    sh.text(v.X(cx), v.Y(cy - 31) - 5, "A", "middle", FS, C['aux'])
    ra = R + 11
    ray(sh, v, cx, cy, g['arc_outer'], ra + 0.5, 225); ray(sh, v, cx, cy, g['arc_outer'], ra + 0.5, 315)
    angle_arc(sh, v, cx, cy, ra, 225, 315, "90° open · 225°–315°")
    
    
    if g['dot_r']:
        ray(sh, v, cx, cy, R + g['dot_r'], R + 8, g['a_end'])
        x, y = P(cx, cy, R + 8, g['a_end'])
        sh.text(v.X(x) + 6, v.Y(y) + 2, "%s° · dot Ø%s" % (num(g['a_end']), num(2 * g['dot_r'])), "start")
    capx = g['capL'][0]
    sh.vdim(v, ink[1], ink[3], cx - 2.4, capx - 2.0, -4, M(ink[3] - ink[1]), lab="left",
            probes=(pmin('y', ink[1], cx), pmax('y', ink[3], capx)))
    sh.vdim(v, 0, cy, 0, cx - 31, -18, M(cy), lab="left", probes=(None, None))
    x1, x2, yc = g['capL'][0] + W / 2, g['capR'][0] - W / 2, g['capL'][1]
    sh.hdim(v, x1, x2, yc + 1.6, yc + 1.6, g['cap_bottom'] + 7, M(x2 - x1), probes=(pmax('x', x1, yc), pmin('x', x2, yc)))
    sh.hdim(v, ink[0], ink[2], cy + 2.4, cy + 2.4, cy + ra + 7, M(ink[2] - ink[0]), lab="above",
            probes=(pmin('x', ink[0], cy), pmax('x', ink[2], cy)))
    sx = 1240
    vs = View(sh, S, sx - S * (cx - 1), 70, inner, clip=(cx - 1, cy - 31, 2, 31 + g['ring_outer'] + 3), name=fname + "_sec")
    sh.text(vs.X(cx), vs.Y(cy - 31) - 5, "A–A", "middle", FS, C['aux'])
    ao, ai, ro, ri, ch = g['arc_outer'], g['arc_inner'], g['ring_outer'], g['ring_inner'], g['chord']
    acx, acy = g['acc_c']; aR = g['acc_R']
    top_o = acy - math.sqrt((aR + W / 2) ** 2 - (cx - acx) ** 2)
    top_i = acy - math.sqrt((aR - W / 2) ** 2 - (cx - acx) ** 2)
    E = [top_o, top_i, cy - ro, cy - ri, cy + ch, cy + ri, cy + ro]
    PR = [pmin('y', E[0], cx, 1.0, 0.4, 'acc'), pmax('y', E[1], cx, 1.0, 0.4, 'acc'), pmin('y', E[2], cx, 1.0, 0.4), pmax('y', E[3], cx, 1.0, 0.4),
          pmin('y', E[4], cx, 1.0, 0.4), pmax('y', E[5], cx, 1.0, 0.4, 'acc'), pmax('y', E[6], cx, 1.0, 0.4)]
    names = ["arc stroke", "gap", "ring", "", "liquid", "ring"]
    xr = cx + 1 + 3
    for i in range(6):
        lab = M(E[i + 1] - E[i]) + ("  " + names[i] if names[i] else "")
        sh.vdim(vs, E[i], E[i + 1], cx + 1, cx + 1, xr, lab, probes=(PR[i], PR[i + 1]))
    xo = cx - 1 - 5
    olab = ["R%s" % num(cy - E[0]), "R%s" % num(cy - E[1]), "R%s" % num(ro), "R%s" % num(ri), None, "R%s" % num(ri), "R%s" % num(ro)]
    for i, y in enumerate(E):
        if i != 4: sh.ordinate(vs, y, cx - 1, xo, olab[i], probe=PR[i])
    if abs(ch) > 1e-6:
        sh.ordinate(vs, cy, cx - 1, xo, "0 centre", probe=None)
        sh.ordinate(vs, cy + ch, cx - 1, xo, "+%s chord" % num(ch), probe=PR[4])
    else:
        sh.ordinate(vs, cy, cx - 1, xo, "0 centre = chord", probe=PR[4])
    off = math.hypot(acx - cx, acy - cy)
    if off > 0.01:
        sh.text(24, sh.H - 58, "! accent arc centre is off the ring centre by (+%s, +%s) px: rounded end points shorten the chord, so the arc spans %s° not 180°. Section shows the visible (accent) edge." % (num(acx - cx), num(acy - cy), num(g['acc_span'])), "start", FS, C['muted'])
    sh.titleblock("BIOVERSEE  ·  %s  %s" % (num_, title),
                  "px @ 64 px artboard  ·  m = %s px  ·  %s  ·  scale %s:1" % (num(m), dial_desc, num(S)))
    return sh, v
