const OWNER = 'echofsadness'; // e.g. 'your-github-username'
const REPO = 'TURanking'; // e.g. 'my-ranks-repo'
const PATH = 'ranks.json'; // path inside repo
const BRANCH = 'main'; // branch that GitHub Pages uses. Use 'main' or 'master' if appropriate

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
