from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import hashlib,json,zipfile
p=Path(__file__).resolve().parent
master=p/'ZION_33_FAVICON_KANON_MASTER.png'
im=Image.open(master).convert('RGBA')
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
# Padding only if necessary; the approved master itself stays untouched.
side=max(im.size);square=Image.new('RGBA',(side,side));square.alpha_composite(im,((side-im.width)//2,(side-im.height)//2))
e=p/'exports';e.mkdir(exist_ok=True)
for n in [16,24,32,48,64,128,180,192,200,256,512,1024]:
 square.resize((n,n),Image.Resampling.LANCZOS).save(e/f'zion-33-{n}.png',optimize=True)
square.save(e/'favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
for src,dst in [('zion-33-180.png','apple-touch-icon.png'),('zion-33-192.png','icon-192.png'),('zion-33-512.png','icon-512.png'),('zion-33-200.png','coingecko-200.png')]:
 (e/dst).write_bytes((e/src).read_bytes())
(e/'site.webmanifest').write_text(json.dumps({'name':'ZION TerraNova','short_name':'ZION','icons':[{'src':'/icon-192.png','sizes':'192x192','type':'image/png'},{'src':'/icon-512.png','sizes':'512x512','type':'image/png'}],'background_color':'#101C2B','theme_color':'#101C2B','display':'standalone'},indent=2))
sheet=Image.new('RGB',(1400,820),'#101C2B');d=ImageDraw.Draw(sheet)
d.text((30,20),'ZION 3.3 / APPROVED FAVICON MASTER / v1',fill='#F0E1BE')
a=square.resize((610,610),Image.Resampling.LANCZOS);sheet.paste(a,(15,105),a)
for y,bg,fg in [(80,'#101C2B','#F0E1BE'),(450,'#F0E1BE','#101C2B')]:
 d.rectangle((650,y,1380,y+330),fill=bg)
 x=675
 for n in [16,24,32,48,64,128,200]:
  a=square.resize((n,n),Image.Resampling.LANCZOS);sheet.paste(a,(x,y+50),a)
  d.text((x,y+275),str(n),fill=fg);x+=n+23
sheet.save(p/'KONTROLA_VELIKOSTI.png',optimize=True)
checks=[]
for f in e.glob('*.png'):
 a=Image.open(f);assert a.width==a.height and a.mode=='RGBA';checks.append(f'{f.name}: {a.width}x{a.height}, RGBA')
assert Image.open(e/'favicon.ico').ico.sizes()=={(n,n) for n in [16,32,48,64,128,256]}
assert im.getextrema()[3]==(0,255)
manifest={'version':'1.0','status':'user_approved_favicon_canon','approved_date':'2026-11-17','scope':'ZION 3.3 favicon / square listing emblem; no change to horizontal glyph','master':master.name,'master_sha256':sha(master),'master_size':list(im.size),'source_library_file_id':'libfile_b866fcb0a29c81918212ce716cf356a9','engine_b_comparison':'separate unapproved study; excluded','files':{str(f.relative_to(p)):sha(f) for f in sorted(e.iterdir()) if f.is_file()}}
(p/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(p/'OVERENI.md').write_text('# Ověření\n\nMaster zachován bajtově; SHA-256 v manifestu. Průhlednost alfa 0–255. Všechny PNG čtvercové bez natahování. ICO obsahuje 16/32/48/64/128/256 px.\n\n'+'\n'.join('- '+c for c in checks)+'\n\nZmenšení není nové překreslení. V 16 px nejsou rozeznatelné jednotlivé listy a kořínky; jde o omezení detailního emblému. Ověřit po nasazení při 100% zobrazení.\n')
zip_path=p.parent/(p.name+'.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted(p.rglob('*')):
  if f.is_file():z.write(f,str(f.relative_to(p.parent)))
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None
print(json.dumps({'zip':str(zip_path),'master_sha256':sha(master),'files':len(list(p.rglob('*'))),'zip_bytes':zip_path.stat().st_size}))
