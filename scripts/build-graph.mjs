import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceArg = process.argv.indexOf('--source');
const sourceRoot = path.resolve(sourceArg >= 0 ? process.argv[sourceArg + 1] : path.join(projectRoot, '..', 'Architecture_Learning-'));
const siteBase = 'https://qiantao18817568425-art.github.io/Architecture_Learning-/';
const archDir = path.join(sourceRoot, 'docs', 'architecture');
const lessonDir = path.join(sourceRoot, 'docs', 'lessons');

function plain(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

const topics = [
  ['system', '整机与平台', '系统边界、平台基线和整体架构'],
  ['virtualization', '虚拟化', 'Hypervisor、Host 与 Guest 边界'],
  ['android', 'Android AAOS', 'Android 服务、应用与系统机制'],
  ['yocto', 'Yocto Host', '宿主系统与平台服务'],
  ['mcu', 'MCU 与车信号', 'MCU、电源控制和车辆接口'],
  ['tbox', 'TBox 与连接', '车联网通信与外部连接'],
  ['display', '显示与 HMI', '显示、首帧与人机界面'],
  ['camera', 'Camera / AVM', '视频采集、环视与帧流'],
  ['audio', '音频与语音', '播放、采集与音频策略'],
  ['power', '电源与生命周期', '休眠、唤醒、启动与恢复'],
  ['cross', '跨域通信', '接口、消息与状态同步'],
  ['diagnosis', '诊断与证据', '日志、复盘与工程验证']
];

const chapterTopics = {
  '00':['system'],'01':['system'],'02':['system','virtualization'],'03':['system'],'04':['system'],
  '05':['cross','diagnosis'],'06':['android'],'07':['yocto'],'08':['mcu'],'09':['tbox'],
  '10':['mcu','cross'],'11':['display','camera'],'12':['audio'],'13':['tbox','cross'],
  '14':['power'],'15':['diagnosis'],'16':['diagnosis'],'17':['system'],'18':['yocto'],
  '19':['camera'],'20':['cross'],'21':['diagnosis'],'22':['diagnosis'],'23':['diagnosis'],'24':['power','display']
};

const keywordTopics = [
  [/虚拟化|hypervisor|\bvm\b|virtio|tee/i,'virtualization'],
  [/android|aaos|carservice|binder/i,'android'],
  [/yocto|sos|weston/i,'yocto'],
  [/mcu|can\b|车信号|车身/i,'mcu'],
  [/tbox|蜂窝|车联网|远控/i,'tbox'],
  [/显示|黑屏|首帧|hmi|launcher|触摸/i,'display'],
  [/camera|avm|环视|摄像|视频/i,'camera'],
  [/audio|音频|语音|功放|tts|aec/i,'audio'],
  [/str|resume|休眠|唤醒|电源|启动|恢复/i,'power'],
  [/some.ip|ethernet|以太网|跨域|通信|消息|网络|服务发现/i,'cross'],
  [/诊断|故障|日志|证据|复盘|测试|闭环/i,'diagnosis']
];

function classify(title) {
  const found = keywordTopics.filter(([re]) => re.test(title)).map(([,id]) => id);
  return [...new Set(found)].slice(0, 2).length ? [...new Set(found)].slice(0, 2) : ['system'];
}

const nodes = [{ id:'root', title:'座舱知识', kind:'root', description:'公开架构章节与每日学习课程的关系入口。', url:siteBase, source:'公开学习站点' }];
const edges = [];
for (const [id,title,description] of topics) {
  nodes.push({ id:`topic:${id}`, title, kind:'topic', description, url:null, source:'主题索引' });
  edges.push({ from:'root', to:`topic:${id}`, type:'主题目录' });
}

const chapterNumbers = (await readdir(archDir)).filter(name=>/^\d{2}\.html$/.test(name)).map(name=>name.slice(0,2)).sort();
for (const number of chapterNumbers) {
  const html = await readFile(path.join(archDir, `${number}.html`), 'utf8');
  const title = plain(html.match(/<title>(.*?)<\/title>/i)?.[1]?.split(' · ')[0] || `${number} 章`);
  const assignedTopics=chapterTopics[number] || classify(title);
  nodes.push({ id:`chapter:${number}`, title:`${number} ${title}`, kind:'chapter', description:'公开架构正文。主题关联用于导航，不代表当前车型连接已被实车验证。', url:`${siteBase}architecture/${number}.html`, source:'座舱架构实践 · 中文版', topics:assignedTopics });
  for (const topic of assignedTopics) edges.push({ from:`topic:${topic}`, to:`chapter:${number}`, type:'主题归类' });
}

const home = await readFile(path.join(sourceRoot,'docs','index.html'),'utf8');
const publishedLessons = new Set((await readdir(lessonDir)).filter(name => name.endsWith('.html')).map(name => name.slice(0,-5)));
const lessonPattern = /<details\b[^>]*class="lesson"[^>]*id="(day-\d+|week-[^"]+)"[^>]*>\s*<summary>\s*<span class="lesson-title">([\s\S]*?)<\/span>/g;
const seen = new Set();
for (const match of home.matchAll(lessonPattern)) {
  const id = match[1];
  if (seen.has(id)) continue;
  seen.add(id);
  const title = plain(match[2]);
  const kind = id.startsWith('day-') ? 'lesson' : 'review';
  const url = publishedLessons.has(id) ? `${siteBase}lessons/${id}.html` : `${siteBase}#${id}`;
  const assignedTopics = classify(title);
  nodes.push({ id:`course:${id}`, title, kind, description:kind==='lesson'?'公开每日课程。课程发布不代表已完成或掌握。':'公开周复盘。课程发布不代表已完成或掌握。', url, source:'座舱架构学习 · 课程档案', topics:assignedTopics });
  for (const topic of assignedTopics) edges.push({ from:`topic:${topic}`, to:`course:${id}`, type:'主题归类' });
}

const daily = nodes.filter(n=>n.kind==='lesson').sort((a,b)=>Number(a.id.slice(11))-Number(b.id.slice(11)));
for(let i=1;i<daily.length;i++) edges.push({ from:daily[i-1].id, to:daily[i].id, type:'课程顺序' });
const reviews = nodes.filter(n=>n.kind==='review');
const data = {
  meta: {
    title:'座舱知识银河',
    sourceSite:siteBase,
    sourceUpdatedOn:(JSON.parse(await readFile(path.join(sourceRoot,'content','learning-progress.json'),'utf8'))).updatedOn,
    chapterCount:chapterNumbers.length,
    lessonCount:daily.length,
    reviewCount:reviews.length,
    relationNotice:'连线为主题归类、目录或课程顺序；不表示已验证的实车硬件连接或故障因果。'
  },
  nodes, edges
};
await mkdir(path.join(projectRoot,'docs'),{recursive:true});
await writeFile(path.join(projectRoot,'docs','graph.json'),JSON.stringify(data,null,2)+'\n','utf8');
console.log(`Graph generated: ${nodes.length} nodes, ${edges.length} edges; ${daily.length} days, ${reviews.length} reviews.`);

