import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../docs/vendor/three/three.module.min.js';
import {buildStarmapLayout,hierarchyRoute} from '../docs/space-scene.js';
const {buildRenderableStarmap,buildAtmosphericFilaments,createStarmapScene}=await import('../docs/starmap-webgl.js').catch(()=>({}));

const graph=JSON.parse(readFileSync(new URL('../docs/graph.json',import.meta.url),'utf8'));

test('WebGL scene model uses the current graph layout and only actual relation edges',()=>{
  assert.equal(typeof buildRenderableStarmap,'function');
  const model=buildRenderableStarmap(graph,{});
  assert.equal(model.positions.size,graph.nodes.length);
  assert.equal(model.visibleIds.size,181);
  assert.ok(model.backgroundIds.size>100);
  const actual=new Set(graph.edges.map(edge=>`${edge.from}|${edge.to}`));
  assert.ok(model.edges.length>100);
  assert.ok(model.edges.every(edge=>actual.has(`${edge.from}|${edge.to}`)));
});

test('overview highlights the real MCU to power to HMI route',()=>{
  const model=buildRenderableStarmap(graph,{});
  assert.deepEqual(model.routeIds,[
    'architecture:mcu-soc','architecture:power','architecture:android-hmi-display'
  ]);
  assert.deepEqual(model.routeEdges,[
    ['architecture:mcu-soc','architecture:power'],
    ['architecture:power','architecture:android-hmi-display']
  ]);
  for(const [from,to] of model.routeEdges)assert.ok(graph.edges.some(edge=>edge.from===from&&edge.to===to),`${from} → ${to} must be a published relation`);
  assert.equal(buildRenderableStarmap(graph,{pathClasses:['data']}).routeEdges.length,0);
});

test('ambient star filaments are dense, deterministic and never semantic nodes',()=>{
  assert.equal(typeof buildAtmosphericFilaments,'function');
  const layout=buildStarmapLayout(graph);
  const first=buildAtmosphericFilaments(graph,layout);
  const second=buildAtmosphericFilaments(graph,layout);
  assert.ok(first.points.length>=4200);
  assert.ok(first.segments.length>=7500);
  assert.ok(first.points.some(point=>point.y>450),'far canopy should reach the top of the frame');
  assert.ok(first.points.some(point=>point.y< -450),'foreground network should reach the bottom of the frame');
  assert.deepEqual(first.points.slice(0,12),second.points.slice(0,12));
  assert.deepEqual(first.segments.slice(0,12),second.segments.slice(0,12));
  const semanticIds=new Set(graph.nodes.map(node=>node.id));
  assert.ok(first.points.every(point=>!semanticIds.has(point.id)));
  assert.ok(first.points.every(point=>[point.x,point.y,point.z,point.size,point.alpha].every(Number.isFinite)));
  assert.ok(first.segments.every(([from,to])=>from>=0&&to>=0&&from<first.points.length&&to<first.points.length&&from!==to));
});

test('hover and filter updates can reuse one stable 3D layout',()=>{
  const positions=buildStarmapLayout(graph);
  const first=buildRenderableStarmap(graph,{positions});
  const second=buildRenderableStarmap(graph,{positions,hoveredId:'root',pathClasses:['power']});
  assert.equal(first.positions,positions);
  assert.equal(second.positions,positions);
});

test('WebGL scene model filters nodes and draws only contiguous real parent routes',()=>{
  assert.equal(typeof buildRenderableStarmap,'function');
  const selected=graph.nodes.find(node=>node.id==='subtopic:power:inputs');
  const model=buildRenderableStarmap(graph,{selectedId:selected.id,zoom:1.6,hiddenKinds:['lesson'],pathClasses:['power']});
  assert.ok(model.visibleIds.has(selected.id));
  assert.equal(model.routeEdges.length,hierarchyRoute(graph,selected.id).length-1,'the selected knowledge path should remain complete under a technical filter');
  assert.ok(model.routeEdges.every(([from,to])=>graph.edges.some(edge=>edge.from===from&&edge.to===to&&edge.pathClass==='hierarchy')));
  assert.ok(model.edges.every(edge=>edge.pathClass==='power'||edge.pathClass==='hierarchy'));
  assert.ok([...model.visibleIds].every(id=>graph.nodes.find(node=>node.id===id)?.kind!=='lesson'));
});

test('WebGL renderer stops after context loss and preserves selection for fallback',()=>{
  assert.equal(typeof createStarmapScene,'function');
  const listeners=new Map();
  const canvas={
    addEventListener:(name,handler)=>listeners.set(name,handler),
    removeEventListener:name=>listeners.delete(name),
    getBoundingClientRect:()=>({left:0,top:0,width:1400,height:900}),
    setPointerCapture(){}
  };
  const scheduler={active:new Set(),request(fn){this.active.add(fn);return fn},cancel(fn){this.active.delete(fn)}};
  const renderer={setPixelRatio(){},setSize(){},render(){},dispose(){this.disposed=true}};
  const lost=[];
  const scene=createStarmapScene({THREE,canvas,graph,reducedMotion:true,rendererFactory:()=>renderer,frameScheduler:scheduler,onContextLost:value=>lost.push(value)});
  assert.ok(scene.inspect().ambientPoints>=1800);
  assert.ok(scene.inspect().ambientSegments>=2600);
  assert.equal(scene.inspect().interactiveCount,buildRenderableStarmap(graph,{}).visibleIds.size);
  scene.resize({width:1400,height:900,dpr:3});
  scene.setState({selectedId:graph.nodes.find(node=>node.kind==='architecture_dimension').id});
  assert.equal(scene.inspect().pixelRatio,1.6);
  assert.equal(scene.inspect().cruising,false);
  const frame=[...scheduler.active][0];scheduler.active.delete(frame);frame(1000);
  assert.ok(scene.inspect().focus);
  assert.deepEqual(scene.inspect().focus,scene.inspect().focusTarget,'reduced-motion focus should finish in the first frame');
  listeners.get('webglcontextlost')({preventDefault(){}});
  assert.equal(scheduler.active.size,0);
  assert.equal(lost[0].selectedId,scene.inspect().selectedId);
  scene.dispose();
  assert.equal(renderer.disposed,true);
});

test('WebGL scene pauses scheduled rendering while its page is hidden',()=>{
  const listeners=new Map();
  const canvas={addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1400,height:900})};
  const visibility={hidden:false,addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:name=>listeners.delete(name)};
  const scheduler={active:new Set(),request(fn){this.active.add(fn);return fn},cancel(fn){this.active.delete(fn)}};
  const renderer={setPixelRatio(){},setSize(){},render(){},dispose(){}};
  const scene=createStarmapScene({THREE,canvas,graph,visibilitySource:visibility,rendererFactory:()=>renderer,frameScheduler:scheduler});
  assert.equal(scheduler.active.size,1);
  visibility.hidden=true;listeners.get('visibilitychange')();
  assert.equal(scheduler.active.size,0);
  visibility.hidden=false;listeners.get('visibilitychange')();
  assert.equal(scheduler.active.size,1);
  scene.dispose();
});

test('cancelling a pointer gesture does not clear the current knowledge selection',()=>{
  const listeners=new Map(),selected=[];
  const canvas={addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1400,height:900})};
  const renderer={setPixelRatio(){},setSize(){},render(){},dispose(){}};
  const scheduler={request:()=>1,cancel(){}};
  const scene=createStarmapScene({THREE,canvas,graph,reducedMotion:true,rendererFactory:()=>renderer,frameScheduler:scheduler,onSelect:id=>selected.push(id)});
  listeners.get('pointerdown')({clientX:320,clientY:250,pointerId:1});
  listeners.get('pointercancel')({clientX:320,clientY:250,pointerId:1});
  assert.deepEqual(selected,[]);
  scene.dispose();
});

test('paused idle WebGL scene stops scheduling frames and wakes for zoom',()=>{
  const listeners=new Map();
  const canvas={addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1400,height:900})};
  const scheduler={active:new Set(),request(fn){this.active.add(fn);return fn},cancel(fn){this.active.delete(fn)}};
  const renderer={setPixelRatio(){},setSize(){},render(){},dispose(){}};
  const scene=createStarmapScene({THREE,canvas,graph,rendererFactory:()=>renderer,frameScheduler:scheduler});
  scene.setCruising(false);
  for(let index=0;index<240&&scheduler.active.size;index++){
    const frame=[...scheduler.active][0];scheduler.active.delete(frame);frame(1000+index*16);
  }
  assert.equal(scheduler.active.size,0,'a static paused map should let the GPU rest');
  listeners.get('pointerleave')();
  assert.equal(scheduler.active.size,1,'pointer leave should restore the neutral camera even when paused');
  const restore=[...scheduler.active][0];scheduler.active.delete(restore);restore(6000);
  scene.zoomBy(1.2);
  assert.equal(scheduler.active.size,1);
  scene.dispose();
});
