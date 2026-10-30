export function createGalaxyBackdrop({THREE,scene,reducedMotion=false,seed=42}={}){
  let value=seed>>>0;const random=()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296);
  const positions=[];for(let i=0;i<360;i++)positions.push((random()-.5)*1800,(random()-.5)*1100,-200-random()*800);
  const group=new THREE.Group(),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color:0xaabfe0,size:1.8,transparent:true,opacity:.42,depthWrite:false});
  group.add(new THREE.Points(geometry,material));scene.add(group);
  let phase=0,active=true,disposed=false;
  return{
    setPhase(next){if(!reducedMotion&&active&&!disposed){phase=next;group.rotation.z=next*.002}},
    resize(){},setActive(next){active=Boolean(next)},
    dispose(){if(disposed)return;disposed=true;scene.remove(group);geometry.dispose();material.dispose()},
    inspect(){return{phase,dustCount:360,containsKnowledgeEdges:false,disposed}}
  };
}
