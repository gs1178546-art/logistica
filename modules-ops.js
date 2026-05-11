// Operations Module Functions
function renderCollections(){
  const cols=DB._get('logistica_collections');
  const done=cols.filter(c=>c.status==='done').length;
  const fail=cols.filter(c=>c.status==='failed').length;
  const total=cols.length||1;
  const weight=cols.filter(c=>c.status==='done').reduce((s,c)=>s+(c.weight||0),0);
  document.getElementById('col-done').textContent=done;
  document.getElementById('col-fail').textContent=fail;
  document.getElementById('col-rate').textContent=Math.round((done/total)*100)+'%';
  document.getElementById('col-weight').textContent=weight.toFixed(0)+' kg';
  const tbody=document.getElementById('collections-tbody');
  if(!cols.length){tbody.innerHTML='<tr><td colspan="7" class="empty-state">Nenhuma coleta.</td></tr>';return;}
  tbody.innerHTML=cols.map(c=>{
    const sc=c.status==='done'?'badge-delivered':'badge-cancelled';
    const sl=c.status==='done'?'Realizada':'Não Realizada';
    return `<tr><td>${new Date(c.date).toLocaleDateString('pt-BR')}</td><td>${c.clientName}</td><td>${c.driver||'—'}</td><td>${c.volumes||0}</td><td>${c.weight||0} kg</td><td><span class="badge ${sc}">${sl}</span></td><td>${c.reason||'—'}</td></tr>`;
  }).join('');
}
function openCollectionModal(){
  const client=prompt('Cliente:');if(!client)return;
  const status=confirm('Coleta realizada?')?'done':'failed';
  const weight=status==='done'?parseFloat(prompt('Peso (kg):')||'0'):0;
  const volumes=status==='done'?parseInt(prompt('Volumes:')||'0'):0;
  const reason=status==='failed'?prompt('Motivo (fechado/acesso negado/cancelamento/sem embalagem):'):'';
  const list=DB._get('logistica_collections');
  list.push({id:'col_'+Date.now(),clientName:client,status,weight,volumes,reason,date:new Date().toISOString(),driver:'Motorista',carrierId:CID});
  DB._set('logistica_collections',list);
  renderCollections();showToast(status==='done'?'Coleta registrada!':'Ocorrência registrada!');
}
function renderLateDeliveries(){
  const dels=DB.getDeliveries(CID);
  const now=new Date();const curMonth=now.getMonth();
  const late=dels.filter(d=>{
    if(d.status!=='delivered')return false;
    const created=new Date(d.createdAt);const delivered=new Date(d.updatedAt||d.createdAt);
    return created.getMonth()!==delivered.getMonth();
  });
  document.getElementById('late-total').textContent=late.length;
  document.getElementById('late-impact').textContent=dels.length?Math.round((late.length/dels.length)*100)+'%':'0%';
  const tbody=document.getElementById('late-tbody');
  if(!late.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhuma baixa fora do mês.</td></tr>';return;}
  const reasons=['Atraso operacional','Retenção fiscal','Devolução','Reagendamento'];
  tbody.innerHTML=late.map(d=>{
    const days=Math.ceil((new Date(d.updatedAt)-new Date(d.createdAt))/86400000);
    return `<tr><td><strong style="color:var(--primary)">${d.trackingCode}</strong></td><td>${d.clientName}</td><td>${new Date(d.createdAt).toLocaleDateString('pt-BR')}</td><td>${new Date(d.updatedAt).toLocaleDateString('pt-BR')}</td><td style="color:var(--danger)">${days}d</td><td>${reasons[Math.floor(Math.random()*reasons.length)]}</td></tr>`;
  }).join('');
}
function renderOccurrences(){
  const occs=DB._get('logistica_occurrences');
  const dels=DB.getDeliveries(CID);const total=dels.length||1;
  const damages=occs.filter(o=>o.type.includes('avaria')).length;
  const lost=occs.filter(o=>o.type.includes('extravio')).length;
  const cost=occs.reduce((s,o)=>s+(o.cost||0),0);
  document.getElementById('occ-damage').textContent=(damages/total*100).toFixed(1)+'%';
  document.getElementById('occ-lost').textContent=(lost/total*100).toFixed(1)+'%';
  document.getElementById('occ-cost').textContent='R$ '+cost.toLocaleString('pt-BR');
  const tbody=document.getElementById('occurrences-tbody');
  if(!occs.length){tbody.innerHTML='<tr><td colspan="7" class="empty-state">Nenhuma ocorrência.</td></tr>';return;}
  tbody.innerHTML=occs.map(o=>{
    const sc=o.status==='resolved'?'badge-delivered':'badge-pending';
    return `<tr><td>${new Date(o.date).toLocaleDateString('pt-BR')}</td><td>${o.code||'—'}</td><td>${o.type}</td><td>${o.route||'—'}</td><td>${o.driver||'—'}</td><td>R$ ${(o.cost||0).toLocaleString('pt-BR')}</td><td><span class="badge ${sc}">${o.status==='resolved'?'Resolvido':'Em apuração'}</span></td></tr>`;
  }).join('');
}
function openOccurrenceModal(){
  const type=prompt('Tipo (avaria total/avaria parcial/extravio confirmado/extravio em apuração):');if(!type)return;
  const cost=parseFloat(prompt('Valor indenização (R$):')||'0');
  const route=prompt('Rota:')||'';
  const list=DB._get('logistica_occurrences');
  list.push({id:'occ_'+Date.now(),type,cost,route,driver:'Motorista',code:'LT'+Date.now().toString(36).toUpperCase(),status:'pending',date:new Date().toISOString(),carrierId:CID});
  DB._set('logistica_occurrences',list);
  renderOccurrences();showToast('Ocorrência registrada!');
}
function renderSLA(){
  const dels=DB.getDeliveries(CID);
  const delivered=dels.filter(d=>d.status==='delivered');
  const ontime=delivered.filter(d=>{const days=Math.ceil((new Date(d.updatedAt||d.createdAt)-new Date(d.createdAt))/86400000);return days<=5;});
  const general=delivered.length?Math.round((ontime.length/delivered.length)*100):0;
  document.getElementById('sla-general').textContent=general+'%';
  document.getElementById('sla-general').style.color=general>=95?'var(--success)':general>=85?'var(--warning)':'var(--danger)';
  document.getElementById('sla-ontime').textContent=ontime.length;
  document.getElementById('sla-late').textContent=delivered.length-ontime.length;
  const risk=dels.filter(d=>d.status==='in_transit').length;
  document.getElementById('sla-risk').textContent=risk;
  const clients={};dels.forEach(d=>{if(!clients[d.clientName])clients[d.clientName]={total:0,ontime:0};clients[d.clientName].total++;if(d.status==='delivered'){const days=Math.ceil((new Date(d.updatedAt||d.createdAt)-new Date(d.createdAt))/86400000);if(days<=5)clients[d.clientName].ontime++;}});
  const tbody=document.getElementById('sla-tbody');
  tbody.innerHTML=Object.entries(clients).map(([name,data])=>{
    const sla=data.total?Math.round((data.ontime/data.total)*100):0;
    const dot=sla>=95?'green':sla>=85?'yellow':'red';
    return `<tr><td><strong>${name}</strong></td><td>95%</td><td>${sla}%</td><td><span class="sla-dot ${dot}"></span>${dot==='green'?'OK':dot==='yellow'?'Atenção':'Crítico'}</td><td>${sla>=95?'↑':'↓'}</td></tr>`;
  }).join('');
}
function renderCosts(){
  const dels=DB.getDeliveries(CID);
  const totalDels=dels.length||1;const totalW=dels.reduce((s,d)=>s+(d.weight||0),0)||1;
  const totalKm=dels.length*280;
  const costs={fuel:totalKm*0.85,maintenance:totalDels*12,tires:totalKm*0.08,tolls:totalKm*0.12,arla:totalKm*0.03,labor:totalDels*35,outsource:totalDels*8};
  const total=Object.values(costs).reduce((s,v)=>s+v,0);
  document.getElementById('cost-total').textContent='R$ '+total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  document.getElementById('cost-kg').textContent='R$ '+(total/totalW).toFixed(2).replace('.',',');
  document.getElementById('cost-del').textContent='R$ '+(total/totalDels).toFixed(2).replace('.',',');
  document.getElementById('cost-km').textContent='R$ '+(total/totalKm).toFixed(2).replace('.',',');
  const labels={'fuel':'Combustível','maintenance':'Manutenção','tires':'Pneus','tolls':'Pedágio','arla':'ARLA','labor':'Mão de obra','outsource':'Terceirização'};
  document.getElementById('cost-breakdown').innerHTML=Object.entries(costs).map(([k,v])=>`<div class="cost-item"><span class="cost-label">${labels[k]}</span><span class="cost-value">R$ ${v.toFixed(2)}</span></div>`).join('')+`<div class="cost-item" style="font-weight:700;border-top:2px solid var(--border);padding-top:0.8rem;"><span>TOTAL</span><span>R$ ${total.toFixed(2)}</span></div>`;
}
function renderDRE(){
  const dels=DB.getDeliveries(CID);
  const revenue=dels.reduce((s,d)=>s+(d.value||0),0);
  const taxes=revenue*0.15;const variable=revenue*0.45;const fixed=revenue*0.2;
  const margin=revenue-taxes-variable-fixed;
  const pct=revenue?(margin/revenue*100):0;
  document.getElementById('dre-revenue').textContent='R$ '+revenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  document.getElementById('dre-costs').textContent='R$ '+(taxes+variable+fixed).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  document.getElementById('dre-margin').textContent=pct.toFixed(1)+'%';
  document.getElementById('dre-margin').style.color=pct>0?'var(--success)':'var(--danger)';
  document.getElementById('dre-table').innerHTML=[
    {l:'Receita Bruta',v:revenue,cls:'positive'},{l:'(-) Impostos (15%)',v:-taxes,cls:'negative'},
    {l:'(-) Custos Variáveis (45%)',v:-variable,cls:'negative'},{l:'(-) Custos Fixos (20%)',v:-fixed,cls:'negative'},
    {l:'= Margem Operacional',v:margin,cls:margin>0?'positive':'negative',total:true}
  ].map(r=>`<div class="dre-row ${r.cls}${r.total?' total':''}"><span class="cost-label">${r.l}</span><span class="cost-value">R$ ${r.v.toFixed(2)}</span></div>`).join('');
  if(window._chartDre)window._chartDre.destroy();
  const months=['Jan','Fev','Mar','Abr','Mai','Jun'];
  window._chartDre=new Chart(document.getElementById('chart-dre'),{type:'line',data:{labels:months,datasets:[{label:'Receita',data:months.map(()=>revenue/6*(0.8+Math.random()*0.4)),borderColor:'#10b981',tension:0.4},{label:'Custos',data:months.map(()=>(taxes+variable+fixed)/6*(0.85+Math.random()*0.3)),borderColor:'#ef4444',tension:0.4}]},options:{responsive:true,plugins:{title:{display:true,text:'Evolução Mensal',color:'#e2e8f0',font:{family:'Outfit'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{display:false}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}}}}});
}
function renderKgKm(){
  const dels=DB.getDeliveries(CID);
  const totalKg=dels.reduce((s,d)=>s+(d.weight||0),0);
  const totalKm=dels.length*280;
  const ratio=totalKm?totalKg/totalKm:0;
  document.getElementById('kgkm-general').textContent=ratio.toFixed(2);
  document.getElementById('kgkm-totalkg').textContent=totalKg.toFixed(0)+' kg';
  document.getElementById('kgkm-totalkm').textContent=totalKm+' km';
  const routes={};
  dels.forEach(d=>{const k=d.origin+'→'+d.destination;if(!routes[k])routes[k]={kg:0,km:Math.floor(Math.random()*800+100)};routes[k].kg+=(d.weight||0);});
  document.getElementById('kgkm-tbody').innerHTML=Object.entries(routes).map(([r,d])=>{
    const eff=d.km?(d.kg/d.km):0;const color=eff>3?'var(--success)':eff>1.5?'var(--warning)':'var(--danger)';
    return `<tr><td><strong>${r}</strong></td><td>${d.kg.toFixed(0)}</td><td>${d.km}</td><td style="font-weight:700;color:${color}">${eff.toFixed(2)}</td><td><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100,eff*20)}%;background:${color}"></div></div></td></tr>`;
  }).join('');
  if(window._chartKgkm)window._chartKgkm.destroy();
  const labels=Object.keys(routes).slice(0,6);
  const data=labels.map(l=>{const r=routes[l];return r.km?(r.kg/r.km):0;});
  window._chartKgkm=new Chart(document.getElementById('chart-kgkm'),{type:'bar',data:{labels,datasets:[{label:'Kg/Km',data,backgroundColor:'rgba(6,182,212,0.6)',borderRadius:6}]},options:{responsive:true,plugins:{title:{display:true,text:'Eficiência por Rota',color:'#e2e8f0',font:{family:'Outfit'}}},scales:{x:{ticks:{color:'#94a3b8',maxRotation:45},grid:{display:false}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}}}}});
}
