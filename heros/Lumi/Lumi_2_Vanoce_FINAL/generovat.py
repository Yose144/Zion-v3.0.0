from pathlib import Path
import json,math,shutil,xml.etree.ElementTree as ET
import cv2,numpy as np
from shapely.geometry import Polygon,LineString,box
from shapely.affinity import translate
from shapely.ops import unary_union,nearest_points
import ezdxf,cairosvg
O=Path(__file__).resolve().parent;O.mkdir(exist_ok=True);(O/'Jednotlive_steny').mkdir(exist_ok=True)
def parse(d):
 rings=[[tuple(map(float,v.split(','))) for v in s.replace('Z','').replace('L',' ').split()] for s in d.split('M')[1:]]
 return Polygon(rings[0],rings[1:])
old=[parse(e.attrib['d']) for e in ET.parse(O/'zdroje/original_Lumi_2_A3.svg').getroot()[0]]
outer=translate(Polygon(old[0].exterior),-10,-14);W=outer.bounds[2]
frame=outer.difference(box(4,7,W-4,119))
src=O/'Schvalena_vytvarna_predloha.png'
im=cv2.imread(str(src));mask=(im[:,:,0]<180).astype(np.uint8)*255
# Crop body only, excluding approximate AI tabs. Exact original tabs come from the source vector.
bounds=[(20,351),(378,710),(739,1073),(1102,1435),(1464,1798),(1826,2156)]
names=['01_Stromecek','02_Betlem','03_Zvonky','04_Andel','05_Vanocni_svicka','06_Ozdoby']
labels=['Stromeček','Betlém','Zvonky','Anděl','Vánoční svíčka','Ozdoby']
scenes=[];reports=[]
def components(p):return [p] if p.geom_type=='Polygon' else [g for g in p.geoms if g.geom_type=='Polygon']
for name,(x0,x1) in zip(names,bounds):
 crop=mask[54:674,x0:x1]
 contours,hierarchy=cv2.findContours(crop,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
 h=hierarchy[0]
 def depth(i):
  d=0
  while h[i][3]>=0:d+=1;i=h[i][3]
  return d
 def points(c):return [(float(v[0][0])*W/(x1-x0-1),3+float(v[0][1])*120/619) for v in c]
 polys=[]
 for i,c in enumerate(contours):
  if depth(i)%2 or len(c)<3:continue
  holes=[points(contours[j]) for j in range(len(contours)) if h[j][3]==i and len(contours[j])>=3]
  p=Polygon(points(c),holes).buffer(0)
  if p.area>.3:polys.append(p)
 p=unary_union(polys).buffer(.10,quad_segs=4).buffer(-.035,quad_segs=4).simplify(.04,preserve_topology=True)
 p=unary_union([p,frame]).intersection(outer).buffer(0)
 # Join genuine isolated wood islands using short material bridges, never invisible floating details.
 bridges=[]
 for attempt in range(100):
  cs=sorted(components(p),key=lambda q:q.area,reverse=True)
  if len(cs)==1:break
  a,b=nearest_points(cs[0],unary_union(cs[1:]));bridge=LineString([a,b]).buffer(.85,quad_segs=8)
  bridges.append({'from':list(a.coords)[0],'to':list(b.coords)[0],'width_mm':1.7,'kind':'island'})
  p=unary_union([p,bridge]).intersection(outer).buffer(0)
 assert p.geom_type=='Polygon'
 # Check and reinforce necks which would separate under 0.3 mm kerf.
 for attempt in range(100):
  er=p.buffer(-.15)
  cs=sorted(components(er),key=lambda q:q.area,reverse=True)
  if len(cs)==1:break
  a,b=nearest_points(cs[0],unary_union(cs[1:]));bridge=LineString([a,b]).buffer(.85,quad_segs=8)
  bridges.append({'from':list(a.coords)[0],'to':list(b.coords)[0],'width_mm':1.7,'kind':'kerf'})
  p=unary_union([p,bridge]).intersection(outer).buffer(0)
 assert p.buffer(-.15).geom_type=='Polygon'
 # Remove sub-millimetre holes; keep useful expressive facial and ornament detail.
 p=Polygon(outer.exterior,[r for r in p.interiors if Polygon(r).area>=.65])
 assert p.is_valid and p.buffer(-.15).geom_type=='Polygon'
 scenes.append(p);reports.append({'motif':name,'bridge_count':len(bridges),'bridges':bridges,'cutouts':len(p.interiors),'connected_after_0_3mm_kerf':True})
 print(name,len(bridges),len(p.interiors))
def path(p):return ' '.join('M'+' L'.join(f'{x:.4f},{y:.4f}' for x,y in r.coords)+' Z' for r in [p.exterior,*p.interiors])
def export(ps,w,h,stem):
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" viewBox="0 0 {w} {h}"><g id="CUT" fill="none" stroke="#ff0000" stroke-width="0.08">'+''.join(f'<path d="{path(p)}"/>' for p in ps)+'</g></svg>'
 stem.with_suffix('.svg').write_text(svg)
 doc=ezdxf.new('R2010');doc.units=4;doc.layers.new('CUT',dxfattribs={'color':1})
 for e in ET.fromstring(svg)[0]:
  p=parse(e.attrib['d']);assert p.is_valid
  for r in [p.exterior,*p.interiors]:doc.modelspace().add_lwpolyline([(x,h-y) for x,y in list(r.coords)[:-1]],close=True,dxfattribs={'layer':'CUT'})
 doc.saveas(stem.with_suffix('.dxf'))
for name,p in zip(names,scenes):export([translate(p,2,2)],68,130,O/'Jednotlive_steny'/name)
parts=[translate(p,10+(i%3)*69,14+(i//3)*136) for i,p in enumerate(scenes)]+old[6:]
export(parts,420,297,O/'Lumi_2_A3_1ku1')
def preview(ps,w,h,target,labels=None):
 s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w*5}px" height="{h*5}px" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="#faf6ed"/>'
 s+=''.join(f'<path d="{path(p)}" fill="#ba8c50" fill-rule="evenodd"/>' for p in ps)
 if labels:
  for i,t in enumerate(labels):s+=f'<text x="{8+i*72+W/2}" y="143" text-anchor="middle" font-family="sans-serif" font-size="4" fill="#483d2d">{t}</text>'
 s+='</svg>';cairosvg.svg2png(bytestring=s.encode(),write_to=str(target))
preview([translate(p,8+i*72,6) for i,p in enumerate(scenes)],444,150,O/'Vsech_6_sten.png',labels)
preview(parts,420,297,O/'Rozklad_A3.png')
for name,p in zip(names,scenes):preview([translate(p,2,2)],68,130,O/'Jednotlive_steny'/f'{name}.png')


(O/'Kontrola_spoju.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
(O/'Motivy.json').write_text(json.dumps(dict(zip(names,labels)),ensure_ascii=False,indent=2))
