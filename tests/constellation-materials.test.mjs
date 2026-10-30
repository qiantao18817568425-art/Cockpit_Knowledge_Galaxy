import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {VISUAL_CONFIG} from '../docs/visual-config.js';
import {createEdgeBatches,createNodeCloud,edgeVisual,nodeVisual,relationClass} from '../docs/constellation-materials.js';

test('visual language reserves champagne gold for active paths and avoids large planets',()=>{
  const normal=nodeVisual({kind:'architecture_dimension'},{selected:false,hovered:false,mode:'home',depth:0});
  const selected=nodeVisual({kind:'architecture_dimension'},{selected:true,hovered:false,mode:'home',depth:0});
  assert.notEqual(normal.color,VISUAL_CONFIG.activeGold);
  assert.equal(selected.color,VISUAL_CONFIG.activeGold);
  assert.ok(VISUAL_CONFIG.maxPrimaryNodePixels<=14);
  assert.ok(VISUAL_CONFIG.background.startsWith('#0')||VISUAL_CONFIG.background==='#000');
});

test('edge styles separate hierarchy and five technical path classes',()=>{
  assert.equal(relationClass({type:'hierarchy'}),'hierarchy');
  assert.equal(relationClass({type:'secondary_membership'}),'hierarchy-secondary');
  assert.equal(relationClass({type:'primary_contains',pathClass:'hierarchy'}),'hierarchy');
  assert.equal(relationClass({type:'secondary_contains',pathClass:'hierarchy-secondary'}),'hierarchy-secondary');
  for(const pathClass of ['control','data','power','state','diagnostic'])assert.equal(relationClass({pathClass}),pathClass);
  const inactive=edgeVisual({pathClass:'data'},{active:false,relationMode:'technical'});
  const active=edgeVisual({pathClass:'data'},{active:true,relationMode:'technical'});
  assert.ok(active.opacity>inactive.opacity);
  assert.equal(active.color,VISUAL_CONFIG.activeGold);
});

test('static edge batches stay within the seven approved visual classes',()=>{
  class Geometry{setAttribute(name,value){this[name]=value;return this}}
  class Attribute{constructor(values,size){this.values=values;this.size=size}}
  class Material{constructor(options){this.options=options}}
  class Segments{constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={}}}
  const THREE={BufferGeometry:Geometry,Float32BufferAttribute:Attribute,LineBasicMaterial:Material,LineSegments:Segments};
  const classes=['hierarchy','hierarchy-secondary','control','data','power','state','diagnostic'];
  const edges=classes.flatMap((name,index)=>Array.from({length:300},(_,edgeIndex)=>({from:`a-${index}-${edgeIndex}`,to:`b-${index}-${edgeIndex}`,type:name,pathClass:['control','data','power','state','diagnostic'].includes(name)?name:undefined})));
  const positions=new Map();
  for(const edge of edges){positions.set(edge.from,{x:0,y:0,z:0});positions.set(edge.to,{x:1,y:1,z:1})}
  const batches=createEdgeBatches(THREE,edges,positions);
  assert.ok(batches.size<=7);
  assert.deepEqual([...batches.keys()].sort(),classes.sort());
});

test('vendored Three.js module and MIT license are present locally',async()=>{
  const module=await readFile(new URL('../docs/vendor/three/three.module.min.js',import.meta.url),'utf8').catch(()=> '');
  const core=await readFile(new URL('../docs/vendor/three/three.core.min.js',import.meta.url),'utf8').catch(()=> '');
  const license=await readFile(new URL('../docs/vendor/three/LICENSE',import.meta.url),'utf8').catch(()=> '');
  assert.ok(module.length>300000);
  assert.match(module,/REVISION/);
  assert.ok(core.length>300000);
  assert.match(core,/ShaderMaterial/);
  assert.match(license,/MIT License/i);
});

test('real Three.js node cloud uses per-node shader sizes for hover emphasis',async()=>{
  const THREE=await import('../docs/vendor/three/three.module.min.js');
  const nodes=[{id:'normal',kind:'component'},{id:'hovered',kind:'component'}];
  const positions=new Map([['normal',{x:0,y:0,z:0}],['hovered',{x:1,y:1,z:1}]]);
  const visuals=new Map(nodes.map(node=>[node.id,nodeVisual(node,{hovered:node.id==='hovered'})]));
  const cloud=createNodeCloud(THREE,nodes,positions,visuals);
  assert.equal(cloud.material.isShaderMaterial,true);
  assert.deepEqual([...cloud.geometry.getAttribute('size').array],[4,7]);
});

