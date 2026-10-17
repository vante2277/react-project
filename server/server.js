// 의존성 없는 서버: 빌드 결과(dist) + /api/indices 제공 (게시판·To do 데이터는 Supabase 에 저장)
// 개발: npm run dev (5173)
// 배포: npm start → http://localhost:3001
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import indicesHandler from '../api/indices.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3001;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not Found (npm run build 먼저 실행)'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/indices') return indicesHandler(req, res);

  const file = path.join(DIST, decodeURIComponent(url.pathname));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  // 없는 경로는 SPA 라우팅을 위해 index.html 반환
  fs.stat(file, (err, st) => {
    sendFile(res, !err && st.isFile() ? file : path.join(DIST, 'index.html'));
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
