import test from 'node:test';
import assert from 'node:assert/strict';
import {fanCurvePath,visibleFanRows} from '../docs/galaxy-fan.js';
test('curves terminate at the visible row anchor and exclude scrolled rows',()=>{
  const rows=[{id:'a',top:-30,bottom:-5},{id:'b',top:12,bottom:36},{id:'c',top:90,bottom:115}];
  assert.deepEqual(visibleFanRows(rows,0,100).map(row=>row.id),['b','c']);
  assert.match(fanCurvePath({x:0,y:50},{x:140,y:24}),/140 24$/);
});
