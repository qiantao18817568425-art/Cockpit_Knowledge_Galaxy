import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildAtlasModel} from '../docs/hybrid-atlas-model.js';
const graph=JSON.parse(readFileSync(new URL('../docs/graph.json',import.meta.url)));
test('atlas is deterministic, independently grouped and uses real nodes',()=>{
  const options={width:1920,height:1080,phase:0};
  const atlas=buildAtlasModel(graph,options);
  assert.deepEqual(atlas,buildAtlasModel(graph,options));
  assert.equal(atlas.activeDimensionId,'architecture:android-hmi-display');
  assert.equal(atlas.constellations.length,17);
  assert.ok(atlas.visibleCardIds.length<=7);
  for(const group of atlas.constellations){
    assert.ok(group.stars.every(star=>graph.nodes.some(node=>node.id===star.nodeId)));
    assert.ok(group.edges.every(edge=>group.stars.some(star=>star.nodeId===edge.from)&&group.stars.some(star=>star.nodeId===edge.to)));
  }
  assert.ok(!('rootEdges' in atlas));
});
test('card count adapts at 1366 and 390 pixels',()=>{
  assert.ok(buildAtlasModel(graph,{width:1366,height:768}).visibleCardIds.length<=5);
  assert.ok(buildAtlasModel(graph,{width:390,height:844}).visibleCardIds.length<=3);
});
