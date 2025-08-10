import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { exec } from 'child_process';
import crypto from 'crypto';
import multer from 'multer';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
// Email config (set env vars in production)
const MAIL_USER = process.env.MAIL_USER || 'tungscript@gmail.com'; // Gmail account
const MAIL_PASS = process.env.MAIL_PASS || ''; // App password (8/16 chars). Leave blank -> disable sending.
const MAIL_TO   = process.env.MAIL_TO   || 'tungscript@gmail.com';

const DATA_FILE = path.join(__dirname, 'data', 'reviews.json');
const CONTENT_FILE = path.join(__dirname, 'data', 'content.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Đổi bằng biến môi trường để bảo mật hơn
const TOKEN_TTL_MS = 8 * 3600 * 1000; // 8 giờ
let tokens = new Map(); // token -> {exp}

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(express.static(__dirname));
// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Basic rate limit (per IP) - adjust if needed
const generalLimiter = rateLimit({
  windowMs: 15*60*1000,
  max: 400, // 400 requests / 15min
  standardHeaders: true,
  legacyHeaders: false
});
app.use(generalLimiter);

// Stricter limit for POST endpoints susceptible to spam
const postLimiter = rateLimit({ windowMs: 10*60*1000, max: 40 });

// Block direct access to server internals (prevent casual code viewing)
app.use((req,res,next)=>{
  if(/\b(server\.js|start-client\.ps1|run-server-startup\.cmd|package\.json|package-lock\.json)\b/i.test(req.path)){
    return res.status(403).send('Forbidden');
  }
  // Prevent listing data directory files directly
  if(req.path.startsWith('/data/')) return res.status(403).send('Forbidden');
  next();
});

function readData(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch(e){ return []; }
}
function writeData(data){ fs.writeFileSync(DATA_FILE, JSON.stringify(data.slice(0,1000), null, 2)); }

function readContent(){
  try { return JSON.parse(fs.readFileSync(CONTENT_FILE,'utf8')); } catch(e){
    return {};
  }
}
function writeContent(obj){
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(obj, null, 2));
}

function issueToken(){
  const t = crypto.randomBytes(24).toString('hex');
  tokens.set(t, { exp: Date.now() + TOKEN_TTL_MS });
  return t;
}
function authMiddleware(req,res,next){
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer (.+)$/);
  if(!m) return res.status(401).json({ok:false,error:'unauthorized'});
  const token = m[1];
  const rec = tokens.get(token);
  if(!rec || rec.exp < Date.now()){
    tokens.delete(token);
    return res.status(401).json({ok:false,error:'expired'});
  }
  next();
}

// Periodic cleanup
setInterval(()=>{
  const now = Date.now();
  for(const [t,rec] of tokens.entries()) if(rec.exp < now) tokens.delete(t);
}, 30*60*1000);

app.get('/api/reviews', (req,res)=>{
  const data = readData();
  res.json({ ok:true, reviews:data });
});

app.post('/api/reviews', postLimiter, (req,res)=>{
  const { stars, name, comment } = req.body || {};
  if(!Number.isInteger(stars) || stars < 1 || stars > 5){ return res.status(400).json({ok:false,error:'invalid_stars'}); }
  if(typeof comment !== 'string' || comment.trim().length < 10){ return res.status(400).json({ok:false,error:'comment_short'}); }
  const safeName = (typeof name === 'string' && name.trim().length <= 40) ? name.trim() : 'Ẩn danh';
  const safeComment = comment.trim().slice(0,500);
  const rec = { id:nanoid(10), stars, name:safeName, comment:safeComment, ts:Date.now() };
  const data = readData();
  data.unshift(rec);
  writeData(data);
  res.json({ ok:true, review:rec });
});

// ===== Contact Form Email =====
app.post('/api/contact', postLimiter, async (req,res)=>{
  const { name, email, message } = req.body || {};
  if(typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ok:false,error:'name_invalid'});
  if(typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ok:false,error:'email_invalid'});
  if(typeof message !== 'string' || message.trim().length < 10) return res.status(400).json({ok:false,error:'message_short'});
  if(!MAIL_PASS){
    // Email disabled (no password provided)
    return res.json({ok:true, delivered:false, note:'Email sending disabled (no MAIL_PASS set)'});
  }
  try{
    const transporter = nodemailer.createTransport({
      service:'gmail',
      auth:{ user: MAIL_USER, pass: MAIL_PASS }
    });
    const info = await transporter.sendMail({
      from: `CV Contact <${MAIL_USER}>`,
      to: MAIL_TO,
      subject: `Liên hệ mới từ CV: ${name}`,
      replyTo: email,
      text: message,
      html: `<p><strong>Tên:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Nội dung:</strong><br>${escapeHtml(message).replace(/\n/g,'<br>')}</p>`
    });
    res.json({ok:true, delivered:true, id: info.messageId});
  }catch(e){
    console.error('Email send error', e);
    res.status(500).json({ok:false,error:'send_failed'});
  }
});

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// ===== Admin Auth =====
app.post('/api/login', (req,res)=>{
  const { password } = req.body || {};
  if(typeof password !== 'string') return res.status(400).json({ok:false,error:'missing_password'});
  if(password !== ADMIN_PASSWORD) return res.status(401).json({ok:false,error:'invalid_password'});
  const token = issueToken();
  res.json({ ok:true, token, ttl: TOKEN_TTL_MS });
});

// ===== Content CRUD =====
app.get('/api/content', (req,res)=>{
  const content = readContent();
  res.json({ ok:true, content });
});

// (No-auth mode) Update content without authentication
app.put('/api/content', (req,res)=>{
  const body = req.body;
  if(typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ok:false,error:'invalid_body'});
  // Basic size guard
  const jsonStr = JSON.stringify(body);
  if(jsonStr.length > 200_000) return res.status(413).json({ok:false,error:'too_large'});
  try{
    writeContent(body);
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ok:false,error:'write_failed'});
  }
});

// ===== Avatar Upload (no-auth current mode) =====
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 2 * 1024 * 1024 } }); // 2MB limit
app.post('/api/upload/avatar', postLimiter, upload.single('avatar'), (req,res)=>{
  if(!req.file) return res.status(400).json({ok:false,error:'no_file'});
  const mime = req.file.mimetype;
  if(!/^image\/(png|jpeg|jpg|webp)$/.test(mime)) return res.status(400).json({ok:false,error:'invalid_type'});
  const targetDir = path.join(__dirname,'assets','img');
  if(!fs.existsSync(targetDir)) fs.mkdirSync(targetDir,{recursive:true});
  const outPath = path.join(targetDir,'avatar.png'); // chuẩn hoá lưu png
  try {
    fs.writeFileSync(outPath, req.file.buffer);
    // Optional: update content hero image path if we add later
    res.json({ok:true, path:'assets/img/avatar.png', ts:Date.now()});
  } catch(e){
    res.status(500).json({ok:false,error:'write_failed'});
  }
});

app.listen(PORT, ()=> {
  const url = 'http://localhost:'+PORT;
  console.log('Server listening on '+url);
  if(process.env.AUTO_OPEN !== '0'){
    try{
      const platform = process.platform;
      if(platform === 'win32') exec(`start "" "${url}"`);
      else if(platform === 'darwin') exec(`open ${url}`);
      else exec(`xdg-open ${url}`);
    }catch(e){/* ignore */}
  }
});
