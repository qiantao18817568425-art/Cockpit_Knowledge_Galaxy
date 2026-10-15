const canvas = document.querySelector('#galaxy');
const ctx = canvas.getContext('2d');
const search = document.querySelector('#search');
const detail = document.querySelector('#detail');
const results = document.querySelector('#results');
const motionLabel = document.querySelector('#motion-label');
const motionToggle = document.querySelector('#motion-toggle');
const motionLight = document.querySelector('.motion-light');

const colors = { root:'#e6f5ff', topic:'#74bbff', chapter:'#7fe2cd', lesson:'#baa4ff', review:'#ffc885' };
const labels = { root:'知识入口', topic:'主题星系', chapter:'架构章节', lesson:'Day 课程', review:'Week 复盘' };
const hidden = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let graph, nodes=[], edges=[], byId=new Map(), neighbors=new Map(), dust=[], stars=[];
let width=0,height=0,dpr=1, yaw=.22,pitch=-.18,zoom=1,selected=null,projected=[],pointer=null;
let auto=!reducedMotion, lastAction=performance.now()-11000, previousFrame=performance.now(),sequenceVisible=false,currentStatus='';

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
function project(p){const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);const x=p.x*cy+p.z*sy,z=p.z*cy-p.x*sy,y=p.y*cx-z*sx,depth=p.y*sx+z*cx;const perspective=950/(950-depth),fit=Math.min(width/1100,height/700)*zoom;return{x:width/2+x*perspective*fit,y:height/2+y*perspective*fit,z:depth,p:perspective,fit}}
function glow(x,y,r,color,alpha){const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color+alpha);gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}

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
  const related=selected?neighbors.get(selected):null;

  for(const d of dust.map(p=>({...project(p),size:p.size,tone:p.tone})).sort((a,b)=>a.z-b.z)){
    ctx.globalAlpha=Math.max(.07,Math.min(.48,(d.z+600)/1200*.48));ctx.fillStyle=d.tone<.55?'#83bcff':'#c3a7ff';ctx.beginPath();ctx.arc(d.x,d.y,Math.max(.3,d.size*d.p*d.fit),0,Math.PI*2);ctx.fill();
  }ctx.globalAlpha=1;

  projected=nodes.map(n=>({...n,...project(n)}));
  const map=new Map(projected.map(n=>[n.id,n]));
  for(const edge of edges){
    if(edge.type==='课程顺序'&&!sequenceVisible)continue;
    const a=map.get(edge.from),b=map.get(edge.to);
    if(!visible(a)||!visible(b))continue;
    const active=selected&&(edge.from===selected||edge.to===selected);
    const dim=(query&&!matching.has(a.id)&&!matching.has(b.id))||(selected&&!active);
    ctx.globalAlpha=dim?.05:active?.68:edge.type==='课程顺序'?.13:.23;
    ctx.strokeStyle=active?'#b7d8ff':edge.type==='课程顺序'?'#b5a4e7':'#7599c6';ctx.lineWidth=active?1.5:1;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }ctx.globalAlpha=1;

  const sorted=[...projected].sort((a,b)=>a.z-b.z);
  const featured=sorted.filter(n=>n.kind==='chapter'||n.kind==='lesson'||n.kind==='review').slice(-16);
  const featuredIds=new Set(featured.map(n=>n.id));
  const occupied=[];
  for(const n of sorted){
    if(!visible(n))continue;
    const active=n.id===selected,neighbor=related?.has(n.id),match=query&&matching.has(n.id),dim=(query&&!match)||(selected&&!active&&!neighbor);
    ctx.globalAlpha=dim?.13:Math.max(.45,Math.min(1,.75+n.z/950));
    const radius=Math.max(2.4,n.r*n.p*n.fit),color=colors[n.kind];
    glow(n.x,n.y,radius*(active?5:3.7),color,active?'75':'33');
    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=active?22:11;ctx.beginPath();ctx.arc(n.x,n.y,radius,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(active){ctx.strokeStyle='#f8fcff';ctx.lineWidth=1.5;ctx.stroke()}
    ctx.globalAlpha=1;
    const showLabel=n.kind==='root'||n.kind==='topic'||active||match||neighbor||(!selected&&!query&&featuredIds.has(n.id));
    if(!showLabel)continue;
    const size=n.kind==='root'?17:n.kind==='topic'?13:11;
    ctx.font=`${n.kind==='root'||n.kind==='topic'?650:500} ${size}px system-ui, "Microsoft YaHei", sans-serif`;
    const text=n.title.length>21?n.title.slice(0,20)+'…':n.title;
    const textWidth=ctx.measureText(text).width,x=n.x+radius+7,y=n.y;
    if(x+textWidth>width-8||x<6||y<10||y>height-10)continue;
    const box={x:x-2,y:y-size*.65,w:textWidth+4,h:size*1.3};
    if(!active&&!match&&occupied.some(p=>box.x<p.x+p.w&&box.x+box.w>p.x&&box.y<p.y+p.h&&box.y+box.h>p.y))continue;
    occupied.push(box);ctx.globalAlpha=dim?.25:.94;ctx.fillStyle=active?'#ffffff':'#dce8f8';ctx.shadowColor='#06101f';ctx.shadowBlur=5;ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  updateMotionLabel(query);
}

function updateMotionLabel(query){
  const spinning=auto&&!document.hidden&&!query&&performance.now()-lastAction>10000;
  const next=spinning?'银河缓慢旋转':query?'搜索聚焦':auto?'互动中 · 稍后旋转':'旋转已暂停';
  if(next===currentStatus)return;
  currentStatus=next;motionLabel.textContent=next;motionLight.style.background=spinning?'#91d8ff':'#aab7d1';motionLight.style.boxShadow=spinning?'0 0 10px #91d8ff':'none';
}

function interaction(){lastAction=performance.now()}
function showNode(id){
  const node=byId.get(id);if(!node)return;
  selected=id;interaction();detail.hidden=false;
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
function clearSelection(){selected=null;detail.hidden=true;interaction()}

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
  if(auto&&!document.hidden&&!search.value.trim()&&time-lastAction>10000){yaw+=delta*.00017;pitch=-.18+Math.sin(time*.00022)*.065;if(selected){selected=null;detail.hidden=true}}
  draw();requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown',event=>{pointer={x:event.clientX,y:event.clientY,yaw,pitch,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');interaction()});
canvas.addEventListener('pointermove',event=>{if(!pointer)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(Math.abs(dx)+Math.abs(dy)>5)pointer.moved=true;if(pointer.moved){yaw=pointer.yaw+dx*.006;pitch=Math.max(-.95,Math.min(.95,pointer.pitch+dy*.004));interaction()}});
canvas.addEventListener('pointerup',event=>{if(pointer&&!pointer.moved){const bounds=canvas.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;const hit=projected.filter(n=>n.kind==='root'||!hidden.has(n.kind)).map(n=>({id:n.id,d:Math.hypot(n.x-x,n.y-y)})).sort((a,b)=>a.d-b.d)[0];if(hit&&hit.d<23)showNode(hit.id);else clearSelection()}pointer=null;canvas.classList.remove('dragging');interaction()});
canvas.addEventListener('pointercancel',()=>{pointer=null;canvas.classList.remove('dragging')});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.6,Math.min(2.3,zoom*(event.deltaY<0?1.09:1/1.09)));interaction()},{passive:false});
search.addEventListener('input',()=>{interaction();renderResults()});
search.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';renderResults();search.blur()}else if(event.key==='Enter'){const first=results.querySelector('button');if(first)first.click()}});
document.querySelector('#detail-close').addEventListener('click',clearSelection);
for(const button of document.querySelectorAll('.filter'))button.addEventListener('click',()=>{const kind=button.dataset.kind;hidden.has(kind)?hidden.delete(kind):hidden.add(kind);syncFilters();interaction()});
document.querySelector('#sequence-toggle').addEventListener('click',event=>{sequenceVisible=!sequenceVisible;event.currentTarget.setAttribute('aria-pressed',String(sequenceVisible));event.currentTarget.textContent=sequenceVisible?'● 隐藏课程顺序连线':'○ 显示课程顺序连线';interaction()});
motionToggle.addEventListener('click',()=>{auto=!auto;motionToggle.textContent=auto?'暂停':'旋转';motionToggle.setAttribute('aria-label',auto?'暂停自动旋转':'开启自动旋转');interaction()});
for(const button of document.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{const action=button.dataset.zoom;if(action==='reset'){yaw=.22;pitch=-.18;zoom=1}else zoom=Math.max(.6,Math.min(2.3,zoom*(action==='in'?1.2:1/1.2)));interaction()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)lastAction=performance.now()-11000});
new ResizeObserver(resize).observe(canvas);resize();

try{
  const response=await fetch('./graph.json',{cache:'no-cache'});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  prepare(await response.json());
  requestAnimationFrame(frame);
}catch(error){motionLabel.textContent='图谱加载失败';document.querySelector('#counts').textContent='请检查 graph.json 是否与网页一起发布。';console.error(error)}

