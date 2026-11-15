const $=s=>document.querySelector(s);
const fields={all:{temp:26.4,moist:34,humidity:62},north:{temp:25.1,moist:41,humidity:65},east:{temp:29.8,moist:24,humidity:56},south:{temp:24.3,moist:37,humidity:64}};
let selected='all',metric='temp',activeEvent=null;
let events=[];
let environment=null;
const environmentHistory=[];
const name=f=>f==='unassigned'?'Unassigned':f==='all'?'All fields':f[0].toUpperCase()+f.slice(1)+' field';
function render(){const d=fields[selected];$('#stats').innerHTML=[['Air temperature',environment?.available?environment.temperature_c.toFixed(1):'—','°C',environment?.available?'Live · Modulino Thermo · at device':'Sensor unavailable · no live reading','☀'],['Soil moisture',d.moist,'% ',selected==='east'?'Simulated · below demo threshold':'Simulated soil moisture','◉'],['Relative humidity',environment?.available?environment.humidity_pct.toFixed(1):'—','%',environment?.available?'Live · Modulino Thermo · at device':'Sensor unavailable · no live reading','≋']].map(([label,value,unit,foot,icon])=>`<article class="stat"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot ${selected==='east'&&label==='Soil moisture'?'warning':''}">${foot}</div></article>`).join('');document.querySelectorAll('.plot').forEach(p=>p.classList.toggle('selected',p.dataset.field===selected));renderChart();renderEvents();}
function renderChart(){if(metric!=='moist'){renderSensorChart();return;}$('#chart-mode').textContent='Past 12 hours · simulated';const d=fields[selected];const base=metric==='temp'?d.temp:metric==='moist'?d.moist:d.humidity;const unit=metric==='temp'?'°C':'%';const label={temp:'Air temperature',moist:'Soil moisture',humidity:'Relative humidity'}[metric];const values=[-3,-3.6,-2.8,-2.4,-3.1,-1.2,-1.8,.1,-.7,1,.4,0].map(x=>base+x*(metric==='humidity'?2:1));const min=Math.floor(Math.min(...values)-2),max=Math.ceil(Math.max(...values)+2);const coords=values.map((v,i)=>`${45+i*43},${145-(v-min)/(max-min)*125}`);$('#chart').innerHTML=`<svg viewBox="0 0 540 180" role="img" aria-label="${label} simulated trend for ${name(selected)}"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c3d6ae" stop-opacity=".55"/><stop offset="1" stop-color="#eef4e7" stop-opacity=".1"/></linearGradient></defs>${[0,1,2,3].map(i=>`<line x1="40" x2="525" y1="${20+i*42}" y2="${20+i*42}" stroke="#edf0e7" stroke-dasharray="3 4"/><text x="0" y="${24+i*42}" fill="#a1aa96" font-size="9">${(max-i*(max-min)/3).toFixed(0)}${unit}</text>`).join('')}<path d="M45,150 L${coords.join(' L')} L518,150 Z" fill="url(#fill)"/><polyline points="${coords.join(' ')}" fill="none" stroke="#7b9763" stroke-width="2.5" stroke-linejoin="round"/><circle cx="518" cy="${coords.at(-1).split(',')[1]}" r="4" fill="#6d8d53" stroke="white" stroke-width="2"/>${['12 AM','3 AM','6 AM','9 AM','12 PM'].map((x,i)=>`<text x="${40+i*116}" y="173" font-size="9" fill="#a1aa96">${x}</text>`).join('')}</svg>`;$('#series-label').textContent=label;$('#chart-caption').textContent=`${name(selected)} · ${label.toLowerCase()} · sample readings`;}
function renderEvents(){let list=events.map((e,i)=>({...e,index:i})).filter(e=>selected==='all'||e.field===selected);$('#eventCount').textContent=list.length;$('#events').innerHTML=list.length ? list.map(e=>`<div class="event-row" role="button" tabindex="0" data-index="${e.index}" aria-label="View ${e.title}"><div class="event-name"><div class="event-icon">${e.icon}</div><div><strong>${e.title}</strong><small>${e.source}</small></div></div><span>${name(e.field)}</span><span>${e.time}</span><span class="status ${e.status==='Reviewed'?'reviewed':''}">${e.status}</span></div>`).join('') : '<p class="empty-events">No leaf screening records yet.</p>';document.querySelectorAll('.event-row').forEach(row=>{const open=()=>{activeEvent=+row.dataset.index;const e=events[activeEvent];$('#detailTitle').textContent=e.title;$('#detailBody').textContent=`${name(e.field)} · ${e.time}. ${e.body}`;$('#ack').textContent=e.status==='Reviewed'?'Close':'Mark as reviewed';$('#detail').showModal()};row.onclick=open;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});}
$('#field').onchange=e=>{selected=e.target.value;render()};document.querySelectorAll('.plot').forEach(p=>p.onclick=()=>{selected=p.dataset.field;$('#field').value=selected;render();toast(`${name(selected)} selected`)});$('#metric').onchange=e=>{metric=e.target.value;renderChart()};
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}
$('.close').onclick=()=>$('#detail').close();$('#ack').onclick=()=>{if(events[activeEvent].status!=='Reviewed'){events[activeEvent].status='Reviewed';renderEvents();toast('Event marked as reviewed')}$('#detail').close()};$('#detail').onclick=e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}};
$('#export').onclick=()=>{const rows=[['Event','Source','Field','Time','Status','Data type'],...events.filter(e=>selected==='all'||e.field===selected).map(e=>[e.title,e.source,name(e.field),e.time,e.status,e.real?'Local model prediction':'Simulated'])];const blob=new Blob([rows.map(r=>r.map(x=>'"'+x.replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='oh-crop-demo-events.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Demo event CSV exported')};
const views={overview:{panels:['cornPanel','fieldPanel','trendPanel','eventsPanel']},insights:{panels:['cornPanel','trendPanel','eventsPanel']}};
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n===b));const v=views[b.dataset.view];$('#crumb').textContent=b.textContent.trim().replace(/^[^a-zA-Z]+/,'');document.querySelectorAll('.content-grid>.panel').forEach(p=>p.classList.toggle('hidden',!v.panels.includes(p.id)));});render();

function renderSensorChart(){
 const key=metric==='temp'?'temperature_c':'humidity_pct';
 const label=metric==='temp'?'Air temperature':'Relative humidity';
 const unit=metric==='temp'?'°C':'%';
 $('#series-label').textContent=label;
 $('#chart-mode').textContent='Observed this session · at device';
 $('#chart-caption').textContent=`Modulino Thermo · ${label.toLowerCase()} · ${environment?.available?'live':'sensor unavailable'}`;
 const rows=environmentHistory.filter(r=>Number.isFinite(r[key]));
 if(!rows.length){$('#chart').textContent='Waiting for real Modulino Thermo samples.';return;}
 const values=rows.map(r=>r[key]);const min=Math.min(...values)-1,max=Math.max(...values)+1;
 const start=rows[0].updated_at,end=rows.at(-1).updated_at;
 const points=rows.map(r=>`${45+(r.updated_at-start)/Math.max(1,end-start)*470},${145-(r[key]-min)/(max-min)*120}`);
 $('#chart').innerHTML=`<svg viewBox="0 0 540 180" role="img" aria-label="Observed ${label} at the device"><text x="5" y="20" font-size="10">${max.toFixed(1)}${unit}</text><text x="5" y="145" font-size="10">${min.toFixed(1)}${unit}</text><polyline points="${points.join(' ')}" fill="none" stroke="#7b9763" stroke-width="2.5"/>${points.map(p=>{const [x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="2" fill="#7b9763"/>`}).join('')}<text x="45" y="173" font-size="10">${new Date(start*1000).toLocaleTimeString()}</text><text x="440" y="173" font-size="10">${new Date(end*1000).toLocaleTimeString()}</text></svg>`;
}
async function refreshEnvironment(){
 try{
  const response=await fetch('/api/environment',{cache:'no-store',signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw Error('Sensor API unavailable');
  const next=await response.json();
  if(next.available && (!Number.isFinite(next.temperature_c)||!Number.isFinite(next.humidity_pct)||!Number.isFinite(next.updated_at)))throw Error('Invalid sensor data');
  environment=next;
  if(next.available&&environmentHistory.at(-1)?.updated_at!==next.updated_at){environmentHistory.push(next);if(environmentHistory.length>120)environmentHistory.shift();}
 }catch(error){environment={available:false};}
 $('#updated').textContent=environment.available?'● Live Thermo · '+new Date(environment.updated_at*1000).toLocaleTimeString():'● Thermo unavailable';
 render();
 setTimeout(refreshEnvironment,1000);
}
refreshEnvironment();
