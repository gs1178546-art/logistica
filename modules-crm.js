// CRM Module Functions
function renderPipeline(){
  const stages=['Prospecção','Proposta','Negociação','Contrato','Ativo'];
  const colors=['#94a3b8','#3b82f6','#f59e0b','#8b5cf6','#10b981'];
  const pipe=DB._get('logistica_pipeline');
  const counts={prospect:0,proposal:0,negotiation:0,contract:0,active:0};
  const keys=Object.keys(counts);
  pipe.forEach(p=>{if(counts[p.stage]!==undefined)counts[p.stage]++;});
  document.getElementById('p-leads').textContent=counts.prospect;
  document.getElementById('p-proposals').textContent=counts.proposal;
  document.getElementById('p-negotiation').textContent=counts.negotiation;
  document.getElementById('p-won').textContent=counts.contract+counts.active;
  const board=document.getElementById('kanban-board');
  board.innerHTML=stages.map((s,i)=>{
    const k=keys[i];const items=pipe.filter(p=>p.stage===k);
    return `<div class="kanban-col"><div class="kanban-col-header" style="background:${colors[i]}22;color:${colors[i]}">${s} (${items.length})</div><div class="kanban-col-body">${items.map(p=>`<div class="kanban-card"><div class="card-title">${p.name}</div><div class="card-value">R$ ${(p.value||0).toLocaleString('pt-BR')}</div><div class="card-meta">${p.contact||''}</div></div>`).join('')||'<div style="text-align:center;color:var(--text-dim);font-size:0.8rem;padding:1rem;">Vazio</div>'}</div></div>`;
  }).join('');
}
function renderClients(){
  const clients=DB._get('logistica_clients');
  const tbody=document.getElementById('clients-tbody');
  if(!clients.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum cliente.</td></tr>';return;}
  tbody.innerHTML=clients.map(c=>`<tr><td><strong>${c.name}</strong></td><td>${c.cnpj||'—'}</td><td>${c.contact||'—'}</td><td>${c.sla||95}%</td><td><span class="badge badge-active">${c.status||'Ativo'}</span></td><td><button class="btn-danger btn-sm" onclick="deleteClient('${c.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></td></tr>`).join('');
  lucide.createIcons();
}
function openClientModal(){
  document.getElementById('client-form').reset();
  document.getElementById('client-modal').classList.add('active');
}

window.saveClient = function(e){
  e.preventDefault();
  const name=document.getElementById('cli-name').value;
  const cnpj=document.getElementById('cli-cnpj').value;
  const contact=document.getElementById('cli-contact').value;
  const sla=document.getElementById('cli-sla').value || '95';
  
  const list=DB._get('logistica_clients');
  list.push({id:'cli_'+Date.now(),name,cnpj,contact,sla:parseInt(sla),status:'Ativo',carrierId:CID,createdAt:new Date().toISOString()});
  DB._set('logistica_clients',list);
  
  renderClients();
  closeModal('client-modal');
  showToast('Cliente adicionado!');
}
function deleteClient(id){
  if(!confirm('Excluir cliente?'))return;
  DB._set('logistica_clients',DB._get('logistica_clients').filter(c=>c.id!==id));
  renderClients();showToast('Cliente excluído.','error');
}
function renderContracts(){
  const contracts=DB._get('logistica_contracts');
  const tbody=document.getElementById('contracts-tbody');
  if(!contracts.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum contrato.</td></tr>';return;}
  const cls=DB._get('logistica_clients');const cm={};cls.forEach(c=>cm[c.id]=c.name);
  tbody.innerHTML=contracts.map(c=>{
    const end=new Date(c.endDate);const now=new Date();const days=Math.ceil((end-now)/86400000);
    const st=days<0?'Vencido':days<30?'Expirando':'Vigente';
    const sc=days<0?'badge-cancelled':days<30?'badge-pending':'badge-active';
    return `<tr><td>${cm[c.clientId]||c.clientName||'—'}</td><td>${c.startDate?.slice(0,10)||'—'} a ${c.endDate?.slice(0,10)||'—'}</td><td>${c.sla||95}%</td><td>R$ ${(c.value||0).toLocaleString('pt-BR')}</td><td><span class="badge ${sc}">${st}</span></td><td><button class="btn-danger btn-sm" onclick="deleteContract('${c.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></td></tr>`;
  }).join('');lucide.createIcons();
}
function openContractModal(){
  document.getElementById('contract-form').reset();
  document.getElementById('contract-modal').classList.add('active');
}

window.saveContract = function(e){
  e.preventDefault();
  const clientName=document.getElementById('ctr-clientName').value;
  const sla=document.getElementById('ctr-sla').value || '95';
  const value=document.getElementById('ctr-value').value || '0';
  
  const startDate=new Date().toISOString();
  const endDate=new Date(Date.now()+365*86400000).toISOString();
  const list=DB._get('logistica_contracts');
  list.push({id:'ctr_'+Date.now(),clientName,sla:parseInt(sla),value:parseFloat(value),startDate,endDate,carrierId:CID});
  DB._set('logistica_contracts',list);
  
  renderContracts();
  closeModal('contract-modal');
  showToast('Contrato adicionado!');
}
function deleteContract(id){
  if(!confirm('Excluir contrato?'))return;
  DB._set('logistica_contracts',DB._get('logistica_contracts').filter(c=>c.id!==id));
  renderContracts();showToast('Contrato excluído.','error');
}
function calcPricing(){
  const dist=parseFloat(document.getElementById('price-dist').value)||0;
  const weight=parseFloat(document.getElementById('price-weight').value)||0;
  const vol=parseFloat(document.getElementById('price-vol').value)||0;
  const mode=document.getElementById('price-mode').value;
  if(!dist||!weight){showToast('Preencha distância e peso.','error');return;}
  let rate=dist<=100?3.5:dist<=500?2.8:dist<=1000?2.2:1.8;
  let total=dist*rate+weight*0.15+vol*12+dist*0.12;
  const mult={normal:1,fragile:1.3,perishable:1.5,dangerous:1.8};
  total*=(mult[mode]||1);
  document.getElementById('price-result').style.display='block';
  document.getElementById('price-total').textContent=`R$ ${total.toFixed(2).replace('.',',')}`;
  document.getElementById('price-breakdown').textContent=`Dist: R$${(dist*rate).toFixed(2)} | Peso: R$${(weight*0.15).toFixed(2)} | Vol: R$${(vol*12).toFixed(2)} | Pedágio: R$${(dist*0.12).toFixed(2)}`;
}
function renderNPS(){
  const nps=DB._get('logistica_nps');
  const promoters=nps.filter(n=>n.score>=9).length;
  const detractors=nps.filter(n=>n.score<=6).length;
  const total=nps.length||1;
  const score=Math.round(((promoters-detractors)/total)*100);
  document.getElementById('nps-score').textContent=score;
  document.getElementById('nps-promoters').textContent=promoters;
  document.getElementById('nps-detractors').textContent=detractors;
  document.getElementById('nps-total').textContent=nps.length;
}
