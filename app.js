const OWNER = 'echofsadness'; 
const REPO = 'TURanking';  
const PATH = 'ranks.json';      
const BRANCH = 'main';        

const PUBLIC_JSON_URL = `https://${OWNER}.github.io/${REPO}/${PATH}`;
const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${PATH}`;

const jsonView = document.getElementById('jsonView');
const manual = document.getElementById('manual');
const unitInput = document.getElementById('unit');
const usernameInput = document.getElementById('username');
const rankInput = document.getElementById('rank');
const applyBtn = document.getElementById('applyBtn');
const reloadBtn = document.getElementById('reloadBtn');
const saveManualBtn = document.getElementById('saveManualBtn');
const clearManual = document.getElementById('clearManual');

let current = {};

async function fetchPublicJson(){
  try {
    const r = await fetch(PUBLIC_JSON_URL + '?cachebuster=' + Date.now());
    if (!r.ok) throw new Error('Pages URL failed');
    return await r.json();
  } catch(e) {
    try {
      const r2 = await fetch(RAW_URL + '?cachebuster=' + Date.now());
      if (!r2.ok) throw new Error('Raw URL failed');
      return await r2.json();
    } catch(e2) {
      throw new Error('Failed to fetch public JSON (Pages/raw)');
    }
  }
}

async function showCurrent(){
  try {
    const j = await fetchPublicJson();
    current = j || {};
    jsonView.textContent = JSON.stringify(current, null, 2);
    manual.value = JSON.stringify(current, null, 2);
  } catch(err) {
    jsonView.textContent = 'Error: ' + err.message;
    manual.value = '';
    Swal.fire({icon:'error', title:'ไม่สามารถโหลด JSON', text: err.message});
  }
}

async function getFileSha(token){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }});
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Failed to get file metadata: ' + res.status + ' ' + txt);
  }
  const data = await res.json();
  return data.sha;
}

async function putFile(token, contentObj, message){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const bodyObj = {
    message: message || 'Update ranks.json via web form',
    content: btoa(unescape(encodeURIComponent(JSON.stringify(contentObj, null, 2)))),
    branch: BRANCH
  };
  try {
    const sha = await getFileSha(token);
    bodyObj.sha = sha;
  } catch(e) {
   
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: 'token ' + token,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyObj)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('GitHub API failed: ' + res.status + ' ' + txt);
  }
  return await res.json();
}

function isDepartmentMode(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const k in obj) {
    if (k === '_order') continue;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      return true; 
    }
  }
  return false;
}

applyBtn.addEventListener('click', async () => {
  const unit = unitInput.value.trim();
  const username = usernameInput.value.trim();
  const rank = rankInput.value.trim();

  if (!unit) {
    Swal.fire({icon:'warning', title:'กรุณากรอก Unit', text:'Unit is required.'});
    return;
  }

  try {
    const j = await fetchPublicJson();
    current = j || {};
  } catch(e) {
    Swal.fire({icon:'warning', title:'ไม่สามารถโหลด JSON ใหม่', text: e.message});
  }

  const deptMode = isDepartmentMode(current);

  if (!deptMode) {
    const hasAny = Object.keys(current || {}).length > 0;
    if (hasAny) {
      const res = await Swal.fire({
        title: 'ranks.json ไม่ใช่ department mode',
        html: 'ไฟล์ปัจจุบันเป็นแบบ simple mapping (username → rank).<br>คุณต้องการแปลงเป็น department mode และย้ายรายการเดิมทั้งหมดเข้าไปในหน่วยที่คุณระบุหรือไม่?<br><b>Yes</b>: ย้ายรายการเดิมไปที่หน่วย <i>' + unit + '</i> และดำเนินการต่อ<br><b>No</b>: ยกเลิก',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Convert & Continue',
        cancelButtonText: 'Cancel'
      });
      if (!res.isConfirmed) {
        return;
      } else {
        const newObj = {};
        newObj["_order"] = [unit];
        newObj[unit] = {};
        for (const k in current) {
          if (Object.prototype.hasOwnProperty.call(current, k)) {
            const v = current[k];
            if (typeof v === 'string') {
              newObj[unit][k] = v;
            }
          }
        }
        current = newObj;
      }
    } else {
      current = {};
    }
  }

 
  if (typeof current[unit] !== 'object' || current[unit] === null || Array.isArray(current[unit])) {
    current[unit] = {};
    if (!Array.isArray(current["_order"])) {
      current["_order"] = current["_order"] || [];
    }
    if (!current["_order"].includes(unit)) {
      current["_order"].push(unit);
    }
  }

  
  if (username) {
    if (rank) {
      current[unit][username] = rank;
    } else {
      if (current[unit] && Object.prototype.hasOwnProperty.call(current[unit], username)) {
        delete current[unit][username];
      }
    }
  } else {
  }

  const { value: token } = await Swal.fire({
    title: 'Paste GitHub PAT',
    input: 'password',
    inputPlaceholder: 'Personal Access Token (with repo permission if private)',
    inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
    showCancelButton: true
  });

  if (!token) {
    Swal.fire({icon:'info', title:'Operation cancelled', text:'Token required to write.'});
    return;
  }

  try {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Applying...';
    const commitMsg = username
      ? (rank ? `Set ${username} -> ${rank} in ${unit}` : `Remove ${username} from ${unit}`)
      : `Ensure unit ${unit} exists`;

    await putFile(token, current, commitMsg);
    await Swal.fire({icon:'success', title:'Applied', text:'ranks.json updated — reloading view.'});
    await showCurrent();
  } catch(err) {
    Swal.fire({icon:'error', title:'Error updating file', text: err.message});
  } finally {
    applyBtn.disabled = false;
    applyBtn.textContent = 'Apply';
  }
});

reloadBtn.addEventListener('click', () => showCurrent());

saveManualBtn.addEventListener('click', async () => {
  let parsed;
  try {
    parsed = JSON.parse(manual.value);
  } catch(e) {
    Swal.fire({icon:'error', title:'Invalid JSON'});
    return;
  }
  const { value: token } = await Swal.fire({
    title: 'Paste GitHub PAT',
    input: 'password',
    showCancelButton: true
  });
  if (!token) return;
  try {
    saveManualBtn.disabled = true; saveManualBtn.textContent = 'Saving...';
    await putFile(token, parsed, 'Manual update of ranks.json');
    await Swal.fire({icon:'success', title:'Saved.'});
    await showCurrent();
  } catch(err) {
    Swal.fire({icon:'error', title:'Error', text: err.message});
  } finally {
    saveManualBtn.disabled = false; saveManualBtn.textContent = 'Save manual JSON';
  }
});

clearManual.addEventListener('click', () => { manual.value = ''; });

await showCurrent();
