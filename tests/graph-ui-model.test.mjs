import test from 'node:test';import assert from 'node:assert/strict';
import {rankSearchResults,visibleNodeIds,expandEvidenceNeighborhood,detailModel} from '../docs/graph-model.js';
const graph={nodes:[
 {id:'a',title:'SleepManager',aliases:['休眠管理器'],kind:'component',layer:'knowledge',platforms:['MT8676']},
 {id:'b',title:'PMIC',kind:'component',layer:'knowledge',platforms:['MT8676']},
 {id:'ev',title:'证据',kind:'evidence',layer:'evidence',hiddenByDefault:true,status:'documented_reference',sourceName:'manual.pdf',pages:[4],downloadUrl:'https://example/a'},
 {id:'src',title:'manual.pdf',kind:'source',layer:'evidence',hiddenByDefault:true}
],edges:[
 {from:'a',to:'b',type:'controls',pathClass:'control',claims:[{status:'documented_reference',evidenceIds:['ev']}]},
 {from:'a',to:'ev',type:'supported_by',pathClass:'diagnostic'},{from:'ev',to:'src',type:'supported_by',pathClass:'diagnostic'}]};
test('search ranks aliases and platform filters',()=>assert.equal(rankSearchResults(graph.nodes,'休眠',{platforms:['MT8676']})[0].id,'a'));
test('evidence is hidden by default and expands for incoming or outgoing selected relations',()=>{assert.ok(!visibleNodeIds(graph,{}).has('ev'));const ids=visibleNodeIds(graph,{selectedId:'a',evidenceVisible:true});assert.ok(ids.has('ev'));assert.ok(ids.has('src'));assert.deepEqual(expandEvidenceNeighborhood(graph,'b'),new Set(['b','ev','src']))});
test('path filters retain connected knowledge nodes',()=>{const ids=visibleNodeIds(graph,{pathClasses:['control']});assert.ok(ids.has('a')&&ids.has('b'))});
test('details include evidence scope source page and URL',()=>{const d=detailModel(graph,'a');assert.deepEqual(d.platforms,['MT8676']);assert.equal(d.evidence[0].sourceName,'manual.pdf');assert.deepEqual(d.evidence[0].pages,[4]);assert.match(d.evidence[0].url,/^https:/)});

