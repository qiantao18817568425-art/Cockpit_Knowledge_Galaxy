export function visibleFanRows(rows,top,bottom){return rows.filter(row=>row.bottom>top&&row.top<bottom).slice(0,24)}
export function fanCurvePath(start,end){return `M ${start.x} ${start.y} C ${start.x+(end.x-start.x)*.3} ${start.y}, ${start.x+(end.x-start.x)*.52} ${end.y}, ${end.x} ${end.y}`}
export function renderGalaxyFan({svg,list,groupsContainer,model,onDrill,onOpenReader,onToggleGroup}){
  let current=model,frame=null;
  function redraw(){
    frame=null;const box=svg.getBoundingClientRect(),listBox=list.getBoundingClientRect();svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    const rows=[...list.querySelectorAll('[data-fan-node]')].map(element=>{const rect=element.getBoundingClientRect();return{element,top:rect.top,bottom:rect.bottom,rect}});
    const visible=visibleFanRows(rows,listBox.top,listBox.bottom);
    if(current.relationMode==='technical'){
      const positions=new Map(visible.map(item=>[item.element.dataset.fanNode,item.rect]));
      for(const edge of current.technicalEdges||[]){const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;const x=a.left-box.left+8,ya=a.top+12-box.top,yb=b.top+12-box.top;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${x} ${ya} Q ${Math.max(2,x-70)} ${(ya+yb)/2} ${x} ${yb}`);path.setAttribute('class',`hybrid-technical ${edge.pathClass}`);svg.append(path)}
      return;
    }
    for(const item of visible){
      const end={x:item.rect.left-box.left+8,y:item.rect.top+Math.min(15,item.rect.height/2)-box.top};
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',fanCurvePath({x:box.width*.02,y:box.height*.47},end));path.setAttribute('class','hybrid-curve');svg.append(path);
    }
  }
  function schedule(){if(frame!==null)return;frame=requestAnimationFrame(redraw)}
  function draw(){
    list.replaceChildren();groupsContainer.replaceChildren();
    for(const row of current.rows){
      const wrap=document.createElement('div');wrap.className=`fan-item${row.isGroup?' group':''}`;wrap.dataset.fanNode=row.nodeId;
      const drill=document.createElement('button');drill.type='button';drill.className='fan-row';drill.textContent=row.title;
      const small=document.createElement('small');small.textContent=row.description|| (row.isGroup?'三级知识链':'座舱架构知识点');drill.append(small);drill.addEventListener('click',()=>onDrill(row.nodeId));
      const detail=document.createElement('button');detail.type='button';detail.className='fan-detail';detail.textContent='专题详情';detail.setAttribute('aria-label',`${row.title}专题详情`);detail.addEventListener('click',()=>onOpenReader(row.nodeId,detail));wrap.append(drill,detail);list.append(wrap);
    }
    if(!current.rows.length){const empty=document.createElement('p');empty.className='fan-empty';empty.textContent='暂无直接下级知识点，可查看专题详情。';list.append(empty)}
    for(const group of current.collapsedGroups||[]){const button=document.createElement('button');button.type='button';button.textContent=`${group.expanded?'收起':'展开'} ${group.title} · ${group.nodeIds.length}`;button.addEventListener('click',()=>onToggleGroup(group.id));groupsContainer.append(button)}
    schedule();
  }
  list.addEventListener('scroll',schedule,{passive:true});const observer=new ResizeObserver(schedule);observer.observe(list);observer.observe(svg);draw();
  return{update(next){current=next;draw()},setViewport(){schedule()},focusNode(id){list.querySelector(`[data-fan-node="${CSS.escape(id)}"] button`)?.focus()},dispose(){observer.disconnect();list.removeEventListener('scroll',schedule);if(frame!==null)cancelAnimationFrame(frame);svg.replaceChildren();list.replaceChildren();groupsContainer.replaceChildren()}};
}
