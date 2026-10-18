import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8' };
const port = Number(process.env.PORT || 4173);

http.createServer(async(req,res)=>{
  const url = new URL(req.url, `http://localhost:${port}`);
  const file = path.resolve(docs, `.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
  if(!file.startsWith(docs+path.sep)){res.writeHead(403).end();return}
  try{const data=await readFile(file);res.writeHead(200,{ 'Content-Type':types[path.extname(file)]||'application/octet-stream' });res.end(data)}
  catch{res.writeHead(404).end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/`));
