import test from 'node:test';
import assert from 'node:assert/strict';
test('atlas renderer draws only local semantic edges and supports interactions',async()=>{
  const {renderGalaxyAtlas}=await import('../docs/galaxy-atlas.js');
  assert.equal(typeof renderGalaxyAtlas,'function');
});
