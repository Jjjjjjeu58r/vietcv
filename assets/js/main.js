// ====== Utility Helpers ======
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

// ====== Theme Switch (Dark / Light) ======
(function themeToggle(){
  const root = document.body;
  const switcher = $('.theme-switch');
  const STORAGE_KEY = 'cv-theme';
  const preferred = localStorage.getItem(STORAGE_KEY);
  if(preferred){ root.classList.toggle('light', preferred === 'light'); }
  const revealHost = $('.theme-reveal');
  // ===== Adaptive Refresh Mapping =====
  // Real display refresh range we care about (Hz)
  const REAL_MIN = 65;      // thấp nhất (giả định >= 65Hz)
  const REAL_MAX = 240;     // cao nhất cần hỗ trợ
  // Virtual FPS scale yêu cầu: 1000 -> 10000
  const VIRTUAL_MIN = 1000;
  const VIRTUAL_MAX = 10000;
  let realFps = 0;          // đo thực tế
  let virtualFps = 0;       // quy đổi 1000-10000
  let samples = [];
  const SAMPLE_WINDOW_MS = 1200; // đo ~1.2s để chính xác trên màn hình cao tần số
  (function measureRefresh(){
    let start = performance.now();
    let last = start;
    function frame(t){
      const dt = t - last; last = t;
      if(dt>0 && dt < 100){ // bỏ qua các frame bị throttle mạnh
        samples.push(dt);
      }
      if(t - start >= SAMPLE_WINDOW_MS){
        if(samples.length){
          const avg = samples.reduce((a,b)=>a+b,0)/samples.length; // ms per frame
          const fps = 1000/avg;
          realFps = fps;
          const clamped = Math.min(REAL_MAX, Math.max(REAL_MIN, fps));
          const ratio = (clamped - REAL_MIN) / (REAL_MAX - REAL_MIN);
          virtualFps = Math.round(VIRTUAL_MIN + ratio * (VIRTUAL_MAX - VIRTUAL_MIN));
        }
        // tiếp tục đo định kỳ để nếu người dùng kéo sang màn hình khác (multi-monitor)
        start = t; samples = [];
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
  function getVirtual(){
    // fallback nếu chưa đủ mẫu: giả định 60~ (sử dụng ngưỡng thấp -> virtual gần min)
    if(!virtualFps){
      return VIRTUAL_MIN; // tạm thời
    }
    return virtualFps;
  }
  function createReveal(mode){
    if(!revealHost) return;
    const circle = document.createElement('div');
    circle.className = 'theme-reveal__circle ' + (mode==='light'?'light':'dark');
    const rect = switcher?.getBoundingClientRect();
    const x = rect ? rect.right : window.innerWidth;
    const y = rect ? rect.top : 0;
    const size = Math.max(window.innerWidth, window.innerHeight) * 2.2;
    circle.style.right = rect ? (window.innerWidth - x)+'px' : '0';
    circle.style.top = y + 'px';
    circle.style.width = circle.style.height = size + 'px';
    circle.style.marginTop = -(size/2)+'px';
    circle.style.marginRight = -(size/2)+'px';
    revealHost.appendChild(circle);
    const vFps = getVirtual();
    if(vFps){
      circle.classList.add('js-anim');
      // baseDuration tương ứng virtual min (1000). Fps ảo càng cao => tốc độ cảm nhận nhanh hơn (rút ngắn thời gian)
      const baseDuration = 850; // ms ở ngưỡng thấp
      const duration = baseDuration * (VIRTUAL_MIN / vFps) ** 0.35; // exponent mềm để tránh chênh lệch quá gắt
      const start = performance.now();
      (function animate(now){
        const progress = Math.min(1,(now-start)/duration);
        const eased = 1 - Math.pow(1-progress,3);
        circle.style.transform = 'scale(' + (0.05 + 0.95*eased) + ')';
        if(progress<1){ requestAnimationFrame(animate); } else { circle.classList.add('fade-out'); setTimeout(()=> circle.remove(),700); }
      })(start);
    } else {
      requestAnimationFrame(()=> circle.classList.add('active'));
      setTimeout(()=> circle.classList.add('fade-out'),650);
      circle.addEventListener('transitionend', ()=> circle.remove(), {once:true});
    }
  }
  function update(){
    root.classList.add('theming');
    const isLight = root.classList.toggle('light');
    localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
    createReveal(isLight ? 'light':'dark');
    setTimeout(()=> root.classList.remove('theming'), 800);
  }
  switcher?.addEventListener('click', update);
  switcher?.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); update(); }});
})();

// ====== Back To Top ======
(function backToTop(){
  const btn = document.querySelector('.back-to-top');
  if(!btn) return;
  const onScroll = ()=>{ if(window.scrollY > 500) btn.classList.add('visible'); else btn.classList.remove('visible'); };
  window.addEventListener('scroll', onScroll, {passive:true});
  btn.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
})();

// ====== Mobile Nav Toggle ======
(function navToggle(){
  const nav = document.querySelector('.main-nav');
  const btn = document.querySelector('.nav-toggle');
  const list = document.querySelector('.nav-list');
  if(!nav || !btn || !list) return;
  function close(){
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
  }
  function open(){
    nav.classList.add('open');
    btn.setAttribute('aria-expanded','true');
  }
  btn.addEventListener('click', ()=>{
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    expanded ? close() : open();
  });
  // Đóng khi chọn link (trên mobile)
  list.addEventListener('click', e=>{
    const a = e.target.closest('a');
    if(a && window.matchMedia('(max-width: 860px)').matches){ close(); }
  });
  // Đóng khi click ra ngoài
  document.addEventListener('click', e=>{
    if(!nav.classList.contains('open')) return;
    if(e.target === btn || btn.contains(e.target)) return;
    if(nav.contains(e.target)) return;
    close();
  });
  // Escape key
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') close(); });
})();

// ====== Active Nav Link on Scroll ======
(function activeSection(){
  const sections = $$('main section[id]');
  const navLinks = $$('.nav-list .nav-link');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const id = entry.target.getAttribute('id');
        navLinks.forEach(a=>{
          if(a.getAttribute('href') === '#' + id) a.classList.add('active'); else a.classList.remove('active');
        });
      }
    });
  }, { rootMargin:'-50% 0px -50% 0px', threshold:0 });
  sections.forEach(sec=>observer.observe(sec));
})();

// ====== Contact Form (Front-end Validation + Fake Submit) ======
(function contactForm(){
  const form = $('#contact-form');
  if(!form) return;
  const statusEl = form.querySelector('.form-status');
  const fields = ['name','email','message','consent'];
  const API_BASE = (location.origin.startsWith('http')?location.origin:'http://localhost:3000').replace(/\/$/, '');
  const STATIC_MODE = location.hostname.endsWith('github.io') || location.protocol === 'file:';
  const validators = {
    name: v => v.trim().length >= 2 || 'Tên tối thiểu 2 ký tự',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email không hợp lệ',
    message: v => v.trim().length >= 10 || 'Nội dung tối thiểu 10 ký tự',
    consent: v => v === true || 'Cần đồng ý điều khoản'
  };
  function setError(name, msg){ const span = form.querySelector(`.error[data-for="${name}"]`); if(span) span.textContent = msg || ''; }
  function getValue(field){ const el = form[field]; if(!el) return ''; return el.type === 'checkbox' ? el.checked : el.value; }
  function validateField(field){ const val = getValue(field); const validator = validators[field]; if(!validator) return true; const result = validator(val); if(result !== true){ setError(field,result); return false;} setError(field,''); return true; }
  fields.forEach(f=>{ const el=form[f]; if(!el) return; el.addEventListener('input', ()=> validateField(f)); if(el.type==='checkbox') el.addEventListener('change', ()=> validateField(f)); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    let ok=true; fields.forEach(f=>{ if(!validateField(f)) ok=false; });
    if(!ok){ statusEl.textContent='Vui lòng kiểm tra lại các trường.'; return; }
    statusEl.textContent='Đang gửi...';
    const payload = { name: form.name.value.trim(), email: form.email.value.trim(), message: form.message.value.trim() };
    if(STATIC_MODE){
      // Fallback dùng mailto (không cần backend)
      const mailto = 'mailto:' + (form.email.value.trim()||'example@example.com') + '?subject=' + encodeURIComponent('[CV] Liên hệ từ '+payload.name) + '&body=' + encodeURIComponent(payload.message + '\n\n(Được tạo từ phiên bản tĩnh)');
      try { window.location.href = mailto; } catch(_){ }
      statusEl.textContent='Mở ứng dụng email để hoàn tất gửi.';
      form.reset();
      return;
    }
    try {
      const resp = await fetch(API_BASE + '/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const js = await resp.json().catch(()=>null);
      if(resp.ok && js && js.ok){
        statusEl.textContent = js.delivered ? 'Gửi thành công! Mình sẽ phản hồi sớm.' : 'Đã ghi nhận (email chưa bật gửi).';
        form.reset();
      } else statusEl.textContent='Gửi thất bại. Thử lại sau.';
    } catch(err){ statusEl.textContent='Không có server (phiên bản tĩnh). Dùng email trực tiếp.'; }
  });
})();

// ====== Dynamic Year ======
(function setYear(){
  const y = new Date().getFullYear();
  const el = $('#year');
  if(el) el.textContent = y;
})();

// ====== Performance: Prefetch internal PDF when idle ======
(function prefetchCV(){
  if('requestIdleCallback' in window){
    requestIdleCallback(()=>{
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = 'assets/cv.pdf';
      document.head.appendChild(link);
    });
  }
})();

// ===== Ratings & Reviews (Shared via API) =====
(function ratingsModule(){
  const form = $('#rating-form');
  if(!form) return;
  const STORAGE_KEY = 'cv-ratings-v1';
  const META_KEY = 'cv-ratings-meta';
  const listEl = $('#reviews-list');
  const avgEl = $('#rating-avg');
  const avgStarsEl = $('#rating-avg-stars');
  const countEl = $('#rating-count');
  const distEl = $('#rating-dist');
  const statusEl = $('#rating-status');
  let data = [];
  let meta = { lastSubmit:0, submissions:[] };
  let captcha = {a:0,b:0,op:'+',ans:0};
  const API_BASE = (location.origin.startsWith('http') ? location.origin : 'http://localhost:3000').replace(/\/$/, '');
  const STATIC_MODE = location.hostname.endsWith('github.io') || location.protocol === 'file:';
  let waitServerTries = 0;
  async function fetchRemote(initial=true){
    if(STATIC_MODE){
      try {
        const r = await fetch('data/reviews.json');
        if(r.ok){ const js = await r.json(); if(Array.isArray(js)){ data = js.slice(0,300); save(); render(); if(initial) statusEl && (statusEl.textContent=''); return true; } }
      } catch(_){}
      if(initial) statusEl && (statusEl.textContent='Chế độ tĩnh: đánh giá chỉ lưu cục bộ trong trình duyệt.');
      return false;
    }
    try {
      const r = await fetch(API_BASE + '/api/reviews');
      if(r.ok){ const js = await r.json(); if(js.ok && Array.isArray(js.reviews)){ data = js.reviews.slice(0,300); save(); render(); if(initial) statusEl && (statusEl.textContent=''); return true; } }
    } catch(e){ if(initial) statusEl && (statusEl.textContent='Đang chờ server đánh giá khởi động...'); }
    return false;
  }
  function load(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw) data = JSON.parse(raw)||[]; }catch(e){ data=[]; } try{ const rawM=localStorage.getItem(META_KEY); if(rawM) meta = Object.assign(meta, JSON.parse(rawM)||{}); }catch(e){} }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data.slice(0,300))); localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  function formatDate(ts){ const d = new Date(ts); return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}); }
  function render(){ const total=data.length; const sum=data.reduce((a,r)=>a+r.stars,0); const avg= total? (sum/total):0; avgEl.textContent = avg.toFixed(1); countEl.textContent = total; avgStarsEl.innerHTML = starHTML(avg,true); avgStarsEl.setAttribute('aria-label', `Điểm trung bình ${avg.toFixed(1)} trên 5`); const buckets=[0,0,0,0,0]; data.forEach(r=>buckets[r.stars-1]++); distEl.innerHTML=''; for(let s=5;s>=1;s--){ const c=buckets[s-1]; const pct= total? (c/total*100):0; const li=document.createElement('li'); li.className='dist-row'; li.innerHTML = `<span>${s}★</span><div class="bar"><span style="width:${pct.toFixed(1)}%"></span></div><div class="pct">${pct.toFixed(0)}%</div>`; distEl.appendChild(li);} listEl.innerHTML=''; if(!data.length){ const empty=document.createElement('li'); empty.className='empty-reviews'; empty.textContent='Chưa có đánh giá nào.'; listEl.appendChild(empty);} else { data.slice().sort((a,b)=>b.ts-a.ts).slice(0,25).forEach(r=>{ const li=document.createElement('li'); li.className='review-item'; li.innerHTML = `<div class="review-head"><div class="review-meta"><span class="review-name">${escapeHTML(r.name||'Ẩn danh')}</span><span>${formatDate(r.ts)}</span></div><div class="review-stars">${starHTML(r.stars)}</div></div><div class="review-comment">${escapeHTML(r.comment)}</div>`; listEl.appendChild(li); }); } }
  function starHTML(value, allowHalf=false){ const stars=[]; for(let i=1;i<=5;i++){ if(allowHalf){ const diff=value-i; if(diff>=0) stars.push('<span>★</span>'); else if(diff>-1){ stars.push('<span style="position:relative;display:inline-block;width:1em;"><span style="position:absolute;inset:0;color:#fbbf24;clip-path:inset(0 50% 0 0)">★</span><span style="color:#374151;">★</span></span>'); } else stars.push('<span style="color:#374151;">★</span>'); } else { stars.push(`<span>${i<=value?'★':'☆'}</span>`); } } return stars.join(''); }
  function escapeHTML(str){ return str.replace(/[&<>"]+/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
  function validate(stars, comment){ if(!stars) return 'Chọn số sao.'; if(!comment || comment.trim().length<10) return 'Nhận xét tối thiểu 10 ký tự.'; return ''; }
  function newCaptcha(){ const ops=['+','-']; const a=Math.floor(Math.random()*10)+5; const b=Math.floor(Math.random()*6)+1; const op=ops[Math.random()*ops.length|0]; const ans= op==='+'?a+b:a-b; captcha={a,b,op,ans}; const qEl=$('#captcha-question'); if(qEl) qEl.textContent=`${a} ${op} ${b} = ?`; const input=$('#captcha-answer'); if(input) input.value=''; }
  function validateCaptcha(){ const input=$('#captcha-answer'); const errSpan=document.querySelector('.error[data-for="captcha"]'); if(!input) return true; const val=input.value.trim(); if(val===''){ errSpan && (errSpan.textContent='Nhập kết quả.'); return false;} if(Number(val)!==captcha.ans){ errSpan && (errSpan.textContent='Sai, thử lại.'); newCaptcha(); return false;} errSpan && (errSpan.textContent=''); return true; }
  // Simple device fingerprint (non-invasive)
  function fingerprint(){
    const nav = navigator; const scr = screen;
    const str = [nav.language, nav.platform, scr.width+'x'+scr.height, nav.hardwareConcurrency, nav.userAgent].join('|');
    let h=0; for(let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i))|0; }
    return 'fp_'+Math.abs(h);
  }
  function cleanupMeta(){
    const dayAgo = Date.now() - 24*3600*1000;
    meta.submissions = (meta.submissions||[]).filter(ts => ts > dayAgo);
  }
  function canSubmit(stars, comment){
    // Honeypot
    if(form.website && form.website.value){ return 'Phát hiện spam.'; }
    cleanupMeta();
    const fp = fingerprint();
    const now = Date.now();
    // Cooldown 15s
    if(now - meta.lastSubmit < 15000) return 'Vui lòng chờ vài giây trước khi gửi lại.';
    // Max 5 submissions / 24h / fingerprint
    const fpCount = data.filter(r => r.fingerprint === fp && now - r.ts < 24*3600*1000).length;
    if(fpCount >= 5) return 'Bạn đã đạt giới hạn đánh giá trong 24h.';
    // Duplicate same stars+comment within 2h
    const dup = data.find(r => r.fingerprint===fp && r.stars===stars && r.comment===comment && now - r.ts < 2*3600*1000);
    if(dup) return 'Nội dung tương tự đã gửi gần đây.';
    return '';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const stars = Number(fd.get('stars'));
    const name = (fd.get('reviewer')||'').toString().trim().slice(0,40);
    const comment = (fd.get('comment')||'').toString().trim().slice(0,500);
    const err = validate(stars, comment); if(err){ statusEl.textContent = err; return; }
    if(!validateCaptcha()){ statusEl.textContent = 'Captcha chưa đúng.'; return; }
    const anti = canSubmit(stars, comment); if(anti){ statusEl.textContent = anti; return; }
    statusEl.textContent = 'Đang gửi...';
    const fp = fingerprint(); meta.lastSubmit = Date.now(); meta.submissions.push(meta.lastSubmit); let created=null;
    if(!STATIC_MODE){
      try { const resp = await fetch(API_BASE + '/api/reviews', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({stars,name,comment})}); if(resp.ok){ const js=await resp.json(); if(js.ok) created = js.review; } } catch(e){}
    }
    if(!created){ created = { id:(crypto.randomUUID?crypto.randomUUID():('id_'+Date.now())), stars, name: name||'Ẩn danh', comment, ts:Date.now(), fingerprint:fp, offline:true }; }
    data.unshift(created); save(); render(); form.reset(); statusEl.textContent = created.offline || STATIC_MODE ? 'Lưu tạm (trình duyệt).' : 'Cảm ơn bạn đã đánh giá!'; newCaptcha();
  });
  // Improve star hover (keyboard support already by radio inputs)
  const starLabels = $$('.stars-input label'); starLabels.forEach(lb=>{ lb.addEventListener('mouseenter', ()=>{ const val=Number(lb.dataset.value); starLabels.forEach(l2=> l2.style.color = Number(l2.dataset.value)<=val ? '#fcd34d':'#555'); }); });
  const starsWrap = $('.stars-input'); starsWrap?.addEventListener('mouseleave', ()=> starLabels.forEach(l2=>{ const input=$('#star'+l2.dataset.value); if(input && input.checked) l2.style.color='#fbbf24'; else l2.style.color='#555'; }));
  load(); render(); newCaptcha();
  fetchRemote().then(ok=>{ if(!ok && !STATIC_MODE){ const interval=setInterval(()=>{ waitServerTries++; fetchRemote(false).then(got=>{ if(got){ clearInterval(interval);} }); if(waitServerTries>30){ clearInterval(interval); statusEl && (statusEl.textContent+=' (Hết thời gian chờ)'); } },3000); } });
  $('#captcha-refresh')?.addEventListener('click', newCaptcha);
  $('#captcha-answer')?.addEventListener('input', ()=>{ const errSpan=document.querySelector('.error[data-for="captcha"]'); if(errSpan) errSpan.textContent=''; });
})();

// ===== Background Music Player =====
(function bgMusic(){
  const toggleBtn = $('#music-toggle');
  const infoEl = $('#music-info');
  const bar = $('#music-progress-bar');
  if(!toggleBtn || !infoEl) return;
  // Configure your playlist here: YouTube links or direct mp3
  const playlist = [
    { title:'Lo-fi Focus', src:'assets/media/lofi.mp3', type:'audio' },
    { title:'Chillhop Stream', src:'https://youtu.be/0Egk57N-w-o?si=VbPx_VVpjzeMxEp3', type:'youtube' }
    // Thêm bài khác tại đây, ví dụ:
    //,{ title:'Track 2', src:'https://youtu.be/XXXXXXXXXXX', type:'youtube' }
  ];
  const autoAdvance = true; // tự chuyển bài khi hết
  let current = 0;
  let audioEl = null; let ytFrame = null; let ytReady=false; let progressTimer=null; let playing=false;
  let targetVolume = 0.65; // audio element final volume
  let fadeTimer = null; let fadeStart = null; let fading = false;
  const STORAGE_KEY = 'cv-music-state-v1';

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({current, time: audioEl?audioEl.currentTime:0, playing}));
  }
  function loadState(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw){ const s=JSON.parse(raw); current= typeof s.current==='number'? s.current:0; }}catch(e){}
  }
  loadState();

  function setInfo(txt){ infoEl.textContent = txt; }
  function formatPct(cur,dur){ if(!dur) return 0; return Math.min(100, (cur/dur)*100); }
  function clearTimers(){ if(progressTimer){ cancelAnimationFrame(progressTimer); progressTimer=null; }}

  function updateProgress(){
    if(audioEl && playing){ bar.style.width = formatPct(audioEl.currentTime, audioEl.duration)+'%'; }
    progressTimer = requestAnimationFrame(updateProgress);
  }

  function createAudio(){
    if(audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.preload='auto';
    audioEl.addEventListener('ended', nextTrack);
    audioEl.addEventListener('timeupdate', ()=> bar.style.width = formatPct(audioEl.currentTime, audioEl.duration)+'%');
    return audioEl;
  }

  function loadTrack(idx){
    current = (idx+playlist.length)%playlist.length;
    const item = playlist[current];
    destroyYT();
    if(item.type==='audio'){
      const a = createAudio();
      a.src = item.src; a.currentTime=0; a.volume=.65;
      setInfo(item.title);
    } else if(item.type==='youtube') {
      // Lazy load YouTube iframe API only when needed
      setInfo(item.title + ' (YouTube)');
      if(!window.YT){
        const tag = document.createElement('script'); tag.src='https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
        window.onYouTubeIframeAPIReady = initYT;
      } else initYT();
    }
    // Prefetch next audio track to giảm độ trễ
    prefetchNext();
  }

  function initYT(){
    if(ytFrame) return;
    const wrap = document.createElement('div');
    wrap.style.position='fixed';wrap.style.width='0';wrap.style.height='0';wrap.style.overflow='hidden';wrap.style.zIndex='-1';
    document.body.appendChild(wrap);
    const vid = extractYT(playlist[current].src);
    ytFrame = new YT.Player(wrap, {
      videoId: vid,
      playerVars:{autoplay:1,controls:0,disablekb:1,modestbranding:1,playsinline:1, mute:1},
      events:{
        'onReady': (e)=>{ ytReady=true; attemptAutoplay(); },
  'onStateChange': (e)=>{ if(e.data===YT.PlayerState.ENDED && autoAdvance) nextTrack(); }
      }
    });
  }

  function extractYT(url){
    const m = url.match(/[?&]v=([^&#]+)/) || url.match(/youtu\.be\/([^?&#]+)/); return m?m[1]:url;
  }

  function destroyYT(){ if(ytFrame && ytFrame.destroy){ ytFrame.destroy(); ytFrame=null; ytReady=false; }}

  function play(){
    const item = playlist[current];
    if(item.type==='audio'){
      createAudio();
      audioEl.muted = true; audioEl.volume = 0; // start muted for autoplay compliance
      audioEl.play().then(()=>{ playing=true; toggleBtn.classList.add('on'); animate(); fadeInAudio(); }).catch(()=> setInfo('Nhấp biểu tượng để bật nhạc')); }
    else if(item.type==='youtube'){
      if(ytReady){ ytFrame.playVideo(); playing=true; toggleBtn.classList.add('on'); animate(); fadeInYT(); }
      else setInfo('Đang tải YouTube...');
    }
  }

  function pause(){
    const item = playlist[current];
    if(item.type==='audio' && audioEl) audioEl.pause();
    if(item.type==='youtube' && ytFrame) ytFrame.pauseVideo && ytFrame.pauseVideo();
    playing=false; toggleBtn.classList.remove('on'); clearTimers();
  }

  function animate(){ clearTimers(); updateProgress(); }
  function nextTrack(){
    if(!playlist.length) return;
    if(playlist.length===1){ // chỉ 1 bài -> loop lại
      if(playlist[0].type==='audio' && audioEl){ audioEl.currentTime=0; audioEl.play(); return; }
      if(playlist[0].type==='youtube' && ytFrame){ ytFrame.seekTo(0,true); ytFrame.playVideo(); return; }
    }
    loadTrack(current+1); if(playing) setTimeout(play, 120);
  }

  // ===== Prefetch next audio track =====
  let audioCache = {};
  function prefetchNext(){
    const nextIdx = (current+1)%playlist.length;
    const next = playlist[nextIdx];
    if(!next || next.type!=='audio') return;
    if(audioCache[next.src]) return; // already
    const pre = new Audio();
    pre.preload='auto';
    pre.src = next.src;
    audioCache[next.src] = pre;
  }

  toggleBtn.addEventListener('click', ()=> { playing ? pause() : play(); });
  toggleBtn.addEventListener('contextmenu', e=>{ e.preventDefault(); nextTrack(); });

  // Autoplay after first user interaction to comply with browser policy
  function attemptAutoplay(){
    if(playing) return; // already
    const item = playlist[current];
    if(item.type==='youtube' && ytReady){
      try{ ytFrame.mute && ytFrame.mute(); ytFrame.playVideo(); playing=true; toggleBtn.classList.add('on'); animate(); fadeInYT(); }
      catch(e){ setInfo('Nhấp để bật nhạc'); }
    } else if(item.type==='audio'){
      play();
    }
  }

  function scheduleUserUnmute(){
    const handler = ()=>{ if(!playing) play(); else { fadeInAudio(); fadeInYT(); } window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); };
    window.addEventListener('pointerdown', handler, {once:true});
    window.addEventListener('keydown', handler, {once:true});
  }

  function fadeInAudio(){
    if(!audioEl) return;
    audioEl.muted = false; fading=true; fadeStart = performance.now(); const dur=1800; audioEl.volume=0;
    function step(t){
      if(!fading) return; const p=Math.min(1,(t-fadeStart)/dur); audioEl.volume = targetVolume * (p*p*(3-2*p));
      if(p<1) requestAnimationFrame(step); else { fading=false; }
    }
    requestAnimationFrame(step);
  }
  function fadeInYT(){
    if(!ytFrame || !ytFrame.unMute) return; try{ ytFrame.unMute(); ytFrame.setVolume(0); }catch(e){ return; }
    let start = performance.now(); const dur=1800; function step(t){ const p=Math.min(1,(t-start)/dur); const eased = p*p*(3-2*p); ytFrame.setVolume(Math.round(100*eased)); if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  // Start from YouTube track if exists
  if(!playlist[current] || playlist[current].type!=='youtube'){
    const firstYT = playlist.findIndex(p=>p.type==='youtube');
    if(firstYT!==-1) current = firstYT;
  }
  loadTrack(current);
  attemptAutoplay();
  scheduleUserUnmute();
})();

// Inject dynamic content loading (admin-managed)
;(function dynamicContent(){
  const API_BASE = (location.origin.startsWith('http')?location.origin:'http://localhost:3000').replace(/\/$/, '');
  const STATIC_MODE = location.hostname.endsWith('github.io') || location.protocol === 'file:';
  function applyContent(c){
    try {
      if(c.hero){
        const nameSpan=document.querySelector('.hero-text .highlight'); if(nameSpan && c.hero.name) nameSpan.textContent=c.hero.name;
        const titleEl=document.querySelector('.hero-text .tagline'); if(titleEl && c.hero.title) titleEl.textContent=c.hero.title;
        const sumEl=document.querySelector('.hero-text .summary'); if(sumEl && c.hero.summary) sumEl.textContent=c.hero.summary;
        const btnContact=document.querySelector('.hero-actions .btn.primary'); if(btnContact && c.hero.actions?.contactText) btnContact.textContent=c.hero.actions.contactText;
        const btnCV=document.querySelector('.hero-actions .btn.outline'); if(btnCV){ if(c.hero.actions?.cvText) btnCV.textContent=c.hero.actions.cvText; if(c.hero.actions?.cvHref) btnCV.setAttribute('href', c.hero.actions.cvHref); }
        const avatarImg=document.querySelector('.avatar-wrapper img'); if(avatarImg){ if(c.hero.avatarUrl){ avatarImg.src=c.hero.avatarUrl; } else { avatarImg.src='assets/img/avatar.png?'+Date.now(); } }
      }
      if(c.social?.links){ Object.entries(c.social.links).forEach(([cls,url])=>{ const a=document.querySelector(`.social-links a.icon.${cls}`); if(a && url){ if(cls==='mail') a.href='mailto:'+url; else a.href=url; } }); }
      if(c.about){ const aboutIntro=document.querySelector('#about .container > p'); if(aboutIntro && c.about.intro) aboutIntro.textContent=c.about.intro; const ul=document.querySelector('#about .bullets'); if(ul && Array.isArray(c.about.bullets)){ ul.innerHTML=''; c.about.bullets.forEach(b=>{ const li=document.createElement('li'); li.textContent=b; ul.appendChild(li); }); } }
      if(c.skills?.groups){ const grid=document.querySelector('#skills .skills-grid'); if(grid){ const cards=grid.querySelectorAll('.skill-card'); c.skills.groups.forEach((g,i)=>{ let card=cards[i]; if(!card){ card=document.createElement('div'); card.className='skill-card'; grid.appendChild(card);} card.innerHTML = `<h3>${g.title||''}</h3>` + '<ul>' + (g.items||[]).map(it=>`<li>${it}</li>`).join('') + '</ul>'; }); } }
      if(Array.isArray(c.experience)){ const timeline=document.querySelector('#experience .timeline'); if(timeline){ timeline.innerHTML=''; c.experience.forEach(item=>{ const art=document.createElement('article'); art.className='timeline-item'; art.innerHTML = `<div class="time">${item.time||''}</div><div class="content"><h3>${item.company||''} <span class="role">${item.role||''}</span></h3><ul>${(item.highlights||[]).map(h=>`<li>${h}</li>`).join('')}</ul><div class="tech-tags">${(item.tech||[]).map(t=>`<span>${t}</span>`).join('')}</div></div>`; timeline.appendChild(art); }); } }
      if(Array.isArray(c.projects)){ const grid=document.querySelector('#projects .projects-grid'); if(grid){ grid.innerHTML=''; c.projects.forEach(p=>{ const art=document.createElement('article'); art.className='project-card'; art.innerHTML=`<div class="project-thumb"></div><div class="project-body"><h3>${p.name||''}</h3><p>${p.desc||''}</p><ul class="project-highlights">${(p.highlights||[]).map(h=>`<li>${h}</li>`).join('')}</ul><div class="tech-tags small">${(p.tech||[]).map(t=>`<span>${t}</span>`).join('')}</div><div class="project-links">${(p.links||[]).map(l=>`<a href="${l.url||'#'}" class="text-link" target="_blank" rel="noopener">${l.label||'Link'}</a>`).join('')}</div></div>`; grid.appendChild(art); }); } }
      if(c.education){ const eduGrid=document.querySelector('#education .edu-grid'); if(eduGrid){ eduGrid.innerHTML=''; const schoolsWrap=document.createElement('div'); schoolsWrap.className='edu-item'; (c.education.schools||[]).forEach(s=>{ const d=document.createElement('div'); d.innerHTML=`<h3>${s.name||''}</h3><p>${s.detail||''}</p>${s.gpa?`<p><strong>GPA:</strong> ${s.gpa}</p>`:''}`; schoolsWrap.appendChild(d); }); const certWrap=document.createElement('div'); certWrap.className='edu-item'; certWrap.innerHTML = `<h3>Chứng chỉ</h3><ul>${(c.education.certs||[]).map(cer=>`<li>${cer}</li>`).join('')}</ul>`; eduGrid.appendChild(schoolsWrap); eduGrid.appendChild(certWrap); } }
      if(c.contact){ const list=document.querySelector('#contact .info-list'); if(list){ list.innerHTML=''; const add=(label,value,isLink=false,hrefPrefix='')=>{ if(!value) return; const li=document.createElement('li'); if(isLink){ li.innerHTML=`<strong>${label}:</strong> <a href="${hrefPrefix+value}" target="_blank" rel="noopener">${value}</a>`; } else { li.innerHTML=`<strong>${label}:</strong> ${value}`; } list.appendChild(li); }; add('Email',c.contact.email,true,'mailto:'); add('Điện thoại',c.contact.phone,true,'tel:'); add('Địa điểm',c.contact.location); add('LinkedIn',c.contact.linkedin,true,c.contact.linkedin&&c.contact.linkedin.startsWith('http')?'':'https://'); } const avail=document.querySelector('#contact .availability'); if(avail && c.contact.availability) avail.textContent=c.contact.availability; }
    } catch(e){ console.warn('Dynamic content error', e); }
  }
  if(STATIC_MODE){ fetch('data/content.json').then(r=> r.ok ? r.json(): null).then(js=>{ if(js) applyContent(js); }).catch(()=>{}); }
  else { fetch(API_BASE + '/api/content').then(r=> r.ok ? r.json(): null).then(js=>{ if(js && js.ok) applyContent(js.content||{}); }).catch(()=>{}); }
})();

