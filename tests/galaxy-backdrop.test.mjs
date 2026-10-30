import test from 'node:test';
import assert from 'node:assert/strict';
import {createGalaxyBackdrop} from '../docs/galaxy-backdrop.js';
test('backdrop is deterministic, non-semantic and disposes safely',()=>{
  const scene={objects:[],add(value){this.objects.push(value)},remove(value){this.objects=this.objects.filter(x=>x!==value)}};
  class Group{constructor(){this.children=[];this.rotation={z:0}}add(value){this.children.push(value)}}
  class Geometry{setAttribute(){return this}dispose(){}}
  class Material{dispose(){}}
  class Points{constructor(geometry,material){this.geometry=geometry;this.material=material}}
  const THREE={Group,BufferGeometry:Geometry,Float32BufferAttribute:class{},PointsMaterial:Material,Points};
  const controller=createGalaxyBackdrop({THREE,scene,reducedMotion:true,seed:7});
  assert.equal(controller.inspect().dustCount,360);
  assert.equal(controller.inspect().containsKnowledgeEdges,false);
  controller.setPhase(1);assert.equal(controller.inspect().phase,0);
  controller.dispose();controller.dispose();assert.equal(scene.objects.length,0);
});
