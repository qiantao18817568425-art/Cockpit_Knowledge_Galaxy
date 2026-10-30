import test from 'node:test';
import assert from 'node:assert/strict';
import {createHybridGalaxyState,reduceHybridGalaxyState,resolveSearchFocus} from '../docs/hybrid-galaxy-state.js';
test('dimension selection and drill stay distinct from reader and restore scroll',()=>{
  let s=createHybridGalaxyState();
  s=reduceHybridGalaxyState(s,{type:'SELECT_DIMENSION',id:'power'});
  assert.equal(s.readerNodeId,null);
  s=reduceHybridGalaxyState(s,{type:'DRILL_NODE',id:'power-chain'});
  s=reduceHybridGalaxyState(s,{type:'SET_FAN_SCROLL',top:42});
  s=reduceHybridGalaxyState(s,{type:'OPEN_READER',id:'power-item'});
  s=reduceHybridGalaxyState(s,{type:'CLOSE_READER'});
  assert.equal(s.focusedNodeId,'power-chain');assert.equal(s.fanScrollTop,42);assert.equal(s.readerNodeId,null);
});
test('search resolves exact IDs even when titles collide',()=>{
  const nodes=[{id:'old',title:'同名'},{id:'d',kind:'architecture_dimension',title:'同名'},{id:'chain',primaryParentId:'d'},{id:'item',primaryParentId:'chain'}];
  assert.deepEqual(resolveSearchFocus(nodes,'item'),{dimensionId:'d',focusedNodeId:'chain',nodeId:'item'});
  assert.deepEqual(resolveSearchFocus(nodes,'d'),{dimensionId:'d',focusedNodeId:null,nodeId:'d'});
  assert.equal(resolveSearchFocus(nodes,'old'),null);
});
test('search focuses a dimension and node atomically while pausing motion',()=>{
  const old=createHybridGalaxyState();
  const s=reduceHybridGalaxyState(old,{type:'SET_SEARCH',dimensionId:'d',nodeId:'n',matches:['n']});
  assert.equal(s.activeDimensionId,'d');assert.equal(s.focusedNodeId,'n');assert.deepEqual(s.searchMatches,['n']);assert.equal(s.motionEnabled,false);assert.notEqual(s,old);
});
