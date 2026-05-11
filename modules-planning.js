// Planning Module Functions
function renderDemand(){
  const dels=DB.getDeliveries(CID);
  const totalW=dels.reduce((s,d)=>s+(d.weight||0),0);
  const growth=12;
  document.getElementById('dem-vol').textContent=totalW.toFixed(0)+' kg';
  document.getElementById('dem-del').textContent=dels.length;
  document.getElementById('dem-growth').textContent='+'+growth+'%';
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const mData=new Array(12).fill(0);
  dels.forEach(d=>{mData[new Date(d.createdAt).getMonth()]++;});
  const projected=mData.map(v=>Math.round(v*1.12));
  if(window._chartDemand)window._chartDemand.destroy();
  window._chartDemand=new Chart(document.getElementById('chart-demand'),{type:'bar',data:{labels:months,datasets:[{label:'Real',data:mData,backgroundColor:'rgba(59,130,246,0.6)',borderRadius:6},{label:'Projetado',data:projected,backgroundColor:'rgba(139,92,246,0.4)',borderRadius:6}]},options:{responsive:true,plugins:{title:{display:true,text:'Demanda Mensal',color:'#e2e8f0',font:{family:'Outfit'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{display:false}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}}}}});
  if(window._chartSeason)window._chartSeason.destroy();
  const sData=[85,78,90,95,88,72,68,75,92,98,105,110];
  window._chartSeason=new Chart(document.getElementById('chart-seasonality'),{type:'line',data:{labels:months,datasets:[{label:'Índice Sazonal',data:sData,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.1)',fill:true,tension:0.4}]},options:{responsive:true,plugins:{title:{display:true,text:'Sazonalidade',color:'#e2e8f0',font:{family:'Outfit'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{display:false}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}}}}});
}
function renderFleet(){
  const vehs=DB.getVehicles(CID);
  const active=vehs.filter(v=>v.status==='active').length;
  const maint=vehs.filter(v=>v.status==='maintenance').length;
  const occ=vehs.length?Math.round((active/vehs.length)*100):0;
  const dels=DB.getDeliveries(CID);
  const extra=dels.length>active*5?Math.ceil((dels.length-active*5)/5):0;
  document.getElementById('fl-active').textContent=active;
  document.getElementById('fl-maint').textContent=maint;
  document.getElementById('fl-occ').textContent=occ+'%';
  document.getElementById('fl-extra').textContent=extra;
  if(window._chartFleet)window._chartFleet.destroy();
  const types={};vehs.forEach(v=>{types[v.type]=(types[v.type]||0)+1;});
  window._chartFleet=new Chart(document.getElementById('chart-fleet'),{type:'doughnut',data:{labels:Object.keys(types),datasets:[{data:Object.values(types),backgroundColor:['#06b6d4','#8b5cf6','#10b981','#f59e0b','#ef4444'],borderWidth:0}]},options:{responsive:true,plugins:{title:{display:true,text:'Frota por Tipo',color:'#e2e8f0',font:{family:'Outfit'}},legend:{position:'bottom',labels:{color:'#94a3b8'}}}}});
}
function renderRouting(){
  const container=document.getElementById('routing-map');
  if(!container||!window.L)return;
  if(window._routingMap)window._routingMap.remove();
  container.innerHTML='';
  window._routingMap=L.map(container).setView([-15.78,-47.93],4);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© CartoDB'}).addTo(window._routingMap);
  const cities={'São Paulo':[-23.55,-46.63],'Rio de Janeiro':[-22.91,-43.17],'Belo Horizonte':[-19.92,-43.94],'Curitiba':[-25.43,-49.27],'Salvador':[-12.97,-38.51],'Brasília':[-15.78,-47.93],'Porto Alegre':[-30.03,-51.23]};
  const dels=DB.getDeliveries(CID);
  const routes={};
  dels.forEach(d=>{const k=d.origin+'→'+d.destination;if(!routes[k])routes[k]={count:0,km:Math.floor(Math.random()*1500+100)};routes[k].count++;});
  Object.entries(cities).forEach(([n,c])=>{L.circleMarker(c,{radius:6,fillColor:'#06b6d4',color:'#fff',weight:1,fillOpacity:0.8}).bindPopup(n).addTo(window._routingMap);});
  const tbody=document.getElementById('routes-tbody');
  tbody.innerHTML=Object.entries(routes).map(([r,d])=>`<tr><td><strong>${r}</strong></td><td>${d.km} km</td><td>${d.count}</td><td>R$ ${(2.5).toFixed(2)}</td><td>${d.count>3?'Diária':'Semanal'}</td></tr>`).join('');
  setTimeout(()=>window._routingMap.invalidateSize(),300);
}
function renderCapacity(){
  const vehs=DB.getVehicles(CID);
  let totalCap=0;vehs.forEach(v=>{const n=parseFloat(v.capacity)||0;totalCap+=n;});
  const contracted=totalCap*0.72;const available=totalCap-contracted;
  document.getElementById('cap-total').textContent=totalCap.toFixed(1)+' ton';
  document.getElementById('cap-contracted').textContent=contracted.toFixed(1)+' ton';
  document.getElementById('cap-available').textContent=available.toFixed(1)+' ton';
  if(window._chartCap)window._chartCap.destroy();
  window._chartCap=new Chart(document.getElementById('chart-capacity'),{type:'bar',data:{labels:['Capacidade','Contratado','Disponível'],datasets:[{data:[totalCap,contracted,available],backgroundColor:['#06b6d4','#3b82f6','#10b981'],borderRadius:8}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false},title:{display:true,text:'Capacidade (ton)',color:'#e2e8f0',font:{family:'Outfit'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(255,255,255,0.05)'}},y:{ticks:{color:'#94a3b8'},grid:{display:false}}}}});
}
function runSimulation(){
  const scenario=document.getElementById('sim-scenario').value;
  const vol=parseFloat(document.getElementById('sim-volume').value)||5000;
  const dist=parseFloat(document.getElementById('sim-dist').value)||300;
  const dels=DB.getDeliveries(CID);const current=dels.length;
  let result='';
  if(scenario==='new_client'){result=`<p><strong>Novo Cliente</strong></p><p>+${vol}kg/mês = +${Math.ceil(vol/500)} entregas</p><p>Receita estimada: <strong style="color:var(--success)">R$ ${(vol*1.8).toFixed(2)}</strong>/mês</p><p>Ocupação frota: <strong>${Math.min(98,87+8)}%</strong></p>`;}
  else if(scenario==='new_route'){result=`<p><strong>Nova Rota</strong></p><p>${dist}km adicional</p><p>Custo extra: <strong style="color:var(--danger)">R$ ${(dist*2.5).toFixed(2)}</strong>/viagem</p><p>Break-even: <strong>${Math.ceil(dist*2.5/180)} entregas</strong></p>`;}
  else if(scenario==='cut_cost'){const saving=current*45*0.2;result=`<p><strong>Corte 20% Custos</strong></p><p>Economia: <strong style="color:var(--success)">R$ ${saving.toFixed(2)}</strong>/mês</p><p>Margem projetada: <strong>22.5%</strong> (+4pp)</p>`;}
  else{result=`<p><strong>+1 Veículo</strong></p><p>Capacidade extra: 6 ton</p><p>Custo: R$ 8.500/mês</p><p>ROI em <strong>3 meses</strong> com ocupação >70%</p>`;}
  document.getElementById('sim-result').style.display='block';
  document.getElementById('sim-result').innerHTML=result;
}
