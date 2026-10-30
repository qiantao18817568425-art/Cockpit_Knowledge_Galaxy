import test from 'node:test';
import assert from 'node:assert/strict';
import {createGalaxyScene} from '../docs/galaxy-3d.js';

function fakes(){
  const listeners=new Map();
  const canvas={
    addEventListener:(name,handler)=>listeners.set(name,handler),
    removeEventListener:(name)=>listeners.delete(name),
    getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),
    dispatch(name,event={preventDefault(){}}){listeners.get(name)?.(event)}
  };
  const scheduler={active:new Set(),request(fn){this.active.add(fn);return fn},cancel(fn){this.active.delete(fn)}};
  class Object3D{constructor(){this.children=[];this.position={set(){}};this.rotation={y:0};this.userData={}} add(...items){this.children.push(...items)} remove(...items){this.children=this.children.filter(item=>!items.includes(item))}}
  class Renderer{setPixelRatio(value){this.pixelRatio=value} setSize(w,h){this.size=[w,h]} render(){} dispose(){this.disposed=true}}
  class Camera{constructor(){this.position={set(){}};this.aspect=1} lookAt(){} updateProjectionMatrix(){}}
  class Raycaster{constructor(){this.params={Points:{}}} setFromCamera(){} intersectObject(){return[]}}
  const THREE={
    Scene:Object3D,Group:Object3D,PerspectiveCamera:Camera,WebGLRenderer:Renderer,Raycaster,
    Vector2:class{set(x,y){this.x=x;this.y=y}},Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z}},AmbientLight:Object3D,
    BufferGeometry:class{setAttribute(){return this} setFromPoints(){return this}},Float32BufferAttribute:class{},
    PointsMaterial:class{},Points:Object3D,LineBasicMaterial:class{},LineSegments:Object3D,
    Color:class{constructor(){this.r=1;this.g=1;this.b=1}},
    CubicBezierCurve3:class{getPoints(){return[]}},Line:Object3D,
    AdditiveBlending:1,NormalBlending:2
  };
  return{canvas,scheduler,THREE};
}

test('context loss stops frames and preserves selected node for fallback',()=>{
  const {canvas,scheduler,THREE}=fakes();
  const calls=[];
  const scene=createGalaxyScene({THREE,canvas,graph:{nodes:[],edges:[]},onContextLost:value=>calls.push(value),frameScheduler:scheduler});
  scene.setState({mode:'home',selectedId:'chain:power',relationMode:'hierarchy'});
  canvas.dispatch('webglcontextlost');
  assert.equal(scheduler.active.size,0);
  assert.deepEqual(calls,[{selectedId:'chain:power'}]);
});

test('controller caps DPR, supports reduced motion and disposes idempotently',()=>{
  const {canvas,scheduler,THREE}=fakes();
  const scene=createGalaxyScene({THREE,canvas,graph:{nodes:[],edges:[]},reducedMotion:true,frameScheduler:scheduler});
  scene.resize({width:900,height:600,dpr:3});
  assert.equal(scene.inspect().pixelRatio,1.5);
  assert.equal(scene.inspect().cruising,false);
  assert.equal(scene.inspect().rayThreshold>0,true);
  assert.equal(scene.zoomBy(1.2)<1050,true);
  assert.equal(scene.setCruising(true),false);
  scene.dispose();
  scene.dispose();
  assert.equal(scene.inspect().disposed,true);
});

test('drill mode keeps fan camera-facing and home restores rotation',()=>{
  const {canvas,scheduler,THREE}=fakes();
  const graph={nodes:[{id:'root',kind:'root'},{id:'d',kind:'architecture_dimension',primaryParentId:'root'},{id:'c',kind:'architecture_chain',hierarchyLevel:2,primaryParentId:'d'}],edges:[]};
  const scene=createGalaxyScene({THREE,canvas,graph,frameScheduler:scheduler});
  scene.setState({mode:'drill',selectedId:'d',relationMode:'hierarchy',expandedGroupIds:new Set()});
  assert.equal(scene.inspect().fanCameraFacing,true);
  canvas.dispatch('pointerdown',{clientX:20,clientY:20,pointerId:1});
  canvas.dispatch('pointermove',{clientX:180,clientY:120});
  assert.deepEqual(scene.inspect().worldRotation,{x:0,y:0});
  scene.setState({mode:'home',selectedId:null,relationMode:'hierarchy',expandedGroupIds:new Set()});
  assert.equal(scene.inspect().cruising,true);
  scene.dispose();
});
