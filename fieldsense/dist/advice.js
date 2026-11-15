/* Shared renderer and temporal policy; also used by the camera-free preview. */
(()=>{
 let previous=null,count=0,data=null;
 const loaded=fetch('/advice.json').then(r=>{if(!r.ok)throw Error('Advice unavailable');return r.json();}).then(value=>data=value);
 function select(result,isLive){
  const accepted=result.status==='prediction'&&result.confidence>=.8&&result.target_probability>=result.target_threshold;
  if(!accepted){previous=null;count=0;return result.status==='non_target'?'non_target':'uncertain';}
  if(!isLive){previous=null;count=0;return result.label;}
  count=previous===result.label?count+1:1;previous=result.label;
  return count>=3?result.label:'waiting';
 }
 async function show(result,isLive=false){
  // Select synchronously so consecutive camera results retain arrival order.
  const key=select(result,isLive);
  try{await loaded;render(key);}catch(e){document.getElementById('cornAdvice').textContent='Advice unavailable. Please retake a clear leaf photo.';}
 }
 function render(key){
  const host=document.getElementById('cornAdvice');if(!host||!data)return;
  const card=data.cards[key]||data.cards.uncertain;
  const title=document.createElement('h4');title.textContent=card.title;
  const check=document.createElement('p');check.textContent=card.check;
  const action=document.createElement('p');action.textContent=card.action;
  const note=document.createElement('small');note.textContent=data.note;
  host.replaceChildren(title,check,action,note);
  if(card.url){const p=document.createElement('p'),a=document.createElement('a');a.href=card.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Reference · University of Minnesota Extension';p.append(a);host.append(p);}
 }
 window.CornAdvice={show,select,reset(){previous=null;count=0;},ready:loaded,render};
 loaded.then(()=>render('waiting')).catch(()=>{});
})();
