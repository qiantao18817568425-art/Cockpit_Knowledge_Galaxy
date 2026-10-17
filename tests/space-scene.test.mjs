import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampLabelX,
  depthLabelStyle,
  drillVisibleNodeIds,
  fibonacciSpherePoint,
  fitLabelSize,
  frontLabelLimit,
  isProjectedVisible,
  orbitPose,
  releaseVelocity,
  selectFrontLabelIds,
  starPulse,
} from '../docs/space-scene.js';

const drillGraph={nodes:[
  {id:'root',kind:'root',hierarchyLevel:0},
  {id:'l1-a',kind:'pyramid',primaryParentId:'root',hierarchyLevel:1},
  {id:'l1-b',kind:'pyramid',primaryParentId:'root',hierarchyLevel:1},
  {id:'domain',kind:'domain',primaryParentId:'l1-a',hierarchyLevel:2},
  {id:'selected',kind:'component',primaryParentId:'domain',hierarchyLevel:3},
  {id:'child-a',kind:'interface',primaryParentId:'selected',hierarchyLevel:4},
  {id:'child-b',kind:'observation',primaryParentId:'selected',hierarchyLevel:4},
  {id:'neighbor-a',kind:'component',primaryParentId:'domain',hierarchyLevel:3},
  {id:'neighbor-b',kind:'component',primaryParentId:'domain',hierarchyLevel:3},
  {id:'ev',kind:'evidence',primaryParentId:'source',hierarchyLevel:5},
  {id:'ev-sibling',kind:'evidence',primaryParentId:'source',hierarchyLevel:5},
  {id:'source',kind:'source',primaryParentId:'l1-b',hierarchyLevel:4}
],edges:[
  {from:'selected',to:'neighbor-a',type:'depends_on',pathClass:'control'},
  {from:'selected',to:'neighbor-b',type:'carries_data_to',pathClass:'data'},
  {from:'selected',to:'ev',type:'supported_by',pathClass:'diagnostic'},
  {from:'ev',to:'source',type:'supported_by',pathClass:'diagnostic'},
  {from:'ev-sibling',to:'source',type:'supported_by',pathClass:'diagnostic'}
]};

test('drill visibility starts at L1 and focuses ancestors, children and capped technical neighbors',()=>{
  assert.deepEqual([...drillVisibleNodeIds(drillGraph,{selectedId:null})].sort(),['l1-a','l1-b','root'].sort());
  const focused=drillVisibleNodeIds(drillGraph,{selectedId:'selected',technicalNeighborLimit:1});
  for(const id of ['root','l1-a','domain','selected','child-a','child-b'])assert.ok(focused.has(id),id);
  assert.equal(['neighbor-a','neighbor-b'].filter(id=>focused.has(id)).length,1);
  assert.equal(focused.has('ev'),false);
  const withEvidence=drillVisibleNodeIds(drillGraph,{selectedId:'selected',evidenceVisible:true});
  assert.ok(withEvidence.has('ev'));
  assert.ok(withEvidence.has('source'));
  assert.equal(withEvidence.has('ev-sibling'),false);
});

test('label density stays sparse across desktop and mobile views',()=>{
  assert.equal(frontLabelLimit(1600),16);
  assert.equal(frontLabelLimit(1000),12);
  assert.equal(frontLabelLimit(390),6);
});

test('rotation labels only the nearest front-facing nodes plus forced interaction targets',()=>{
  const ids=selectFrontLabelIds([
    {id:'root',kind:'root',depth:0,onScreen:true},
    {id:'near-a',kind:'component',depth:420,onScreen:true},
    {id:'near-b',kind:'topic',depth:310,onScreen:true},
    {id:'middle',kind:'component',depth:80,onScreen:true},
    {id:'back',kind:'topic',depth:-220,onScreen:true},
    {id:'hovered-back',kind:'component',depth:-300,onScreen:true,forced:true},
    {id:'offscreen',kind:'topic',depth:500,onScreen:false},
  ],{limit:2,minDepth:40});
  assert.deepEqual([...ids].sort(),['hovered-back','near-a','near-b','root'].sort());
});

test('forced interaction labels stay capped and honor priority',()=>{
  const ids=selectFrontLabelIds([
    {id:'root',kind:'root',depth:0,onScreen:true},
    {id:'selected',kind:'platform',depth:-300,onScreen:true,forced:true,forcePriority:100},
    {id:'hovered',kind:'component',depth:-260,onScreen:true,forced:true,forcePriority:90},
    {id:'match-a',kind:'component',depth:80,onScreen:true,forced:true,forcePriority:60},
    {id:'match-b',kind:'component',depth:70,onScreen:true,forced:true,forcePriority:60},
  ],{limit:0,minDepth:40,forcedLimit:2});
  assert.deepEqual([...ids].sort(),['hovered','root','selected'].sort());
});

test('reduced motion disables star pulsing',()=>{
  assert.equal(starPulse(1000,.3,true),1);
  assert.notEqual(starPulse(1000,.3,false),starPulse(1600,.3,false));
});

test('only on-screen projected nodes receive labels',()=>{
  assert.equal(isProjectedVisible({x:100,y:100,radius:8,width:375,height:667}),true);
  assert.equal(isProjectedVisible({x:-30,y:100,radius:8,width:375,height:667}),false);
  assert.equal(isProjectedVisible({x:390,y:100,radius:8,width:375,height:667}),false);
});

test('long mobile labels shrink to the available width',()=>{
  assert.equal(fitLabelSize({size:12,textWidth:443,availableWidth:359}),9.72);
  assert.equal(fitLabelSize({size:10,textWidth:100,availableWidth:359}),10);
});

test('release inertia expires after the pointer pauses',()=>{
  assert.equal(releaseVelocity(.003,35),.003);
  assert.equal(releaseVelocity(.003,140),0);
});

test('labels at the screen edge are clamped into view instead of disappearing',()=>{
  assert.equal(clampLabelX(-42,120,800),8);
  assert.equal(clampLabelX(760,120,800),672);
  assert.equal(clampLabelX(300,120,800),300);
});

test('fibonacci sphere distributes every topic on a deterministic 3D shell',()=>{
  const points=Array.from({length:12},(_,index)=>fibonacciSpherePoint(index,12,330));
  assert.equal(points.length,12);
  for(const point of points){
    const radius=Math.hypot(point.x,point.y,point.z);
    assert.ok(Math.abs(radius-330)<1e-6);
  }
  assert.equal(new Set(points.map(point=>`${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`)).size,12);
});

test('front labels use depth to change prominence',()=>{
  const near=depthLabelStyle({depth:420,perspective:1.45,kind:'component',active:false});
  const far=depthLabelStyle({depth:-430,perspective:.68,kind:'component',active:false});
  assert.equal(near.visible,true);
  assert.equal(far.visible,true);
  assert.ok(near.alpha>far.alpha);
  assert.ok(near.size>far.size);
  assert.ok(far.alpha>=.2);
  assert.ok(far.size>=7);
});

test('idle orbit advances yaw and adds a gentle three-axis camera drift',()=>{
  const start=orbitPose({yaw:.2,pitch:-.18,roll:0},1000,16);
  const later=orbitPose(start,4000,16);
  assert.ok(later.yaw>start.yaw);
  assert.notEqual(later.pitch,start.pitch);
  assert.notEqual(later.roll,start.roll);
  assert.ok(Math.abs(later.roll)<.08);
});
