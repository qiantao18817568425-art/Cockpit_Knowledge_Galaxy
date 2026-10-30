import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildFanModel} from '../docs/hybrid-fan-model.js';
const graph=JSON.parse(readFileSync(new URL('../docs/graph.json',import.meta.url)));
test('dimension fan groups real L3 and direct L4 nodes, with a bounded curve window',()=>{
  const id='architecture:android-hmi-display';
  const result=buildFanModel(graph,{dimensionId:id,maxCurves:24});
  const children=graph.nodes.filter(node=>node.primaryParentId===id||node.secondaryParentIds?.includes(id));
  assert.equal(result.groups.length,children.length);
  for(const row of result.rows)assert.ok(graph.nodes.some(node=>node.id===row.nodeId));
  for(const group of result.groups){
    assert.deepEqual(group.children.map(row=>row.nodeId).sort(),graph.nodes.filter(node=>node.primaryParentId===group.nodeId).map(node=>node.id).sort());
  }
  assert.ok(result.visibleCurves.length<=24);
  assert.equal(result.totalRowCount,result.rows.length);
});
test('empty groups remain explicit and never acquire invented rows',()=>{
  const result=buildFanModel({nodes:[{id:'d'},{id:'c',primaryParentId:'d'}]},{dimensionId:'d'});
  assert.equal(result.groups[0].empty,true);
  assert.deepEqual(result.groups[0].children,[]);
});
test('focused L3 includes direct L4 and only one deeper main path',()=>{
  const nodes=[{id:'d',hierarchyLevel:1},{id:'c',primaryParentId:'d',hierarchyLevel:2},{id:'a',primaryParentId:'c',hierarchyLevel:3},{id:'b',primaryParentId:'c',hierarchyLevel:3},{id:'x',primaryParentId:'a',hierarchyLevel:4},{id:'y',primaryParentId:'x',hierarchyLevel:5},{id:'z',primaryParentId:'b',hierarchyLevel:4}];
  const result=buildFanModel({nodes},{dimensionId:'d',focusedNodeId:'c'});
  assert.deepEqual(result.rows.map(row=>row.nodeId),['a','x','y','b']);
  assert.ok(result.collapsedGroups.some(group=>group.nodeIds.includes('z')));
  const expanded=buildFanModel({nodes},{dimensionId:'d',focusedNodeId:'c',expandedGroupIds:new Set(['deep:c:b'])});
  assert.ok(expanded.rows.some(row=>row.nodeId==='z'));assert.equal(expanded.collapsedGroups.find(group=>group.id==='deep:c:b').expanded,true);
});
test('technical mode only exposes real selected path classes between displayed knowledge points',()=>{
  const nodes=[{id:'d',hierarchyLevel:1},{id:'c',primaryParentId:'d',hierarchyLevel:2},{id:'a',primaryParentId:'c',hierarchyLevel:3},{id:'b',primaryParentId:'c',hierarchyLevel:3}];
  const edges=[{from:'a',to:'b',pathClass:'data'},{from:'a',to:'b',pathClass:'power'},{from:'c',to:'a',pathClass:'hierarchy'}];
  const result=buildFanModel({nodes,edges},{dimensionId:'d',relationMode:'technical',pathClasses:['data']});
  assert.deepEqual(result.technicalEdges,[edges[0]]);
});
test('secondary L3 membership appears in another dimension without duplicating its node',()=>{
  const nodes=[{id:'d1',hierarchyLevel:1},{id:'d2',hierarchyLevel:1},{id:'shared',primaryParentId:'d1',secondaryParentIds:['d2'],hierarchyLevel:2},{id:'item',primaryParentId:'shared',hierarchyLevel:3}];
  const result=buildFanModel({nodes},{dimensionId:'d2'});
  assert.equal(result.groups[0].nodeId,'shared');assert.equal(result.groups[0].secondary,true);
  assert.deepEqual(result.groups[0].children.map(item=>item.nodeId),['item']);
});
