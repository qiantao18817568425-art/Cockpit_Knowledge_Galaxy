function stableNodes(nodes=[]){
  return [...nodes].sort((a,b)=>(a.hierarchyOrder??Number.MAX_SAFE_INTEGER)-(b.hierarchyOrder??Number.MAX_SAFE_INTEGER)||String(a.title||'').localeCompare(String(b.title||''),'zh-CN')||a.id.localeCompare(b.id));
}

export function createGalaxyState({reducedMotion=false}={}){
  return {
    selectedId:null,
    selectedLevel:null,
    relationMode:'hierarchy',
    platforms:[],
    pathClasses:[],
    evidenceVisible:false,
    matchingIds:[],
    expandedGroupIds:new Set(),
    cameraHistory:[],
    cameraTarget:null,
    reducedMotion:Boolean(reducedMotion),
    contextLost:false
  };
}

export function reduceGalaxyState(state,action){
  switch(action?.type){
    case 'SELECT_NODE':
      return {...state,selectedId:action.nodeId??null,selectedLevel:action.hierarchyLevel??null,contextLost:false};
    case 'CLEAR_SELECTION':
      return {...state,selectedId:null,selectedLevel:null,expandedGroupIds:new Set(),cameraTarget:null};
    case 'SET_RELATION_MODE':
      return {...state,relationMode:action.mode==='technical'?'technical':'hierarchy'};
    case 'SET_FILTERS':
      return {...state,platforms:[...(action.platforms||[])],pathClasses:[...(action.pathClasses||[])],evidenceVisible:Boolean(action.evidenceVisible)};
    case 'SET_SEARCH_MATCHES':
      return {...state,matchingIds:[...(action.matchingIds||[])],selectedId:action.focusId??state.selectedId,selectedLevel:action.hierarchyLevel??state.selectedLevel,contextLost:false};
    case 'EXPAND_GROUP':
      if(state.expandedGroupIds.has(action.groupId))return state;
      return {...state,expandedGroupIds:new Set([...state.expandedGroupIds,action.groupId])};
    case 'COLLAPSE_GROUP':{
      const expandedGroupIds=new Set(state.expandedGroupIds);
      expandedGroupIds.delete(action.groupId);
      return {...state,expandedGroupIds};
    }
    case 'PUSH_CAMERA':
      return {...state,cameraHistory:[...state.cameraHistory,action.pose]};
    case 'POP_CAMERA':{
      if(!state.cameraHistory.length)return state;
      const history=[...state.cameraHistory];
      const cameraTarget=history.pop();
      return {...state,cameraHistory:history,cameraTarget};
    }
    case 'CONTEXT_LOST':
      return {...state,contextLost:true};
    default:
      return state;
  }
}

export function selectSceneMode(state){
  if(!state?.selectedId)return 'home';
  return (state.selectedLevel??0)<=1?'drill':'topic';
}

function descendants(childrenByParent,id){
  const result=[];
  const queue=[...(childrenByParent.get(id)||[])];
  while(queue.length){
    const node=queue.shift();
    result.push(node);
    queue.push(...(childrenByParent.get(node.id)||[]));
  }
  return result;
}

export function selectDepthVisibility(graph,state,{maxListItems=24}={}){
  const nodes=graph?.nodes||[];
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const childrenByParent=new Map();
  for(const node of nodes){
    if(!node.primaryParentId)continue;
    if(!childrenByParent.has(node.primaryParentId))childrenByParent.set(node.primaryParentId,[]);
    childrenByParent.get(node.primaryParentId).push(node);
  }
  for(const [id,children] of childrenByParent)childrenByParent.set(id,stableNodes(children));

  const visibleIds=new Set();
  const selected=byId.get(state?.selectedId);
  if(!selected)return{visibleIds,listItems:[],windowItems:[],collapsedGroups:[],requiresScroll:false};

  let cursor=selected;
  while(cursor){
    visibleIds.add(cursor.id);
    cursor=byId.get(cursor.primaryParentId);
  }

  const direct=childrenByParent.get(selected.id)||[];
  for(const node of direct)visibleIds.add(node.id);

  if((selected.hierarchyLevel??0)<=1){
    const listItems=stableNodes(direct);
    const safeMax=Math.max(1,Number(maxListItems)||24);
    return{visibleIds,listItems,windowItems:listItems.slice(0,safeMax),collapsedGroups:[],requiresScroll:listItems.length>safeMax};
  }

  const mainPath=[];
  let main=direct[0];
  while(main){
    mainPath.push(main);
    visibleIds.add(main.id);
    main=(childrenByParent.get(main.id)||[])[0];
  }
  const mainIds=new Set(mainPath.map(node=>node.id));
  const collapsedGroups=[];
  const expanded=new Set(state.expandedGroupIds||[]);

  for(const anchor of direct){
    const hidden=descendants(childrenByParent,anchor.id).filter(node=>!mainIds.has(node.id));
    if(!hidden.length)continue;
    const id=`deep:${selected.id}:${anchor.id}`;
    if(expanded.has(id))for(const node of hidden)visibleIds.add(node.id);
    collapsedGroups.push({id,anchorId:anchor.id,title:anchor.title||anchor.id,nodeIds:hidden.map(node=>node.id),expanded:expanded.has(id)});
  }

  const orderedVisible=stableNodes(nodes.filter(node=>visibleIds.has(node.id)&&node.id!==selected.id&&node.hierarchyLevel>=(selected.hierarchyLevel??0)+1));
  const listItems=orderedVisible;
  const safeMax=Math.max(1,Number(maxListItems)||24);
  return{
    visibleIds,
    listItems,
    windowItems:listItems.slice(0,safeMax),
    collapsedGroups,
    requiresScroll:listItems.length>safeMax
  };
}

