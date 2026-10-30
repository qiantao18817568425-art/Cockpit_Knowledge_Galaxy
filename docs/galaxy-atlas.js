const NS='http://www.w3.org/2000/svg';
function el(name,attributes={}){const item=document.createElementNS(NS,name);for(const [key,value] of Object.entries(attributes))item.setAttribute(key,String(value));return item}
export function renderGalaxyAtlas({svg,cardLayer,model,onHover=()=>{},onSelect=()=>{}}){
  let current=model,hovered=null,matches=new Set();
  function draw(){
    svg.replaceChildren();cardLayer.replaceChildren();
    const route=el('path',{d:current.decorativeRoute.path,class:'atlas-route','aria-hidden':'true'});svg.append(route);
    for(const constellation of current.constellations){
      const group=el('g',{'data-constellation':constellation.id,class:`atlas-group${constellation.active?' active':''}${constellation.cardVisible?' front':' distant'}`});
      for(const edge of constellation.edges){const a=constellation.stars.find(s=>s.nodeId===edge.from),b=constellation.stars.find(s=>s.nodeId===edge.to);if(a&&b)group.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'atlas-link'}))}
      for(const star of constellation.decorativeStars)group.append(el('circle',{cx:star.x,cy:star.y,r:1.6,class:'atlas-decoration','aria-hidden':'true'}));
      for(const star of constellation.stars){
        const circle=el('circle',{cx:star.x,cy:star.y,r:star.primary?5:3,class:`atlas-star${star.nodeId===hovered?' hovered':''}${matches.has(star.nodeId)?' matched':''}`,tabindex:0,role:'button','aria-label':star.title});
        const title=el('title');title.textContent=star.title;circle.append(title);
        circle.addEventListener('pointerenter',()=>onHover(star.nodeId));circle.addEventListener('pointerleave',()=>onHover(null));circle.addEventListener('click',()=>onSelect(constellation.id,star.nodeId));circle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(constellation.id,star.nodeId)}});group.append(circle);
      }
      svg.append(group);
      if(constellation.cardVisible){
        const card=document.createElement('button');card.type='button';card.className=`atlas-card${constellation.active?' active':''}`;
        card.style.left=`${Math.min(82,constellation.center.x/10+7)}%`;card.style.top=`${Math.max(4,constellation.center.y/10-6)}%`;
        const count=document.createElement('span');count.className='atlas-card-count';count.textContent=String(constellation.knowledgeCount).padStart(2,'0');
        const name=document.createElement('strong');name.textContent=constellation.title;
        const small=document.createElement('small');small.textContent=`${constellation.childrenCount} 条知识链 · ${constellation.knowledgeCount} 个知识点`;
        card.append(count,name,small);card.addEventListener('click',()=>onSelect(constellation.id,constellation.id));cardLayer.append(card);
      }
    }
  }
  draw();return{update(next){current=next;draw()},setHovered(id){hovered=id;draw()},setSearchMatches(ids){matches=new Set(ids);draw()},dispose(){svg.replaceChildren();cardLayer.replaceChildren()}};
}
