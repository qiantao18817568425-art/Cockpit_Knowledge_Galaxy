import test from 'node:test';
import assert from 'node:assert/strict';

import {
  depthLabelStyle,
  fibonacciSpherePoint,
  orbitPose,
} from '../docs/space-scene.js';

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
