import {rankSearchResults,visibleNodeIds,detailModel} from './graph-model.js';
import {clampLabelX,depthLabelStyle,fibonacciSpherePoint,fitLabelSize,isProjectedVisible,orbitPose,releaseVelocity,starPulse} from './space-scene.js';
const canvas = document.querySelector('#galaxy');
const ctx = canvas.getContext('2d');
const search = document.querySelector('#search');
const detail = document.querySelector('#detail');
const results = document.querySelector('#results');
const motionLabel = document.querySelector('#motion-label');
const motionToggle = document.querySelector('#motion-toggle');
const motionLight = document.querySelector('.motion-light');
const hoverCard = document.querySelector('#hover-card');

const colors = { root:'#e6f5ff', topic:'#74bbff', subtopic:'#f7aadd', chapter:'#7fe2cd', lesson:'#baa4ff', review:'#ffc885',platform:'#5fc9ff',domain:'#75a7ff',component:'#7fe2cd',interface:'#ffc15d',state:'#d6a7ff',process:'#9ed49e',observation:'#ff9fc6',failure_mode:'#ff7b7b',source:'#8d9bb5',evidence:'#ffe7a3' };
const labels = { root:'知识入口', topic:'主题星系', subtopic:'细分链路', chapter:'架构章节', lesson:'Day 课程', review:'Week 复盘',platform:'平台',domain:'知识域',component:'组件',interface:'接口',state:'状态',process:'流程',observation:'观测点',failure_mode:'失效模式',source:'原始资料',evidence:'页码证据' };
const labelFor=node=>node.id.startsWith('subtopic:raw:')?'资料分类':labels[node.kind];
const hidden = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let graph, nodes=[], edges=[], byId=new Map(), neighbors=new Map(), dust=[], stars=[], nebulae=[];
const viewState={selectedId:null,platforms:[],pathClasses:[],evidenceVisible:false,candidateVisible:false};
let visibleIds=new Set();
let width=0,height=0,dpr=1, yaw=.22,pitch=-.18,roll=0,zoom=1,selected=null,projected=[],pointer=null;
let yawVelocity=0,pitchVelocity=0;
let hovered=null;
const hoverLevels=new Map();
let auto=!reducedMotion, lastAction=performance.now()-11000, previousFrame=performance.now(),sequenceVisible=false,currentStatus='';
const focus={x:0,y:0,z:0};
const focusTarget={x:0,y:0,z:0};

function seeded(id){let n=2166136261;for(const char of id){n^=char.charCodeAt(0);n=Math.imul(n,16777619)}return (n>>>0)/4294967296}
function randomStream(seedValue){let n=seedValue>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
const random=randomStream(41867);

function prepare(raw){
  graph=raw;
  const topicNodes=raw.nodes.filter(n=>n.kind==='topic');
  const topicPositions=new Map(topicNodes.map((n,i)=>[n.id,fibonacciSpherePoint(i,topicNodes.length,330)]));
  const subtopicNodes=raw.nodes.filter(n=>n.kind==='subtopic');
  const groups=new Map();
  for(const node of subtopicNodes.filter(n=>n.depth===1)){if(!groups.has(node.parentId))groups.set(node.parentId,[]);groups.get(node.parentId).push(node)}
  const subtopicPositions=new Map();
  for(const [parentId,children] of groups){const parent=topicPositions.get(parentId)||{x:0,y:0,z:0};children.forEach((n,i)=>{const a=i*Math.PI*2/children.length;subtopicPositions.set(n.id,{x:parent.x+Math.cos(a)*145,y:parent.y+Math.sin(a)*104,z:parent.z+Math.sin(a+.8)*100})})}
  const childrenByParent=new Map();
  for(const node of subtopicNodes.filter(n=>n.depth===2)){
    if(!childrenByParent.has(node.parentId))childrenByParent.set(node.parentId,[]);
    childrenByParent.get(node.parentId).push(node);
  }
  for(const [parentId,children] of childrenByParent){
    const parent=subtopicPositions.get(parentId);if(!parent)continue;
    children.forEach((n,i)=>{const a=i*Math.PI*2/children.length+.35;subtopicPositions.set(n.id,{x:parent.x+Math.cos(a)*51,y:parent.y+Math.sin(a)*39,z:parent.z+Math.sin(a+.7)*49})});
  }
  const domainTopic={platform:'system',virtualization:'virtualization',android:'android',yocto:'yocto',mcu:'mcu',tbox:'tbox',display:'display',hmi:'display',camera:'camera',audio:'audio',power:'power','cross-domain':'cross',connectivity:'cross',lifecycle:'power',usb:'diagnosis',security:'virtualization',assurance:'diagnosis',performance:'diagnosis',diagnosis:'diagnosis'};
  nodes=raw.nodes.map(n=>{
    if(n.kind==='root')return{...n,x:0,y:0,z:0,r:11};
    if(n.kind==='topic')return{...n,...topicPositions.get(n.id),r:7.7};
    if(n.kind==='subtopic')return{...n,...subtopicPositions.get(n.id),r:n.depth===1?5.9:4.1};
    const parent=topicPositions.get(`topic:${n.topics?.[0]||domainTopic[n.domain]||'system'}`)||{x:0,y:0,z:0};
    const r1=seeded(n.id+'a'),r2=seeded(n.id+'b'),r3=seeded(n.id+'c');
    const a=r1*Math.PI*2,spread=n.kind==='chapter'?80:n.kind==='lesson'?128:153;
    const semantic=n.layer==='knowledge'||n.layer==='evidence';
    return{...n,x:parent.x+Math.cos(a)*(semantic?95:spread)+(r3-.5)*38,y:parent.y+Math.sin(a)*(semantic?72:spread*.74),z:parent.z+(r2-.5)*(semantic?150:spread*1.75),r:n.kind==='chapter'?5.1:n.kind==='lesson'?3.6:n.kind==='domain'?6.2:n.kind==='platform'?6:n.kind==='component'?4.5:n.kind==='interface'?4:n.kind==='evidence'?3.2:n.kind==='source'?2.7:3.5};
  });
  byId=new Map(nodes.map(n=>[n.id,n]));
  edges=raw.edges.filter(e=>byId.has(e.from)&&byId.has(e.to));
  neighbors=new Map(nodes.map(n=>[n.id,new Set()]));
  for(const e of edges){neighbors.get(e.from).add(e.to);neighbors.get(e.to).add(e.from)}
  refreshVisible();
  dust=Array.from({length:720},()=>{const a=random()*Math.PI*2,r=Math.pow(random(),.58)*650;return{x:Math.cos(a)*r,y:(random()-.5)*(85+r*.13),z:Math.sin(a)*r*.82,size:random()*1.35+.22,tone:random()}});
  stars=Array.from({length:310},()=>({x:random(),y:random(),r:random()*1.05+.18,a:random()*.55+.1,depth:random(),twinkle:random()*Math.PI*2}));
  nebulae=Array.from({length:9},(_,i)=>({x:.14+random()*.72,y:.12+random()*.76,r:.18+random()*.24,hue:i%3,phase:random()*Math.PI*2}));
  document.querySelector('#counts').textContent=`${raw.meta.sourceCoverage.total} 份资料 · ${raw.meta.semantic.entityCount} 个知识实体 · ${raw.meta.semantic.relationCount} 条技术关系 · ${raw.meta.semantic.evidenceCount} 条页码证据 · ${raw.meta.chapterCount} 章架构`;
  document.querySelector('#updated').textContent=`课程索引更新 ${raw.meta.sourceUpdatedOn}`;
  motionToggle.textContent=auto?'暂停':'旋转';
  motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');
}
function refreshVisible(){if(!graph)return;viewState.selectedId=selected;visibleIds=visibleNodeIds(graph,viewState)}

function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function project(p){const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);const px=p.x-focus.x,py=p.y-focus.y,pz=p.z-focus.z;const yawX=px*cy+pz*sy,z=pz*cy-px*sy,pitchY=py*cx-z*sx,depth=py*sx+z*cx;const x=yawX*cr-pitchY*sr,y=yawX*sr+pitchY*cr;const perspective=950/(950-depth),fit=Math.max(.52,Math.min(width/1450,height/980))*zoom;return{x:width/2+x*perspective*fit,y:height/2+y*perspective*fit,z:depth,p:perspective,fit}}
function glow(x,y,r,color,alpha){const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color+alpha);gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function pickNode(x,y){let hit=null,best=Infinity;for(const n of projected){if(!visibleIds.has(n.id)||(n.kind!=='root'&&hidden.has(n.kind)))continue;const distance=Math.hypot(n.x-x,n.y-y),range=Math.max(15,n.r*n.p*n.fit+10);if(distance<=range&&distance<best){hit=n;best=distance}}return hit}
function setHovered(id){if(hovered===id)return;hovered=id;canvas.classList.toggle('is-hovering',!!id);hoverCard.classList.toggle('is-visible',!!id);hoverCard.setAttribute('aria-hidden',String(!id));if(id){const n=byId.get(id);hoverLevels.set(id,hoverLevels.get(id)||0);document.querySelector('#hover-kind').textContent=labelFor(n);document.querySelector('#hover-title').textContent=n.title;document.querySelector('#hover-meta').textContent=`${n.description} · ${neighbors.get(id)?.size||0} 个直接关联`}interaction()}
function positionHoverCard(map){if(!hovered)return;const n=map.get(hovered);if(!n)return;const x=Math.max(14,Math.min(width-hoverCard.offsetWidth-14,n.x+24));const y=Math.max(14,Math.min(height-hoverCard.offsetHeight-14,n.y+18));hoverCard.style.left=`${x}px`;hoverCard.style.top=`${y}px`}

function background(time){
  const radial=ctx.createRadialGradient(width*.52,height*.48,0,width*.5,height*.5,Math.max(width,height)*.82);
  radial.addColorStop(0,'#142446');radial.addColorStop(.38,'#080f25');radial.addColorStop(.75,'#030716');radial.addColorStop(1,'#01030b');
  ctx.fillStyle=radial;ctx.fillRect(0,0,width,height);
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const cloud of nebulae){
    const parallax=cloud.r*.08;
    const x=(cloud.x+Math.sin(yaw+cloud.phase)*parallax)*width;
    const y=(cloud.y+Math.sin(pitch*1.7+cloud.phase)*parallax)*height;
    const radius=Math.max(width,height)*cloud.r;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
    const colors=cloud.hue===0?['#305fc629','#15306e10']:cloud.hue===1?['#723b9e24','#28164f0d']:['#177f8c1e','#0d3b4a0c'];
    gradient.addColorStop(0,colors[0]);gradient.addColorStop(.48,colors[1]);gradient.addColorStop(1,'#00000000');ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  ctx.globalCompositeOperation='source-over';
  for(const s of stars){
    const px=((s.x+(yaw*.012*s.depth))%1+1)%1*width,py=((s.y+(pitch*.018*s.depth))%1+1)%1*height;
    const pulse=starPulse(time,s.twinkle,reducedMotion);
    ctx.globalAlpha=s.a*pulse;ctx.fillStyle=s.depth>.72?'#d9f7ff':s.depth>.38?'#b8cfff':'#a895ff';ctx.beginPath();ctx.arc(px,py,s.r*(.65+s.depth*.65),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();ctx.globalAlpha=1;
  const vignette=ctx.createRadialGradient(width*.5,height*.5,Math.min(width,height)*.2,width*.5,height*.5,Math.max(width,height)*.72);
  vignette.addColorStop(.35,'#00000000');vignette.addColorStop(1,'#000611a6');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
}

function draw(){
  if(!width||!height||!graph)return;
  const sceneTime=performance.now();
  ctx.clearRect(0,0,width,height);background(sceneTime);
  const query=search.value.trim().toLocaleLowerCase();
  const matching=new Set(query?nodes.filter(n=>n.title.toLocaleLowerCase().includes(query)).map(n=>n.id):[]);
  const visible=n=>visibleIds.has(n.id)&&(n.kind==='root'||!hidden.has(n.kind));
  const emphasis=hovered||selected;
  const related=emphasis?neighbors.get(emphasis):null;

  for(const d of dust.map(p=>({...project(p),size:p.size,tone:p.tone})).sort((a,b)=>a.z-b.z)){
    ctx.globalAlpha=Math.max(.07,Math.min(.48,(d.z+600)/1200*.48));ctx.fillStyle=d.tone<.55?'#83bcff':'#c3a7ff';ctx.beginPath();ctx.arc(d.x,d.y,Math.max(.3,d.size*d.p*d.fit),0,Math.PI*2);ctx.fill();
  }ctx.globalAlpha=1;

  projected=nodes.map(n=>({...n,...project(n)}));
  const map=new Map(projected.map(n=>[n.id,n]));
  positionHoverCard(map);
  for(const edge of edges){
    if(edge.type==='课程顺序'&&!sequenceVisible)continue;
    if(viewState.pathClasses.length&&edge.pathClass&&!viewState.pathClasses.includes(edge.pathClass))continue;
    const a=map.get(edge.from),b=map.get(edge.to);
    if(!visible(a)||!visible(b))continue;
    const active=emphasis&&(edge.from===emphasis||edge.to===emphasis);
    const dim=(query&&!matching.has(a.id)&&!matching.has(b.id)&&!active)||(emphasis&&!active);
    const indexEdge=edge.pathClass==='index';
    ctx.globalAlpha=dim?.05:active?.68:indexEdge?.06:edge.type==='课程顺序'?.13:.23;
    const pathColor={control:'#74bbff',data:'#7fe2cd',power:'#ffc15d',diagnostic:'#f7aadd'}[edge.pathClass];
    ctx.strokeStyle=active?'#ffffff':(pathColor||(edge.type==='课程顺序'?'#b5a4e7':indexEdge?'#536b90':'#7599c6'));ctx.lineWidth=active?1.7:indexEdge?.7:edge.pathClass?1.15:1;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }ctx.globalAlpha=1;

  const sorted=[...projected].sort((a,b)=>a.z-b.z);
  const labelQueue=[];
  const occupied=[];
  for(const n of sorted){
    if(!visible(n))continue;
    const active=n.id===selected,preview=n.id===hovered,neighbor=related?.has(n.id),match=query&&matching.has(n.id),hover=hoverLevels.get(n.id)||0;
    const dim=(query&&!match&&!active&&!preview&&!neighbor)||(emphasis&&!active&&!preview&&!neighbor);
    ctx.globalAlpha=dim?.13:Math.max(.45,Math.min(1,.75+n.z/950));
    const radius=Math.max(2.4,n.r*n.p*n.fit*(active?1.35:1)*(1+hover*.38)),color=colors[n.kind];
    glow(n.x,n.y,radius*(active||preview?5:3.7),color,active||preview?'75':'33');
    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=active||preview?22:11;ctx.beginPath();ctx.arc(n.x,n.y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(active||hover>.3){ctx.strokeStyle='#f8fcff';ctx.lineWidth=1.5;ctx.stroke()}
    ctx.globalAlpha=1;
    if(!isProjectedVisible({x:n.x,y:n.y,radius,width,height}))continue;
    const labelStyle=depthLabelStyle({depth:n.z,perspective:n.p,kind:n.kind,active,hover});
    if(!labelStyle.visible)continue;
    labelQueue.push({n,active,preview,hover,dim,radius,color,labelStyle});
  }
  labelQueue.sort((a,b)=>(Number(a.active)+Number(a.preview)*2)-(Number(b.active)+Number(b.preview)*2));
  for(const {n,active,preview,hover,dim,radius,color,labelStyle} of labelQueue){
    let size=labelStyle.size;
    ctx.font=`${labelStyle.weight} ${size}px system-ui, "Microsoft YaHei", sans-serif`;
    const text=n.title;
    let textWidth=ctx.measureText(text).width;
    size=fitLabelSize({size,textWidth,availableWidth:Math.max(80,width-16)});
    ctx.font=`${labelStyle.weight} ${size}px system-ui, "Microsoft YaHei", sans-serif`;
    textWidth=ctx.measureText(text).width;
    let x=n.x+radius+7+hover*4;
    if(x+textWidth>width-12)x=n.x-radius-9-textWidth;
    x=clampLabelX(x,textWidth,width);
    let y=Math.max(size,Math.min(height-size,n.y-hover*7));
    let box={x:x-2,y:y-size*.65,w:textWidth+4,h:size*1.3};
    let collisions=0;
    while(collisions<5&&occupied.some(p=>box.x<p.x+p.w&&box.x+box.w>p.x&&box.y<p.y+p.h&&box.y+box.h>p.y)){
      collisions++;y=Math.max(size,Math.min(height-size,y+(collisions%2?1:-1)*size*(.8+collisions*.38)));box={...box,y:y-size*.65};
    }
    occupied.push(box);
    if(hover>.03){ctx.globalAlpha=hover*.82;ctx.fillStyle='#0d2039';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-8,y-size*.82,textWidth+16,size*1.64,7);ctx.fill();ctx.globalAlpha=hover*.55;ctx.stroke()}
    ctx.globalAlpha=(dim?.2:labelStyle.alpha)*(collisions===5&&!active&&!preview?.58:1);ctx.fillStyle=active||preview?'#ffffff':'#dce8f8';ctx.shadowColor=hover>.03?color:'#06101f';ctx.shadowBlur=hover>.03?18*hover:3;ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  updateMotionLabel(query);
}

function updateMotionLabel(query){
  const spinning=auto&&!document.hidden&&!query&&!selected&&!hovered&&performance.now()-lastAction>10000;
  const next=hovered?'悬停预览':selected?'节点聚焦':spinning?'银河缓慢旋转':query?'搜索聚焦':auto?'互动中 · 稍后旋转':'旋转已暂停';
  if(next===currentStatus)return;
  currentStatus=next;motionLabel.textContent=next;motionLight.style.background=spinning?'#91d8ff':'#aab7d1';motionLight.style.boxShadow=spinning?'0 0 10px #91d8ff':'none';
}

function interaction(){lastAction=performance.now()}
function showNode(id){
  const node=byId.get(id);if(!node)return;
  selected=id;viewState.selectedId=id;refreshVisible();interaction();detail.hidden=false;
  focusTarget.x=node.x;focusTarget.y=node.y;focusTarget.z=node.z;
  document.querySelector('#detail-kind').textContent=labelFor(node);
  document.querySelector('#detail-title').textContent=node.title;
  const model=detailModel(graph,id);
  document.querySelector('#detail-description').textContent=model.description;
  document.querySelector('#detail-source').textContent=node.sourceName||node.source||model.evidence[0]?.sourceName||'知识图谱整理';
  const link=document.querySelector('#detail-link');
  const primaryUrl=node.url||node.downloadUrl||model.evidence[0]?.url;
  if(primaryUrl&&(primaryUrl.startsWith('https://')||primaryUrl.startsWith('./'))){
    link.href=primaryUrl;
    link.textContent=node.id==='topic:raw'?'查看原始资料目录 ↗':node.id.startsWith('subtopic:raw:')?'查看分类资料 ↗':node.kind==='topic'?'阅读相关章节 ↗':node.kind==='root'?'前往学习站点 ↗':node.kind==='subtopic'?'阅读对应段落 ↗':'打开原文 ↗';
    link.hidden=false;
  }else{link.removeAttribute('href');link.hidden=true}
  const scope=document.querySelector('#detail-scope');scope.replaceChildren();
  for(const value of [...(model.platforms||[]),model.runtimeDomain,model.status].filter(Boolean)){const tag=document.createElement('span');tag.textContent=value;scope.append(tag)}
  const evidenceBox=document.querySelector('#detail-evidence');evidenceBox.replaceChildren();
  for(const ev of model.evidence.slice(0,6)){const card=document.createElement('div');card.className='evidence-card';const head=document.createElement('b');head.textContent=`${ev.status||'证据'} · ${ev.sourceName||'原始资料'} · 第 ${(ev.pages||[]).flat().join('–')} 页`;card.append(head);card.append(document.createTextNode(ev.summary||''));if(ev.url){const a=document.createElement('a');a.href=ev.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 打开来源 ↗';card.append(a)}evidenceBox.append(card)}
  const list=document.querySelector('#related-list');list.replaceChildren();
  const order={subtopic:0,chapter:1,lesson:2,review:3,topic:4,root:5};
  const relations=[...neighbors.get(id)].filter(other=>byId.has(other)).sort((a,b)=>order[byId.get(a).kind]-order[byId.get(b).kind]);
  for(const other of relations){const item=document.createElement('button');item.type='button';item.textContent=byId.get(other).title;item.addEventListener('click',()=>showNode(other));list.append(item)}
}
function clearSelection(){selected=null;viewState.selectedId=null;focusTarget.x=0;focusTarget.y=0;focusTarget.z=0;detail.hidden=true;refreshVisible();interaction()}

function renderResults(){
  const q=search.value.trim().toLocaleLowerCase();results.replaceChildren();
  if(!q){results.hidden=true;clearSelection();return}
  const matches=rankSearchResults(nodes,q,viewState).slice(0,10);
  results.hidden=false;
  if(!matches.length){const empty=document.createElement('div');empty.className='empty-result';empty.textContent='没有匹配的节点';empty.style.padding='9px';empty.style.color='#a9bad6';results.append(empty);return}
  for(const n of matches){const item=document.createElement('button');item.type='button';item.setAttribute('role','option');item.textContent=n.title;const kind=document.createElement('small');kind.textContent=labelFor(n);item.append(kind);item.addEventListener('click',()=>{hidden.delete(n.kind);syncFilters();showNode(n.id);results.hidden=true});results.append(item)}
  if(matches.length===1)showNode(matches[0].id);
}
function syncFilters(){for(const button of document.querySelectorAll('.filter')){const on=!hidden.has(button.dataset.kind);button.setAttribute('aria-pressed',String(on));button.querySelector('span').textContent=on?'✓':'○'}}

function frame(time){
  const delta=Math.min(50,time-previousFrame);previousFrame=time;
  const easing=reducedMotion?1:1-Math.exp(-delta/260);
  for(const axis of ['x','y','z'])focus[axis]+=(focusTarget[axis]-focus[axis])*easing;
  const hoverEasing=reducedMotion?1:1-Math.exp(-delta/130);
  for(const [id,level] of hoverLevels){const next=level+((id===hovered?1:0)-level)*hoverEasing;if(next<.01&&id!==hovered)hoverLevels.delete(id);else hoverLevels.set(id,next)}
  const cruising=auto&&!document.hidden&&!selected&&!hovered&&!search.value.trim()&&time-lastAction>10000;
  if(cruising){({yaw,pitch,roll}=orbitPose({yaw,pitch,roll},time,delta));yawVelocity*=.94;pitchVelocity*=.94}
  else if(!pointer){yaw+=yawVelocity*delta;pitch=Math.max(-1.05,Math.min(1.05,pitch+pitchVelocity*delta));const friction=Math.exp(-delta/1450);yawVelocity*=friction;pitchVelocity*=friction;roll+=(0-roll)*(1-Math.exp(-delta/520))}
  draw();requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown',event=>{setHovered(null);yawVelocity=0;pitchVelocity=0;pointer={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,lastTime:performance.now(),yaw,pitch,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');interaction()});
canvas.addEventListener('pointermove',event=>{if(pointer){const now=performance.now(),dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,step=Math.max(8,now-pointer.lastTime),stepX=event.clientX-pointer.lastX,stepY=event.clientY-pointer.lastY;if(Math.abs(dx)+Math.abs(dy)>5)pointer.moved=true;if(pointer.moved){yaw=pointer.yaw+dx*.006;pitch=Math.max(-1.05,Math.min(1.05,pointer.pitch+dy*.004));yawVelocity=reducedMotion?0:Math.max(-.004,Math.min(.004,stepX*.006/step));pitchVelocity=reducedMotion?0:Math.max(-.003,Math.min(.003,stepY*.004/step));pointer.lastX=event.clientX;pointer.lastY=event.clientY;pointer.lastTime=now;interaction()}return}if(event.pointerType==='touch')return;const bounds=canvas.getBoundingClientRect();setHovered(pickNode(event.clientX-bounds.left,event.clientY-bounds.top)?.id||null)});
canvas.addEventListener('pointerup',event=>{if(pointer&&!pointer.moved){const bounds=canvas.getBoundingClientRect(),hit=pickNode(event.clientX-bounds.left,event.clientY-bounds.top);if(hit)showNode(hit.id);else clearSelection()}if(pointer?.moved){const idle=performance.now()-pointer.lastTime;yawVelocity=releaseVelocity(yawVelocity,idle);pitchVelocity=releaseVelocity(pitchVelocity,idle)}pointer=null;canvas.classList.remove('dragging');if(event.pointerType!=='touch'){const bounds=canvas.getBoundingClientRect();setHovered(pickNode(event.clientX-bounds.left,event.clientY-bounds.top)?.id||null)}interaction()});
canvas.addEventListener('pointercancel',()=>{pointer=null;yawVelocity=0;pitchVelocity=0;canvas.classList.remove('dragging');setHovered(null)});
canvas.addEventListener('pointerleave',()=>{if(!pointer)setHovered(null)});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.6,Math.min(2.3,zoom*(event.deltaY<0?1.09:1/1.09)));interaction()},{passive:false});
search.addEventListener('input',()=>{interaction();renderResults()});
search.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';renderResults();search.blur()}else if(event.key==='Enter'){const first=results.querySelector('button');if(first)first.click()}});
document.querySelector('#detail-close').addEventListener('click',clearSelection);
for(const button of document.querySelectorAll('.filter'))button.addEventListener('click',()=>{const kind=button.dataset.kind;hidden.has(kind)?hidden.delete(kind):hidden.add(kind);syncFilters();interaction()});
for(const button of document.querySelectorAll('.platform-chip'))button.addEventListener('click',()=>{const value=button.dataset.platform;viewState.platforms=viewState.platforms.includes(value)?viewState.platforms.filter(x=>x!==value):[...viewState.platforms,value];button.setAttribute('aria-pressed',String(viewState.platforms.includes(value)));refreshVisible();interaction()});
for(const button of document.querySelectorAll('.path-chip'))button.addEventListener('click',()=>{const value=button.dataset.path;viewState.pathClasses=viewState.pathClasses.includes(value)?viewState.pathClasses.filter(x=>x!==value):[...viewState.pathClasses,value];button.setAttribute('aria-pressed',String(viewState.pathClasses.includes(value)));refreshVisible();interaction()});
document.querySelector('#evidence-toggle').addEventListener('click',event=>{viewState.evidenceVisible=!viewState.evidenceVisible;event.currentTarget.setAttribute('aria-pressed',String(viewState.evidenceVisible));event.currentTarget.textContent=viewState.evidenceVisible?'● 隐藏所选节点证据':'○ 展开所选节点证据';refreshVisible();interaction()});
document.querySelector('#sequence-toggle').addEventListener('click',event=>{sequenceVisible=!sequenceVisible;event.currentTarget.setAttribute('aria-pressed',String(sequenceVisible));event.currentTarget.textContent=sequenceVisible?'● 隐藏课程顺序连线':'○ 显示课程顺序连线';interaction()});
motionToggle.addEventListener('click',()=>{auto=!auto;motionToggle.textContent=auto?'暂停':'旋转';motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');interaction()});
for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{const action=button.dataset.zoom;if(action==='reset'){yaw=.22;pitch=-.18;roll=0;yawVelocity=0;pitchVelocity=0;zoom=1;clearSelection()}else zoom=Math.max(.6,Math.min(2.3,zoom*(action==='in'?1.2:1/1.2)));interaction()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)lastAction=performance.now()-11000});
new ResizeObserver(resize).observe(canvas);resize();

try{
  const response=await fetch('./graph.json',{cache:'no-cache'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  prepare(await response.json());
  requestAnimationFrame(frame);
}catch(error){motionLabel.textContent='图谱加载失败';document.querySelector('#counts').textContent='请检查 graph.json 是否与网页一起发布。';console.error(error)}
