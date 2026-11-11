from pathlib import Path
import xml.etree.ElementTree as ET
import re,math,json
from shapely.geometry import Polygon,box,Point
from shapely.affinity import translate,rotate
import ezdxf
import sys
O=Path(sys.argv[1])
REPORT=O
root=ET.parse(O/'Lumi_2_A3_1ku1.svg').getroot()
assert root.attrib['width']=='420mm' and root.attrib['height']=='297mm' and root.attrib['viewBox']=='0 0 420 297'
polys=[];allrings=[]
for el in root[0]:
 rings=[]
 for seg in el.attrib['d'].split('M')[1:]:
  rings.append([tuple(map(float,v.split(','))) for v in seg.replace('Z','').replace('L',' ').split()])
 p=Polygon(rings[0],rings[1:]);assert p.is_valid and p.geom_type=='Polygon';polys.append(p);allrings+=rings
assert len(polys)==9 # eight lantern parts + test strip
for p in polys:assert box(5,5,415,292).contains(p)
spacing=min(a.distance(b) for i,a in enumerate(polys) for b in polys[:i]);assert spacing>2
W=65-3/math.sqrt(3);ap=65*math.sqrt(3)/2
panels=[]
for i in range(6):
 p=translate(polys[i],-10-(i%3)*69,-14-(i//3)*136);panels.append(p)
 assert abs(p.bounds[2]-W)<.0001 and p.bounds[3]==126
 assert p.buffer(-.15).geom_type=='Polygon'
# Same outer contour and tabs for all six panels.
for p in panels:assert Polygon(p.exterior).hausdorff_distance(Polygon(panels[0].exterior))<.0001
top=translate(polys[6],-302,-76);bottom=translate(polys[7],-302,-218)
assert Polygon(top.exterior).hausdorff_distance(Polygon(bottom.exterior))<.0001
slot_top=[Polygon(r) for r in top.interiors if abs(Polygon(r).area-8.1*3.1)<.002]
slot_bottom=[Polygon(r) for r in bottom.interiors if abs(Polygon(r).area-8.1*3.1)<.002]
assert len(slot_top)==len(slot_bottom)==12
maxerr=0;clearances=[];walls=[]
for deg in range(30,390,60):
 wall=rotate(box(-W/2,ap-1.5,W/2,ap+1.5),deg-90,origin=(0,0));walls.append(wall)
 for c in [-14.5,14.5]:
  tab=rotate(box(c-4,ap-1.5,c+4,ap+1.5),deg-90,origin=(0,0))
  for group in [slot_top,slot_bottom]:
   slot=min(group,key=lambda s:s.centroid.distance(tab.centroid))
   maxerr=max(maxerr,slot.centroid.distance(tab.centroid))
   assert slot.contains(tab)
   clearances.append(slot.boundary.distance(tab.boundary))
assert maxerr<.0001
# The six 3 mm wall volumes have no mutual overlap in plan.
maxoverlap=max(a.intersection(b).area for i,a in enumerate(walls) for b in walls[:i]);assert maxoverlap<1e-8
# Central hole radius from exported coordinates, not from generator settings.
hole=max((Polygon(r) for r in top.interiors),key=lambda p:p.area)
assert max(abs(math.hypot(x,y)-45) for x,y in hole.exterior.coords)<.0001
assert len(top.interiors)>30 # 12 slots, central hole and botanical cutouts
assert top.buffer(-.15).geom_type=='Polygon'
# Independently read DXF and compare every exported contour.
doc=ezdxf.readfile(O/'Lumi_2_A3_1ku1.dxf');assert doc.units==4
entities=[e for e in doc.modelspace().query('LWPOLYLINE') if e.dxf.layer=='CUT'];assert len(entities)==len(allrings)
maxdelta=0
for entity,ring in zip(entities,allrings):
 assert entity.closed and entity.dxf.layer=='CUT'
 points=[(v[0],297-v[1]) for v in entity.get_points()]
 assert len(points)==len(ring)-1
 maxdelta=max(maxdelta,max(math.dist(a,b) for a,b in zip(points,ring)))
assert maxdelta<.00008
result={'A3_mm':[420,297],'lantern_parts':8,'extra_test_strip':1,'all_six_walls_identical_outer_shape':True,'wall_mm':[round(W,5),120],'including_tabs_height_mm':126,'tab_centres_spacing_mm':29,'slot_mm':[8.1,3.1],'tab_mm':[8,3],'matched_tab_slot_pairs':24,'max_centre_mismatch_mm':maxerr,'minimum_nominal_clearance_per_side_mm':min(clearances),'maximum_wall_overlap_area_mm2':maxoverlap,'minimum_sheet_part_spacing_mm':spacing,'top_hole_mm':90,'top_decoration_cutouts':len(top.interiors)-13,'svg_dxf_max_coordinate_delta_mm':maxdelta,'kerf_compensated':False,'physical_cut_test':False}
(REPORT/'Overeni_rozmeru.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))


assert len(root)==1 and root[0].attrib["id"]=="CUT"
assert all(e.dxf.layer=="CUT" for e in doc.modelspace())
print("Only cut contours; no engraving operations.")
