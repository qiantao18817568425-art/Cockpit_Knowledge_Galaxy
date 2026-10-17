import argparse, datetime, json, re, sqlite3
from pathlib import Path

KNOWLEDGE_BY_CATEGORY = {
  'platform':['domain:platform','domain:cross-domain'], 'virtualization':['domain:virtualization','domain:cross-domain'],
  'android':['domain:android'], 'yocto':['domain:yocto'], 'mcu':['domain:mcu','domain:power'],
  'tbox':['domain:tbox','domain:connectivity'], 'display':['domain:display','domain:hmi'],
  'camera':['domain:camera'], 'audio':['domain:audio'], 'power':['domain:power'],
  'boot':['domain:lifecycle'], 'stability':['domain:assurance','domain:performance'],
  'diagnosis':['domain:diagnosis','domain:assurance'], 'usb':['domain:usb-storage'], 'security':['domain:security']
}

def version_of(name):
  found=re.search(r'(?i)(?:^|[_\s-])(V\d+(?:\.\d+){0,2}|R\d+(?:\.\d+)*)',name)
  return found.group(1).upper() if found else 'unspecified'

def main():
  parser=argparse.ArgumentParser()
  parser.add_argument('--db',required=True); parser.add_argument('--catalog',required=True); parser.add_argument('--output',required=True)
  args=parser.parse_args()
  catalog=json.loads(Path(args.catalog).read_text(encoding='utf-8'))
  db=sqlite3.connect(f'file:{Path(args.db).as_posix()}?mode=ro',uri=True); db.row_factory=sqlite3.Row
  indexed={r['sha256']:r for r in db.execute('select sha256,indexed_pages,text_extraction,content_state,publication_state from documents')}
  documents=[]
  for item in catalog['documents']:
    row=indexed.get(item['sha256']); fmt=item['format'].lower()
    if fmt in {'zip','rar','7z','tar','gz'}: state='container_indexed'
    elif row and (row['indexed_pages'] or 0)>0: state='indexed'
    elif fmt in {'png','jpg','jpeg','bmp','gif','webp'}: state='needs_visual_review'
    else: state='metadata_only'
    documents.append({
      'id':item['id'],'sha256':item['sha256'],'name':item['name'],'format':item['format'],
      'category':item['category'],'platform':item.get('platform') or 'unspecified','version':version_of(item['name']),
      'downloadUrl':item.get('downloadUrl',''),'indexedPages':int(row['indexed_pages'] or 0) if row else 0,
      'processingState':state,'knowledgeIds':KNOWLEDGE_BY_CATEGORY.get(item['category'],[]),
      'reviewNote':('可检索文本已建立索引；技术结论仍按具体版本和页码核验。' if state=='indexed' else
                    '容器内可读成员已单独登记。' if state=='container_indexed' else
                    '未生成可检索正文，需视觉核对。' if state=='needs_visual_review' else '仅保留元数据，待补充内容核验。')
    })
  archive=[]
  for row in db.execute('select archive,member,extension,extracted_sha256,pages_or_sections,searchable_sections,status from archive_documents order by archive,member'):
    archive.append({'containerName':Path(row['archive']).name,'memberName':row['member'],'format':(row['extension'] or '').lstrip('.').upper(),
      'sha256':row['extracted_sha256'],'pagesOrSections':row['pages_or_sections'] or 0,'searchableSections':row['searchable_sections'] or 0,
      'processingState':'indexed' if (row['searchable_sections'] or 0)>0 else 'needs_visual_review','reviewNote':row['status'] or ''})
  states={};
  for item in documents: states[item['processingState']]=states.get(item['processingState'],0)+1
  out={'generatedOn':datetime.date.today().isoformat(),'documents':documents,'archiveDocuments':archive,
       'summary':{'publicDocuments':len(documents),'archiveDocuments':len(archive),'processingStates':states,
                  'mappedDocuments':sum(bool(x['knowledgeIds']) for x in documents)}}
  target=Path(args.output); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(json.dumps(out['summary'],ensure_ascii=False))
  db.close()
if __name__=='__main__': main()

