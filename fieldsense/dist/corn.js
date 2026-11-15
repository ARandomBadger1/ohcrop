// Same-origin API: serve this dashboard from the UNO Q inference app.
(()=>{
const el=id=>document.getElementById(id);
const names={healthy:'Healthy leaf',common_rust:'Common rust',gray_leaf_spot:'Gray leaf spot',northern_leaf_blight:'Northern leaf blight'};
let busy=false,last=null,live=true,cameraReady=false,streamStarted=false;
function show(result,isLive=false){
 window.CornAdvice.show(result,isLive);
 last=result;el('cornResult').textContent=result.display;
 el('cornScore').textContent=result.status==='non_target'?`Corn target score ${(result.target_probability*100).toFixed(1)}% — disease classification skipped`:`Disease confidence ${(result.confidence*100).toFixed(1)}% · corn target ${(result.target_probability*100).toFixed(1)}% · inference ${result.inference_ms} ms`;
 el('cornMessage').textContent=`${result.source} · ${new Date(result.timestamp).toLocaleString()} · ${result.field==='unassigned'?'No field assigned':result.field+' field'}`;
 if(!isLive)el('cornPreview').src=`/api/images/${encodeURIComponent(result.id)}.jpg`;
 el('cornPreview').hidden=false;el('cornPlaceholder').hidden=true;
 el('cornProbabilities').replaceChildren(...Object.entries(result.probabilities).sort((a,b)=>b[1]-a[1]).map(([key,value])=>{
  const row=document.createElement('div');row.className='corn-probability';
  const label=document.createElement('span');label.textContent=names[key]||key;
  const score=document.createElement('b');score.textContent=(value*100).toFixed(1)+'%';row.append(label,score);return row;
 }));
}
function syncEvents(rows){
 const reviewed=new Set(events.filter(e=>e.real&&e.status==='Reviewed').map(e=>e.id));
 events=events.filter(e=>!e.real);
 for(const row of [...rows].reverse()) events.unshift({real:true,id:row.id,field:row.field,
  title:row.display,source:`Local corn model · ${(row.confidence*100).toFixed(1)}% confidence`,
  time:new Date(row.timestamp).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
  status:reviewed.has(row.id)?'Reviewed':'Needs review',icon:'🌽',body:`${row.display}. Model confidence ${(row.confidence*100).toFixed(1)}%. Source: ${row.source}. Captured ${new Date(row.timestamp).toLocaleString()}. This is a four-class leaf screening prediction; verify suspected disease before taking action.`});
 renderEvents();
}
async function refresh(){
 try{
  const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error('Local model API unavailable');
  const status=await response.json();if(!status.local_inference)throw Error('Local model API unavailable');
  el('cornConnection').textContent='Local model connected';
  cameraReady=status.camera.available;
  el('cornCapture').disabled=!cameraReady||busy;
  if(live&&cameraReady&&!streamStarted){el('cornPreview').src='/api/stream';el('cornPreview').hidden=false;el('cornPlaceholder').hidden=true;streamStarted=true;}
  if(!last)el('cornMessage').textContent=status.camera.available?'USB camera ready. Confirm a corn leaf, then analyze.':status.camera.error||'Camera unavailable; upload a leaf photo.';
  const r=await fetch('/api/events',{cache:'no-store'});if(!r.ok)throw Error('Cannot load events');const rows=await r.json();syncEvents(rows);
  if(rows.length&&!last)show(rows[0]);
 }catch(e){el('cornConnection').textContent='Local model offline';el('cornCapture').disabled=true;el('cornMessage').textContent='Open Oh, Crop! from the UNO Q address on port 8080. Environmental demo remains available.';}
}
async function analyze(file){
 if(busy)return;
 if(file&&live)setLive(false);
 if(!el('cornConfirm').checked){el('cornMessage').textContent='Please confirm that the image shows a single corn leaf close-up.';return;}
 busy=true;el('cornCapture').disabled=true;el('cornUpload').disabled=true;el('cornMessage').textContent='Analyzing on the local device…';
 try{
  const data=new FormData();data.set('corn_leaf_confirmed','true');data.set('field',el('cornField').value);if(file)data.set('image',file);
  const response=await fetch('/api/predict',{method:'POST',body:data});const result=await response.json();if(!response.ok)throw Error(result.error||'Analysis failed');show(result);if(live){streamStarted=false;}await refresh();
 }catch(e){el('cornMessage').textContent=e.message;}
 finally{busy=false;el('cornUpload').disabled=false;el('cornUpload').value='';await refresh();}
}
function setLive(value){
 window.CornAdvice.reset();live=value;streamStarted=false;el('cornLive').textContent=live?'Pause live recognition':'Start live recognition';
 if(!live){el('cornPreview').src='/api/snapshot?t='+Date.now();el('cornMessage').textContent='Live recognition paused.';}
 else refresh();
}
el('cornLive').onclick=()=>setLive(!live);
async function liveLoop(){
 try{
  if(live&&cameraReady&&!busy){
   const r=await fetch('/api/live-predict',{method:'POST'});const result=await r.json();
   if(!r.ok)throw Error(result.error||'Camera prediction failed');
   if(live)show(result,true);
  }
 }catch(e){if(live){window.CornAdvice.show({status:'uncertain'});el('cornMessage').textContent=e.message;}}
 finally{setTimeout(liveLoop,250);}
}
liveLoop();
el('cornCapture').onclick=()=>analyze();el('cornUpload').onchange=e=>{if(e.target.files[0])analyze(e.target.files[0]);};
fetch('/samples/index.json').then(r=>r.ok?r.json():[]).then(rows=>{el('cornSamples').replaceChildren(...rows.map(row=>{const a=document.createElement('button');a.className='text-button';a.textContent='Test '+(names[row.label]||row.label);a.onclick=async()=>{try{const r=await fetch('/samples/'+encodeURIComponent(row.file));if(!r.ok)throw Error('Sample unavailable');const blob=await r.blob();if(live)setLive(false);await analyze(new File([blob],row.file,{type:'image/jpeg'}));}catch(e){el('cornMessage').textContent=e.message;}};return a;}));}).catch(()=>{});
refresh();setInterval(refresh,5000);
})();
