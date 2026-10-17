export function referenceAction(url=''){
  let parsed;
  try{parsed=new URL(url,globalThis.location?.href||'https://example.invalid/')}catch{return{previewType:'none',canLoad:false,canDownload:false,externalUrl:''}}
  if(!['http:','https:'].includes(parsed.protocol))return{previewType:'none',canLoad:false,canDownload:false,externalUrl:''};
  const pdf=/\.pdf$/i.test(parsed.pathname)||parsed.pathname.includes('/raw-files/');
  return{previewType:pdf?'pdf':'article',canLoad:true,canDownload:pdf,externalUrl:parsed.href};
}

export function markdownDownloadSpec(title,content){
  const safe=String(title||'座舱知识').replace(/[\\/:*?"<>|：]+/g,'-').replace(/\s+/g,' ').trim().replace(/-+/g,'-');
  return{filename:`${safe||'座舱知识'}-专题总结.md`,type:'text/markdown;charset=utf-8',content:String(content||'')};
}

