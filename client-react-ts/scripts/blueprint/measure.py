import re, math
from svgpathtools import parse_path
import os
src = open(os.environ.get('BV_LOGO_TS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/components/BrandLogo/logoSvgs.ts'))).read()
def get(name):
    m = re.search(r'export const %s = "(.*?)";\n' % name, src)
    return m.group(1).replace('\\"', '"')
LOGO = {k: get(k) for k in ['LOGO_MARK','LOGO_MARK_SMALL','LOGO_WORDMARK','LOGO_WORDMARK_SMALL']}
def inner(svg): return re.sub(r'^<svg[^>]*>|</svg>$', '', svg)
def viewbox(svg): return [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
LETTERS_D = re.search(r'<path d="(M18 70.5[^"]+)"', LOGO['LOGO_WORDMARK']).group(1)
SUB = []
for p in re.findall(r'M[^M]+', LETTERS_D):
    xmin,xmax,ymin,ymax = map(float, parse_path(p).bbox())
    SUB.append(dict(d=p, bbox=[xmin,ymin,xmax,ymax]))
def glyph_of(x):
    for name,lo,hi in [('B',0,62),('i',62,84),('v',140,192),('e1',192,245),('r',245,287),('s',287,327),('e2',327,380),('e3',380,440)]:
        if lo<=x<hi: return name
GLY = {}
for s in SUB: GLY.setdefault(glyph_of((s['bbox'][0]+s['bbox'][2])/2), []).append(s)
def gbox(g):
    bs=[s['bbox'] for s in GLY[g]]
    return [min(b[0] for b in bs),min(b[1] for b in bs),max(b[2] for b in bs),max(b[3] for b in bs)]
def arc_ink_bbox(cx,cy,R,W,a0,a1,n=36000):
    xs=[];ys=[]
    for i in range(n+1):
        a=math.radians(a0+(a1-a0)*i/n); xs.append(cx+R*math.cos(a)); ys.append(cy-R*math.sin(a))
    h=W/2
    return [min(xs)-h,min(ys)-h,max(xs)+h,max(ys)+h]
def parse_dial(s, k=1.0, tx=0.0, ty=0.0):
    arcs = re.findall(r'<path d="M([\d.]+) ([\d.]+)A([\d.]+) [\d.]+ 0 (\d) 1 ([\d.]+) ([\d.]+)" fill="none" style="([^"]+)" stroke-width="([\d.]+)"', s)
    circles = re.findall(r'<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"([^>]*)>', s)
    liq = re.search(r'<path d="M([\d.]+) ([\d.]+)H([\d.]+)A([\d.]+)', s)
    ring = [c for c in circles if 'stroke-width' in c[3]][0]
    dot = [c for c in circles if 'stroke-width' not in c[3]]
    cx,cy = float(ring[0]),float(ring[1]); R=float(arcs[0][2]); W=float(arcs[0][7])
    track = any('logo-track' in a[6] for a in arcs)
    acc = [a for a in arcs if 'accent' in a[6]][0]
    ex,ey = float(acc[4]),float(acc[5])
    sx,sy = float(acc[0]),float(acc[1])
    a_start = math.degrees(math.atan2(-(sy-cy), sx-cx)) % 360        # 225
    a_end = math.degrees(math.atan2(-(ey-cy), ex-cx)) % 360           # 45 or 315
    span = (a_start - a_end) % 360 or 360                               # clockwise on screen
    ringw = float(re.search(r'stroke-width="([\d.]+)"', ring[3]).group(1))
    T=lambda x,y:(x*k+tx, y*k+ty)
    g=dict(); g['cx'],g['cy']=T(cx,cy); g['R']=R*k; g['W']=W*k
    g['ring_r']=float(ring[2])*k; g['ring_w']=ringw*k; g['liq_r']=float(liq.group(4))*k
    g['chord']=(float(liq.group(2))-cy)*k; g['dot_r']=float(dot[0][2])*k if dot else 0.0
    g['track']=track; g['a_start']=a_start; g['a_end']=a_end; g['acc_span']=span
    g['track_span']=270.0 if track else None
    cxx,cyy,RR,WW=g['cx'],g['cy'],g['R'],g['W']
    g['arc_outer']=RR+WW/2; g['arc_inner']=RR-WW/2
    g['ring_outer']=g['ring_r']+g['ring_w']/2; g['ring_inner']=g['ring_r']-g['ring_w']/2
    g['gap']=g['arc_inner']-g['ring_outer']
    full = 270.0
    ab = arc_ink_bbox(cxx,cyy,RR,WW,a_start,a_start-full)
    g['arcbox']=ab
    c=math.cos(math.radians(45))
    g['capL']=(cxx-RR*c, cyy+RR*c); g['capR']=(cxx+RR*c, cyy+RR*c)
    g['cap_bottom']=cyy+RR*c+WW/2
    ink=[ab[0],ab[1],ab[2],max(ab[3], cyy+g['ring_outer'])]
    if g['dot_r']:
        dx,dy=T(float(dot[0][0]),float(dot[0][1])); g['dot']=(dx,dy); r=g['dot_r']
        ink=[min(ink[0],dx-r),min(ink[1],dy-r),max(ink[2],dx+r),max(ink[3],dy+r)]
    g['ink']=ink; g['k']=k
    return g
MARK = parse_dial(inner(LOGO['LOGO_MARK']))
SMALL = parse_dial(inner(LOGO['LOGO_MARK_SMALL']))
DIAL = parse_dial(inner(LOGO['LOGO_WORDMARK']))
tr = re.search(r'translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)', LOGO['LOGO_WORDMARK_SMALL'])
SDIAL = parse_dial(inner(LOGO['LOGO_MARK_SMALL']), float(tr.group(3)), float(tr.group(1)), float(tr.group(2)))
def r3(v): return round(v,3) if isinstance(v,float) else ([r3(x) for x in v] if isinstance(v,(list,tuple)) else v)
if __name__=='__main__':
    for n,g in [('MARK',MARK),('SMALL',SMALL),('DIAL',DIAL),('SDIAL',SDIAL)]:
        print(n, {k:r3(v) for k,v in g.items()})
    for gname in GLY: print(gname, r3(gbox(gname)), len(GLY[gname]))
    print('vb', viewbox(LOGO['LOGO_WORDMARK']))

def enrich(g, s, k=1.0, tx=0.0, ty=0.0):
    """true arc centres/radii (SVG endpoint parameterisation) via svgpathtools"""
    for m_ in re.finditer(r'<path d="(M[\d.]+ [\d.]+A[^"]+)" fill="none" style="([^"]+)"', s):
        a = parse_path(m_.group(1))[0]
        key = 'track' if 'logo-track' in m_.group(2) else 'acc'
        g[key + '_c'] = (a.center.real * k + tx, a.center.imag * k + ty)
        g[key + '_R'] = a.radius.real * k; g[key + '_span'] = abs(a.delta)
    return g
enrich(MARK, inner(LOGO['LOGO_MARK']))
enrich(SMALL, inner(LOGO['LOGO_MARK_SMALL']))
enrich(DIAL, inner(LOGO['LOGO_WORDMARK']))
enrich(SDIAL, inner(LOGO['LOGO_MARK_SMALL']), float(tr.group(3)), float(tr.group(1)), float(tr.group(2)))
