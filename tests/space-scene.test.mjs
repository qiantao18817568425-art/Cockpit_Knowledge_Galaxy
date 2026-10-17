import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampLabelX,
  depthLabelStyle,
  fibonacciSpherePoint,
  fitLabelSize,
  isProjectedVisible,
  orbitPose,
  releaseVelocity,
  starPulse,
} from '../docs/space-scene.js';

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

test('all visible nodes keep a readable label while depth changes its prominence',()=>{
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
