const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));

export function fibonacciSpherePoint(index,total,radius=1){
  const count=Math.max(1,total);
  const y=1-(index+.5)*2/count;
  const ring=Math.sqrt(Math.max(0,1-y*y));
  const angle=index*GOLDEN_ANGLE;
  return{x:Math.cos(angle)*ring*radius,y:y*radius,z:Math.sin(angle)*ring*radius};
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
