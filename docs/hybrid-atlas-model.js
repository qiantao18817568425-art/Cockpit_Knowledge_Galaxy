const DEFAULT_ID='architecture:android-hmi-display';
const TEMPLATES=[[[0,0],[-.85,-.6],[-1.3,.2],[-.55,.8],[.4,.7],[.9,-.2],[.25,-.85]],[[0,0],[-.9,-.5],[-1.2,.35],[-.45,.85],[.35,.65],[1,.1],[.65,-.75]],[[0,0],[-1,-.25],[-.7,-.85],[.15,-.65],[.9,-.35],[1,.55],[.05,.8]],[[0,0],[-.8,-.75],[-1.25,-.1],[-.7,.7],[.1,.9],[.85,.45],[.65,-.65]],[[0,0],[-1,-.55],[-.65,.1],[-1,.75],[0,.65],[.8,.85],[1,-.2]],[[0,0],[-.85,-.8],[-.95,.1],[-.55,.7],[.3,.85],[1,.35],[.55,-.7]]];
const SLOTS=[[.20,.19],[.44,.22],[.18,.43],[.51,.45],[.47,.68],[.32,.82],[.69,.22],[.70,.68],[.08,.64],[.76,.40],[.22,.68],[.59,.80],[.11,.30],[.64,.58],[.34,.34],[.75,.84],[.32,.08]];
function hash(value){let n=2166136261;for(const char of value){n^=char.codePointAt(0);n=Math.imul(n,16777619)}return n>>>0}
function sorted(nodes){return [...nodes].sort((a,b)=>(a.hierarchyOrder??999999)-(b.hierarchyOrder??999999)||a.id.localeCompare(b.id))}
export function buildConstellationTemplate(nodes,{seed=0,center={x:0,y:0},scale=50}={}){
  const template=TEMPLATES[seed%TEMPLATES.length];
  const stars=nodes.map((node,index)=>{const p=template[index%template.length];const extra=Math.floor(index/template.length)*.18;return{nodeId:node.id,title:node.title,x:center.x+p[0]*scale*(1+extra),y:center.y+p[1]*scale*(1+extra),primary:index===0}});
  const edges=stars.slice(1).map(star=>({from:stars[0].nodeId,to:star.nodeId}));
  const decorativeStars=template.slice(Math.min(nodes.length,template.length)).map((p,index)=>({id:`dust-${index}`,x:center.x+p[0]*scale,y:center.y+p[1]*scale}));
  return{stars,edges,decorativeStars};
}
export function buildAtlasModel(graph,{activeDimensionId=DEFAULT_ID,width=1920,height=1080,phase=0}={}){
  const dimensions=sorted((graph.nodes||[]).filter(node=>node.kind==='architecture_dimension'));
  const visibleCount=width<=720?3:width<=1450?5:7;
  const active=dimensions.find(node=>node.id===activeDimensionId)||dimensions[0];
  const preferred=['architecture:system-concepts','architecture:mtk-platform','architecture:mcu-soc',DEFAULT_ID,'architecture:audio','architecture:power','architecture:camera-perception'];
  const visibleCardIds=[active?.id,...preferred,...dimensions.map(node=>node.id)].filter((id,index,array)=>id&&array.indexOf(id)===index).slice(0,visibleCount);
  const ordered=[...preferred,...dimensions.map(node=>node.id)].filter((id,index,array)=>array.indexOf(id)===index);
  const constellations=dimensions.map(d=>{
    const idx=ordered.indexOf(d.id);const slot=SLOTS[idx%SLOTS.length];
    const center={x:slot[0]*1000,y:slot[1]*1000};const children=sorted((graph.nodes||[]).filter(node=>node.primaryParentId===d.id));
    const shape=buildConstellationTemplate([d,...children],{seed:hash(d.id),center,scale:55});
    const descendants=children.flatMap(child=>(graph.nodes||[]).filter(node=>node.primaryParentId===child.id));
    return{id:d.id,title:d.title,center,active:d.id===active?.id,childrenCount:children.length,knowledgeCount:descendants.length,cardVisible:visibleCardIds.includes(d.id),...shape};
  });
  return{activeDimensionId:active?.id||null,constellations,visibleCardIds,decorativeRoute:{path:'M 160 690 C 190 520 160 290 220 155',semantic:false},phase,width,height};
}
