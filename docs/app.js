import {buildReaderModel,rankSearchResults,readerMarkdown,visibleNodeIds} from './graph-model.js?v=20261113-starmap1';
import {buildStarmapLayout,buildStarmapView,clampLabelX,depthLabelStyle,drillVisibleNodeIds,edgeVisualStyle,fitLabelSize,frontLabelLimit,introStarmapPose,isProjectedVisible,orbitPose,releaseVelocity,routeLightProgress,starPulse,starmapBackgroundIds,starmapParallax,visibleLabelIds} from './space-scene.js?v=20261113-starmap1';
import {markdownDownloadSpec,referenceAction} from './reader-actions.js?v=20261113-starmap1';
const canvas = document.querySelector('#galaxy');
const ctx = canvas.getContext('2d');
const search = document.querySelector('#search');
const detail = document.querySelector('#detail');
const results = document.querySelector('#results');
const motionLabel = document.querySelector('#motion-label');
const motionToggle = document.querySelector('#motion-toggle');
const motionLight = document.querySelector('.motion-light');
const hoverCard = document.querySelector('#hover-card');
const routePanel = document.querySelector('#starmap-route');
let readerReturnFocus = null;
function isUsableFocusTarget(element) {
  return !!(element?.matches?.('button,a[href],input,summary,[tabindex]') &&
    element.isConnected && !element.closest('[inert]') &&
    getComputedStyle(element).visibility === 'visible' && element.getClientRects().length);
}

const colors = {root:'#e9f3ff',architecture_dimension:'#a9cde5',architecture_chain:'#a5c8d8',pyramid:'#a9cde5',index:'#849db3',topic:'#a9cde5',subtopic:'#9ec9c1',chapter:'#a8bacb',lesson:'#b6acd1',review:'#dec99d',platform:'#9dcbe0',domain:'#9fbfd3',component:'#a9c5d2',interface:'#d8c28f',state:'#b8a9ce',process:'#9dc7bd',observation:'#a6c0cd',failure_mode:'#d5a5a6',source:'#7d92a6',evidence:'#e2ca95'};
const labels = { root:'智能座舱',architecture_dimension:'架构维度',architecture_chain:'三级知识链',pyramid:'一级入口',index:'索引', topic:'主题星系', subtopic:'细分链路', chapter:'架构章节', lesson:'Day 课程', review:'Week 复盘',platform:'平台',domain:'知识域',component:'组件',interface:'接口',state:'状态',process:'流程',observation:'观测点',failure_mode:'失效模式',source:'原始资料',evidence:'页码证据' };
const labelFor=node=>node.id.startsWith('subtopic:raw:')?'资料分类':labels[node.kind];
const hidden = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let graph, nodes=[], edges=[], byId=new Map(), neighbors=new Map(), dust=[], stars=[], nebulae=[];
const viewState={selectedId:null,platforms:[],pathClasses:[],evidenceVisible:false,candidateVisible:false};
let visibleIds=new Set(),backgroundIds=new Set(),starmapView={routeIds:[],routeEdges:[],emphasisIds:new Set()};
let width=0,height=0,dpr=1, yaw=.18,pitch=-.22,roll=0,zoom=1,zoomTarget=1,selected=null,projected=[],pointer=null;
let screenCenter=.55,screenCenterTarget=.55;
let yawVelocity=0,pitchVelocity=0;
let hovered=null;
const hoverLevels=new Map();
let matchingIds=new Set();
let currentReader=null;
let auto=!reducedMotion, lastAction=performance.now()-11000, previousFrame=performance.now(),sequenceVisible=false,currentStatus='';
let introStart=null,routeStart=0,zoomStage=0;
const focus={x:0,y:0,z:0};
const focusTarget={x:0,y:0,z:0};
const parallax={x:0,y:0},parallaxTarget={x:0,y:0};

function randomStream(seedValue){let n=seedValue>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)}
const random=randomStream(41867);

function prepare(raw){
  graph=raw;
  const hierarchyPositions=buildStarmapLayout(raw);
  nodes=raw.nodes.map(n=>{
    if(n.kind==='root')return{...n,x:0,y:0,z:0,r:5.2};
    const position=hierarchyPositions.get(n.id)||{x:0,y:0,z:0};
    return{...n,...position,r:n.kind==='architecture_dimension'?5.5:n.kind==='architecture_chain'?3.7:n.kind==='domain'?3.1:n.kind==='platform'?3.3:n.navigationOnly?1.5:n.kind==='evidence'?1.5:2.1};
  });
  byId=new Map(nodes.map(n=>[n.id,n]));
  edges=raw.edges.filter(e=>byId.has(e.from)&&byId.has(e.to));
  neighbors=new Map(nodes.map(n=>[n.id,new Set()]));
  for(const e of edges){neighbors.get(e.from).add(e.to);neighbors.get(e.to).add(e.from)}
  refreshVisible();
  dust=Array.from({length:850},()=>{const a=random()*Math.PI*2,r=Math.pow(random(),.72)*780;return{x:Math.cos(a)*r,y:(random()-.5)*(210+r*.2),z:Math.sin(a)*r*.66,size:random()*1.05+.18,tone:random()}});
  stars=Array.from({length:260},()=>({x:random(),y:random(),r:random()*.8+.12,a:random()*.28+.04,depth:random(),twinkle:random()*Math.PI*2}));
  nebulae=Array.from({length:7},(_,i)=>{const t=i/6;return{x:.15+t*.75+(random()-.5)*.1,y:.69-t*.42+(random()-.5)*.15,r:.09+random()*.16,hue:i%3,phase:random()*Math.PI*2}});
  if(!reducedMotion){introStart=performance.now();({yaw,pitch,zoom}=introStarmapPose(0));}
  document.querySelector('#counts').textContent=`${raw.meta.sourceCoverage.total} 份资料 · ${raw.meta.semantic.entityCount} 个知识实体 · ${raw.meta.semantic.relationCount} 条技术关系 · ${raw.meta.semantic.evidenceCount} 条页码证据 · ${raw.meta.chapterCount} 章架构`;
  document.querySelector('#updated').textContent=`课程索引更新 ${raw.meta.sourceUpdatedOn}`;
  const topics=raw.nodes.filter(node=>node.kind==='architecture_dimension');
  document.querySelector('#topic-count').textContent=`· ${topics.length} 个主题`;
  const topicList=document.querySelector('#topic-list');
  topicList.replaceChildren();
  for(const node of topics){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=node.title;
    button.addEventListener('click',()=>showNode(node.id));
    topicList.append(button);
  }
  motionToggle.textContent=auto?'暂停':'旋转';
  motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');
}
function refreshVisible(){
  if(!graph)return;
  viewState.selectedId=selected;
  const allowed=visibleNodeIds(graph,viewState);
  const drill=selected?drillVisibleNodeIds(graph,{selectedId:selected,expandedDepth:1,evidenceVisible:viewState.evidenceVisible,matchingIds}):[];
  starmapView=buildStarmapView(graph,{zoom,selectedId:selected,hoveredId:hovered,allowedIds:allowed,drillIds:drill,matchingIds,hiddenKinds:hidden});
  visibleIds=starmapView.visibleIds;
  backgroundIds=new Set([...starmapBackgroundIds(graph,{zoom})].filter(id=>allowed.has(id)&&!visibleIds.has(id)&&!hidden.has(byId.get(id)?.kind)));
  if(routePanel){
    routePanel.hidden=!selected||starmapView.routeIds.length<2||starmapView.routeEdges.length!==starmapView.routeIds.length-1;
    routePanel.querySelector('strong').textContent=starmapView.routeIds.map(id=>byId.get(id)?.title).filter(Boolean).join('  /  ');
  }
}

function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function project(p){const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);const px=p.x-focus.x,py=p.y-focus.y,pz=p.z-focus.z;const yawX=px*cy+pz*sy,z=pz*cy-px*sy,pitchY=py*cx-z*sx,depth=py*sx+z*cx;const x=yawX*cr-pitchY*sr,y=yawX*sr+pitchY*cr;const perspective=1050/(1050-depth),fit=Math.max(.52,Math.min(width/1450,height/850))*zoom;return{x:width*screenCenter+x*perspective*fit+parallax.x*perspective,y:height*.51+y*perspective*fit+parallax.y*perspective,z:depth,p:perspective,fit}}
function glow(x,y,r,color,alpha){const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color+alpha);gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function pickNode(x,y){let hit=null,best=Infinity;for(const n of projected){if(!visibleIds.has(n.id)||(n.kind!=='root'&&hidden.has(n.kind)))continue;const distance=Math.hypot(n.x-x,n.y-y),range=Math.max(15,n.r*n.p*n.fit+10);if(distance<=range&&distance<best){hit=n;best=distance}}return hit}
function setHovered(id){if(hovered===id)return;hovered=id;refreshVisible();canvas.classList.toggle('is-hovering',!!id);hoverCard.classList.toggle('is-visible',!!id);hoverCard.setAttribute('aria-hidden',String(!id));if(id){const n=byId.get(id);hoverLevels.set(id,hoverLevels.get(id)||0);document.querySelector('#hover-kind').textContent=labelFor(n);document.querySelector('#hover-title').textContent=n.title;document.querySelector('#hover-meta').textContent=`${n.description} · ${neighbors.get(id)?.size||0} 个直接关联`}interaction()}
function positionHoverCard(map){if(!hovered)return;const n=map.get(hovered);if(!n)return;const x=Math.max(14,Math.min(width-hoverCard.offsetWidth-14,n.x+24));const y=Math.max(14,Math.min(height-hoverCard.offsetHeight-14,n.y+18));hoverCard.style.left=`${x}px`;hoverCard.style.top=`${y}px`}

function background(time){
  const radial=ctx.createRadialGradient(width*.57,height*.48,0,width*.52,height*.5,Math.max(width,height)*.82);
  radial.addColorStop(0,'#101b2b');radial.addColorStop(.38,'#080f1d');radial.addColorStop(.78,'#03070f');radial.addColorStop(1,'#01040a');
  ctx.fillStyle=radial;ctx.fillRect(0,0,width,height);
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const cloud of nebulae){
    const parallax=cloud.r*.08;
    const x=(cloud.x+Math.sin(yaw+cloud.phase)*parallax)*width;
    const y=(cloud.y+Math.sin(pitch*1.7+cloud.phase)*parallax)*height;
    const radius=Math.max(width,height)*cloud.r;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
    const colors=cloud.hue===0?['#4b718625','#1834410a']:cloud.hue===1?['#9b74401c','#46321d08']:['#7592a520','#243a4b09'];
    gradient.addColorStop(0,colors[0]);gradient.addColorStop(.48,colors[1]);gradient.addColorStop(1,'#00000000');ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  const coreX=width*.56+Math.sin(yaw)*width*.012,coreY=height*.51+Math.sin(pitch)*height*.016;
  const core=ctx.createRadialGradient(coreX,coreY,0,coreX,coreY,Math.min(width,height)*.46);
  core.addColorStop(0,'#b7d9e713');core.addColorStop(.42,'#5b8ba510');core.addColorStop(1,'#00000000');ctx.fillStyle=core;ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation='source-over';
  for(const s of stars){
    const px=((s.x+(yaw*.012*s.depth))%1+1)%1*width+parallax.x*s.depth*.3,py=((s.y+(pitch*.018*s.depth))%1+1)%1*height+parallax.y*s.depth*.3;
    const pulse=starPulse(time,s.twinkle,reducedMotion);
    ctx.globalAlpha=s.a*pulse;ctx.fillStyle=s.depth>.72?'#e6f4ff':s.depth>.38?'#aabfcb':'#b9a98b';ctx.beginPath();ctx.arc(px,py,s.r*(.65+s.depth*.65),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();ctx.globalAlpha=1;
  const vignette=ctx.createRadialGradient(width*.5,height*.5,Math.min(width,height)*.2,width*.5,height*.5,Math.max(width,height)*.72);
  vignette.addColorStop(.35,'#00000000');vignette.addColorStop(1,'#00040db3');ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
}

function draw(){
  if(!width||!height||!graph)return;
  const sceneTime=performance.now();
  ctx.clearRect(0,0,width,height);background(sceneTime);
  const query=search.value.trim().toLocaleLowerCase();
  const matching=matchingIds;
  const visible=n=>n&&visibleIds.has(n.id);
  const emphasis=hovered||selected;
  const related=starmapView.emphasisIds;
  const routeKeys=new Set(starmapView.routeEdges.map(([from,to])=>`${from}|${to}`));

  for(const d of dust.map(p=>({...project(p),size:p.size,tone:p.tone})).sort((a,b)=>a.z-b.z)){
    ctx.globalAlpha=Math.max(.025,Math.min(.22,(d.z+650)/1300*.22));ctx.fillStyle=d.tone<.72?'#9ab8c8':'#d7b88a';ctx.beginPath();ctx.arc(d.x,d.y,Math.max(.22,d.size*d.p*d.fit),0,Math.PI*2);ctx.fill();
  }ctx.globalAlpha=1;

  projected=nodes.filter(visible).map(n=>({...n,...project(n)}));
  const map=new Map(projected.map(n=>[n.id,n]));
  const backgroundPoints=nodes.filter(n=>backgroundIds.has(n.id)).map(n=>({...n,...project(n)}));
  const backgroundMap=new Map([...map,...backgroundPoints.map(n=>[n.id,n])]);
  positionHoverCard(map);
  ctx.strokeStyle='#a6bfce';ctx.lineWidth=.55;
  for(const edge of edges){
    if(!backgroundIds.has(edge.from)&&!backgroundIds.has(edge.to))continue;
    if(!['hierarchy','hierarchy-secondary','control','data','power'].includes(edge.pathClass))continue;
    if(viewState.pathClasses.length&&edge.pathClass&&!viewState.pathClasses.includes(edge.pathClass))continue;
    const a=backgroundMap.get(edge.from),b=backgroundMap.get(edge.to);
    if(!a||!b||a.kind==='root'||b.kind==='root')continue;
    ctx.globalAlpha=(edge.pathClass==='hierarchy' ? .055 : .032)*(emphasis||query ? .4 : 1);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  for(const n of backgroundPoints.sort((a,b)=>a.z-b.z)){
    ctx.globalAlpha=Math.max(.18,Math.min(.43,(n.z+500)/1100))*(emphasis||query ? .42 : 1);
    ctx.fillStyle='#b6cbd4';ctx.beginPath();ctx.arc(n.x,n.y,Math.max(.48,n.p*n.fit*.82),0,Math.PI*2);ctx.fill();
  }ctx.globalAlpha=1;
  for(const edge of edges){
    if(edge.type==='课程顺序'&&!sequenceVisible)continue;
    if(viewState.pathClasses.length&&edge.pathClass&&!viewState.pathClasses.includes(edge.pathClass))continue;
    const a=map.get(edge.from),b=map.get(edge.to);
    if(!a||!b)continue;
    const active=emphasis&&(edge.from===emphasis||edge.to===emphasis);
    const onRoute=routeKeys.has(`${edge.from}|${edge.to}`)||routeKeys.has(`${edge.to}|${edge.from}`);
    if((a.kind==='root'||b.kind==='root')&&!active&&!onRoute)continue;
    if(edge.pathClass==='index'&&!active&&!onRoute)continue;
    const dim=(query&&!matching.has(a.id)&&!matching.has(b.id)&&!active&&!onRoute)||(emphasis&&!active&&!onRoute);
    const edgeStyle=edgeVisualStyle(edge);
    const near=Math.max(.35,Math.min(1.15,((a.z+b.z)/2+550)/950));
    const baseAlpha=edge.pathClass==='hierarchy'?Math.max(.13,edgeStyle.alpha):edge.pathClass==='hierarchy-secondary' ? .08 : .12;
    ctx.globalAlpha=onRoute ? .75 : active ? .62 : dim ? .025 : baseAlpha*near;
    const pathColor={control:'#aabed1',data:'#92c8c4',power:'#e1bd82',state:'#aaa9c7',diagnostic:'#a2b8bd'}[edge.pathClass];
    ctx.strokeStyle=onRoute?'#e9bf75':active?'#dcecf7':(pathColor||'#9eb7c7');ctx.lineWidth=onRoute?1.8:active?1.3:Math.max(.5,edgeStyle.width*.72);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }ctx.globalAlpha=1;

  if(starmapView.routeEdges.length){
    ctx.save();ctx.strokeStyle='#eac482';ctx.lineWidth=2.1;ctx.shadowColor='#ffc977';ctx.shadowBlur=12;ctx.globalAlpha=.88;
    for(const [from,to] of starmapView.routeEdges){const a=map.get(from),b=map.get(to);if(!a||!b)continue;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    ctx.restore();
    if(selected&&!reducedMotion){
      const progress=routeLightProgress(sceneTime-routeStart,starmapView.routeEdges.length+1);
      const segment=progress&&starmapView.routeEdges[progress.segment];
      if(segment){const a=map.get(segment[0]),b=map.get(segment[1]);if(a&&b){const x=a.x+(b.x-a.x)*progress.t,y=a.y+(b.y-a.y)*progress.t;glow(x,y,17,'#ffd188','aa');ctx.fillStyle='#fff4d6';ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill()}}
    }
  }

  const sorted=[...projected].sort((a,b)=>a.z-b.z);
  const labelLimit=frontLabelLimit(width);
  const labelCandidates=sorted.filter(visible).map(n=>{
    const hover=hoverLevels.get(n.id)||0;
    const forcePriority=n.id===selected?100:n.id===hovered?90:hover>.02?70+hover:matching.has(n.id)?60:0;
    return{id:n.id,kind:n.kind,hierarchyLevel:n.hierarchyLevel,depth:n.z,onScreen:isProjectedVisible({x:n.x,y:n.y,radius:Math.max(3,n.r*n.p*n.fit),width,height}),forced:forcePriority>0,forcePriority};
  });
  const labelIds=visibleLabelIds(labelCandidates,{mode:'home',hoveredId:hovered,selectedId:selected,matchingIds:[...matching],currentChainIds:starmapView.routeIds,limit:labelLimit,minDepth:35,forcedLimit:8,homeLimit:width>=1400?10:7});
  const labelQueue=[];
  const occupied=[];
  for(const n of sorted){
    if(!visible(n))continue;
    const active=n.id===selected,preview=n.id===hovered,neighbor=related.has(n.id),match=query&&matching.has(n.id),hover=hoverLevels.get(n.id)||0;
    const dim=(query&&!match&&!active&&!preview&&!neighbor)||(emphasis&&!active&&!preview&&!neighbor);
    const depthAlpha=Math.max(.36,Math.min(1,(n.z+490)/850));
    ctx.globalAlpha=dim ? .14 : active||preview ? 1 : depthAlpha;
    const major=n.kind==='root'||n.kind==='architecture_dimension';
    const radius=Math.max(n.navigationOnly ? .8 : major ? 2.7 : 1.2,n.r*n.p*n.fit*(active?1.4:1)*(1+hover*.32));
    const color=active||starmapView.routeIds.includes(n.id) ? '#f4ca86' : colors[n.kind]||'#b7cad5';
    if(major||active||preview||neighbor)glow(n.x,n.y,radius*(active||preview?5:major?3.7:2.7),color,active||preview?'70':'2e');
    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=active||preview?15:major?7:0;ctx.beginPath();ctx.arc(n.x,n.y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(active||hover>.35){ctx.strokeStyle='#f8fcff';ctx.lineWidth=1.2;ctx.stroke()}
    ctx.globalAlpha=1;
    if(!labelIds.has(n.id)||!isProjectedVisible({x:n.x,y:n.y,radius,width,height}))continue;
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
    if(hover>.03||active){ctx.globalAlpha=Math.max(hover*.82,active ? .85 : 0);ctx.fillStyle='#0b1624';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-8,y-size*.82,textWidth+16,size*1.64,7);ctx.fill();ctx.globalAlpha=Math.max(hover*.55,active ? .7 : 0);ctx.stroke()}
    ctx.globalAlpha=(dim?.2:labelStyle.alpha)*(collisions===5&&!active&&!preview?.58:1);ctx.fillStyle=active||preview?'#fff9ec':'#d5e5ee';ctx.shadowColor=hover>.03?color:'#06101f';ctx.shadowBlur=hover>.03?14*hover:3;ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  updateMotionLabel(query);
}

function updateMotionLabel(query){
  const spinning=auto&&!document.hidden&&!query&&!selected&&!hovered&&performance.now()-lastAction>10000;
  const next=introStart!==null?'正在进入星图':hovered?'悬停预览':selected?'知识路径聚焦':spinning?'星图缓慢巡航':query?'搜索聚焦':auto?'互动中 · 稍后巡航':'巡航已暂停';
  if(next===currentStatus)return;
  currentStatus=next;motionLabel.textContent=next;motionLight.style.background=spinning?'#91d8ff':'#aab7d1';motionLight.style.boxShadow=spinning?'0 0 10px #91d8ff':'none';
}

function interaction(){lastAction=performance.now();introStart=null}

function pagesLabel(pages=[]){const flat=pages.flat?.(Infinity)||pages;return flat.length?`第 ${flat.join('、')} 页`:'页码未标注'}
function appendReason(container,label,value,className='reader-reason'){
  if(!value)return;const block=document.createElement('div');block.className=className;const heading=document.createElement('b');heading.textContent=label;const text=document.createElement('p');text.textContent=value;block.append(heading,text);container.append(block);
}
function appendSupports(container,supports=[]){
  if(!supports.length)return;const block=document.createElement('div');block.className='citation-supports';const heading=document.createElement('b');heading.textContent='具体支撑关系';const list=document.createElement('ul');for(const support of supports.slice(0,5)){const item=document.createElement('li');item.textContent=`${support.direct?'直接':'相邻'} · ${support.title}`;list.append(item)}block.append(heading,list);container.append(block);
}
function referenceMeta(reference,status){const platforms=reference.platforms?.length?` · ${reference.platforms.join('/')}`:'';return `${pagesLabel(reference.pages)} · ${status}${platforms}`}
function emptyReader(container,text){const item=document.createElement('div');item.className='reader-empty';item.textContent=text;container.append(item)}
function appendReaderChip(container,label,item){if(!item)return;const chip=document.createElement(item.id&&byId.has(item.id)?'button':'span');chip.className='reader-chip';chip.textContent=`${label}：${item.title||item.id}`;if(chip.tagName==='BUTTON'){chip.type='button';chip.addEventListener('click',()=>showNode(item.id))}container.append(chip)}
function appendReaderList(container,values,emptyText){if(!values?.length){emptyReader(container,emptyText);return}const list=document.createElement('ul');for(const value of values){const item=document.createElement('li');item.textContent=value;list.append(item)}container.append(list)}
const caseStatusLabels={root_cause_confirmed:'根因已确认',direct_failure_confirmed_trigger_open:'直接失效已确认 · 触发待查',awaiting_review:'待逐案核验',indexed:'仅索引',concluded:'已形成结论',verified:'证据已核验'};
const evidenceTypeLabels={direct:'直接证据',confirmed_input:'已确认输入',background:'背景证据',missing:'证据缺口'};
function appendCaseMeta(container,item){
  const meta=document.createElement('div');meta.className='case-meta-row';
  for(const value of [caseStatusLabels[item.caseStatus]||caseStatusLabels[item.evidenceState]||item.evidenceState,item.confidence&&`置信度：${item.confidence}`,item.scope?.timeWindow].filter(Boolean)){const chip=document.createElement('span');chip.textContent=value;meta.append(chip)}
  container.append(meta);
}
function closeReaderPreview(){const section=document.querySelector('#reader-preview-section');section.hidden=true;document.querySelector('#reader-preview').src='about:blank'}
function showReference(reference){
  const action=referenceAction(reference.url);if(!action.canLoad)return;
  const section=document.querySelector('#reader-preview-section'),frame=document.querySelector('#reader-preview');
  document.querySelector('#reader-preview-title').textContent=reference.title||'资料预览';
  const open=document.querySelector('#reader-preview-open');open.href=action.externalUrl;
  const download=document.querySelector('#reader-preview-download');download.hidden=!action.canDownload;download.href=action.externalUrl;download.download=reference.title||'原始资料';
  frame.title=`${reference.title||'资料'}在线预览`;frame.src=action.externalUrl;section.hidden=false;detail.scrollTo({top:Math.max(0,section.offsetTop-12),behavior:reducedMotion?'auto':'smooth'});
}
function appendReferenceActions(container,reference){
  const action=referenceAction(reference.url);if(!action.externalUrl)return;
  const actions=document.createElement('div');actions.className='citation-actions';
  if(action.canLoad){const load=document.createElement('button');load.type='button';load.textContent='页面内加载';load.addEventListener('click',()=>showReference(reference));actions.append(load)}
  const open=document.createElement('a');open.href=action.externalUrl;open.target='_blank';open.rel='noopener noreferrer';open.textContent='打开原文';actions.append(open);
  if(action.canDownload){const download=document.createElement('a');download.href=action.externalUrl;download.download=reference.title||'原始资料';download.textContent='下载资料';actions.append(download)}
  container.append(actions);
}
function renderReader(model){
  document.querySelector('#reader-summary').textContent=model.summary;
  document.querySelector('#reader-summary-basis').textContent={curated_summary:'人工整理摘要',structured_knowledge:'结构化知识',classification_only:'待吸收'}[model.summaryBasis]||'知识整理';
  document.querySelector('#reader-notice').textContent=model.notice;
  const breadcrumb=document.querySelector('#reader-breadcrumb');breadcrumb.replaceChildren();
  for(const [index,item] of model.breadcrumb.entries()){const button=document.createElement('button');button.type='button';button.textContent=item.title;button.addEventListener('click',()=>showNode(item.id));breadcrumb.append(button);if(index<model.breadcrumb.length-1){const sep=document.createElement('span');sep.textContent='›';sep.setAttribute('aria-hidden','true');breadcrumb.append(sep)}}
  const memberships=document.querySelector('#reader-memberships');memberships.replaceChildren();
  appendReaderChip(memberships,'主要归属',model.memberships?.primary||{title:'智能座舱总入口'});
  for(const item of model.memberships?.secondary||[])appendReaderChip(memberships,'同时关联',item);
  if(!model.memberships?.secondary?.length){const note=document.createElement('span');note.className='reader-membership-note';note.textContent='同时关联：无已登记交叉归属';memberships.append(note)}
  const architecture=document.querySelector('#reader-architecture');architecture.replaceChildren();
  if(model.architecture?.length){
    const label=document.createElement('strong');label.className='architecture-flow-title';label.textContent='端到端主链路';architecture.append(label);
    const flow=document.createElement('div');flow.className='architecture-flow';
    model.architecture.forEach((step,index)=>{const item=document.createElement('span');item.className='architecture-step';item.textContent=typeof step==='string'?step:(step.title||step.label);flow.append(item);if(index<model.architecture.length-1){const arrow=document.createElement('i');arrow.textContent='→';arrow.setAttribute('aria-hidden','true');flow.append(arrow)}});
    architecture.append(flow);
  }
  const responsibility=document.querySelector('#reader-responsibility');responsibility.replaceChildren();
  if(model.contentState==='awaiting_absorption')emptyReader(responsibility,'资料尚未吸收：当前只保留层级和分类，不生成技术职责。');
  else{
    appendReason(responsibility,'职责',model.responsibility.role,'responsibility-block role');
    for(const [label,values] of [['输入',model.responsibility.input],['内部机制',model.responsibility.mechanism],['输出',model.responsibility.output],['证据边界',model.responsibility.limits]])if(values?.length)appendReason(responsibility,label,values.join('；'),'responsibility-block');
  }
  const annotations=document.querySelector('#reader-annotations');annotations.replaceChildren();
  const reviewedClaims=(model.sourceClaims||[]).filter(item=>['page_verified','supporting_context'].includes(item.status)&&item.claim);
  if(reviewedClaims.length){const label=document.createElement('strong');label.className='annotation-title';label.textContent='学习来源批注';annotations.append(label);for(const item of reviewedClaims.slice(0,6)){const card=document.createElement('article');card.className='annotation-card';const source=document.createElement('b');source.textContent=`${item.title}${item.pages?.length?` · 第 ${item.pages.join('、')} 页`:''}`;const claim=document.createElement('p');claim.textContent=item.claim;card.append(source,claim);if(item.basis){const basis=document.createElement('small');basis.textContent=`融入原因：${item.basis}`;card.append(basis)}if(item.downloadUrl)appendReferenceActions(card,{title:item.title,url:item.downloadUrl});annotations.append(card)}}
  const children=document.querySelector('#reader-children');children.replaceChildren();
  if(!model.children.length)emptyReader(children,'当前节点没有更下一层的公开节点。');
  for(const child of model.children){const button=document.createElement('button');button.type='button';button.className='drill-card';const title=document.createElement('strong');title.textContent=child.title;const text=document.createElement('span');text.textContent=child.role;button.append(title,text);button.addEventListener('click',()=>showNode(child.id));children.append(button)}
  const learning=document.querySelector('#reader-learning');learning.replaceChildren();
  for(const item of model.courses||[]){const card=document.createElement('button');card.type='button';card.className='learning-card';const title=document.createElement('strong');title.textContent=item.title;const basis=document.createElement('span');basis.textContent=item.basis||'课程内容映射';card.append(title,basis);card.addEventListener('click',()=>showNode(item.id));learning.append(card)}
  if(!model.courses?.length)emptyReader(learning,'当前节点暂无已复核的课程映射。');
  const analysis=document.querySelector('#reader-analysis');analysis.replaceChildren();
  appendReason(analysis,'分析入口',model.analysis?.entry,'analysis-block entry');
  if(model.analysis?.skills?.length){const skills=document.createElement('div');skills.className='analysis-skills';for(const item of model.analysis.skills)appendReaderChip(skills,'适用技能',item);analysis.append(skills)}
  appendReaderList(analysis,model.analysis?.possibilities,'当前没有从已核验案例吸收的故障可能性。');
  if(model.analysis?.checkDomains?.length)appendReason(analysis,'需要检查的域与接口',model.analysis.checkDomains.join('、'),'analysis-block');
  if(model.analysis?.observationPoints?.length)appendReason(analysis,'主要观测点',model.analysis.observationPoints.join('；'),'analysis-block');
  const paths=document.querySelector('#reader-paths');paths.replaceChildren();
  const pathNames={control:'控制路径',data:'数据路径',power:'电源路径',state:'状态路径',diagnostic:'诊断路径'};
  for(const [pathClass,items] of Object.entries(model.technicalPaths||{})){const group=document.createElement('section');group.className=`path-group ${pathClass}`;const heading=document.createElement('h4');heading.textContent=pathNames[pathClass]||pathClass;group.append(heading);for(const item of items){const card=document.createElement('button');card.type='button';card.className='path-card';const title=document.createElement('strong');title.textContent=item.relatedTitle;const why=document.createElement('span');why.textContent=item.whyRelated||item.why;card.append(title,why);for(const [label,value] of [['输入',item.input],['交接',item.handoff],['输出',item.output],['验证',(item.verification||[]).join('；')]])if(value){const row=document.createElement('small');row.textContent=`${label}：${value}`;card.append(row)}card.addEventListener('click',()=>showNode(item.relatedId));group.append(card)}paths.append(group)}
  if(!paths.children.length)emptyReader(paths,model.contentState==='awaiting_absorption'?'资料尚未吸收，暂无可发布的技术链。':'当前节点暂无结构化技术关系。');
  const cases=document.querySelector('#reader-cases');cases.replaceChildren();
  for(const item of model.cases||[]){
    const card=document.createElement('article');card.className='case-card';const title=document.createElement('strong');title.textContent=item.title||item.symptom||'脱敏案件';card.append(title);appendCaseMeta(card,item);
    const summary=document.createElement('p');summary.textContent=item.projection?.summary||item.publicSummary||'当前只保留脱敏索引。';card.append(summary);
    if(item.projection?.relationReason)appendReason(card,'为什么归入当前专题',item.projection.relationReason,'case-relation-reason');
    if(item.normalExpectation)appendReason(card,'正常预期',item.normalExpectation,'case-normal');
    if(item.confirmedFacts?.length)appendReason(card,'已经确认',item.confirmedFacts.join('；'),'case-confirmed');
    if(item.hypotheses?.length)appendReason(card,'待验证假设',item.hypotheses.join('；'),'case-hypotheses');
    for(const report of item.reportVersions||[]){const version=document.createElement('div');version.className=`case-version ${report.status||''}`;const versionTitle=document.createElement('b');versionTitle.textContent=report.title;const status=document.createElement('span');status.textContent=report.statusLabel||report.status;const text=document.createElement('p');text.textContent=report.summary;version.append(versionTitle,status,text);appendReferenceActions(version,{title:report.title,url:report.url});card.append(version)}
    cases.append(card)
  }
  if(!model.cases?.length)emptyReader(cases,'当前没有已公开的脱敏案件摘要。');
  const reportCount=(model.cases||[]).reduce((count,item)=>count+(item.reportVersions?.length||0),0);document.querySelector('#reader-case-count').textContent=`${model.cases?.length||0} 个案例 · ${reportCount} 份报告`;
  const caseRelations=document.querySelector('#reader-case-relations');caseRelations.replaceChildren();
  for(const item of model.cases||[])for(const relation of item.technicalChain||[]){const card=document.createElement('article');card.className=`case-relation-card ${relation.pathClass||'data'}`;const title=document.createElement('strong');title.textContent=item.title||item.symptom;const chain=document.createElement('p');chain.textContent=relation.text;card.append(title,chain);appendReason(card,'故障为什么沿这条链路传播',relation.failurePropagation,'case-failure-propagation');if(item.projection?.relationReason)appendReason(card,'为什么与当前专题有关',item.projection.relationReason,'case-relation-reason');caseRelations.append(card)}
  if(!caseRelations.children.length)emptyReader(caseRelations,'当前节点暂无已核验案例的故障传播链。');
  const caseEvidence=document.querySelector('#reader-case-evidence');caseEvidence.replaceChildren();
  for(const item of model.cases||[]){
    for(const report of item.reportVersions||[]){const card=document.createElement('article');card.className='evidence-card report';const head=document.createElement('header');const title=document.createElement('strong');title.textContent=`分析报告 · ${report.title}`;const status=document.createElement('span');status.textContent=report.statusLabel||report.status;head.append(title,status);const summary=document.createElement('p');summary.textContent=report.summary;card.append(head,summary);appendReason(card,'材料性质','这是由原始日志和项目确认信息形成的分析产物，不等同于原始日志。','citation-boundary');appendReferenceActions(card,{title:report.title,url:report.url});caseEvidence.append(card)}
    for(const evidence of item.evidence||[]){const card=document.createElement('article');card.className=`evidence-card ${evidence.type||''}`;const head=document.createElement('header');const title=document.createElement('strong');title.textContent=`${evidence.id} · ${evidence.source}`;const status=document.createElement('span');status.textContent=evidenceTypeLabels[evidence.type]||evidence.type;head.append(title,status);const position=document.createElement('small');position.textContent=`定位：${evidence.location}`;card.append(head,position);appendReason(card,'支持什么结论',evidence.supports,'citation-why');appendReason(card,'证据边界',evidence.boundary,'citation-boundary');caseEvidence.append(card)}
  }
  if(!caseEvidence.children.length)emptyReader(caseEvidence,'当前节点没有已吸收案例报告或原始日志证据索引。');
  const tpm=document.querySelector('#reader-tpm');tpm.replaceChildren();
  const tpmFields=[['触发方','trigger'],['首轮牵头','firstRoundLead'],['直接失效责任','directFailureOwner'],['修复责任','repairOwner'],['接口／恢复策略方','interfaceOwner'],['验证方','verifier'],['关闭判据','closure']];
  for(const [label,key] of tpmFields)if(model.tpm?.[key])appendReason(tpm,label,model.tpm[key],'tpm-block');
  for(const item of model.cases||[]){if(!Object.keys(item.tpm||{}).length)continue;const heading=document.createElement('h4');heading.className='case-tpm-title';heading.textContent=item.title||item.symptom;tpm.append(heading);if(item.projection?.tpmFocus)appendReason(tpm,'当前专题的TPM重点',item.projection.tpmFocus,'tpm-block focus');for(const [label,key] of tpmFields)if(item.tpm?.[key])appendReason(tpm,label,item.tpm[key],'tpm-block')}
  if(!tpm.children.length)emptyReader(tpm,'责任边界随具体链路与案件确认，当前节点未单独登记 TPM 分工。');
  const verification=document.querySelector('#reader-verification');verification.replaceChildren();
  appendReaderList(verification,model.verification,'当前节点暂无独立验证判据。');
  const observations=document.querySelector('#reader-observations');observations.replaceChildren();
  if(!model.observations.length)emptyReader(observations,'当前没有已吸收的观测点。');else{const list=document.createElement('ul');for(const value of model.observations){const item=document.createElement('li');item.textContent=value;list.append(item)}observations.append(list)}
  const sourceMappings=document.querySelector('#reader-source-mappings');sourceMappings.replaceChildren();
  for(const item of model.sourceClaims||[]){const card=document.createElement('article');card.className='source-mapping-card';const head=document.createElement('header');const title=document.createElement('strong');title.textContent=`${item.title||item.sourceId}${item.duplicateCount>1?`（已合并 ${item.duplicateCount} 份同名副本）`:''}`;const status=document.createElement('span');status.className='citation-meta';status.textContent=`${item.status||'needs_review'}${item.pages?.length?` · 第 ${item.pages.join('、')} 页`:''}`;head.append(title,status);card.append(head);if(item.claim)appendReason(card,'学习批注',item.claim,'citation-claim');appendReason(card,'映射理由（为什么融入当前专题）',item.basis||'资料索引命中当前知识节点。','citation-why');if(item.section)appendReason(card,'原文章节',item.section,'citation-section');appendReason(card,'证据边界',item.status==='page_verified'?'已逐页核对并登记页码；结论仍受对应车型、版本和章节范围约束。':item.status==='supporting_context'?'已逐页核对，但这里只作为上下文，不直接证明项目接口或现车实现。':item.status==='content_indexed'?'已读取全文文本并提取章节、术语和代表页；具体参数、时序和现车适用性仍需页级复核。':'当前为资料索引映射，不能单独作为页级技术结论。','citation-boundary');if(item.downloadUrl)appendReferenceActions(card,{title:item.title||item.sourceId,url:item.downloadUrl});sourceMappings.append(card)}
  if(!model.sourceClaims?.length)emptyReader(sourceMappings,'当前没有登记到该节点的原始资料映射。');
  const citations=document.querySelector('#reader-citations');citations.replaceChildren();let citationCount=0;
  const represented=new Set();
  for(const reference of model.references.filter(item=>item.kind==='article')){const card=document.createElement('article');card.className='citation-card article';const head=document.createElement('header');const title=document.createElement('strong');title.textContent=reference.title;const meta=document.createElement('span');meta.className='citation-meta';meta.textContent=referenceMeta(reference,reference.status||'published_article');head.append(title,meta);card.append(head);if(reference.summary){const text=document.createElement('p');text.textContent=reference.summary;card.append(text)}appendReason(card,'为什么引用',reference.whyCited,'citation-why');appendReason(card,'证据边界',reference.evidenceBoundary,'citation-boundary');appendReferenceActions(card,reference);citations.append(card);citationCount++;represented.add(reference.url)}
  for(const citation of model.citations){const card=document.createElement('article');card.className='citation-card';const head=document.createElement('header');const title=document.createElement('strong');title.textContent=citation.sourceName;const meta=document.createElement('span');meta.className='citation-meta';meta.textContent=referenceMeta(citation,citation.status);head.append(title,meta);card.append(head);if(citation.summary){const text=document.createElement('p');text.textContent=citation.summary;card.append(text)}appendReason(card,'为什么引用',citation.whyCited,'citation-why');appendSupports(card,citation.displaySupports||citation.supports);appendReason(card,'证据边界',citation.evidenceBoundary,'citation-boundary');if(citation.url){appendReferenceActions(card,{title:citation.sourceName,url:citation.url});represented.add(citation.url)}citations.append(card);citationCount++}
  for(const reference of model.references.filter(item=>item.kind==='source'&&!represented.has(item.url))){const card=document.createElement('article');card.className='citation-card';const head=document.createElement('header');const title=document.createElement('strong');title.textContent=reference.title;const meta=document.createElement('span');meta.className='citation-meta';meta.textContent=referenceMeta(reference,reference.status||'source_register');head.append(title,meta);card.append(head);if(reference.summary){const text=document.createElement('p');text.textContent=reference.summary;card.append(text)}appendReason(card,'为什么引用',reference.whyCited,'citation-why');appendSupports(card,reference.supports);appendReason(card,'证据边界',reference.evidenceBoundary,'citation-boundary');appendReferenceActions(card,reference);citations.append(card);citationCount++}
  if(!citations.children.length)emptyReader(citations,'当前节点尚未绑定可公开加载的原始资料或文章。');
  document.querySelector('#reader-citation-count').textContent=`${citationCount} 项`;
  const navigation=document.querySelector('#reader-navigation-list');navigation.replaceChildren();
  if(!model.navigation.length)emptyReader(navigation,'当前没有额外分类关系。');
  for(const item of model.navigation){const button=document.createElement('button');button.type='button';button.textContent=`${item.relatedTitle} · ${item.relationType}`;button.title=item.whyRelated;button.addEventListener('click',()=>showNode(item.relatedId));navigation.append(button)}
}
function downloadReaderSummary(){
  if(!currentReader)return;const spec=markdownDownloadSpec(currentReader.title,readerMarkdown(currentReader));const url=URL.createObjectURL(new Blob([spec.content],{type:spec.type}));const link=document.createElement('a');link.href=url;link.download=spec.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
function showNode(id){
  const node=byId.get(id);if(!node)return;
  if(detail.hidden)readerReturnFocus=document.activeElement;
  selected=id;viewState.selectedId=id;zoomTarget=Math.max(1.5,zoomTarget);screenCenterTarget=.38;routeStart=performance.now();refreshVisible();interaction();detail.hidden=false;
  focusTarget.x=node.x;focusTarget.y=node.y;focusTarget.z=node.z;
  document.querySelector('#detail-kind').textContent=labelFor(node);
  document.querySelector('#detail-title').textContent=node.title;
  currentReader=buildReaderModel(graph,id,{platforms:viewState.platforms});renderReader(currentReader);closeReaderPreview();
  const scope=document.querySelector('#detail-scope');scope.replaceChildren();
  for(const value of [...(currentReader.scope.platforms||[]),currentReader.scope.runtimeDomain,currentReader.scope.version,currentReader.scope.status].filter(Boolean)){const tag=document.createElement('span');tag.textContent=value;scope.append(tag)}
  detail.scrollTop=0;
  document.querySelector('#detail-title').focus({preventScroll:true});
}
function clearSelection(){const restoreFocus=detail.contains(document.activeElement);selected=null;currentReader=null;viewState.selectedId=null;focusTarget.x=0;focusTarget.y=0;focusTarget.z=0;zoomTarget=1;screenCenterTarget=.55;detail.hidden=true;closeReaderPreview();refreshVisible();interaction();if(restoreFocus){const target=isUsableFocusTarget(readerReturnFocus)?readerReturnFocus:search;target.focus({preventScroll:true})}readerReturnFocus=null}

function renderResults(){
  const q=search.value.trim().toLocaleLowerCase();results.replaceChildren();
  if(!q){matchingIds=new Set();results.hidden=true;search.setAttribute('aria-expanded','false');clearSelection();return}
  const matches=rankSearchResults(nodes,q,viewState).slice(0,10);
  matchingIds=new Set(matches.slice(0,8).map(node=>node.id));
  refreshVisible();
  results.hidden=false;
  search.setAttribute('aria-expanded','true');
  if(!matches.length){const empty=document.createElement('div');empty.className='empty-result';empty.textContent='没有匹配的节点';empty.style.padding='9px';empty.style.color='#a9bad6';results.append(empty);return}
  for(const n of matches){const item=document.createElement('button');item.type='button';item.setAttribute('role','option');item.textContent=n.title;const kind=document.createElement('small');kind.textContent=labelFor(n);item.append(kind);item.addEventListener('click',()=>{hidden.delete(n.kind);syncFilters();results.hidden=true;search.setAttribute('aria-expanded','false');showNode(n.id)});results.append(item)}
}
function syncFilters(){for(const button of document.querySelectorAll('.filter')){const on=!hidden.has(button.dataset.kind);button.setAttribute('aria-pressed',String(on));button.querySelector('span').textContent=on?'✓':'○'}}

function frame(time){
  const delta=Math.min(50,time-previousFrame);previousFrame=time;
  const easing=reducedMotion?1:1-Math.exp(-delta/260);
  const parallaxEasing=reducedMotion?1:1-Math.exp(-delta/180);
  parallax.x+=(parallaxTarget.x-parallax.x)*parallaxEasing;
  parallax.y+=(parallaxTarget.y-parallax.y)*parallaxEasing;
  screenCenter+=(screenCenterTarget-screenCenter)*easing;
  if(introStart!==null){
    const progress=Math.min(1,(time-introStart)/1500);
    ({yaw,pitch,zoom}=introStarmapPose(progress));
    if(progress>=1)introStart=null;
  }else zoom+=(zoomTarget-zoom)*easing;
  const stage=zoom<1.35?0:zoom<1.75?1:2;
  if(stage!==zoomStage){zoomStage=stage;refreshVisible()}
  for(const axis of ['x','y','z'])focus[axis]+=(focusTarget[axis]-focus[axis])*easing;
  const hoverEasing=reducedMotion?1:1-Math.exp(-delta/130);
  for(const [id,level] of hoverLevels){const next=level+((id===hovered?1:0)-level)*hoverEasing;if(next<.01&&id!==hovered)hoverLevels.delete(id);else hoverLevels.set(id,next)}
  const cruising=auto&&!document.hidden&&!selected&&!hovered&&!search.value.trim()&&time-lastAction>10000;
  if(cruising){({yaw,pitch,roll}=orbitPose({yaw,pitch,roll},time,delta));yawVelocity*=.94;pitchVelocity*=.94}
  else if(!pointer){yaw+=yawVelocity*delta;pitch=Math.max(-1.05,Math.min(1.05,pitch+pitchVelocity*delta));const friction=Math.exp(-delta/1450);yawVelocity*=friction;pitchVelocity*=friction;roll+=(0-roll)*(1-Math.exp(-delta/520))}
  if(!document.hidden)draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown',event=>{setHovered(null);yawVelocity=0;pitchVelocity=0;pointer={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,lastTime:performance.now(),yaw,pitch,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');interaction()});
canvas.addEventListener('pointermove',event=>{if(pointer){const now=performance.now(),dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,step=Math.max(8,now-pointer.lastTime),stepX=event.clientX-pointer.lastX,stepY=event.clientY-pointer.lastY;if(Math.abs(dx)+Math.abs(dy)>5)pointer.moved=true;if(pointer.moved){yaw=pointer.yaw+dx*.006;pitch=Math.max(-1.05,Math.min(1.05,pointer.pitch+dy*.004));yawVelocity=reducedMotion?0:Math.max(-.004,Math.min(.004,stepX*.006/step));pitchVelocity=reducedMotion?0:Math.max(-.003,Math.min(.003,stepY*.004/step));pointer.lastX=event.clientX;pointer.lastY=event.clientY;pointer.lastTime=now;interaction()}return}if(event.pointerType==='touch')return;const bounds=canvas.getBoundingClientRect();Object.assign(parallaxTarget,starmapParallax((event.clientX-bounds.left)/bounds.width*2-1,(event.clientY-bounds.top)/bounds.height*2-1,{reducedMotion}));setHovered(pickNode(event.clientX-bounds.left,event.clientY-bounds.top)?.id||null)});
canvas.addEventListener('pointerup',event=>{if(pointer&&!pointer.moved){const bounds=canvas.getBoundingClientRect(),hit=pickNode(event.clientX-bounds.left,event.clientY-bounds.top);if(hit)showNode(hit.id);else clearSelection()}if(pointer?.moved){const idle=performance.now()-pointer.lastTime;yawVelocity=releaseVelocity(yawVelocity,idle);pitchVelocity=releaseVelocity(pitchVelocity,idle)}pointer=null;canvas.classList.remove('dragging');if(event.pointerType!=='touch'){const bounds=canvas.getBoundingClientRect();setHovered(pickNode(event.clientX-bounds.left,event.clientY-bounds.top)?.id||null)}interaction()});
canvas.addEventListener('pointercancel',()=>{pointer=null;yawVelocity=0;pitchVelocity=0;canvas.classList.remove('dragging');setHovered(null)});
canvas.addEventListener('pointerleave',()=>{parallaxTarget.x=0;parallaxTarget.y=0;if(!pointer)setHovered(null)});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoomTarget=Math.max(.58,Math.min(2.3,zoomTarget*(event.deltaY<0?1.12:1/1.12)));interaction()},{passive:false});
search.addEventListener('input',()=>{interaction();renderResults()});
search.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();if(search.value){search.value='';renderResults()}else search.blur()}else if(event.key==='Enter'){const first=results.querySelector('button');if(first)first.click()}else if(event.key==='ArrowDown'){const first=results.querySelector('button');if(first){event.preventDefault();first.focus()}}});
results.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();search.focus()}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){const items=[...results.querySelectorAll('button')];const index=items.indexOf(document.activeElement);const next=items[index+(event.key==='ArrowDown'?1:-1)];if(next){event.preventDefault();next.focus()}}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!detail.hidden)clearSelection();else if(event.key==='/'&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)){event.preventDefault();search.focus()}});
document.querySelector('#detail-close').addEventListener('click',clearSelection);
document.querySelector('#reader-preview-close').addEventListener('click',closeReaderPreview);
document.querySelector('#reader-download-summary').addEventListener('click',downloadReaderSummary);
for(const button of document.querySelectorAll('.filter'))button.addEventListener('click',()=>{const kind=button.dataset.kind;hidden.has(kind)?hidden.delete(kind):hidden.add(kind);syncFilters();refreshVisible();interaction()});
for(const button of document.querySelectorAll('.platform-chip'))button.addEventListener('click',()=>{const value=button.dataset.platform;viewState.platforms=viewState.platforms.includes(value)?viewState.platforms.filter(x=>x!==value):[...viewState.platforms,value];button.setAttribute('aria-pressed',String(viewState.platforms.includes(value)));refreshVisible();if(selected)showNode(selected);interaction()});
for(const button of document.querySelectorAll('.path-chip'))button.addEventListener('click',()=>{const value=button.dataset.path;viewState.pathClasses=viewState.pathClasses.includes(value)?viewState.pathClasses.filter(x=>x!==value):[...viewState.pathClasses,value];button.setAttribute('aria-pressed',String(viewState.pathClasses.includes(value)));refreshVisible();interaction()});
document.querySelector('#evidence-toggle').addEventListener('click',event=>{viewState.evidenceVisible=!viewState.evidenceVisible;event.currentTarget.setAttribute('aria-pressed',String(viewState.evidenceVisible));event.currentTarget.textContent=viewState.evidenceVisible?'● 隐藏所选节点证据':'○ 展开所选节点证据';refreshVisible();interaction()});
document.querySelector('#sequence-toggle').addEventListener('click',event=>{sequenceVisible=!sequenceVisible;event.currentTarget.setAttribute('aria-pressed',String(sequenceVisible));event.currentTarget.textContent=sequenceVisible?'● 隐藏课程顺序连线':'○ 显示课程顺序连线';interaction()});
motionToggle.addEventListener('click',()=>{auto=!auto;motionToggle.textContent=auto?'暂停':'旋转';motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');interaction()});
for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{const action=button.dataset.zoom;if(action==='reset'){yaw=.18;pitch=-.22;roll=0;yawVelocity=0;pitchVelocity=0;zoomTarget=1;clearSelection()}else zoomTarget=Math.max(.58,Math.min(2.3,zoomTarget*(action==='in'?1.2:1/1.2)));interaction()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)lastAction=performance.now()-11000});
new ResizeObserver(resize).observe(canvas);resize();

try{
  const response=await fetch('./graph.json',{cache:'no-cache'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  prepare(await response.json());
  requestAnimationFrame(frame);
}catch(error){motionLabel.textContent='图谱加载失败';document.querySelector('#counts').textContent='请检查 graph.json 是否与网页一起发布。';console.error(error)}

