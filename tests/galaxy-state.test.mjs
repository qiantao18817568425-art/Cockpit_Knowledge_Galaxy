import test from 'node:test';
import assert from 'node:assert/strict';

import {createGalaxyState,reduceGalaxyState,selectDepthVisibility,selectSceneMode} from '../docs/galaxy-state.js';

const graph={nodes:[
  {id:'root',kind:'root',hierarchyLevel:0},
  {id:'l2',kind:'architecture_dimension',primaryParentId:'root',hierarchyLevel:1,hierarchyOrder:10},
  {id:'l3',kind:'architecture_chain',primaryParentId:'l2',hierarchyLevel:2,hierarchyOrder:10},
  {id:'l4-main',kind:'component',primaryParentId:'l3',hierarchyLevel:3,hierarchyOrder:10},
  {id:'l4-side',kind:'component',primaryParentId:'l3',hierarchyLevel:3,hierarchyOrder:20},
  {id:'l5-main',kind:'process',primaryParentId:'l4-main',hierarchyLevel:4,hierarchyOrder:10},
  {id:'l6-main',kind:'observation',primaryParentId:'l5-main',hierarchyLevel:5,hierarchyOrder:10},
  {id:'l5-side',kind:'process',primaryParentId:'l4-side',hierarchyLevel:4,hierarchyOrder:20},
  {id:'l6-side',kind:'observation',primaryParentId:'l5-side',hierarchyLevel:5,hierarchyOrder:20}
],edges:[]};

test('scene mode follows the selected hierarchy level',()=>{
  const initial=createGalaxyState();
  assert.equal(selectSceneMode(initial),'home');
  const l2=reduceGalaxyState(initial,{type:'SELECT_NODE',nodeId:'l2',hierarchyLevel:1});
  assert.equal(selectSceneMode(l2),'drill');
  const l3=reduceGalaxyState(l2,{type:'SELECT_NODE',nodeId:'l3',hierarchyLevel:2});
  assert.equal(selectSceneMode(l3),'topic');
  assert.equal(initial.selectedId,null);
});

test('L2 selection exposes only direct L3 nodes and does not leak deeper descendants',()=>{
  const state=reduceGalaxyState(createGalaxyState(),{type:'SELECT_NODE',nodeId:'l2',hierarchyLevel:1});
  const result=selectDepthVisibility(graph,state);
  assert.deepEqual(result.listItems.map(node=>node.id),['l3']);
  assert.equal(result.visibleIds.has('l4-main'),false);
});

test('L3 selection exposes direct L4 and the ordered main path while grouping side descendants',()=>{
  const state=reduceGalaxyState(createGalaxyState(),{type:'SELECT_NODE',nodeId:'l3',hierarchyLevel:2});
  const result=selectDepthVisibility(graph,state,{maxListItems:24});
  for(const id of ['root','l2','l3','l4-main','l4-side','l5-main','l6-main'])assert.ok(result.visibleIds.has(id),id);
  assert.equal(result.visibleIds.has('l5-side'),false);
  assert.ok(result.collapsedGroups.some(group=>group.nodeIds.includes('l5-side')));
  assert.equal(result.requiresScroll,false);
});

test('expanding a deep group adds its nodes without mutating the previous state',()=>{
  const selected=reduceGalaxyState(createGalaxyState(),{type:'SELECT_NODE',nodeId:'l3',hierarchyLevel:2});
  const collapsed=selectDepthVisibility(graph,selected);
  const groupId=collapsed.collapsedGroups.find(group=>group.nodeIds.includes('l5-side')).id;
  const expanded=reduceGalaxyState(selected,{type:'EXPAND_GROUP',groupId});
  const result=selectDepthVisibility(graph,expanded);
  assert.ok(result.visibleIds.has('l5-side'));
  assert.equal(result.collapsedGroups.find(group=>group.id===groupId).expanded,true);
  assert.equal(selected.expandedGroupIds.has(groupId),false);
  assert.equal(expanded.expandedGroupIds.has(groupId),true);
});

test('long lists retain every item and expose a bounded virtual window',()=>{
  const nodes=[...graph.nodes];
  for(let index=0;index<30;index++)nodes.push({id:`l4-${index}`,kind:'component',primaryParentId:'l3',hierarchyLevel:3,hierarchyOrder:100+index});
  const state=reduceGalaxyState(createGalaxyState(),{type:'SELECT_NODE',nodeId:'l3',hierarchyLevel:2});
  const result=selectDepthVisibility({nodes,edges:[]},state,{maxListItems:24});
  assert.ok(result.listItems.length>24);
  assert.equal(result.windowItems.length,24);
  assert.equal(result.requiresScroll,true);
});

test('search focus is one immutable transaction and camera history pops in order',()=>{
  const initial=createGalaxyState();
  const focused=reduceGalaxyState(initial,{type:'SET_SEARCH_MATCHES',matchingIds:['l3','l4-main'],focusId:'l3',hierarchyLevel:2});
  assert.deepEqual(focused.matchingIds,['l3','l4-main']);
  assert.equal(focused.selectedId,'l3');
  assert.equal(selectSceneMode(focused),'topic');
  assert.equal(initial.selectedId,null);
  const pushed=reduceGalaxyState(focused,{type:'PUSH_CAMERA',pose:{x:1,y:2,z:3}});
  const popped=reduceGalaxyState(pushed,{type:'POP_CAMERA'});
  assert.deepEqual(popped.cameraTarget,{x:1,y:2,z:3});
  assert.equal(popped.cameraHistory.length,0);
});

test('context loss records recovery state without changing the knowledge selection',()=>{
  const selected=reduceGalaxyState(createGalaxyState(),{type:'SELECT_NODE',nodeId:'l3',hierarchyLevel:2});
  const lost=reduceGalaxyState(selected,{type:'CONTEXT_LOST'});
  assert.equal(lost.contextLost,true);
  assert.equal(lost.selectedId,'l3');
});

