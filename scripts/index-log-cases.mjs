import {readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args=new Map();
for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const source=args.get('--source');
const output=args.get('--output')||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../content/case-register.json');
if(!source)throw new Error('Usage: node scripts/index-log-cases.mjs --source <folder> --output <json>');
const entries=(await readdir(source,{withFileTypes:true})).filter(item=>item.isDirectory()).map(item=>item.name);
const definitions=[
  {id:'case:display-black',pattern:/黑屏|绿屏|白屏|双黑屏|屏重启|卡死/i,symptom:'显示黑屏、异常颜色、卡死或重启',knowledgeIds:['chain:display-output','chain:stability'],skillIds:['t12t-display-black-freeze','t12t-stability-crash-reset']},
  {id:'case:avm-no-video',pattern:/AVM|倒车影像|DVR|环视|摄像/i,symptom:'Camera、AVM 或倒车影像无画面',knowledgeIds:['chain:avm-video-flow'],skillIds:['t12t-avm-camera-stream']},
  {id:'case:network-offline',pattern:/断联|无网络|网络|以太网/i,symptom:'车辆网络断联或服务离线',knowledgeIds:['chain:ethernet-connectivity','chain:tbox-connectivity'],skillIds:['t12t-ethernet-sgmii','t12t-cross-domain-msg']},
  {id:'case:performance-freeze',pattern:/卡顿|卡死|响应慢/i,symptom:'系统或界面卡顿、卡死',knowledgeIds:['chain:performance-diagnosis','chain:hmi-runtime'],skillIds:['t12t-performance-jank']},
  {id:'case:audio-no-output',pattern:/无声|不播报|音频|声音/i,symptom:'音频无声或播报异常',knowledgeIds:['chain:audio-paths','chain:audio-policy-routing'],skillIds:['t12t-audio-path']}
];
const cases=definitions.map(item=>{
  const matched=entries.filter(name=>item.pattern.test(name)).length;
  return{id:item.id,symptom:item.symptom,scope:{indexedDirectoryCount:matched},clocks:{state:'needs_review'},bootGeneration:{state:'needs_review'},
    knowledgeIds:item.knowledgeIds,skillIds:item.skillIds,evidenceState:'indexed',
    publicSummary:`本地案件目录中索引到 ${matched} 个可能相关目录；尚未逐案完成版本确认、跨域时间对齐和证据核验，不构成根因结论。`};
});
const result={version:1,privacy:'仅发布按症状聚合的数量和证据状态，不发布目录名、VIN、人员、地点或原始日志。',summary:{indexedTopLevelDirectories:entries.length},cases};
await writeFile(output,JSON.stringify(result,null,2)+'\n','utf8');
console.log(`Case register generated: ${entries.length} top-level directories, ${cases.length} sanitized symptom groups.`);
