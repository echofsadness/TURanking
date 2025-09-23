const OWNER = 'echofsadness'; 
const REPO = 'TURanking';   
const PATH = 'ranks.json';        
const BRANCH = 'main';       

const PUBLIC_JSON_URL = `https://${OWNER}.github.io/${REPO}/${PATH}`; 
const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;

const jsonView = document.getElementById('jsonView');
const manual = document.getElementById('manual');
const playerInput = document.getElementById('player');
const rankInput = document.getElementById('rank');
const updateBtn = document.getElementById('updateBtn');
const reloadBtn = document.getElementById('reloadBtn');
const saveManualBtn = document.getElementById('saveManualBtn');
const clearManual = document.getElementById('clearManual');

let current = {}; // object in memory

async function fetchPublicJson(){
  try{
    const r = await fetch(PUBLIC_JSON_URL + '?cachebuster=' + Date.now());
    if(!r.ok) throw new Error('Pages URL failed');
    const j = await r.json();
    return j;
  }catch(e){
    try{
      const r2 = await fetch(RAW_URL + '?cachebuster=' + Date.now());
      if(!r2.ok) throw new Error('Raw URL failed');
      const j2 = await r2.json();
      return j2;
    }catch(e2){
      throw new Error('Failed to fetch public JSON from Pages or raw.githubusercontent');
    }
  }
}

async function showCurrent(){
  try{
    const j = await fetchPublicJson();
    current = j;
    jsonView.textContent = JSON.stringify(current, null, 2);
    manual.value = JSON.stringify(current, null, 2);
  }catch(err){
    jsonView.textContent = 'Error: ' + err.message;
    manual.value = '';
    Swal.fire({icon:'error',title:'ไม่สามารถโหลด JSON',text: err.message})
  }
}

// --- GitHub API helpers (for writing) ---
async function getFileSha(token){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`;
  const res = await fetch(url, {headers:{Authorization:'token '+token, Accept:'application/vnd.github.v3+json'}});
  if(!res.ok) throw new Error('Failed to get file metadata: '+res.statusText);
  const data = await res.json();
  return data.sha;
}

async function putFile(token, contentObj, message){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const bodyObj = {
    message: message || 'Update ranks.json via web form',
    content: btoa(unescape(encodeURIComponent(JSON.stringify(contentObj, null, 2)))), // base64
    branch: BRANCH
  };

  try{
    const sha = await getFileSha(token);
    bodyObj.sha = sha;
  }catch(e){
    // file might not exist yet; skip sha
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers:{
      Authorization: 'token '+token,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type':'application/json'
    },
    body: JSON.stringify(bodyObj)
  });

  if(!res.ok){
    const txt = await res.text();
    throw new Error('GitHub API failed: ' + res.status + ' ' + txt);
  }
  return await res.json();
}

// UI actions
updateBtn.addEventListener('click', async ()=>{
  const player = playerInput.value.trim();
  const rank = rankInput.value.trim();
  if(player === ''){ 
    Swal.fire({icon:'warning',title:'กรุณากรอกชื่อผู้เล่น'});
    return; 
  }

  const newObj = Object.assign({}, current);
  if(rank === ''){
    delete newObj[player];
  } else {
    newObj[player] = rank;
  }

  const { value: token } = await Swal.fire({
    title: 'Paste GitHub PAT',
    input: 'password',
    inputPlaceholder: 'Personal Access Token',
    inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
    showCancelButton: true
  });

  if(!token){ Swal.fire({icon:'info',title:'Operation cancelled — token required to write.'}); return; }

  try{
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';
    await putFile(token, newObj, `Update rank for ${player}`);
    await Swal.fire({icon:'success',title:'Updated successfully',text:'Reloading view — may take a few seconds to propagate to Pages.'});
    await showCurrent();
  }catch(err){
    Swal.fire({icon:'error',title:'Error updating file',text: err.message});
  }finally{
    updateBtn.disabled = false;
    updateBtn.textContent = 'Update';
  }
});

reloadBtn.addEventListener('click', ()=> showCurrent());

saveManualBtn.addEventListener('click', async ()=>{
  let parsed;
  try{ parsed = JSON.parse(manual.value); }catch(e){ Swal.fire({icon:'error',title:'Invalid JSON'}); return; }
  const { value: token } = await Swal.fire({
    title: 'Paste GitHub PAT',
    input: 'password',
    inputPlaceholder: 'Personal Access Token',
    inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
    showCancelButton: true
  });
  if(!token) return;
  try{
    saveManualBtn.disabled = true;
    saveManualBtn.textContent = 'Saving...';
    await putFile(token, parsed, 'Manual update of ranks.json');
    await Swal.fire({icon:'success',title:'Saved.'});
    await showCurrent();
  }catch(err){ Swal.fire({icon:'error',title:'Error',text:err.message}); }
  finally{ saveManualBtn.disabled = false; saveManualBtn.textContent = 'Save manual JSON'; }
});

clearManual.addEventListener('click', ()=>{ manual.value = ''; });

// Initialize view
showCurrent();
