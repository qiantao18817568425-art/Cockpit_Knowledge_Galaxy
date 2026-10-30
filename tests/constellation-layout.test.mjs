import test from 'node:test';
import assert from 'node:assert/strict';

import {buildDrillLayout,buildFanCurve,buildOverviewLayout,seedFromId,selectVisibleCards} from '../docs/constellation-layout.js';
import {createGalaxyState,reduceGalaxyState} from '../docs/galaxy-state.js';

const dimensions=Array.from({length:17},(_,index)=>({id:`l2-${index}`,title:`维度 ${index}`,kind:'architecture_dimension',primaryParentId:'root',hierarchyLevel:1,hierarchyOrder:index*10}));
const graph={nodes:[
  {id:'root',title:'智能座舱',kind:'root',hierarchyLevel:0},
  ...dimensions,
  {id:'l3-shared',title:'共享三级',kind:'architecture_chain',primaryParentId:'l2-2',secondaryParentIds:['l2-6'],hierarchyLevel:2,hierarchyOrder:10},
  {id:'l3-b',title:'第二三级',kind:'architecture_chain',primaryParentId:'l2-2',hierarchyLevel:2,hierarchyOrder:20},
  ...Array.from({length:30},(_,index)=>({id:`l4-${index}`,title:`四级 ${index}`,kind:'component',primaryParentId:'l3-shared',hierarchyLevel:3,hierarchyOrder:index}))
],edges:[]};

test('seedFromId and overview layout are deterministic',()=>{
  assert.equal(seedFromId('l2-2'),seedFromId('l2-2'));
  const first=buildOverviewLayout(graph);
  const second=buildOverviewLayout(graph);
  assert.deepEqual(first,second);
  assert.deepEqual(first.get('root'),{x:0,y:0,z:0,region:'core'});
});

test('overview creates 17 separated dimension constellations and one shared L3 entity',()=>{
  const layout=buildOverviewLayout(graph,{radius:360,clusterRadius:72});
  const centers=dimensions.map(node=>layout.get(node.id));
  assert.equal(new Set(centers.map(point=>`${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`)).size,17);
  for(let left=0;left<centers.length;left++)for(let right=left+1;right<centers.length;right++){
    assert.ok(Math.hypot(centers[left].x-centers[right].x,centers[left].y-centers[right].y,centers[left].z-centers[right].z)>55);
  }
  const shared=layout.get('l3-shared');
  const primary=layout.get('l2-2');
  assert.ok(Math.hypot(shared.x-primary.x,shared.y-primary.y,shared.z-primary.z)<100);
  assert.equal([...layout.keys()].filter(id=>id==='l3-shared').length,1);
});

test('drill layout keeps the fan camera-facing and exposes a 24 item window',()=>{
  const state=reduceGalaxyState(createGalaxyState(),{type:'SELECT_NODE',nodeId:'l3-shared',hierarchyLevel:2});
  const layout=buildDrillLayout(graph,'l3-shared',{state,maxListItems:24});
  assert.equal(layout.cameraFacingPlane,true);
  assert.equal(layout.fanItems.length,24);
  assert.equal(layout.requiresScroll,true);
  assert.ok(layout.fanItems.every(item=>layout.positions.get(item.id).z===0));
  assert.ok(layout.fanItems.every(item=>layout.positions.get(item.id).region==='fan'));
  assert.ok(layout.positions.get('l3-shared').x<0);
});

test('fan curves share a convergence point but have distinct endpoints',()=>{
  const start={x:-20,y:0,z:0};
  const first=buildFanCurve(start,{x:420,y:-100,z:0},0,3);
  const last=buildFanCurve(start,{x:420,y:100,z:0},2,3);
  assert.deepEqual(first[0],start);
  assert.deepEqual(last[0],start);
  assert.notDeepEqual(first.at(-1),last.at(-1));
  assert.ok(first.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z)));
});

test('complete constellation cards are capped while all dimension names remain available',()=>{
  const desktop=selectVisibleCards(graph,{selectedId:'l2-2',hoveredId:'l2-6',frontIds:dimensions.map(node=>node.id)},{mobile:false});
  const mobile=selectVisibleCards(graph,{selectedId:'l2-2',hoveredId:'l2-6',frontIds:dimensions.map(node=>node.id)},{mobile:true});
  assert.equal(desktop.names.length,17);
  assert.ok(desktop.cards.length<=7);
  assert.ok(mobile.cards.length<=3);
  assert.ok(desktop.cards.some(card=>card.id==='l2-2'));
  assert.ok(desktop.cards.some(card=>card.id==='l2-6'));
});

