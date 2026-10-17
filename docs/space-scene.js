const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));

export function fibonacciSpherePoint(index,total,radius=1){
  const count=Math.max(1,total);
  const y=1-(index+.5)*2/count;
  const ring=Math.sqrt(Math.max(0,1-y*y));
  const angle=index*GOLDEN_ANGLE;
  return{x:Math.cos(angle)*ring*radius,y:y*radius,z:Math.sin(angle)*ring*radius};
}

export function clampLabelX(x,textWidth,viewportWidth,padding=8){
  return Math.max(padding,Math.min(viewportWidth-textWidth-padding,x));
}

export function fitLabelSize({size,textWidth,availableWidth,minSize=5}){
  if(textWidth<=availableWidth)return size;
  return Math.max(minSize,Math.round(size*availableWidth/textWidth*100)/100);
}

export function isProjectedVisible({x,y,radius=0,width,height}){
  return x+radius>=0&&x-radius<=width&&y+radius>=0&&y-radius<=height;
}

export function starPulse(time,phase,reducedMotion=false){
  return reducedMotion?1:.72+.28*Math.sin(time*.0013+phase);
}

export function releaseVelocity(velocity,idleMs,expiryMs=90){
  return idleMs<=expiryMs?velocity:0;
}

export function selectFrontLabelIds(candidates,{limit=28,minDepth=30,forcedLimit=8}={}){
  const selected=new Set(candidates.filter(item=>item.kind==='root').map(item=>item.id));
  const forced=candidates
    .filter(item=>item.kind!=='root'&&item.forced&&item.onScreen)
    .sort((a,b)=>(b.forcePriority||0)-(a.forcePriority||0)||b.depth-a.depth)
    .slice(0,Math.max(0,forcedLimit));
  for(const item of forced)selected.add(item.id);
  const front=candidates
    .filter(item=>item.onScreen&&item.kind!=='root'&&!selected.has(item.id)&&item.depth>=minDepth)
    .sort((a,b)=>b.depth-a.depth)
    .slice(0,Math.max(0,limit));
  for(const item of front)selected.add(item.id);
  return selected;
}

export function frontLabelLimit(viewportWidth){
  return viewportWidth<720?6:viewportWidth<1400?12:16;
}

export function depthLabelStyle({depth=0,perspective=1,kind='component',active=false,hover=0}){
  const importance={root:9,topic:4,platform:3,domain:3,subtopic:2}[kind]||0;
  const depthLevel=Math.max(0,Math.min(1,(depth+560)/1120));
  const base=kind==='root'?17:kind==='topic'?12:kind==='platform'||kind==='domain'?10.5:8;
  return{
    visible:true,
    size:Math.max(7,Math.min(22,base*perspective+depthLevel*2.2+hover*5+(active?3:0))),
    alpha:active?1:Math.max(.2,Math.min(.95,.2+depthLevel*.48+importance*.035+hover*.2)),
    weight:kind==='root'||kind==='topic'||kind==='platform'||kind==='domain'?650:500,
  };
}

export function orbitPose(pose,time,delta){
  return{
    yaw:pose.yaw+delta*.00011,
    pitch:-.16+Math.sin(time*.00016)*.105,
    roll:Math.sin(time*.000105)*.042,
  };
}

