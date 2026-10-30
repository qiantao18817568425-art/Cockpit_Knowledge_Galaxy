export function createHybridGalaxyState(){return{activeDimensionId:'architecture:android-hmi-display',focusedNodeId:null,readerNodeId:null,expandedGroupIds:new Set(),fanScrollTop:0,searchMatches:[],platforms:[],relationMode:'hierarchy',pathClasses:[],motionEnabled:true}}
export function resolveSearchFocus(nodes,id){
  const map=new Map(nodes.map(node=>[node.id,node]));let node=map.get(id);const seen=new Set();let chain=null;
  while(node&&node.kind!=='architecture_dimension'&&!seen.has(node.id)){seen.add(node.id);chain=node;node=map.get(node.primaryParentId)}
  return node?{dimensionId:node.id,focusedNodeId:chain?.id||null,nodeId:id}:null;
}
export function reduceHybridGalaxyState(state,action){
  switch(action.type){
    case 'SELECT_DIMENSION':return{...state,activeDimensionId:action.id,focusedNodeId:null,readerNodeId:null,expandedGroupIds:new Set(),fanScrollTop:0};
    case 'DRILL_NODE':return{...state,focusedNodeId:action.id,readerNodeId:null,expandedGroupIds:new Set(),fanScrollTop:0};
    case 'OPEN_READER':return{...state,readerNodeId:action.id};
    case 'CLOSE_READER':return{...state,readerNodeId:null};
    case 'SET_FAN_SCROLL':return{...state,fanScrollTop:action.top};
    case 'SET_SEARCH':return{...state,activeDimensionId:action.dimensionId,focusedNodeId:action.nodeId,searchMatches:[...(action.matches||[])],readerNodeId:null,fanScrollTop:0,motionEnabled:false};
    case 'SET_FILTERS':return{...state,platforms:[...(action.platforms??state.platforms)],pathClasses:[...(action.pathClasses??state.pathClasses)],relationMode:action.relationMode??state.relationMode};
    case 'TOGGLE_GROUP':{const next=new Set(state.expandedGroupIds);next.has(action.id)?next.delete(action.id):next.add(action.id);return{...state,expandedGroupIds:next}}
    case 'SET_MOTION':return{...state,motionEnabled:Boolean(action.enabled)};
    default:return state;
  }
}
