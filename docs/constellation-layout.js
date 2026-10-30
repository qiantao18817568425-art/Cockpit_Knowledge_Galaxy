import {createGalaxyState,selectDepthVisibility} from './galaxy-state.js?v=20261028-three1';

const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));

export function seedFromId(id=''){
  let hash=2166136261;
  for(const character of String(id)){
    hash^=character.codePointAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function ordered(nodes=[]){
  return [...nodes].sort((a,b)=>(a.hierarchyOrder??Number.MAX_SAFE_INTEGER)-(b.hierarchyOrder??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id));
}

function spherePoint(index,total,radius){
  const y=1-((index+.5)/Math.max(1,total))*2;
  const radial=Math.sqrt(Math.max(0,1-y*y));
  const angle=index*GOLDEN_ANGLE;
  return{x:Math.cos(angle)*radial*radius,y:y*radius,z:Math.sin(angle)*radial*radius};
}

export function buildOverviewLayout(graph,{radius=360,clusterRadius=72}={}){
  const nodes=graph?.nodes||[];
  const map=new Map();
  const root=nodes.find(node=>node.kind==='root');
  if(root)map.set(root.id,{x:0,y:0,z:0,region:'core'});
  const dimensions=ordered(nodes.filter(node=>node.kind==='architecture_dimension'));
  dimensions.forEach((node,index)=>map.set(node.id,{...spherePoint(index,dimensions.length,radius),region:'constellation'}));
  const childrenByParent=new Map();
  for(const node of nodes){
    if(!node.primaryParentId)continue;
    if(!childrenByParent.has(node.primaryParentId))childrenByParent.set(node.primaryParentId,[]);
    childrenByParent.get(node.primaryParentId).push(node);
  }
  for(const dimension of dimensions){
    const center=map.get(dimension.id);
    const children=ordered(childrenByParent.get(dimension.id)||[]).filter(node=>node.kind==='architecture_chain'||node.hierarchyLevel===2);
    const phase=(seedFromId(dimension.id)%6283)/1000;
    children.forEach((node,index)=>{
      const angle=phase+(index/Math.max(1,children.length))*Math.PI*2;
      const wave=(index%3-1)*clusterRadius*.18;
      map.set(node.id,{
        x:center.x+Math.cos(angle)*clusterRadius,
        y:center.y+Math.sin(angle)*clusterRadius*.72,
        z:center.z+wave,
        region:'constellation-node'
      });
    });
  }
  return map;
}

export function buildFanCurve(start,end,index=0,total=1){
  const spread=(index-(Math.max(1,total)-1)/2)/Math.max(1,total);
  return [
    {...start},
    {x:start.x+(end.x-start.x)*.24,y:start.y+spread*54,z:start.z},
    {x:start.x+(end.x-start.x)*.66,y:end.y-spread*34,z:end.z},
    {...end}
  ];
}

export function buildDrillLayout(graph,selectedId,{state=createGalaxyState(),maxListItems=24}={}){
  const visibility=selectDepthVisibility(graph,{...state,selectedId:state.selectedId||selectedId},{maxListItems});
  const selected=graph.nodes.find(node=>node.id===selectedId);
  const positions=new Map();
  positions.set(selectedId,{x:-260,y:0,z:0,region:'focus'});
  const fanItems=visibility.windowItems;
  const height=Math.min(640,Math.max(160,fanItems.length*28));
  fanItems.forEach((item,index)=>{
    const y=fanItems.length===1?0:-height/2+(index/(fanItems.length-1))*height;
    positions.set(item.id,{x:420,y,z:0,region:'fan'});
  });
  const curves=fanItems.map((item,index)=>({id:item.id,points:buildFanCurve({x:-30,y:0,z:0},positions.get(item.id),index,fanItems.length)}));
  return{
    selected,
    positions,
    fanItems,
    listItems:visibility.listItems,
    collapsedGroups:visibility.collapsedGroups,
    requiresScroll:visibility.requiresScroll,
    curves,
    cameraFacingPlane:true
  };
}

export function selectVisibleCards(graph,{selectedId=null,hoveredId=null,frontIds=[]}={},{mobile=false}={}){
  const dimensions=ordered((graph?.nodes||[]).filter(node=>node.kind==='architecture_dimension'));
  const byId=new Map(dimensions.map(node=>[node.id,node]));
  const limit=mobile?3:7;
  const priority=[selectedId,hoveredId,...frontIds].filter(Boolean);
  const ids=[];
  for(const id of priority){
    if(byId.has(id)&&!ids.includes(id))ids.push(id);
    if(ids.length===limit)break;
  }
  return{
    names:dimensions.map(node=>({id:node.id,title:node.title})),
    cards:ids.map(id=>{
      const node=byId.get(id);
      const childCount=graph.nodes.filter(item=>item.primaryParentId===id).length;
      return{id,title:node.title,count:childCount};
    })
  };
}

