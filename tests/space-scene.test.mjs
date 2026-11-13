import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildArchitectureLayout,
  buildStarmapLayout,
  buildStarmapView,
  clampLabelX,
  depthLabelStyle,
  drillVisibleNodeIds,
  edgeVisualStyle,
  fibonacciSpherePoint,
  fitLabelSize,
  frontLabelLimit,
  homeVisibleNodeIds,
  hierarchyRoute,
  introStarmapPose,
  isProjectedVisible,
  orbitPose,
  releaseVelocity,
  routeLightProgress,
  selectFrontLabelIds,
  starPulse,
  starmapBackgroundIds,
  starmapOverviewIds,
  starmapParallax,
  visibleLabelIds,
} from '../docs/space-scene.js';

test('starmap places 17 irregular regions and keeps descendants near their parent',()=>{
  const dimensions=Array.from({length:17},(_,index)=>({id:`region-${index}`,kind:'architecture_dimension',hierarchyLevel:1,primaryParentId:'root',hierarchyOrder:index}));
  const graph={nodes:[{id:'root',kind:'root',hierarchyLevel:0},...dimensions,{id:'chain',kind:'architecture_chain',hierarchyLevel:2,primaryParentId:'region-8'},{id:'detail',kind:'component',hierarchyLevel:3,primaryParentId:'chain'}]};
  const first=buildStarmapLayout(graph),second=buildStarmapLayout(graph);
  assert.deepEqual(first,second);
  const anchors=dimensions.map(node=>first.get(node.id));
  assert.equal(new Set(anchors.map(point=>`${point.x}:${point.y}:${point.z}`)).size,17);
  assert.ok(anchors.filter(point=>Math.abs(point.x)<350&&Math.abs(point.y)<230).length>=6);
  assert.ok(new Set(anchors.map(point=>Math.round(Math.hypot(point.x,point.y,point.z)/50))).size>3,'regions should not sit on one shell');
  const chain=first.get('chain'),parent=first.get('region-8'),detail=first.get('detail');
  assert.ok(Math.hypot(chain.x-parent.x,chain.y-parent.y,chain.z-parent.z)<140);
  assert.ok(Math.hypot(detail.x-chain.x,detail.y-chain.y,detail.z-chain.z)<90);
});

test('semantic zoom reveals navigation stars without exposing source or evidence by default',()=>{
  const graph={nodes:[
    {id:'root',kind:'root'},{id:'region',kind:'architecture_dimension'},
    {id:'component',kind:'component'},{id:'topic',kind:'topic',navigationOnly:true},
    {id:'lesson',kind:'lesson',navigationOnly:true},{id:'source',kind:'source'},
    {id:'evidence',kind:'evidence'}
  ]};
  assert.deepEqual([...starmapOverviewIds(graph,{zoom:1})].sort(),['component','region','root']);
  assert.equal(starmapOverviewIds(graph,{zoom:1.5}).has('topic'),true);
  assert.equal(starmapOverviewIds(graph,{zoom:1.5}).has('lesson'),false);
  assert.equal(starmapOverviewIds(graph,{zoom:1.9}).has('lesson'),true);
  assert.equal(starmapOverviewIds(graph,{zoom:2}).has('source'),false);
  assert.equal(starmapOverviewIds(graph,{zoom:2}).has('evidence'),false);
  assert.deepEqual([...starmapBackgroundIds(graph,{zoom:1})].sort(),['lesson','topic']);
  assert.deepEqual([...starmapBackgroundIds(graph,{zoom:1.5})],['lesson']);
  assert.equal(starmapBackgroundIds(graph,{zoom:1.9}).size,0);
});

test('selected route follows real parents and safely stops at missing or cyclic parents',()=>{
  const graph={nodes:[{id:'root'},{id:'region',primaryParentId:'root'},{id:'chain',primaryParentId:'region'},{id:'orphan',primaryParentId:'missing'},{id:'a',primaryParentId:'b'},{id:'b',primaryParentId:'a'}]};
  assert.deepEqual(hierarchyRoute(graph,'chain'),['root','region','chain']);
  assert.deepEqual(hierarchyRoute(graph,'orphan'),['orphan']);
  assert.deepEqual(hierarchyRoute(graph,'missing'),[]);
  assert.ok(hierarchyRoute(graph,'a').length<=2);
});

test('camera entrance and route pulse are bounded and honor reduced motion',()=>{
  assert.deepEqual(introStarmapPose(1,{reducedMotion:true}),introStarmapPose(1));
  assert.ok(introStarmapPose(0).zoom<introStarmapPose(1).zoom);
  assert.ok(introStarmapPose(.5).zoom>introStarmapPose(0).zoom);
  assert.deepEqual(routeLightProgress(0,3),{segment:0,t:0});
  assert.deepEqual(routeLightProgress(1200,3,{durationMs:2400}),{segment:1,t:0});
  assert.equal(routeLightProgress(1000,1),null);
  assert.deepEqual(starmapParallax(1,-1),{x:7,y:-5});
  assert.deepEqual(starmapParallax(99,-99),{x:7,y:-5});
  assert.deepEqual(starmapParallax(1,-1,{reducedMotion:true}),{x:0,y:0});
});

test('starmap view keeps context and highlights only contiguous visible parent links',()=>{
  const graph={nodes:[
    {id:'root',kind:'root'},{id:'region',kind:'architecture_dimension',primaryParentId:'root'},
    {id:'child',kind:'component',primaryParentId:'region'},
    {id:'sibling',kind:'component',primaryParentId:'region'},
    {id:'evidence',kind:'evidence',primaryParentId:'child'}
  ],edges:[{from:'root',to:'region',pathClass:'hierarchy'},{from:'region',to:'child',pathClass:'hierarchy'},{from:'region',to:'sibling',pathClass:'hierarchy'}]};
  const view=buildStarmapView(graph,{selectedId:'child',allowedIds:new Set(['root','child','sibling','evidence']),drillIds:new Set(['child','evidence'])});
  assert.deepEqual([...view.visibleIds].sort(),['child','evidence','root','sibling']);
  assert.deepEqual(view.routeIds,['root','child']);
  assert.deepEqual(view.routeEdges,[],'a filtered-out parent must not be bypassed by a fake line');
  const full=buildStarmapView(graph,{selectedId:'child',allowedIds:new Set(graph.nodes.map(node=>node.id))});
  assert.deepEqual(full.routeEdges,[['root','region'],['region','child']]);
  assert.ok(full.visibleIds.has('sibling'),'other regions remain as spatial context');
  const matched=buildStarmapView(graph,{allowedIds:new Set(['root']),matchingIds:['child'],selectedId:'child'});
  assert.ok(matched.visibleIds.has('child'),'search focus stays visible even if a filter excluded it');
});

test('hovered neighbors light up while the selected hierarchy route remains intact',()=>{
  const graph={nodes:[
    {id:'root',kind:'root'},{id:'selected',kind:'component',primaryParentId:'root'},
    {id:'hovered',kind:'component',primaryParentId:'root'},
    {id:'neighbor',kind:'component',primaryParentId:'root'}
  ],edges:[{from:'hovered',to:'neighbor',pathClass:'data'}]};
  const view=buildStarmapView(graph,{selectedId:'selected',hoveredId:'hovered'});
  assert.deepEqual(view.routeIds,['root','selected']);
  assert.ok(view.emphasisIds.has('neighbor'));
});

const drillGraph={nodes:[
  {id:'root',kind:'root',hierarchyLevel:0},
  {id:'l1-a',kind:'pyramid',primaryParentId:'root',hierarchyLevel:1},
  {id:'l1-b',kind:'pyramid',primaryParentId:'root',hierarchyLevel:1},
  {id:'domain',kind:'domain',primaryParentId:'l1-a',hierarchyLevel:2},
  {id:'selected',kind:'component',primaryParentId:'domain',hierarchyLevel:3},
  {id:'child-a',kind:'interface',primaryParentId:'selected',hierarchyLevel:4},
  {id:'child-b',kind:'observation',primaryParentId:'selected',hierarchyLevel:4},
  {id:'neighbor-a',kind:'component',primaryParentId:'domain',hierarchyLevel:3},
  {id:'neighbor-b',kind:'component',primaryParentId:'domain',hierarchyLevel:3},
  {id:'ev',kind:'evidence',primaryParentId:'source',hierarchyLevel:5},
  {id:'ev-sibling',kind:'evidence',primaryParentId:'source',hierarchyLevel:5},
  {id:'source',kind:'source',primaryParentId:'l1-b',hierarchyLevel:4}
],edges:[
  {from:'selected',to:'neighbor-a',type:'depends_on',pathClass:'control'},
  {from:'selected',to:'neighbor-b',type:'carries_data_to',pathClass:'data'},
  {from:'selected',to:'ev',type:'supported_by',pathClass:'diagnostic'},
  {from:'ev',to:'source',type:'supported_by',pathClass:'diagnostic'},
  {from:'ev-sibling',to:'source',type:'supported_by',pathClass:'diagnostic'}
]};

test('home visibility includes L1 L2 and every L3 star while keeping deeper content hidden',()=>{
  const home=homeVisibleNodeIds(drillGraph);
  assert.deepEqual([...home].sort(),['domain','l1-a','l1-b','root'].sort());
  assert.equal(home.has('selected'),false);
  assert.equal(home.has('source'),false);
  assert.deepEqual([...drillVisibleNodeIds(drillGraph,{selectedId:null})].sort(),[...home].sort());
});

test('drill visibility focuses ancestors children and capped technical neighbors',()=>{
  const focused=drillVisibleNodeIds(drillGraph,{selectedId:'selected',technicalNeighborLimit:1});
  for(const id of ['root','l1-a','domain','selected','child-a','child-b'])assert.ok(focused.has(id),id);
  assert.equal(['neighbor-a','neighbor-b'].filter(id=>focused.has(id)).length,1);
  assert.equal(focused.has('ev'),false);
  const withEvidence=drillVisibleNodeIds(drillGraph,{selectedId:'selected',evidenceVisible:true});
  assert.ok(withEvidence.has('ev'));
  assert.ok(withEvidence.has('source'));
  assert.equal(withEvidence.has('ev-sibling'),false);
});

test('home labels keep L3 hidden until interaction explicitly reveals it',()=>{
  const candidates=[
    {id:'root',kind:'root',hierarchyLevel:0,depth:0,onScreen:true},
    {id:'l2',kind:'architecture_dimension',hierarchyLevel:1,depth:100,onScreen:true},
    {id:'l3-front',kind:'architecture_chain',hierarchyLevel:2,depth:500,onScreen:true},
    {id:'l3-hover',kind:'architecture_chain',hierarchyLevel:2,depth:-200,onScreen:true},
    {id:'l4',kind:'component',hierarchyLevel:3,depth:600,onScreen:true}
  ];
  assert.deepEqual([...visibleLabelIds(candidates,{mode:'home'})].sort(),['l2','root']);
  assert.deepEqual([...visibleLabelIds(candidates,{mode:'home',hoveredId:'l3-hover'})].sort(),['l2','l3-hover','root']);
  assert.deepEqual([...visibleLabelIds(candidates,{mode:'home',matchingIds:['l3-front']})].sort(),['l2','l3-front','root']);
  assert.deepEqual([...visibleLabelIds(candidates,{mode:'home',selectedId:'l3-front',currentChainIds:['l3-hover']})].sort(),['l2','l3-front','l3-hover','root']);
  assert.equal(visibleLabelIds(candidates,{mode:'home'}).has('l3-hover'),false);
});

test('overview can cap region labels without hiding the focused route',()=>{
  const candidates=[
    {id:'root',kind:'root',hierarchyLevel:0,depth:0,onScreen:true},
    {id:'back',kind:'architecture_dimension',hierarchyLevel:1,depth:-200,onScreen:true},
    {id:'front',kind:'architecture_dimension',hierarchyLevel:1,depth:200,onScreen:true},
    {id:'middle',kind:'architecture_dimension',hierarchyLevel:1,depth:20,onScreen:true}
  ];
  assert.deepEqual([...visibleLabelIds(candidates,{mode:'home',homeLimit:2})].sort(),['front','middle','root']);
  assert.ok(visibleLabelIds(candidates,{mode:'home',homeLimit:2,selectedId:'back'}).has('back'));
});

test('label density stays sparse across desktop and mobile views',()=>{
  assert.equal(frontLabelLimit(1600),16);
  assert.equal(frontLabelLimit(1000),12);
  assert.equal(frontLabelLimit(390),6);
});

test('rotation labels only the nearest front-facing nodes plus forced interaction targets',()=>{
  const ids=selectFrontLabelIds([
    {id:'root',kind:'root',depth:0,onScreen:true},
    {id:'near-a',kind:'component',depth:420,onScreen:true},
    {id:'near-b',kind:'topic',depth:310,onScreen:true},
    {id:'middle',kind:'component',depth:80,onScreen:true},
    {id:'back',kind:'topic',depth:-220,onScreen:true},
    {id:'hovered-back',kind:'component',depth:-300,onScreen:true,forced:true},
    {id:'offscreen',kind:'topic',depth:500,onScreen:false},
  ],{limit:2,minDepth:40});
  assert.deepEqual([...ids].sort(),['hovered-back','near-a','near-b','root'].sort());
});

test('forced interaction labels stay capped and honor priority',()=>{
  const ids=selectFrontLabelIds([
    {id:'root',kind:'root',depth:0,onScreen:true},
    {id:'selected',kind:'platform',depth:-300,onScreen:true,forced:true,forcePriority:100},
    {id:'hovered',kind:'component',depth:-260,onScreen:true,forced:true,forcePriority:90},
    {id:'match-a',kind:'component',depth:80,onScreen:true,forced:true,forcePriority:60},
    {id:'match-b',kind:'component',depth:70,onScreen:true,forced:true,forcePriority:60},
  ],{limit:0,minDepth:40,forcedLimit:2});
  assert.deepEqual([...ids].sort(),['hovered','root','selected'].sort());
});

test('reduced motion disables star pulsing',()=>{
  assert.equal(starPulse(1000,.3,true),1);
  assert.notEqual(starPulse(1000,.3,false),starPulse(1600,.3,false));
});

test('only on-screen projected nodes receive labels',()=>{
  assert.equal(isProjectedVisible({x:100,y:100,radius:8,width:375,height:667}),true);
  assert.equal(isProjectedVisible({x:-30,y:100,radius:8,width:375,height:667}),false);
  assert.equal(isProjectedVisible({x:390,y:100,radius:8,width:375,height:667}),false);
});

test('long mobile labels shrink to the available width',()=>{
  assert.equal(fitLabelSize({size:12,textWidth:443,availableWidth:359}),9.72);
  assert.equal(fitLabelSize({size:10,textWidth:100,availableWidth:359}),10);
});

test('release inertia expires after the pointer pauses',()=>{
  assert.equal(releaseVelocity(.003,35),.003);
  assert.equal(releaseVelocity(.003,140),0);
});

test('labels at the screen edge are clamped into view instead of disappearing',()=>{
  assert.equal(clampLabelX(-42,120,800),8);
  assert.equal(clampLabelX(760,120,800),672);
  assert.equal(clampLabelX(300,120,800),300);
});

test('fibonacci sphere distributes every topic on a deterministic 3D shell',()=>{
  const points=Array.from({length:12},(_,index)=>fibonacciSpherePoint(index,12,330));
  assert.equal(points.length,12);
  for(const point of points){
    const radius=Math.hypot(point.x,point.y,point.z);
    assert.ok(Math.abs(radius-330)<1e-6);
  }
  assert.equal(new Set(points.map(point=>`${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`)).size,12);
});

test('front labels use depth to change prominence',()=>{
  const near=depthLabelStyle({depth:420,perspective:1.45,kind:'component',active:false});
  const far=depthLabelStyle({depth:-430,perspective:.68,kind:'component',active:false});
  assert.equal(near.visible,true);
  assert.equal(far.visible,true);
  assert.ok(near.alpha>far.alpha);
  assert.ok(near.size>far.size);
  assert.ok(far.alpha>=.2);
  assert.ok(far.size>=7);
});

test('desktop starmap region labels stay readable while detail labels remain smaller',()=>{
  const region=depthLabelStyle({depth:80,perspective:1,kind:'architecture_dimension'});
  const detail=depthLabelStyle({depth:80,perspective:1,kind:'component'});
  assert.ok(region.size>=12);
  assert.ok(region.size>detail.size);
});

test('idle orbit advances yaw and adds a gentle three-axis camera drift',()=>{
  const start=orbitPose({yaw:.2,pitch:-.18,roll:0},1000,16);
  const later=orbitPose(start,4000,16);
  assert.ok(later.yaw>start.yaw);
  assert.notEqual(later.pitch,start.pitch);
  assert.notEqual(later.roll,start.roll);
  assert.ok(Math.abs(later.roll)<.08);
});

test('architecture layout creates one deterministic cluster per L2 center',()=>{
  const dimensions=Array.from({length:17},(_,index)=>({id:`l2-${index}`,title:`L2 ${index}`,kind:'architecture_dimension',primaryParentId:'root',hierarchyLevel:1,hierarchyOrder:(index+1)*10}));
  const graph={nodes:[
    {id:'root',title:'智能座舱',kind:'root',hierarchyLevel:0},...dimensions,
    {id:'shared',title:'共享三级',kind:'architecture_chain',primaryParentId:'l2-3',secondaryParentIds:['l2-7','l2-11'],hierarchyLevel:2,hierarchyOrder:10},
    {id:'l4',title:'四级阶段',kind:'component',primaryParentId:'shared',hierarchyLevel:3,hierarchyOrder:10}
  ]};
  const first=buildArchitectureLayout(graph,{l2Radius:330,l3Radius:92,l4Spacing:58});
  const second=buildArchitectureLayout(graph,{l2Radius:330,l3Radius:92,l4Spacing:58});
  assert.deepEqual(first,second);
  assert.deepEqual(first.get('root'),{x:0,y:0,z:0});
  assert.equal(new Set(dimensions.map(item=>JSON.stringify(first.get(item.id)))).size,17);
  for(const item of dimensions)assert.ok(Math.abs(Math.hypot(...Object.values(first.get(item.id)))-330)<1e-6,item.id);
  const primary=first.get('l2-3'),shared=first.get('shared');
  assert.ok(Math.hypot(shared.x-primary.x,shared.y-primary.y,shared.z-primary.z)<Math.hypot(shared.x,shared.y,shared.z));
  const withoutSecondary=buildArchitectureLayout({nodes:graph.nodes.map(item=>item.id==='shared'?{...item,secondaryParentIds:[]}:item)},{l2Radius:330,l3Radius:92,l4Spacing:58});
  assert.deepEqual(first.get('shared'),withoutSecondary.get('shared'));
});

test('secondary membership edges are quieter than primary hierarchy edges',()=>{
  const primary=edgeVisualStyle({type:'primary_contains',pathClass:'hierarchy'});
  const secondary=edgeVisualStyle({type:'secondary_contains',pathClass:'hierarchy-secondary'});
  assert.ok(secondary.width<primary.width);
  assert.ok(secondary.alpha<primary.alpha);
});
