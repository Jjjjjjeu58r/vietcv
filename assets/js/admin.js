// Determine API base: use relative paths when already served via HTTP to avoid origin/path mismatches.
const API_BASE = (location.origin && location.origin.startsWith('http')) ? '' : 'http://localhost:3000';
let token = '';
let content = {};

const app = document.getElementById('app');
const pinBox = document.getElementById('pin-box');
const pinInput = document.getElementById('pin-input');
const pinBtn = document.getElementById('pin-btn');
const pinStatus = document.getElementById('pin-status');
const sectionsWrap = document.getElementById('sections');
const rawJson = document.getElementById('raw-json');
const saveBtn = document.getElementById('save-btn');
const reloadBtn = document.getElementById('reload-btn');
const toastEl = document.getElementById('toast');
const sessionStatus = document.getElementById('session-status');

function toast(msg, ok=true){
  toastEl.textContent = msg;
  toastEl.style.borderColor = ok? '#10b981':'#f87171';
  toastEl.classList.add('show');
  setTimeout(()=> toastEl.classList.remove('show'), 2600);
}

async function api(path, opts={}){
  const headers = opts.headers || {}; headers['Content-Type']='application/json';
  if(token) headers['Authorization'] = 'Bearer '+token;
  let resp;
  try{
    resp = await fetch(API_BASE+path, {...opts, headers});
  }catch(e){
    throw new Error('network');
  }
  if(resp.status === 401){ throw new Error('unauthorized'); }
  let js = null;
  try{ js = await resp.json(); }catch(e){ throw new Error('bad_json'); }
  return js;
}

// No login required (public admin mode) – WARNING: không bảo mật, chỉ dùng nội bộ

async function loadContent(){
  sectionsWrap.innerHTML = 'Đang tải...';
  try{
    const js = await api('/api/content');
    if(js.ok){ content = js.content || {}; renderEditors(); rawJson.textContent = JSON.stringify(content, null, 2); }
  }catch(e){ sectionsWrap.textContent='Không tải được nội dung.'; if(e.message==='unauthorized'){ logout(); } }
}

function logout(){ location.reload(); }

function renderEditors(){
  sectionsWrap.innerHTML='';
  // Hero
  addPanel('Hero', panel=>{
    panel.appendChild(inputField('Tên', content.hero?.name || '', v=> set(['hero','name'], v)));
    panel.appendChild(inputField('Tiêu đề', content.hero?.title || '', v=> set(['hero','title'], v)));
    panel.appendChild(textAreaField('Tóm tắt', content.hero?.summary || '', v=> set(['hero','summary'], v)));
  panel.appendChild(inputField('CV Button Text', content.hero?.actions?.cvText || '', v=>{ if(!content.hero.actions) content.hero.actions={}; content.hero.actions.cvText=v; dirty(); schedulePreview(); }));
  panel.appendChild(inputField('CV File Link', content.hero?.actions?.cvHref || '', v=>{ if(!content.hero.actions) content.hero.actions={}; content.hero.actions.cvHref=v; dirty(); schedulePreview(); }));
    // Avatar upload
    const avatarWrap = document.createElement('div');
    const lbl = document.createElement('label'); lbl.textContent='Avatar (tải ảnh mới)'; lbl.style.display='block'; lbl.style.fontSize='.75rem'; lbl.style.opacity=.8; lbl.style.marginTop='.5rem';
  const preview = document.createElement('img'); 
  function avatarUrl(){ return (API_BASE||'') + '/assets/img/avatar.png?'+Date.now(); }
  preview.src= avatarUrl(); 
  preview.alt='Avatar'; preview.style.width='120px'; preview.style.height='120px'; preview.style.objectFit='cover'; preview.style.borderRadius='50%'; preview.style.display='block'; preview.style.margin='0.5rem 0'; preview.style.border='2px solid #222';
    const file = document.createElement('input'); file.type='file'; file.accept='image/png,image/jpeg,image/webp'; file.style.marginTop='.35rem';
    const upBtn = document.createElement('button'); upBtn.textContent='Tải lên'; upBtn.type='button'; upBtn.className='secondary'; upBtn.style.marginLeft='.6rem';
    const status = document.createElement('div'); status.style.fontSize='.65rem'; status.style.marginTop='.4rem'; status.style.opacity=.8;
    // Avatar URL (file link) input
    const urlDiv = document.createElement('div');
    const urlLabel = document.createElement('label'); urlLabel.textContent='Avatar URL (File link)'; urlLabel.style.display='block'; urlLabel.style.fontSize='.65rem'; urlLabel.style.opacity=.8; urlLabel.style.marginTop='.75rem';
    const urlInput = document.createElement('input'); urlInput.type='text'; urlInput.placeholder='https://... (để trống dùng ảnh tải lên)'; urlInput.value = content.hero?.avatarUrl || '';
    urlInput.addEventListener('input', ()=>{
      if(!content.hero) content.hero={};
      content.hero.avatarUrl = urlInput.value.trim();
      dirty(); schedulePreview();
      if(urlInput.value.trim()){
        preview.src = urlInput.value.trim();
        status.textContent='Đang tải xem trước URL...';
      } else {
        preview.src = avatarUrl();
        status.textContent='Sử dụng ảnh đã upload (nếu có).';
      }
    });
    preview.addEventListener('error', ()=>{ if(urlInput.value.trim()){ status.textContent='Không tải được ảnh URL, kiểm tra đường dẫn.'; preview.src = avatarUrl(); } });
    urlDiv.appendChild(urlLabel); urlDiv.appendChild(urlInput);
    file.addEventListener('change', ()=>{ 
      status.textContent='';
      const f=file.files[0]; if(!f) return;
      if(f.size > 2*1024*1024){ status.textContent='File >2MB, hãy chọn ảnh nhỏ hơn.'; file.value=''; return; }
      if(!/\.(png|jpg|jpeg|webp)$/i.test(f.name)){ status.textContent='Định dạng không hợp lệ (png/jpg/webp).'; file.value=''; return; }
      const r=new FileReader(); r.onload= e=>{ preview.src=e.target.result; }; r.readAsDataURL(f);
    });
    upBtn.addEventListener('click', async ()=>{
      const f = file.files && file.files[0]; if(!f){ status.textContent='Chưa chọn file'; return; }
      if(f.size > 2*1024*1024){ status.textContent='File quá lớn (>2MB)'; return; }
      status.textContent='Đang tải...';
      upBtn.disabled = true; upBtn.textContent='Đang tải...';
      const fd = new FormData(); fd.append('avatar', f);
      try{
  const resp = await fetch((API_BASE||'') + '/api/upload/avatar', { method:'POST', body: fd });
        let js=null; try{ js = await resp.json(); }catch(parseErr){ status.textContent='Phản hồi không hợp lệ'; }
        if(!resp.ok){
          status.textContent = 'Lỗi '+resp.status+': '+ (js && js.error || resp.statusText);
        } else if(js && js.ok){
          status.textContent='Đã cập nhật avatar'; preview.src= avatarUrl(); toast('Avatar cập nhật');
        } else {
          status.textContent='Tải thất bại';
        }
      }catch(e){
        status.textContent='Lỗi mạng (server chưa chạy?)';
        // Thử ping nhẹ để gợi ý
  try{ fetch((API_BASE||'') + '/api/content',{method:'GET'}).catch(()=>{}); }catch(_){ }
      } finally {
        upBtn.disabled=false; upBtn.textContent='Tải lên';
      }
    });
    const line = document.createElement('div'); line.style.display='flex'; line.style.alignItems='center'; line.appendChild(file); line.appendChild(upBtn);
  avatarWrap.appendChild(lbl); avatarWrap.appendChild(preview); avatarWrap.appendChild(line); avatarWrap.appendChild(urlDiv); avatarWrap.appendChild(status); panel.appendChild(avatarWrap);
  });
  // About
  addPanel('Giới thiệu', panel=>{
    panel.appendChild(textAreaField('Đoạn giới thiệu', content.about?.intro || '', v=> set(['about','intro'], v)));
    panel.appendChild(textArrayField('Gạch đầu dòng', content.about?.bullets || [], v=> set(['about','bullets'], v)));
  });
  // Skills
  addPanel('Kỹ năng', panel=>{
    const groups = content.skills?.groups || [];
    groups.forEach((g,i)=>{
      const wrap = document.createElement('div'); wrap.style.border='1px solid #222'; wrap.style.padding='.6rem .7rem'; wrap.style.borderRadius='6px'; wrap.style.marginBottom='.6rem'; wrap.style.position='relative';
      const del = document.createElement('button'); del.textContent='✕'; del.title='Xóa nhóm'; del.style.position='absolute'; del.style.top='.3rem'; del.style.right='.35rem'; del.style.background='#b91c1c'; del.style.border='none'; del.style.color='#fff'; del.style.padding='.2rem .45rem'; del.style.fontSize='.65rem'; del.style.borderRadius='4px'; del.style.cursor='pointer';
      del.addEventListener('click', ()=>{ content.skills.groups.splice(i,1); dirty(); renderEditors(); });
      wrap.appendChild(del);
      wrap.appendChild(textField(`Nhóm ${i+1} - Tiêu đề`, g.title || '', v=>{ g.title=v; dirty(); }));
      wrap.appendChild(textArrayField(`Nhóm ${i+1} - Items`, g.items || [], v=>{ g.items=v; dirty(); }));
      panel.appendChild(wrap);
    });
  const addBtn = document.createElement('button'); addBtn.textContent='Thêm nhóm kỹ năng'; addBtn.className='secondary'; addBtn.style.marginTop='0.75rem';
  addBtn.addEventListener('click', ()=>{ if(!content.skills) content.skills={groups:[]}; if(!content.skills.groups) content.skills.groups=[]; content.skills.groups.push({title:'Nhóm mới', items:[]}); dirty(); renderEditors(); });
  panel.appendChild(addBtn);
  });
  // Experience
  addPanel('Kinh nghiệm', panel=>{
    const exp = content.experience || [];
    exp.forEach((item,i)=>{
      const wrap = document.createElement('div'); wrap.style.border='1px solid #222'; wrap.style.padding='.6rem .7rem'; wrap.style.borderRadius='6px'; wrap.style.marginBottom='.6rem'; wrap.style.position='relative';
      const del = document.createElement('button'); del.textContent='✕'; del.title='Xóa mục'; del.style.position='absolute'; del.style.top='.3rem'; del.style.right='.35rem'; del.style.background='#b91c1c'; del.style.border='none'; del.style.color='#fff'; del.style.padding='.2rem .45rem'; del.style.fontSize='.65rem'; del.style.borderRadius='4px'; del.style.cursor='pointer';
      del.addEventListener('click', ()=>{ content.experience.splice(i,1); dirty(); renderEditors(); });
      wrap.appendChild(del);
      wrap.appendChild(textField(`Mục ${i+1} - Thời gian`, item.time||'', v=>{item.time=v;dirty();}));
      wrap.appendChild(textField(`Mục ${i+1} - Công ty`, item.company||'', v=>{item.company=v;dirty();}));
      wrap.appendChild(textField(`Mục ${i+1} - Vai trò`, item.role||'', v=>{item.role=v;dirty();}));
      wrap.appendChild(textArrayField(`Mục ${i+1} - Highlights`, item.highlights||[], v=>{item.highlights=v;dirty();}));
      wrap.appendChild(textArrayField(`Mục ${i+1} - Tech`, item.tech||[], v=>{item.tech=v;dirty();}));
      panel.appendChild(wrap);
    });
  const addExp = document.createElement('button'); addExp.textContent='Thêm kinh nghiệm'; addExp.className='secondary'; addExp.addEventListener('click', ()=>{ if(!content.experience) content.experience=[]; content.experience.push({time:'',company:'',role:'',highlights:[],tech:[]}); dirty(); renderEditors(); }); panel.appendChild(addExp);
  });
  // Projects
  addPanel('Dự án', panel=>{
    const prj = content.projects || [];
    prj.forEach((p,i)=>{
      const wrap = document.createElement('div'); wrap.style.border='1px solid #222'; wrap.style.padding='.6rem .7rem'; wrap.style.borderRadius='6px'; wrap.style.marginBottom='.6rem'; wrap.style.position='relative';
      const del = document.createElement('button'); del.textContent='✕'; del.title='Xóa dự án'; del.style.position='absolute'; del.style.top='.3rem'; del.style.right='.35rem'; del.style.background='#b91c1c'; del.style.border='none'; del.style.color='#fff'; del.style.padding='.2rem .45rem'; del.style.fontSize='.65rem'; del.style.borderRadius='4px'; del.style.cursor='pointer';
      del.addEventListener('click', ()=>{ content.projects.splice(i,1); dirty(); renderEditors(); });
      wrap.appendChild(del);
      wrap.appendChild(textField(`Dự án ${i+1} - Tên`, p.name||'', v=>{p.name=v;dirty();}));
      wrap.appendChild(textAreaField(`Dự án ${i+1} - Mô tả`, p.desc||'', v=>{p.desc=v;dirty();}));
      wrap.appendChild(textArrayField(`Dự án ${i+1} - Điểm nổi bật`, p.highlights||[], v=>{p.highlights=v;dirty();}));
      wrap.appendChild(textArrayField(`Dự án ${i+1} - Tech`, p.tech||[], v=>{p.tech=v;dirty();}));
      wrap.appendChild(linkArrayField(`Dự án ${i+1} - Links`, p.links||[], v=>{p.links=v;dirty();}));
      panel.appendChild(wrap);
    });
  const addPrj = document.createElement('button'); addPrj.textContent='Thêm dự án'; addPrj.className='secondary'; addPrj.addEventListener('click', ()=>{ if(!content.projects) content.projects=[]; content.projects.push({name:'Dự án mới',desc:'',highlights:[],tech:[],links:[]}); dirty(); renderEditors(); }); panel.appendChild(addPrj);
  });
  // Education
  addPanel('Học vấn & Chứng chỉ', panel=>{
    const schools = content.education?.schools || [];
    schools.forEach((s,i)=>{
      const wrap = document.createElement('div'); wrap.style.border='1px solid #222'; wrap.style.padding='.6rem .7rem'; wrap.style.borderRadius='6px'; wrap.style.marginBottom='.6rem'; wrap.style.position='relative';
      const del = document.createElement('button'); del.textContent='✕'; del.title='Xóa trường'; del.style.position='absolute'; del.style.top='.3rem'; del.style.right='.35rem'; del.style.background='#b91c1c'; del.style.border='none'; del.style.color='#fff'; del.style.padding='.2rem .45rem'; del.style.fontSize='.65rem'; del.style.borderRadius='4px'; del.style.cursor='pointer';
      del.addEventListener('click', ()=>{ content.education.schools.splice(i,1); dirty(); renderEditors(); });
      wrap.appendChild(del);
      wrap.appendChild(textField(`Trường ${i+1} - Tên`, s.name||'', v=>{s.name=v;dirty();}));
      wrap.appendChild(textField(`Trường ${i+1} - Chi tiết`, s.detail||'', v=>{s.detail=v;dirty();}));
      wrap.appendChild(textField(`Trường ${i+1} - GPA`, s.gpa||'', v=>{s.gpa=v;dirty();}));
      panel.appendChild(wrap);
    });
    panel.appendChild(textArrayField('Chứng chỉ', content.education?.certs||[], v=>{ content.education.certs=v; dirty(); }));
  const addSchool = document.createElement('button'); addSchool.textContent='Thêm trường'; addSchool.className='secondary'; addSchool.addEventListener('click', ()=>{ if(!content.education) content.education={schools:[],certs:[]}; if(!content.education.schools) content.education.schools=[]; content.education.schools.push({name:'Trường mới',detail:'',gpa:''}); dirty(); renderEditors(); }); panel.appendChild(addSchool);
  const addCert = document.createElement('button'); addCert.textContent='Thêm chứng chỉ rỗng'; addCert.className='secondary'; addCert.style.marginLeft='.5rem'; addCert.addEventListener('click', ()=>{ if(!content.education) content.education={schools:[],certs:[]}; if(!content.education.certs) content.education.certs=[]; content.education.certs.push(''); dirty(); renderEditors(); }); panel.appendChild(addCert);
  });
  // Contact
  addPanel('Liên hệ', panel=>{
    panel.appendChild(textField('Email', content.contact?.email||'', v=> set(['contact','email'], v)));
    panel.appendChild(textField('Điện thoại', content.contact?.phone||'', v=> set(['contact','phone'], v)));
    panel.appendChild(textField('Địa điểm', content.contact?.location||'', v=> set(['contact','location'], v)));
    panel.appendChild(textField('LinkedIn', content.contact?.linkedin||'', v=> set(['contact','linkedin'], v)));
    panel.appendChild(textField('Availability', content.contact?.availability||'', v=> set(['contact','availability'], v)));
  });
  // Social links
  addPanel('Social Links', panel=>{
    if(!content.social) content.social = {links:{}};
    if(!content.social.links) content.social.links = {};
    const keys = ['website','linkedin','github','mail','facebook','x','instagram','youtube','telegram','whatsapp','medium'];
    Object.keys(content.social.links).forEach(k=>{ if(!keys.includes(k)) keys.push(k); });
    keys.forEach(k=>{
      const row = document.createElement('div'); row.style.position='relative';
      row.appendChild(inputField(k, content.social.links[k]||'', v=>{ content.social.links[k]=v; dirty(); schedulePreview(); }));
      const canDel = !['website','linkedin','github','mail','facebook','x','instagram','youtube','telegram','whatsapp','medium'].includes(k);
      if(canDel){
        const del = document.createElement('button'); del.textContent='X'; del.title='Xóa link'; del.style.position='absolute'; del.style.top='0'; del.style.right='0'; del.style.background='#b91c1c'; del.style.border='none'; del.style.color='#fff'; del.style.padding='.2rem .45rem'; del.style.fontSize='.65rem'; del.style.borderRadius='4px'; del.style.cursor='pointer';
        del.addEventListener('click', ()=>{ delete content.social.links[k]; dirty(); renderEditors(); });
        row.appendChild(del);
      }
      panel.appendChild(row);
    });
  const addSocial = document.createElement('button'); addSocial.textContent='Thêm key social mới'; addSocial.className='secondary'; addSocial.addEventListener('click', ()=>{ const newKey = prompt('Tên key (chỉ chữ thường, số, -)'); if(!newKey) return; if(!/^[a-z0-9-]{2,20}$/.test(newKey)) { alert('Key không hợp lệ'); return; } if(!content.social.links) content.social.links={}; if(content.social.links[newKey]) { alert('Key đã tồn tại'); return; } content.social.links[newKey]=''; dirty(); renderEditors(); }); panel.appendChild(addSocial);
  });
  rawJson.textContent = JSON.stringify(content, null, 2);
}

function divider(parent){ const hr=document.createElement('hr'); hr.style.borderColor='#222'; parent.appendChild(hr); }

function addPanel(title, build){
  const wrap = document.createElement('div'); wrap.className='panel';
  const h = document.createElement('h2'); h.textContent=title; wrap.appendChild(h);
  const cont = document.createElement('div'); wrap.appendChild(cont);
  build(cont);
  sectionsWrap.appendChild(wrap);
}

function textField(label, value, onChange){ return inputField(label, value, onChange); }
function inputField(label, value, onChange){
  const div = document.createElement('div');
  const l = document.createElement('label'); l.textContent=label; l.style.display='block'; l.style.fontSize='.75rem'; l.style.opacity=.8; l.style.marginTop='.5rem';
  const inp = document.createElement('input'); inp.type='text'; inp.value = value;
  inp.addEventListener('input', ()=>{ onChange(inp.value); dirty(); schedulePreview(); });
  div.appendChild(l); div.appendChild(inp); return div;
}
function textAreaField(label, value, onChange){
  const div = document.createElement('div');
  const l = document.createElement('label'); l.textContent=label; l.style.display='block'; l.style.fontSize='.75rem'; l.style.opacity=.8; l.style.marginTop='.5rem';
  const ta = document.createElement('textarea'); ta.value=value; ta.rows=3;
  ta.addEventListener('input', ()=>{ onChange(ta.value); dirty(); schedulePreview(); });
  div.appendChild(l); div.appendChild(ta); return div;
}
function textArrayField(label, arr, onChange){
  const div = document.createElement('div');
  const l = document.createElement('label'); l.textContent=label; l.style.display='block'; l.style.fontSize='.75rem'; l.style.opacity=.8; l.style.marginTop='.5rem';
  const ta = document.createElement('textarea'); ta.value = arr.join('\n'); ta.rows=4;
  ta.addEventListener('input', ()=>{ onChange(ta.value.split(/\n+/).map(v=>v.trim()).filter(Boolean)); dirty(); schedulePreview(); });
  div.appendChild(l); div.appendChild(ta); return div;
}
function linkArrayField(label, arr, onChange){
  const div = document.createElement('div');
  const l = document.createElement('label'); l.textContent=label; l.style.display='block'; l.style.fontSize='.75rem'; l.style.opacity=.8; l.style.marginTop='.5rem';
  const ta = document.createElement('textarea'); ta.value = arr.map(o=>`${o.label}|${o.url}`).join('\n'); ta.rows=4;
  ta.addEventListener('input', ()=>{ onChange(ta.value.split(/\n+/).map(v=>v.trim()).filter(Boolean).map(line=>{ const [label,url] = line.split('|'); return {label:label?.trim()||'', url:url?.trim()||''}; })); dirty(); schedulePreview(); });
  div.appendChild(l); div.appendChild(ta); return div;
}

function set(pathArr, value){
  let cur = content; for(let i=0;i<pathArr.length-1;i++){ if(!cur[pathArr[i]]) cur[pathArr[i]] = {}; cur = cur[pathArr[i]]; }
  cur[pathArr[pathArr.length-1]] = value; dirty(); schedulePreview();
}

let dirtyFlag=false; function dirty(){ dirtyFlag=true; saveBtn.textContent='Lưu tất cả *'; }

let previewTimer=null; function schedulePreview(){ clearTimeout(previewTimer); previewTimer=setTimeout(()=> rawJson.textContent = JSON.stringify(content, null, 2), 400); }

async function save(){
  if(!dirtyFlag){ toast('Không có thay đổi'); return; }
  try{ const js = await api('/api/content', {method:'PUT', body:JSON.stringify(content)}); if(js.ok){ toast('Đã lưu'); dirtyFlag=false; saveBtn.textContent='Lưu tất cả'; } else toast('Lưu thất bại', false); }catch(e){ toast('Lỗi lưu', false); if(e.message==='unauthorized') logout(); }
}

saveBtn.addEventListener('click', save);
reloadBtn.addEventListener('click', loadContent);

// Init directly
(function pinGate(){
  app.style.display='none';
  function enter(){
    const val = (pinInput.value||'').trim();
    if(val === '2006'){
      pinBox.classList.add('hidden');
      app.style.display='block';
      loadContent();
      sessionStatus.textContent='Đã xác thực bằng PIN.';
    } else {
      pinStatus.textContent='Sai PIN';
    }
  }
  pinBtn?.addEventListener('click', enter);
  pinInput?.addEventListener('keydown', e=>{ if(e.key==='Enter') enter(); });
})();
