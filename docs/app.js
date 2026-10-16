const canvas = document.querySelector('#galaxy');
const ctx = canvas.getContext('2d');
const search = document.querySelector('#search');
const detail = document.querySelector('#detail');
const results = document.querySelector('#results');
const motionLabel = document.querySelector('#motion-label');
const motionToggle = document.querySelector('#motion-toggle');
const motionLight = document.querySelector('.motion-light');
const hoverCard = document.querySelector('#hover-card');

const colors = { root:'#e6f5ff', topic:'#74bbff', chapter:'#7fe2cd', lesson:'#baa4ff', review:'#ffc885' };
const labels = { root:'知识入口', topic:'主题星系', chapter:'架构章节', lesson:'Day 课程', review:'Week 复盘' };
const hidden = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let graph, nodes=[], edges=[], byId=new Map(), neighbors=new Map(), dust=[], stars=[];
let width=0,height=0,dpr=1, yaw=.22,pitch=-.18,zoom=1,selected=null,projected=[],pointer=null;
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
  const topicPositions=new Map(topicNodes.map((n,i)=>{const a=i*Math.PI*2/topicNodes.length-.6;return[n.id,{x:Math.cos(a)*330,y:Math.sin(a*1.7)*115,z:Math.sin(a)*250}]}));
  nodes=raw.nodes.map(n=>{
    if(n.kind==='root')return{...n,x:0,y:0,z:0,r:11};
    if(n.kind==='topic')return{...n,...topicPositions.get(n.id),r:7.7};
    const parent=topicPositions.get(`topic:${n.topics?.[0]||'system'}`)||{x:0,y:0,z:0};
    const r1=seeded(n.id+'a'),r2=seeded(n.id+'b'),r3=seeded(n.id+'c');
    const a=r1*Math.PI*2,spread=n.kind==='chapter'?80:n.kind==='lesson'?128:153;
    return{...n,x:parent.x+Math.cos(a)*spread+(r3-.5)*38,y:parent.y+Math.sin(a)*spread*.74,z:parent.z+(r2-.5)*spread*1.75,r:n.kind==='chapter'?5.1:n.kind==='lesson'?3.6:3.1};
  });
  byId=new Map(nodes.map(n=>[n.id,n]));
  edges=raw.edges.filter(e=>byId.has(e.from)&&byId.has(e.to));
  neighbors=new Map(nodes.map(n=>[n.id,new Set()]));
  for(const e of edges){neighbors.get(e.from).add(e.to);neighbors.get(e.to).add(e.from)}
  dust=Array.from({length:420},()=>{const a=random()*Math.PI*2,r=Math.sqrt(random())*590;return{x:Math.cos(a)*r,y:(random()-.5)*78,z:Math.sin(a)*r*.75,size:random()*1.2+.25,tone:random()}});
  stars=Array.from({length:140},()=>({x:random(),y:random(),r:random()*.9+.2,a:random()*.45+.12}));
  document.querySelector('#counts').textContent=`${raw.meta.chapterCount} 章架构 · ${raw.meta.lessonCount} 个 Day · ${raw.meta.reviewCount} 条 Week 复盘`;
  document.querySelector('#updated').textContent=`课程索引更新 ${raw.meta.sourceUpdatedOn}`;
  motionToggle.textContent=auto?'暂停':'旋转';
  motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');
}

function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function project(p){const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);const px=p.x-focus.x,py=p.y-focus.y,pz=p.z-focus.z;const x=px*cy+pz*sy,z=pz*cy-px*sy,y=py*cx-z*sx,depth=py*sx+z*cx;const perspective=950/(950-depth),fit=Math.min(width/1100,height/700)*zoom;return{x:width/2+x*perspective*fit,y:height/2+y*perspective*fit,z:depth,p:perspective,fit}}
function glow(x,y,r,color,alpha){const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color+alpha);gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function pickNode(x,y){let hit=null,best=Infinity;for(const n of projected){if(n.kind!=='root'&&hidden.has(n.kind))continue;const distance=Math.hypot(n.x-x,n.y-y),range=Math.max(15,n.r*n.p*n.fit+10);if(distance<=range&&distance<best){hit=n;best=distance}}return hit}
function setHovered(id){if(hovered===id)return;hovered=id;canvas.classList.toggle('is-hovering',!!id);hoverCard.classList.toggle('is-visible',!!id);hoverCard.setAttribute('aria-hidden',String(!id));if(id){const n=byId.get(id);hoverLevels.set(id,hoverLevels.get(id)||0);document.querySelector('#hover-kind').textContent=labels[n.kind];document.querySelector('#hover-title').textContent=n.title;document.querySelector('#hover-meta').textContent=`${n.description} · ${neighbors.get(id)?.size||0} 个直接关联`}interaction()}
function positionHoverCard(map){if(!hovered)return;const n=map.get(hovered);if(!n)return;const x=Math.max(14,Math.min(width-hoverCard.offsetWidth-14,n.x+24));const y=Math.max(14,Math.min(height-hoverCard.offsetHeight-14,n.y+18));hoverCard.style.left=`${x}px`;hoverCard.style.top=`${y}px`}

function background(){
  const radial=ctx.createRadialGradient(width*.5,height*.5,4,width*.5,height*.5,Math.max(width,height)*.8);
  radial.addColorStop(0,'#263761');radial.addColorStop(.32,'#142344');radial.addColorStop(.65,'#0a142b');radial.addColorStop(1,'#060a17');
  ctx.fillStyle=radial;ctx.fillRect(0,0,width,height);
  const nebula=ctx.createRadialGradient(width*.5,height*.51,5,width*.5,height*.51,Math.min(width,height)*.53);
  nebula.addColorStop(0,'#ac7bea25');nebula.addColorStop(.55,'#426fe518');nebula.addColorStop(1,'#111e5500');
  ctx.fillStyle=nebula;ctx.fillRect(0,0,width,height);
  for(const s of stars){ctx.globalAlpha=s.a;ctx.fillStyle='#d8e8ff';ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
}

function draw(){
  if(!width||!height||!graph)return;
  ctx.clearRect(0,0,width,height);background();
  const query=search.value.trim().toLocaleLowerCase();
  const matching=new Set(query?nodes.filter(n=>n.title.toLocaleLowerCase().includes(query)).map(n=>n.id):[]);
  const visible=n=>n.kind==='root'||!hidden.has(n.kind);
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
    const a=map.get(edge.from),b=map.get(edge.to);
    if(!visible(a)||!visible(b))continue;
    const active=emphasis&&(edge.from===emphasis||edge.to===emphasis);
    const dim=(query&&!matching.has(a.id)&&!matching.has(b.id)&&!active)||(emphasis&&!active);
    ctx.globalAlpha=dim?.05:active?.68:edge.type==='课程顺序'?.13:.23;
    ctx.strokeStyle=active?'#b7d8ff':edge.type==='课程顺序'?'#b5a4e7':'#7599c6';ctx.lineWidth=active?1.5:1;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }ctx.globalAlpha=1;

  const sorted=[...projected].sort((a,b)=>a.z-b.z);
  const featured=sorted.filter(n=>n.kind==='chapter'||n.kind==='lesson'||n.kind==='review').slice(-16);
  const featuredIds=new Set(featured.map(n=>n.id));
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
    const showLabel=n.kind==='root'||n.kind==='topic'||active||preview||hover>.02||match||neighbor||(!emphasis&&!query&&featuredIds.has(n.id));
    if(!showLabel)continue;
    labelQueue.push({n,active,preview,hover,dim,radius,color});
  }
  labelQueue.sort((a,b)=>(Number(a.active)+Number(a.preview)*2)-(Number(b.active)+Number(b.preview)*2));
  for(const {n,active,preview,hover,dim,radius,color} of labelQueue){
    const baseSize=active?17:n.kind==='root'?17:n.kind==='topic'?13:11;
    const size=baseSize+(24-baseSize)*hover;
    ctx.font=`${n.kind==='root'||n.kind==='topic'?650:500} ${size}px system-ui, "Microsoft YaHei", sans-serif`;
    const limit=hover>.5?32:21;
    const text=n.title.length>limit?n.title.slice(0,limit-1)+'…':n.title;
    const textWidth=ctx.measureText(text).width;
    let x=n.x+radius+7+hover*4;
    if(x+textWidth>width-12)x=n.x-radius-9-textWidth;
    const y=Math.max(size,Math.min(height-size,n.y-hover*7));
    if(x<8||x+textWidth>width-8)continue;
    const box={x:x-2,y:y-size*.65,w:textWidth+4,h:size*1.3};
    if(!active&&!preview&&hover<.15&&occupied.some(p=>box.x<p.x+p.w&&box.x+box.w>p.x&&box.y<p.y+p.h&&box.y+box.h>p.y))continue;
    occupied.push(box);
    if(hover>.03){ctx.globalAlpha=hover*.82;ctx.fillStyle='#0d2039';ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x-8,y-size*.82,textWidth+16,size*1.64,7);ctx.fill();ctx.globalAlpha=hover*.55;ctx.stroke()}
    ctx.globalAlpha=dim?.25:.94;ctx.fillStyle=active||preview?'#ffffff':'#dce8f8';ctx.shadowColor=hover>.03?color:'#06101f';ctx.shadowBlur=hover>.03?18*hover:5;ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.shadowBlur=0;ctx.globalAlpha=1;
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
  selected=id;interaction();detail.hidden=false;
  focusTarget.x=node.x;focusTarget.y=node.y;focusTarget.z=node.z;
  document.querySelector('#detail-kind').textContent=labels[node.kind];
  document.querySelector('#detail-title').textContent=node.title;
  document.querySelector('#detail-description').textContent=node.description;
  document.querySelector('#detail-source').textContent=node.source;
  const link=document.querySelector('#detail-link');
  if(node.url&&node.url.startsWith(graph.meta.sourceSite)){link.href=node.url;link.hidden=false}else{link.removeAttribute('href');link.hidden=true}
  const list=document.querySelector('#related-list');list.replaceChildren();
  const relations=[...neighbors.get(id)].filter(other=>byId.has(other)).sort((a,b)=>{
    const ak=byId.get(a).kind,bk=byId.get(b).kind;return (ak==='topic'?1:0)-(bk==='topic'?1:0);
  });
  for(const other of relations.slice(0,8)){const item=document.createElement('button');item.type='button';item.textContent=byId.get(other).title;item.addEventListener('click',()=>showNode(other));list.append(item)}
  if(relations.length>8){const more=document.createElement('small');more.textContent=`另有 ${relations.length-8} 个关联节点`;list.append(more)}
}
function clearSelection(){selected=null;focusTarget.x=0;focusTarget.y=0;focusTarget.z=0;detail.hidden=true;interaction()}

function renderResults(){
  const q=search.value.trim().toLocaleLowerCase();results.replaceChildren();
  if(!q){results.hidden=true;clearSelection();return}
  const matches=nodes.filter(n=>n.title.toLocaleLowerCase().includes(q)).slice(0,10);
  results.hidden=false;
  if(!matches.length){const empty=document.createElement('div');empty.className='empty-result';empty.textContent='没有匹配的节点';empty.style.padding='9px';empty.style.color='#a9bad6';results.append(empty);return}
  for(const n of matches){const item=document.createElement('button');item.type='button';item.setAttribute('role','option');item.textContent=n.title;const kind=document.createElement('small');kind.textContent=labels[n.kind];item.append(kind);item.addEventListener('click',()=>{hidden.delete(n.kind);syncFilters();showNode(n.id);results.hidden=true});results.append(item)}
  if(matches.length===1)showNode(matches[0].id);
}
function syncFilters(){for(const button of document.querySelectorAll('.filter')){const on=!hidden.has(button.dataset.kind);button.setAttribute('aria-pressed',String(on));button.querySelector('span').textContent=on?'✓':'○'}}

function frame(time){
  const delta=Math.min(50,time-previousFrame);previousFrame=time;
  const easing=reducedMotion?1:1-Math.exp(-delta/260);
  for(const axis of ['x','y','z'])focus[axis]+=(focusTarget[axis]-focus[axis])*easing;
  const hoverEasing=reducedMotion?1:1-Math.exp(-delta/130);
  for(const [id,level] of hoverLevels){const next=level+((id===hovered?1:0)-level)*hoverEasing;if(next<.01&&id!==hovered)hoverLevels.delete(id);else hoverLevels.set(id,next)}
  if(auto&&!document.hidden&&!selected&&!hovered&&!search.value.trim()&&time-lastAction>10000){yaw+=delta*.00017;pitch=-.18+Math.sin(time*.00022)*.065}
  draw();requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown',event=>{setHovered(null);pointer={x:event.clientX,y:event.clientY,yaw,pitch,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');interaction()});
canvas.addEventListener('pointermove',event=>{if(pointer){const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(Math.abs(dx)+Math.abs(dy)>5)pointer.moved=true;if(pointer.moved){yaw=pointer.yaw+dx*.006;pitch=Math.max(-.95,Math.min(.95,pointer.pitch+dy*.004));interaction()}return}if(event.pointerType==='touch')return;const bounds=canvas.getBoundingClientRect();setHovered(pickNode(event.clientX-bounds.left,event.clientY-bounds.top)?.id||null)});
canvas.addEventListener('pointerup',event=>{if(pointer&&!pointer.moved){const bounds=canvas.getBoundingClientRect(),hit=pickNode(event.clientX-bounds.left,event.clientY-bounds.top);if(hit)showNode(hit.id);else clearSelection()}pointer=null;canvas.classList.remove('dragging');if(event.pointerType!=='touch'){const bounds=canvas.getBoundingClientRect();setHovered(pickNode(event.clientX-bounds.left,event.clientY-bounds.top)?.id||null)}interaction()});
canvas.addEventListener('pointercancel',()=>{pointer=null;canvas.classList.remove('dragging');setHovered(null)});
canvas.addEventListener('pointerleave',()=>{if(!pointer)setHovered(null)});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.6,Math.min(2.3,zoom*(event.deltaY<0?1.09:1/1.09)));interaction()},{passive:false});
search.addEventListener('input',()=>{interaction();renderResults()});
search.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';renderResults();search.blur()}else if(event.key==='Enter'){const first=results.querySelector('button');if(first)first.click()}});
document.querySelector('#detail-close').addEventListener('click',clearSelection);
for(const button of document.querySelectorAll('.filter'))button.addEventListener('click',()=>{const kind=button.dataset.kind;hidden.has(kind)?hidden.delete(kind):hidden.add(kind);syncFilters();interaction()});
document.querySelector('#sequence-toggle').addEventListener('click',event=>{sequenceVisible=!sequenceVisible;event.currentTarget.setAttribute('aria-pressed',String(sequenceVisible));event.currentTarget.textContent=sequenceVisible?'● 隐藏课程顺序连线':'○ 显示课程顺序连线';interaction()});
motionToggle.addEventListener('click',()=>{auto=!auto;motionToggle.textContent=auto?'暂停':'旋转';motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');interaction()});
for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{const action=button.dataset.zoom;if(action==='reset'){yaw=.22;pitch=-.18;zoom=1;clearSelection()}else zoom=Math.max(.6,Math.min(2.3,zoom*(action==='in'?1.2:1/1.2)));interaction()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)lastAction=performance.now()-11000});
new ResizeObserver(resize).observe(canvas);resize();

try{
  const response=await fetch('./graph.json',{cache:'no-cache'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  prepare(await response.json());
  requestAnimationFrame(frame);
}catch(error){motionLabel.textContent='图谱加载失败';document.querySelector('#counts').textContent='请检查 graph.json 是否与网页一起发布。';console.error(error)}

