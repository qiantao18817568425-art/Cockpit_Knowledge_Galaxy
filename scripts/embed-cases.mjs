import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {embedCases} from './lib/case-model.mjs';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const graphPath=path.join(projectRoot,'docs','graph.json');
const [graph,taxonomy,register]=await Promise.all([
  readFile(graphPath,'utf8').then(JSON.parse),
  readFile(path.join(projectRoot,'content','architecture-taxonomy.json'),'utf8').then(JSON.parse),
  readFile(path.join(projectRoot,'content','case-register.json'),'utf8').then(JSON.parse)
]);
embedCases(graph.nodes,taxonomy,register);
graph.meta.referenceMapping={...(graph.meta.referenceMapping||{}),cases:register.cases.length,reviewedReports:register.summary?.reviewedReportCount||0};
await writeFile(graphPath,JSON.stringify(graph,null,2)+'\n','utf8');
console.log(`Embedded ${register.cases.length} canonical cases into ${graph.nodes.length} graph nodes.`);
