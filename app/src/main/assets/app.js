
let clients=JSON.parse(localStorage.getItem('vh_clients')||'[]');
let tx=JSON.parse(localStorage.getItem('vh_tx')||'[]');
let paidInterest=JSON.parse(localStorage.getItem('vh_paidInterest')||'[]');
let expenses=JSON.parse(localStorage.getItem('vh_expenses')||'[]');
let expenseIns=JSON.parse(localStorage.getItem('vh_expenseIns')||'[]');
let partners=JSON.parse(localStorage.getItem('vh_partners')||'[]');
let balance=Number(localStorage.getItem('vh_balance')||'0');
let selectedMonth=new Date(), selectedId=null, editingId=null;

const pad2=n=>String(n).padStart(2,'0');
const localDateString=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const today=()=>localDateString(new Date());
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const save=()=>{
 try{
   localStorage.setItem('vh_clients',JSON.stringify(clients));
   localStorage.setItem('vh_tx',JSON.stringify(tx));
   localStorage.setItem('vh_paidInterest',JSON.stringify(paidInterest));
   localStorage.setItem('vh_expenses',JSON.stringify(expenses));
   localStorage.setItem('vh_expenseIns',JSON.stringify(expenseIns));
   localStorage.setItem('vh_partners',JSON.stringify(partners));
   localStorage.setItem('vh_balance',String(balance));
   return true;
 }catch(e){
   alert('Data save nahi ho pa raha. Browser storage full ho sakta hai.');
   console.error(e);
   return false;
 }
};
const d0=s=>new Date(s+'T00:00:00');

function dueDates(c,end=today()){
 const startKey=dateKey(c.start), endKey=dateKey(end);
 const period=Math.max(1,Number(c.period||1));
 let arr=[];
 for(let k=startKey+period;k<=endKey;k+=period){
   const dt=new Date(k*86400000);
   arr.push(`${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth()+1)}-${pad2(dt.getUTCDate())}`);
 }
 return arr;
}
function dateKey(s){
 const [y,m,d]=String(s).split('-').map(Number);
 return Math.floor(Date.UTC(y,m-1,d)/86400000);
}
function dueDate(c,date){
 const period=Math.max(1,Number(c.period||1));
 const diff=dateKey(date)-dateKey(c.start);
 return diff>0 && diff%period===0;
}
function receivedFor(c,date=null){
 return tx.filter(x=>x.clientId===c.id&&x.type==='interest'&&(!date||x.date===date)).reduce((s,x)=>s+Number(x.amount||0),0);
}
function principalPaid(c){return tx.filter(x=>x.clientId===c.id&&x.type==='principal').reduce((s,x)=>s+Number(x.amount||0),0)}
function dueTotal(c){return dueDates(c).length*Number(c.interest||0)}
function unpaid(c){
 let due=0;
 for(const date of dueDates(c)) if(receivedFor(c,date)<Number(c.interest||0)) due+=Number(c.interest||0)-receivedFor(c,date);
 return due;
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function openAdd(){
 pushAppHistory('add');
 editingId=null; addForm.classList.remove('hidden');dashboard.classList.add('hidden');clientView.classList.add('hidden');
 document.getElementById('addTitle').textContent='Naya Client';
 ['name','phone','principal','advanceInterest','penaltyAmount','penaltyDays','period','interest'].forEach(id=>document.getElementById(id).value='');
 document.getElementById('start').value=today();
}
function closeAdd(fromHistory=false){if(!fromHistory&&history.state&&history.state.vhView)history.back();addForm.classList.add('hidden');dashboard.classList.remove('hidden');editingId=null;render()}

function saveClient(){
 let name=document.getElementById('name').value.trim(), phone=document.getElementById('phone').value.trim();
 let principal=+document.getElementById('principal').value, period=+document.getElementById('period').value, interest=+document.getElementById('interest').value;
 let start=document.getElementById('start').value||today(), advance=+document.getElementById('advanceInterest').value||0;
 let penaltyAmount=+document.getElementById('penaltyAmount').value||0, penaltyDays=+document.getElementById('penaltyDays').value||0;
 if(!name)return alert('Naam zaroori hai');
 if(principal<=0||period<=0||interest<0)return alert('Details sahi bharein');

 if(editingId){
   let c=clients.find(x=>x.id===editingId); if(!c)return;
   let oldPrincipal=Number(c.principal||0);
   const oldStart=c.start;
   const oldPeriod=Number(c.period||period);
   const startChanged=oldStart && start && oldStart!==start;
   const shiftDays=dateKey(start)-dateKey(oldStart);

   // IMPORTANT: changing the client's schedule date shifts the complete
   // schedule, not only the edited calendar cell. Already-paid interest,
   // pending due dates, and future due dates stay matched to the same
   // installment. Example: 20 -> 21 when the schedule moves 10 -> 11.
   if(startChanged && shiftDays!==0){
     tx.filter(x=>x.clientId===c.id).forEach(x=>{
       const xd=d0(x.date);
       xd.setDate(xd.getDate()+shiftDays);
       x.date=localDateString(xd);
     });
   }

   // If the interval itself changes, existing payment dates are preserved;
   // the new calendar is recalculated from the new start/period, so old
   // pending calendar cells disappear and the next schedule is generated
   // from the new settings.
   c.name=name;c.phone=phone;c.principal=principal;c.start=start;c.period=period;c.interest=interest;
   c.advanceInterest=advance;c.penaltyAmount=penaltyAmount;c.penaltyDays=penaltyDays;
   balance += oldPrincipal-principal;
   save(); editingId=null; addForm.classList.add('hidden'); dashboard.classList.remove('hidden'); render(); openClient(c.id);
 }else{
   let c={id:Date.now(),name,phone,principal,start,period,interest,advanceInterest:advance,penaltyAmount,penaltyDays};
   clients.push(c);
   balance-=principal;
   if(advance>0){tx.push({id:Date.now()+1,clientId:c.id,type:'interest',amount:advance,date:start,advance:true});balance+=advance}
   save();addForm.classList.add('hidden');dashboard.classList.remove('hidden');render();
 }
}

function getEditPassword(){return localStorage.getItem('vh_edit_password')||''}
function ensurePassword(){
 let p=getEditPassword();
 if(!p){let n=prompt('Pehli baar edit password set karein (4+ characters):');if(!n||n.length<4){alert('Password 4 ya usse zyada characters ka rakhein');return false}localStorage.setItem('vh_edit_password',n);return true}
 return prompt('Edit password:')===p;
}
function resetEditPassword(){
 let old=getEditPassword();
 if(old&&prompt('Purana password:')!==old){alert('Password galat hai');return}
 let n=prompt('Naya password:');if(!n||n.length<4){alert('Password 4+ characters ka hona chahiye');return}
 localStorage.setItem('vh_edit_password',n);alert('Password reset ho gaya');
}

function editClient(id){
 if(!ensurePassword())return;
 let c=clients.find(x=>x.id===id);if(!c)return;
 editingId=id;dashboard.classList.add('hidden');clientView.classList.add('hidden');addForm.classList.remove('hidden');
 document.getElementById('addTitle').textContent='✏️ Client Ki Sabhi Details Edit Karein';
 document.getElementById('name').value=c.name||'';document.getElementById('phone').value=c.phone||'';
 document.getElementById('principal').value=c.principal||0;document.getElementById('start').value=c.start||today();
 document.getElementById('advanceInterest').value=c.advanceInterest||0;document.getElementById('penaltyAmount').value=c.penaltyAmount||0;
 document.getElementById('penaltyDays').value=c.penaltyDays||0;document.getElementById('period').value=c.period||0;document.getElementById('interest').value=c.interest||0;
}

function deleteClient(id){
 if(!ensurePassword())return;
 let c=clients.find(x=>x.id===id);if(!c)return;
 if(!confirm(c.name+' ka poora khata, calendar aur is client ki entries delete karni hain?'))return;
 balance += Number(c.principal||0);
 tx=tx.filter(x=>x.clientId!==id);
 clients=clients.filter(x=>x.id!==id);
 save();selectedId=null;closeClient();
}

function editEntry(entryId){
 if(!ensurePassword())return;
 const x=tx.find(t=>t.id===entryId);
 if(!x)return;
 const c=clients.find(c=>c.id===x.clientId);
 if(!c)return;

 const newDate=prompt('Date YYYY-MM-DD',x.date);
 if(newDate===null)return;

 const amountText=prompt(
   x.type==='interest'?'Vyaj Jama amount ₹':'Mool Jama amount ₹',
   String(x.amount||0)
 );
 if(amountText===null)return;

 // Strictly validate the entered date, including real calendar dates.
 const dm=/^(\d{4})-(\d{2})-(\d{2})$/.exec(newDate.trim());
 const amount=Number(amountText);
 if(!dm || amount<=0){
   alert('Date YYYY-MM-DD aur amount sahi bharein');
   return;
 }
 const y=Number(dm[1]), m=Number(dm[2]), day=Number(dm[3]);
 const check=new Date(y,m-1,day);
 if(check.getFullYear()!==y || check.getMonth()!==m-1 || check.getDate()!==day){
   alert('Date sahi calendar date honi chahiye');
   return;
 }

 const txBackup=tx.map(t=>({...t}));
 const balanceBefore=balance;
 const oldDate=x.date;
 const oldAmount=Number(x.amount||0);
 const delta=dateKey(newDate)-dateKey(oldDate);

 // Move the selected interest installment and all later interest entries
 // exactly once. The selected record remains the same object/id.
 if(x.type==='interest' && delta!==0){
   tx.filter(t=>t.clientId===c.id && t.type==='interest' && dateKey(t.date)>=dateKey(oldDate))
     .forEach(t=>{
       const key=dateKey(t.date)+delta;
       const dt=new Date(key*86400000);
       t.date=`${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth()+1)}-${pad2(dt.getUTCDate())}`;
     });
 }else{
   x.date=newDate.trim();
 }

 x.amount=amount;
 balance += amount-oldAmount;

 if(!save()){
   // Restore the complete in-memory state if browser storage failed.
   tx=txBackup;
   balance=balanceBefore;
   render();
   return;
 }

 render();
 if(selectedId===c.id){
   openClient(c.id);
 }else{
   alert('Entry save ho gayi');
 }
}

function deleteEntry(entryId){
 if(!ensurePassword())return;
 let x=tx.find(t=>t.id===entryId);if(!x)return;
 if(!confirm('Ye entry delete karni hai?'))return;
 balance -= Number(x.amount||0);
 tx=tx.filter(t=>t.id!==entryId);
 save();render();if(selectedId)openClient(selectedId);
}

function addReceived(id,date){
 let c=clients.find(x=>x.id===id);if(!c)return;
 let amount=+prompt(c.name+' ka vyaj jama — amount ₹',Math.max(0,Number(c.interest)-receivedFor(c,date||today())));
 if(amount<=0)return;
 tx.push({id:Date.now(),clientId:id,type:'interest',amount,date:date||today()});balance+=amount;save();render();if(selectedId===id)openClient(id);
}
function addPrincipal(id){
 let c=clients.find(x=>x.id===id);if(!c)return;
 let amount=+prompt('Mool paisa jama — amount ₹');if(amount<=0)return;
 tx.push({id:Date.now(),clientId:id,type:'principal',amount,date:today()});balance+=amount;save();render();openClient(id);
}
function addPaidInterest(){
 if(!ensurePassword())return;
 let name=prompt('Kisko vyaj diya?');if(!name)return;let amount=+prompt('Kitna vyaj diya ₹');if(amount<=0)return;
 paidInterest.push({id:Date.now(),name,amount,date:today()});balance-=amount;save();render();
}
function editPaid(id){
 if(!ensurePassword())return;let x=paidInterest.find(a=>a.id===id);if(!x)return;
 let name=prompt('Kisko diya?',x.name);if(name===null)return;let amount=+prompt('Amount ₹',x.amount);if(amount<=0)return;
 let date=prompt('Date YYYY-MM-DD',x.date);if(date===null)return;
 balance+=Number(x.amount)-amount;x.name=name;x.amount=amount;x.date=date;save();render();
}
function deletePaid(id){
 if(!ensurePassword())return;let x=paidInterest.find(a=>a.id===id);if(!x)return;
 if(!confirm('Ye paid-interest entry delete karni hai?'))return;
 balance+=Number(x.amount);paidInterest=paidInterest.filter(a=>a.id!==id);save();render();
}


function makeClientShareLink(id){
  const c=clients.find(x=>String(x.id)===String(id)); if(!c)return '';
  const payload={
    v:1,
    c:c,
    tx:tx.filter(x=>String(x.clientId)===String(id)),
    generatedAt:new Date().toISOString()
  };
  const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return location.href.split('#')[0]+'#share='+encoded;
}
function decodeClientShare(encoded){
  try{return JSON.parse(decodeURIComponent(escape(atob(encoded))))}catch(e){return null}
}
function copyClientShareLink(id){
  const link=makeClientShareLink(id); if(!link)return;
  const done=()=>alert('Client ka link copy ho gaya. Ab WhatsApp par bhej sakte ho.');
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(link).then(done).catch(()=>prompt('Link copy karein:',link));
  }else{
    prompt('Link copy karein:',link);
  }
}

function openClient(id,fromHistory=false){
 if(!fromHistory) pushAppHistory('client:'+id);
 selectedId=id;dashboard.classList.add('hidden');addForm.classList.add('hidden');interestForm.classList.add('hidden');clientView.classList.remove('hidden');
 let c=clients.find(x=>x.id===id);if(!c)return;
 const link=makeClientShareLink(id);
 let principalLeft=Math.max(0,Number(c.principal)-principalPaid(c)),unpaidAmt=unpaid(c);
 clientView.innerHTML=`<button class="secondary back" onclick="closeClient()">← Sabhi Client</button>
 <div class="section"><h2>👤 ${esc(c.name)}</h2><div class="meta">${c.phone?'📱 '+esc(c.phone)+' • ':''}Start: ${esc(c.start)} • Har ${c.period} din ${money(c.interest)}</div>
 <div class="cards" style="margin-top:12px"><div class="card"><div class="label">Mool Baaki</div><div class="value purple">${money(principalLeft)}</div></div><div class="card"><div class="label">Vyaj Baaki</div><div class="value red">${money(unpaidAmt)}</div></div></div>
 <div class="client-actions"><button class="secondary" onclick="addReceived(${id},today())">Aaj Jama</button><button class="secondary" onclick="addPrincipal(${id})">Mool Jama</button><button class="secondary" onclick="editClient(${id})">✏️ Sabhi Edit</button><button class="danger" onclick="deleteClient(${id})">🗑️ Client Delete</button></div>
 <div class="meta">Calendar dates are calculated in local (India) date format; 24th will no longer become 23rd. </div><div class="meta">Penalty: ${c.penaltyAmount>0&&c.penaltyDays>0?money(c.penaltyAmount)+' har '+c.penaltyDays+' din':'Band'}</div></div>
 <div class="section"><h2>🔗 Client View Link</h2><div class="client-link">${esc(link)}</div><button class="primary" style="width:100%;margin-top:8px" onclick="copyClientShareLink(${id})">📤 Link Copy Karke Client Ko Bhejo</button><div class="meta" style="margin-top:7px">Is link me sirf isi client ka hisab rahega.</div></div>
 <div class="section"><h2>📆 Vyaj Calendar</h2><div class="calendar-head"><button class="secondary" onclick="changeMonth(-1)">‹</button><b id="monthTitle"></b><button class="secondary" onclick="changeMonth(1)">›</button></div><div id="calendar"></div></div>
 <div class="section"><h2>🧾 Is Client Ka Khata</h2><div id="clientLedger"></div></div>`;
 renderCalendar();renderClientLedger();
}
function closeClient(fromHistory=false){if(!fromHistory&&history.state&&history.state.vhView!=='dashboard'){history.back();return;}selectedId=null;clientView.classList.add('hidden');interestForm.classList.add('hidden');addForm.classList.add('hidden');showDashboard()}
function changeMonth(n){selectedMonth.setMonth(selectedMonth.getMonth()+n);renderCalendar()}

function renderCalendar(){
 let c=clients.find(x=>x.id===selectedId);if(!c)return;
 let y=selectedMonth.getFullYear(),m=selectedMonth.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0);
 document.getElementById('monthTitle').textContent=first.toLocaleDateString('hi-IN',{month:'long',year:'numeric'});
 let out='<div class="calendar">'+['Su','Mo','Tu','We','Th','Fr','Sa'].map(x=>`<div class="dow">${x}</div>`).join('');
 for(let i=0;i<first.getDay();i++)out+='<div></div>';
 for(let day=1;day<=last.getDate();day++){
   let dt=new Date(y,m,day),ds=localDateString(dt),due=dueDate(c,ds),got=receivedFor(c,ds);
   let isPast=due&&got<Number(c.interest||0); let isPaid=due&&got>=Number(c.interest||0);
   out+=`<div class="calday ${ds===today()?'today':''} ${isPaid?'paid-day':(isPast?'overdue':'')}" ${due?`onclick="calendarDateAction(${c.id},'${ds}')"`:''}>
   <div class="calnum">${day}</div>${due?`<div class="due ${got>=c.interest?'paid':''}">₹${Number(c.interest).toLocaleString('en-IN')}</div><div class="calendar-action">${got>=c.interest?'✓ Jama':'＋ Jama'}</div>`:''}
   ${got?`<div class="meta">Jama ₹${money(got)}</div>`:''}</div>`;
 }
 document.getElementById('calendar').innerHTML=out+'</div>';
}
function renderClientLedger(){
 let c=clients.find(x=>x.id===selectedId);if(!c)return;
 let arr=tx.filter(x=>x.clientId===c.id).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 document.getElementById('clientLedger').innerHTML=arr.length?arr.map(x=>`<div class="item"><b>${esc(x.date)}</b> — ${x.type==='interest'?'<span class="green">Intrest In</span>':'Mool Jama'} — <span class="${x.type==='interest'?'green':'purple'}">${money(x.amount)}</span>${x.advance?' <span class="tag">Advance</span>':''}<div><button class="secondary small" onclick="editEntry(${x.id})">✏️ Edit</button> <button class="danger small" onclick="deleteEntry(${x.id})">🗑️ Delete</button></div></div>`).join(''):'<div class="empty">Abhi payment history nahi hai.</div>';
}

function openInterestForm(){
 pushAppHistory('interestForm');
 dashboard.classList.add('hidden');addForm.classList.add('hidden');clientView.classList.add('hidden');interestForm.classList.remove('hidden');
 document.getElementById('interestClient').innerHTML=clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 document.getElementById('interestDate').value=today();document.getElementById('interestAmount').value='';
}
function closeInterestForm(fromHistory=false){if(!fromHistory&&history.state&&history.state.vhView)history.back();interestForm.classList.add('hidden');dashboard.classList.remove('hidden');render()}
function saveInterestFromForm(){
 if(!ensurePassword())return;
 let id=+document.getElementById('interestClient').value,date=document.getElementById('interestDate').value||today(),amount=+document.getElementById('interestAmount').value;
 if(!id||amount<=0)return alert('Client aur amount sahi bharein');
 tx.push({id:Date.now(),clientId:id,type:'interest',amount,date});balance+=amount;save();closeInterestForm();
}
function calendarDateAction(id,date){
 let c=clients.find(x=>x.id===id);if(!c)return;
 let interest=Number(c.interest||0);
 let got=receivedFor(c,date),remaining=Math.max(0,interest-got);
 if(remaining<=0){alert(date+" ka vyaj already jama hai: "+money(got));return}
 let raw=prompt(c.name+" — "+date+" ka vyaj jama karein. Baki: "+money(remaining),remaining);
 if(raw===null)return;
 let amount=Number(raw);
 if(!Number.isFinite(amount)||amount<=0){alert("Jama amount sahi bharein");return}
 if(amount>remaining){alert("Jama amount baki vyaj se zyada nahi ho sakta. Baki: "+money(remaining));return}
 tx.push({id:Date.now(),clientId:id,type:"interest",amount,date});
 balance+=amount;
 if(!save()){tx.pop();balance-=amount;alert("Vyaj jama save nahi ho saka.");return}
 renderCalendar();renderClientLedger();render();
}

function ensureRoute(){
 if(!history.state || !history.state.vhView) history.replaceState({vhView:'dashboard'},'',location.pathname+location.search+location.hash);
}
function pushAppHistory(view){
 ensureRoute();
 if(history.state.vhView!==view) history.pushState({vhView:view},'',location.pathname+location.search+location.hash);
}
function showDashboard(){
 document.querySelectorAll('#dashboard > .section').forEach(el=>el.classList.add('hidden'));
 document.querySelector('.cards').classList.remove('hidden');
 document.querySelector('.quick-actions').classList.remove('hidden');
 document.getElementById('clientView').classList.add('hidden');
 document.getElementById('addForm').classList.add('hidden');
 document.getElementById('interestForm').classList.add('hidden');
 selectedId=null; editingId=null;
 render(); window.scrollTo({top:0,behavior:'instant'});
}
function handleAppBack(){
 const view=history.state?.vhView||'dashboard';
 if(view==='dashboard'){ showDashboard(); return; }
 if(view.startsWith('section:')){
   const id=view.slice(8);
   document.querySelector('.cards').classList.add('hidden');
   document.querySelector('.quick-actions').classList.add('hidden');
   document.querySelectorAll('#dashboard > .section').forEach(el=>el.classList.add('hidden'));
   document.getElementById('clientView').classList.add('hidden');
   document.getElementById('addForm').classList.add('hidden');
   document.getElementById('interestForm').classList.add('hidden');
   const el=document.getElementById(id);
   if(el){ el.classList.remove('hidden'); if(id==='giveSection')renderGive(); if(id==='todayInterestSection')renderTodayInterest(); if(id==='expenseSection')renderExpenses(); if(id==='partnerSection')renderPartners(); if(id==='cashBookSection')renderCashBook(); el.scrollIntoView({behavior:'instant',block:'start'}); }
   return;
 }
 if(view.startsWith('client:')){
   const id=Number(view.slice(7));
   selectedId=id; openClient(id,true); return;
 }
 showDashboard();
}
window.addEventListener('popstate',handleAppBack);
ensureRoute();

function openGive(){
 pushAppHistory('section:giveSection');
 document.querySelector('.cards').classList.add('hidden');
 document.querySelector('.quick-actions').classList.add('hidden');
 document.querySelectorAll('#dashboard > .section').forEach(el=>el.classList.add('hidden'));
 const el=document.getElementById('giveSection');
 el.classList.remove('hidden');
 const search=document.getElementById('giveSearch');
 if(search) search.value='';
 renderGive();
 el.scrollIntoView({behavior:'instant',block:'start'});
 if(search) setTimeout(()=>search.focus(),50);
}
function renderGive(){
 const q=(document.getElementById('giveSearch')?.value||'').trim().toLowerCase();
 const rows=clients.filter(c=>String(c.name||'').toLowerCase().includes(q));
 const totalPrincipal=rows.reduce((s,c)=>s+Number(c.principal||0),0);
 const totalReceived=rows.reduce((s,c)=>s+tx.filter(x=>x.clientId===c.id&&x.type==='interest').reduce((a,x)=>a+Number(x.amount||0),0),0);
 const totalUnpaid=rows.reduce((s,c)=>s+unpaid(c),0);
 document.getElementById('giveSummary').innerHTML=`<div class="cards" style="margin:12px 0"><div class="card"><div class="label">Mool Diya</div><div class="value purple">${money(totalPrincipal)}</div></div><div class="card"><div class="label">Vyaj Aaya</div><div class="value green">${money(totalReceived)}</div></div><div class="card"><div class="label">Vyaj Baki</div><div class="value red">${money(totalUnpaid)}</div></div></div>`;
 document.getElementById('giveList').innerHTML=rows.length?rows.map(c=>{
   const interestReceived=tx.filter(x=>x.clientId===c.id&&x.type==='interest').reduce((s,x)=>s+Number(x.amount||0),0);
   const interestUnpaid=unpaid(c);
   const pendingEntries=dueDates(c).filter(d=>receivedFor(c,d)<Number(c.interest||0)).length;
   const nameClass=pendingEntries>=5?'client-name-red':'';
   return `<div class="client" onclick="openClient(${c.id})"><div class="clienttop"><div><div class="name ${nameClass}">${esc(c.name)}</div><div class="meta">${c.phone?'📱 '+esc(c.phone):' '} </div></div><div class="red"><b>${money(interestUnpaid)}</b><div class="meta">Vyaj Baki</div></div></div><div class="row" style="margin-top:10px"><div class="statline"><span>Mool Diya</span><b class="purple">${money(c.principal)}</b></div><div class="statline"><span>Vyaj Aaya</span><b class="green">${money(interestReceived)}</b></div></div></div>`;
 }).join(''):'<div class="empty">Search ke hisaab se koi client nahi mila.</div>';
}

function openTodayInterest(){
 pushAppHistory('section:todayInterestSection');
 document.querySelector('.cards').classList.add('hidden');
 document.querySelector('.quick-actions').classList.add('hidden');
 document.querySelectorAll('#dashboard > .section').forEach(el=>el.classList.add('hidden'));
 const el=document.getElementById('todayInterestSection');
 el.classList.remove('hidden');
 renderTodayInterest();
 el.scrollIntoView({behavior:'instant',block:'start'});
}
function renderTodayInterest(){
 const ds=today();
 const rows=clients.filter(c=>dueDate(c,ds)).map(c=>{
   const due=Number(c.interest||0);
   const got=Math.min(due,receivedFor(c,ds));
   const done=got>=due && due>0;
   return {c,due,got,done};
 }).filter(x=>x.due>0);
 const total=rows.reduce((s,x)=>s+x.due,0);
 const got=rows.reduce((s,x)=>s+x.got,0);
 document.getElementById('todayInterestTotal').textContent=money(total);
 document.getElementById('todayInterestIn').textContent=money(got);
 document.getElementById('todayInterestList').innerHTML=rows.length?rows.map(x=>`<div class="item"><div class="clienttop"><div><b>${esc(x.c.name)}</b><div class="meta">Aaj ka interest: ${money(x.due)}</div></div><div class="${x.done?'green':'orange'}"><b>${x.done?'✓ Interest In':'Pending'}</b><div class="meta">${money(x.got)} / ${money(x.due)}</div></div></div></div>`).join(''):'<div class="empty">Aaj kisi ka interest due nahi hai.</div>';
}
function openSection(id){
 // Keep the dashboard container alive; only switch the visible dashboard content.
 // The sections live inside #dashboard, so hiding #dashboard itself makes the
 // clicked page invisible.
 pushAppHistory('section:'+id);
 document.querySelector('.cards').classList.add('hidden');
 document.querySelector('.quick-actions').classList.add('hidden');
 document.querySelectorAll('#dashboard > .section').forEach(el=>el.classList.add('hidden'));
 const el=document.getElementById(id);
 if(el){ el.classList.remove('hidden'); if(id==='expenseSection') renderExpenses(); if(id==='partnerSection') renderPartners(); if(id==='cashBookSection') renderCashBook(); if(id==='receivedSection') render(); if(id==='paidSection') render(); el.scrollIntoView({behavior:'instant',block:'start'}); }
}
function closeSection(fromHistory=false){
 if(!fromHistory && history.state && history.state.vhView!=='dashboard'){ history.back(); return; }
 showDashboard();
}

function openExpense(){ openSection('expenseSection'); renderExpenses(); }
function saveExpense(){
 const amount=Number(document.getElementById('expenseAmount').value||0);
 const date=document.getElementById('expenseDate').value||today();
 const note=document.getElementById('expenseNote').value.trim();
 if(amount<=0){alert('Kharcha amount sahi bharein');return;}
 if(amount>balance){ if(!confirm('Available Balance se zyada kharcha hai. Phir bhi save karein?')) return; }
 expenses.push({id:Date.now(),amount,date,note});
 balance-=amount; save();
 document.getElementById('expenseAmount').value=''; document.getElementById('expenseNote').value=''; document.getElementById('expenseDate').value=today();
 render(); renderExpenses();
}
function deleteExpense(id){
 const x=expenses.find(a=>a.id===id); if(!x)return;
 if(!confirm('Ye expense delete karna hai?'))return;
 balance+=Number(x.amount||0); expenses=expenses.filter(a=>a.id!==id); save(); render(); renderExpenses();
}
function renderExpenses(){
 const total=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
 const totalIn=expenseIns.reduce((s,x)=>s+Number(x.amount||0),0);
 const el=document.getElementById('expenseTotal'); if(el)el.textContent=money(total);
 const ein=document.getElementById('expenseInTotal'); if(ein)ein.textContent=money(totalIn);
 const list=document.getElementById('expenseLedger'); if(!list)return;
 const out=[...expenses].map(x=>({...x,kind:'out'})); const ins=[...expenseIns].map(x=>({...x,kind:'in'}));
 const arr=out.concat(ins).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 list.innerHTML=arr.length?arr.map(x=>`<div class="item"><div class="clienttop"><div><b>${esc(x.date)}</b><div class="meta">${esc(x.note||'Expense')}</div></div><div class="${x.kind==='in'?'green':'red'}"><b>${x.kind==='in'?'+':'-'}${money(x.amount)}</b><div class="meta">${x.kind==='in'?'Expense In':'Expense Out'}</div></div></div>${x.kind==='out'?`<button class="danger small" onclick="deleteExpense(${x.id})">🗑️ Delete</button>`:`<button class="secondary small" onclick="deleteExpenseIn(${x.id})">🗑️ Delete</button>`}</div>`).join(''):'<div class="empty">Abhi koi expense nahi hai.</div>';
}
function deleteExpenseIn(id){ const x=expenseIns.find(a=>a.id===id);if(!x)return;if(!confirm('Ye Expense In delete karna hai?'))return;balance-=Number(x.amount||0);expenseIns=expenseIns.filter(a=>a.id!==id);save();render();renderExpenses(); }


function openCashBook(){
 pushAppHistory('section:cashBookSection');
 document.querySelector('.cards').classList.add('hidden');
 document.querySelector('.quick-actions').classList.add('hidden');
 document.querySelectorAll('#dashboard > .section').forEach(el=>el.classList.add('hidden'));
 document.getElementById('cashBookSection').classList.remove('hidden');
 renderCashBook(); document.getElementById('cashBookSection').scrollIntoView({behavior:'instant',block:'start'});
}
function addLedgerRow(arr,date,remark,amount,incoming,sortId=0,source='',refId=null){arr.push({date,remark,amount:Number(amount||0),incoming,sortId,source,refId});}
function cashBookEntries(){
 const arr=[];
 clients.forEach(c=>{
   if(Number(c.principal||0)>0) addLedgerRow(arr,c.start,'Give — '+c.name,Number(c.principal),false,c.id,'client',c.id);
 });
 tx.forEach(x=>{const c=clients.find(c=>c.id===x.clientId); if(!c)return; addLedgerRow(arr,x.date,(x.type==='interest'?'Interest In — ':'Mool Jama — ')+c.name,x.amount,true,x.id,'tx',x.id);});
 paidInterest.forEach(x=>addLedgerRow(arr,x.date,'Interest Out — '+x.name,x.amount,false,x.id,'paid',x.id));
 expenses.forEach(x=>addLedgerRow(arr,x.date,'Expense Out — '+(x.note||''),x.amount,false,x.id,'expense',x.id));
 expenseIns.forEach(x=>addLedgerRow(arr,x.date,'Expense In — '+(x.note||''),x.amount,true,x.id,'expenseIn',x.id));
 partners.forEach(pr=>{
   (pr.entries||[]).forEach(x=>addLedgerRow(arr,x.date,(x.type==='in'?'Cash In — ':'Cash Out — ')+pr.name,x.amount,x.type==='in',x.id,'partner',pr.id+':'+x.id));
 });
 arr.sort((a,b)=>a.date.localeCompare(b.date)||a.sortId-b.sortId);
 let running=0; arr.forEach(x=>{running += x.incoming?x.amount:-x.amount; x.running=running;});
 return arr;
}
function deletePartnerEntry(partnerId,entryId){
 if(!ensurePassword())return;
 const p=partners.find(x=>x.id===partnerId); if(!p)return;
 const x=(p.entries||[]).find(a=>a.id===entryId); if(!x)return;
 if(!confirm('Ye Cash '+(x.type==='in'?'In':'Out')+' entry delete karni hai?'))return;
 if(x.type==='in') balance-=Number(x.amount||0); else balance+=Number(x.amount||0);
 p.entries=p.entries.filter(a=>a.id!==entryId); save(); render(); renderPartners(); renderCashBook();
}
function deleteCashBookRow(source,refId){
 if(source==='tx') return deleteEntry(refId);
 if(source==='paid') return deletePaid(refId);
 if(source==='expense') return deleteExpense(refId);
 if(source==='expenseIn') return deleteExpenseIn(refId);
 if(source==='partner'){
   const parts=String(refId).split(':');
   return deletePartnerEntry(Number(parts[0]),Number(parts[1]));
 }
 alert('Is entry ko yahan se delete nahi kiya ja sakta.');
}
function renderCashBook(){
 const el=document.getElementById('cashBookLedger'); if(!el)return;
 document.getElementById('cashBookBalance').textContent=money(balance);
 const arr=cashBookEntries();
 if(!arr.length){el.innerHTML='<div class="empty">Abhi koi hisab nahi hai.</div>';return;}
 let html='<table class="cashbook-table"><thead><tr><th>Particular / Remark</th><th>Cr/Dr</th><th>Balance</th></tr></thead><tbody>';
 let last='';
 arr.forEach(x=>{
   if(x.date!==last){html+=`<tr><td colspan="3" class="date-group">⌄ ${esc(x.date)} ⌄</td></tr>`;last=x.date;}
   const canDelete=x.source!=='client';
   html+=`<tr class="cashbook-row"><td>${esc(x.remark)}${canDelete?`<div style="margin-top:5px"><button class="danger small" onclick="deleteCashBookRow('${x.source}','${String(x.refId).replace(/'/g,"\\'")}')">🗑️ Delete</button></div>`:''}</td><td class="${x.incoming?'cash-in':'cash-out'}">${x.incoming?'+':'-'}${money(x.amount)}</td><td>${money(x.running)}</td></tr>`;
 });
 html+='</tbody></table>';
 el.innerHTML=html;
}
function addPartner(){
 const name=document.getElementById('partnerName').value.trim(); const opening=Number(document.getElementById('partnerOpening').value||0);
 if(!name)return alert('Partner naam zaroori hai');
 const pr={id:Date.now(),name,entries:[]}; partners.push(pr);
 if(opening>0){pr.entries.push({id:Date.now()+1,date:today(),type:'in',amount:opening});balance+=opening;}
 save(); document.getElementById('partnerName').value='';document.getElementById('partnerOpening').value='';render();renderPartners();
}
function partnerIn(id){
 const p=partners.find(x=>x.id===id);if(!p)return; const amount=Number(prompt(p.name+' se paisa aaya ₹')||0);if(amount<=0)return;
 p.entries.push({id:Date.now(),date:today(),type:'in',amount});balance+=amount;save();render();renderPartners();
}
function partnerOut(id){
 const p=partners.find(x=>x.id===id);if(!p)return; const amount=Number(prompt(p.name+' ko paisa diya ₹')||0);if(amount<=0)return;
 p.entries.push({id:Date.now(),date:today(),type:'out',amount});balance-=amount;save();render();renderPartners();
}
function renderPartners(){
 const el=document.getElementById('partnerList');if(!el)return;
 el.innerHTML=partners.length?partners.map(p=>{const ins=(p.entries||[]).filter(x=>x.type==='in').reduce((s,x)=>s+Number(x.amount||0),0);const outs=(p.entries||[]).filter(x=>x.type==='out').reduce((s,x)=>s+Number(x.amount||0),0);return `<div class="partner-card"><div class="clienttop"><div><div class="name">${esc(p.name)}</div><div class="meta">Cash In: ${money(ins)} • Cash Out: ${money(outs)}</div></div><b class="${ins-outs>=0?'green':'red'}">${money(ins-outs)}</b></div><div class="partner-actions"><button class="secondary" onclick="partnerIn(${p.id})">＋ Cash In</button><button class="danger" onclick="partnerOut(${p.id})">− Cash Out</button></div><div class="meta" style="margin-top:8px">${(p.entries||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(x=>`<div style="margin:7px 0">${esc(x.date)} — ${x.type==='in'?'<span class="cash-in">Cash In</span>':'<span class="cash-out">Cash Out</span>'} ${money(x.amount)} <button class="danger small" onclick="deletePartnerEntry(${p.id},${x.id})">🗑️ Delete</button></div>`).join('')}</div></div>`}).join(''):'<div class="empty">Abhi koi partner add nahi hai.</div>';
}
function saveExpenseIn(){
 const amount=Number(document.getElementById('expenseAmount').value||0); const date=document.getElementById('expenseDate').value||today(); const note=document.getElementById('expenseNote').value.trim();
 if(amount<=0)return alert('Expense In amount sahi bharein');
 expenseIns.push({id:Date.now(),amount,date,note});balance+=amount;save();document.getElementById('expenseAmount').value='';document.getElementById('expenseNote').value='';document.getElementById('expenseDate').value=today();render();renderExpenses();
}
function render(){
 let lent=clients.reduce((s,c)=>s+Math.max(0,Number(c.principal)-principalPaid(c)),0);
 let todayTx=tx.filter(x=>x.date===today());
 // Today's Total Collection = total interest due for today (all clients).
 // Today's Collection = interest actually received today.
 let todayInterestDue=clients.reduce((sum,c)=>{
   const due=dueDate(c,today());
   return sum + (due ? Number(c.interest||0) : 0);
 },0);
 let tr=todayTx.filter(x=>x.type==='interest').reduce((s,x)=>s+Number(x.amount||0),0);
 document.getElementById('lent').textContent=money(lent);document.getElementById('balance').textContent=money(balance);
 document.getElementById('todayDue').textContent=money(todayInterestDue);
 document.getElementById('todayReceived').textContent=money(tr);
 if(!document.getElementById('todayInterestSection').classList.contains('hidden')) renderTodayInterest();
 if(!document.getElementById('giveSection').classList.contains('hidden')) renderGive();
 if(!document.getElementById('expenseSection').classList.contains('hidden')) renderExpenses();
 let oldDue=clients.flatMap(c=>dueDates(c).filter(d=>d<today()).map(d=>({c,d,a:Math.max(0,Number(c.interest||0)-receivedFor(c,d))}))).filter(x=>x.a>0);
 document.getElementById('unpaidList').innerHTML=oldDue.length?oldDue.sort((a,b)=>a.d.localeCompare(b.d)).map(x=>`<div class="item"><b>${esc(x.c.name)}</b> — <span class="meta">${esc(x.d)}</span> — <span class="red">${money(x.a)}</span> baki</div>`).join(''):'<div class="empty">Koi purana due baki nahi hai.</div>';
 document.getElementById('clients').innerHTML=clients.length?clients.map(c=>{
   const unpaidEntries=dueDates(c).filter(d=>receivedFor(c,d)<Number(c.interest||0)).length;
   const todayPaid=dueDate(c,today()) && receivedFor(c,today())>=Number(c.interest||0);
   const nameClass=unpaidEntries>=5?'client-name-red':'';
   const check=todayPaid?'<span class="green-check" title="Aaj ka vyaj jama">✓</span>':'';
   return `<div class="client" onclick="openClient(${c.id})"><div class="clienttop"><div><div class="name ${nameClass}">${esc(c.name)}${check}</div><div class="meta">Mool baaki: ${money(Math.max(0,Number(c.principal)-principalPaid(c)))}</div></div><div class="red"><b>${money(unpaid(c))}</b><div class="meta">Vyaj baki</div></div></div></div>`;
 }).join(''):'<div class="empty">Abhi koi client nahi hai.</div>';
 let received=[...tx].filter(x=>x.type==='interest').sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 document.getElementById('allReceived').textContent=money(received.reduce((s,x)=>s+Number(x.amount||0),0));
 document.getElementById('receivedLedger').innerHTML=received.length?received.slice(0,100).map(x=>{let c=clients.find(c=>c.id===x.clientId);return `<div class="item"><b>${esc(x.date)}</b> — ${c?esc(c.name):'Deleted'} — <span class="green">Intrest In ${money(x.amount)}</span>${x.advance?' <span class="tag">Advance</span>':''}<div><button class="secondary small" onclick="editEntry(${x.id})">✏️ Edit</button> <button class="danger small" onclick="deleteEntry(${x.id})">🗑️ Delete</button></div></div>`}).join(''):'<div class="empty">Abhi koi vyaj receive nahi hua.</div>';
 document.getElementById('allPaid').textContent=money(paidInterest.reduce((s,x)=>s+Number(x.amount||0),0));
 document.getElementById('paidLedger').innerHTML=paidInterest.length?paidInterest.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class="item"><b>${esc(x.date)}</b> — ${esc(x.name)} — <span class="red">Intrest Out ${money(x.amount)}</span><div><button class="secondary small" onclick="editPaid(${x.id})">✏️ Edit</button> <button class="danger small" onclick="deletePaid(${x.id})">🗑️ Delete</button></div></div>`).join(''):'<div class="empty">Abhi koi vyaj diya nahi hai.</div>';
}

function showClientPublic(id){
  const c=clients.find(x=>String(x.id)===String(id));
  if(!c){document.body.innerHTML='<div class="container"><div class="section"><h2>Khata nahi mila</h2><div class="meta">Client link purana ya galat ho sakta hai.</div></div></div>';return}
  document.getElementById('dashboard').classList.add('hidden');document.getElementById('addForm').classList.add('hidden');document.getElementById('interestForm').classList.add('hidden');document.getElementById('clientView').classList.remove('hidden');
  const principalLeft=Math.max(0,Number(c.principal)-principalPaid(c)),interestLeft=unpaid(c);
  document.getElementById('clientView').innerHTML=`<div class="section"><h2>📒 ${esc(c.name)} ka Pura Khata</h2><div class="meta">${c.phone?'📱 '+esc(c.phone)+' • ':''}Start: ${esc(c.start)} • Har ${c.period} din ${money(c.interest)}</div><div class="cards" style="margin-top:12px"><div class="card"><div class="label">Mool Baaki</div><div class="value purple">${money(principalLeft)}</div></div><div class="card"><div class="label">Vyaj Baaki</div><div class="value red">${money(interestLeft)}</div></div></div></div><div class="section"><h2>📆 Vyaj Calendar</h2><div class="calendar-head"><b id="monthTitle"></b></div><div id="calendar"></div></div><div class="section"><h2>🧾 Jama / Payment History</h2><div id="clientLedger"></div></div><div class="section"><div class="meta">Ye client-view link hai. Isme sirf isi client ka hisab dikhaya gaya hai.</div></div>`;
  renderCalendar();
  renderClientLedger();
}

function enableNotifications(){
 if(!('Notification' in window)){alert('Is browser me notification support nahi hai');return}
 Notification.requestPermission().then(p=>{if(p==='granted'){localStorage.setItem('vh_notifications','1');notifyTodayDue();alert('Notifications ON')}})
}
function notifyTodayDue(){
 if(localStorage.getItem('vh_notifications')!=='1'||Notification.permission!=='granted')return;
 const due=clients.filter(c=>dueDate(c,today()));
 if(due.length)new Notification('Aaj Vyaj Lena Hai',{body:'Aaj '+due.length+' client ka payment due hai.'});
}
setInterval(()=>{if(new Date().getHours()>=8&&new Date().getHours()<22)notifyTodayDue()},2*60*60*1000);

render();
const expenseDateEl=document.getElementById('expenseDate'); if(expenseDateEl) expenseDateEl.value=today();
if(location.hash.startsWith('#share=')){
  const shared=decodeClientShare(location.hash.slice(7));
  if(shared&&shared.c){
    const oldClients=clients,oldTx=tx;
    clients=[shared.c];tx=shared.tx||[];
    // Public mode uses only the shared snapshot; no other clients are loaded.
    showClientPublic(shared.c.id);
    clients=oldClients;tx=oldTx;
  }else{
    document.body.innerHTML='<div class="container"><div class="section"><h2>Khata nahi mila</h2><div class="meta">Client link invalid hai.</div></div></div>';
  }
} else if(location.hash.startsWith('#client='))showClientPublic(location.hash.slice(8));

// Initial UI setup for new sections
(function(){
  const ed=document.getElementById('expenseDate'); if(ed) ed.value=today();
})();
