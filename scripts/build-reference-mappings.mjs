import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async relative=>JSON.parse(await readFile(path.join(root,relative),'utf8'));
const writeJson=(relative,value)=>writeFile(path.join(root,relative),JSON.stringify(value,null,2)+'\n','utf8');

const dayTargets={
  1:['chain:system-overview'],2:['chain:ee-boundaries'],3:['chain:system-overview','chain:mcu-soc-responsibility'],
  4:['chain:mtk-compute-resources','chain:mcu-soc-responsibility'],5:['chain:hmi-runtime','chain:display-output'],
  6:['chain:runtime-boundaries','chain:android-app-framework'],7:['chain:power-lifecycle','chain:boot-lifecycle'],
  8:['chain:power-lifecycle'],9:['chain:vehicle-bus','chain:ethernet-connectivity'],10:['chain:soa-service-contract'],
  11:['chain:mcu-soc-responsibility','chain:soa-service-contract'],12:['chain:someip-service'],
  13:['chain:someip-service','chain:soa-discovery-subscription'],14:['chain:soa-service-contract'],
  15:['chain:soa-service-contract'],16:['chain:soa-service-contract','chain:tee-security'],
  17:['chain:android-internal-ipc'],18:['chain:cross-domain-transport'],19:['chain:virtio-data','chain:runtime-boundaries'],
  20:['chain:clock-sources'],21:['chain:cross-domain-time'],22:['chain:android-app-framework','chain:hmi-runtime'],
  23:['chain:hmi-runtime'],24:['chain:display-output'],25:['chain:display-output'],26:['chain:vehicle-service-framework'],
  27:['chain:stability','chain:android-app-framework'],28:['chain:avm-video-flow','chain:mtk-peripheral-map'],
  29:['chain:avm-video-flow','chain:virtio-data','chain:resource-budget'],30:['chain:avm-video-flow'],
  31:['chain:cabin-perception'],32:['chain:avm-video-flow','chain:evidence-ledger'],
  33:['chain:avm-video-flow','chain:evidence-ledger'],34:['chain:audio-policy-routing'],
  35:['chain:audio-paths'],36:['chain:audio-policy-routing','chain:audio-paths'],
  37:['chain:audio-policy-routing','chain:audio-paths'],38:['chain:str-display-recovery','chain:power-lifecycle'],
  39:['chain:str-display-recovery','chain:power-lifecycle','chain:cross-domain-transport'],
  40:['chain:display-output','chain:evidence-ledger'],41:['chain:stability','chain:runtime-boundaries'],
  42:['chain:stability','chain:runtime-boundaries'],43:['chain:someip-service','chain:soa-discovery-subscription'],
  44:['chain:ethernet-connectivity','chain:someip-service','chain:evidence-ledger']
};

const reviewTargets={
  'course:week-11-saturday':['chain:audio-paths','chain:audio-policy-routing'],
  'course:week-11-sunday':['chain:audio-paths','chain:evidence-ledger'],
  'course:week-12-friday':['chain:audio-paths','chain:cross-domain-transport'],
  'course:week-12-sunday':['chain:evidence-ledger','chain:stability'],
  'course:week-13-friday':['chain:display-output','chain:runtime-boundaries'],
  'course:week-13-saturday':['chain:display-output','chain:evidence-ledger'],
  'course:week-13-sunday':['chain:evidence-ledger','chain:stability'],
  'course:week-14-friday':['chain:runtime-boundaries','chain:someip-service','chain:stability'],
  'course:week-14-saturday':['chain:someip-service','chain:evidence-ledger'],
  'course:week-entry-1':['chain:system-overview','chain:evidence-ledger'],
  'course:week-entry-2':['chain:ee-boundaries','chain:evidence-ledger'],
  'course:week-entry-3':['chain:ee-boundaries','chain:evidence-ledger'],
  'course:week-entry-4':['chain:mtk-compute-resources','chain:evidence-ledger'],
  'course:week-entry-5':['chain:mtk-compute-resources','chain:evidence-ledger'],
  'course:week-entry-6':['chain:hmi-runtime','chain:evidence-ledger'],
  'course:week-entry-7':['chain:power-lifecycle','chain:evidence-ledger'],
  'course:week-entry-8':['chain:power-lifecycle','chain:evidence-ledger'],
  'course:week-entry-9':['chain:power-lifecycle','chain:evidence-ledger'],
  'course:week-entry-10':['chain:vehicle-bus','chain:evidence-ledger'],
  'course:week-entry-11':['chain:vehicle-bus','chain:evidence-ledger'],
  'course:week-entry-12':['chain:vehicle-bus','chain:evidence-ledger'],
  'course:week-entry-13':['chain:soa-service-contract','chain:evidence-ledger'],
  'course:week-entry-14':['chain:soa-service-contract','chain:evidence-ledger'],
  'course:week-entry-15':['chain:soa-service-contract','chain:evidence-ledger'],
  'course:week-entry-16':['chain:runtime-boundaries','chain:evidence-ledger']
};

const graph=await readJson('docs/graph.json');
const known=new Set(graph.nodes.map(node=>node.id));
const learningNodes=graph.nodes.filter(node=>['lesson','review'].includes(node.kind));
const learningItems=learningNodes.map(node=>{
  const day=Number(node.id.match(/^course:day-(\d+)$/)?.[1]);
  const knowledgeIds=Number.isInteger(day)&&day>0?dayTargets[day]:reviewTargets[node.id];
  if(!knowledgeIds?.length)throw new Error(`Missing explicit learning mapping: ${node.id}`);
  for(const id of knowledgeIds)if(!known.has(id))throw new Error(`Unknown learning target: ${node.id} -> ${id}`);
  return{id:node.id,knowledgeIds,basis:'依据课程标题、课程正文主题和端到端技术链进行显式映射；课程发布状态不代表已经掌握。'};
}).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
await writeJson('content/learning-mapping.json',{version:1,items:learningItems});

const skillTargets={
  't12t-cockpit-diagnosis':['chain:evidence-ledger','chain:system-overview'],
  't12t-log-analysis':['chain:evidence-ledger','chain:cross-domain-time'],
  't12t-platform-architecture':['chain:system-overview','chain:runtime-boundaries'],
  't12t-display-black-freeze':['chain:display-output','chain:str-display-recovery'],
  't12t-touch-input':['chain:touch-input'],
  't12t-avm-camera-stream':['chain:avm-video-flow'],
  't12t-power-sleep-str':['chain:power-lifecycle','chain:str-display-recovery'],
  't12t-audio-path':['chain:audio-paths','chain:audio-policy-routing'],
  't12t-stability-crash-reset':['chain:stability'],
  't12t-performance-jank':['chain:performance-diagnosis','chain:resource-budget'],
  't12t-ethernet-sgmii':['chain:ethernet-connectivity'],
  't12t-wireless-phone-link':['chain:wireless-phone-link'],
  't12t-cross-domain-msg':['chain:cross-domain-transport','chain:someip-service'],
  't12t-boot-hmi':['chain:boot-lifecycle','chain:str-display-recovery'],
  't12t-log-storm':['chain:log-retention'],
  't12t-usb-typec-storage':['chain:usb-storage'],
  't12t-virtualization-tee':['chain:runtime-boundaries','chain:tee-security'],
  't12t-db-ke-forensics':['chain:db-ke-forensics'],
  't12t-mcu':['chain:mcu-soc-responsibility','chain:mcu-soc-control'],
  't12t-tpm-triage':['chain:evidence-ledger'],
  't12t-tpm-5y8d':['chain:evidence-ledger','chain:stability']
};
await writeJson('content/skill-mapping.json',{version:1,skills:Object.entries(skillTargets).map(([id,knowledgeIds])=>({id,knowledgeIds}))});

const categoryTargets={
  platform:'chain:platform-family',virtualization:'chain:runtime-boundaries',android:'chain:android-app-framework',
  yocto:'chain:hal-driver-boundary',mcu:'chain:mcu-soc-responsibility',tbox:'chain:tbox-connectivity',
  display:'chain:display-output',camera:'chain:avm-video-flow',audio:'chain:audio-paths',power:'chain:power-lifecycle',
  boot:'chain:boot-lifecycle',stability:'chain:stability',diagnosis:'chain:evidence-ledger',usb:'chain:usb-storage',security:'chain:tee-security'
};
function sourceTargets(source){
  const name=source.name||'';const targets=[];
  const add=id=>{if(known.has(id)&&!targets.includes(id))targets.push(id)};
  add(categoryTargets[source.category]||'chain:evidence-ledger');
  for(const [pattern,id] of [
    [/DDR|memory|内存/i,'chain:mtk-compute-resources'],[/GPS|GNSS|RTC|time/i,'chain:clock-sources'],
    [/Camera|AVM|ISP|CSI|SENINF|摄像|环视/i,'chain:avm-video-flow'],[/audio|codec|DSP|ALSA|音频|功放/i,'chain:audio-paths'],
    [/ethernet|SGMII|PHY|MDIO|以太网/i,'chain:ethernet-connectivity'],[/SOME.?IP/i,'chain:someip-service'],
    [/power|suspend|resume|STR|IPO|电源|休眠|唤醒/i,'chain:power-lifecycle'],[/boot|启动|升级|OTA/i,'chain:boot-lifecycle'],
    [/TEE|RPMB|security|安全/i,'chain:tee-security'],[/USB|Type.?C|UFS|storage|存储/i,'chain:usb-storage'],
    [/display|HMI|Surface|DRM|显示/i,'chain:display-output'],[/Binder|Framework|CarService|VHAL/i,'chain:android-app-framework'],
    [/CAN|CANFD|LIN/i,'chain:vehicle-bus'],[/virtual|Hypervisor|VirtIO|VM/i,'chain:runtime-boundaries']
  ])if(pattern.test(name))add(id);
  return targets.slice(0,4);
}
const sourceRegister=await readJson('content/source-register.json');
for(const source of sourceRegister.documents){
  const targets=sourceTargets(source);
  const status=source.processingState==='indexed'?'indexed':'needs_review';
  source.knowledgeIds=targets;
  source.knowledgeMappings=targets.map(knowledgeId=>({
    knowledgeId,status,
    basis:`依据文件名、平台字段和“${source.category}”资料分类映射；尚未完成该文件的页级技术结论核验。`
  }));
}
sourceRegister.summary.mappedDocuments=sourceRegister.documents.filter(item=>item.knowledgeMappings?.length).length;
await writeJson('content/source-register.json',sourceRegister);
console.log(`Reference mappings generated: ${learningItems.length} learning items, ${Object.keys(skillTargets).length} skills, ${sourceRegister.documents.length} sources.`);
