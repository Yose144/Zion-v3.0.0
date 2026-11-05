#!/usr/bin/env python3
"""Apply only audited lampion images to explicitly mapped public roots."""
import argparse,hashlib,json,shutil,sys,datetime
from pathlib import Path
BASE=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description='Lampion v6: by default only inspect, no writes.')
 ap.add_argument('--root',action='append',default=[],metavar='DOMAIN=/ABS/PUBLIC',help='Repeat for each domain; point to public asset root, not repository root.')
 ap.add_argument('--apply',action='store_true',help='Write verified replacements and backup original files.')
 args=ap.parse_args();roots={}
 for value in args.root:
  if '=' not in value:ap.error('--root must be DOMAIN=/ABS/PUBLIC')
  domain,path=value.split('=',1);root=Path(path).resolve()
  if not root.is_dir():ap.error(f'Public root does not exist: {root}')
  roots[domain]=root
 if not roots:ap.error('Specify at least one --root DOMAIN=/ABS/PUBLIC')
 manifest=json.loads((BASE/'replacement_manifest.json').read_text())
 plans=[];errors=[]
 for row in manifest['replacements']:
  domain=row['domain']
  if domain not in roots:continue
  root=roots[domain];dest=(root/row['target_public_path']).resolve();src=(BASE/row['package_file']).resolve()
  if not dest.is_relative_to(root) or not src.is_relative_to(BASE):raise ValueError('Path outside configured root')
  if not src.is_file() or sha(src)!=row['new_sha256']:errors.append(f'INVALID PACKAGE FILE: {src}');continue
  if not dest.is_file():errors.append(f'MISSING TARGET: {dest}');continue
  old=sha(dest)
  if old==row['new_sha256']:print(f'ALREADY V6: {dest}');continue
  if old!=row['old_sha256']:errors.append(f'CHANGED SINCE AUDIT: {dest}');continue
  plans.append((row,src,dest))
 for row,src,dest in plans:print(('APPLY' if args.apply else 'DRY RUN')+f': {row["old_url"]} -> {dest}')
 if errors:
  print('\n'.join(errors),file=sys.stderr);print('Nothing written. Resolve mismatches before trying again.',file=sys.stderr);return 2
 if not args.apply:print(f'{len(plans)} verified files. No changes written.');return 0
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 backup=BASE/'backups'/stamp
 for row,src,dest in plans:
  saved=backup/row['domain']/row['target_public_path'];saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(dest,saved)
  shutil.copy2(src,dest)
  assert sha(dest)==row['new_sha256']
 print(f'Updated {len(plans)} files. Backups: {backup}');return 0
if __name__=='__main__':sys.exit(main())
