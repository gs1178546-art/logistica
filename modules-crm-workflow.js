// =============================================
// CRM Avançado - Workflow de Aprovação
// =============================================

// ── Stage Configuration ──────────────────────
const CRM_STAGES = {
  triagem:      { label: 'Triagem',       color: '#94a3b8', icon: 'inbox' },
  validacao:    { label: 'Validação',     color: '#3b82f6', icon: 'eye' },
  planejamento: { label: 'Planejamento',  color: '#f59e0b', icon: 'clipboard-list' },
  conferencia:  { label: 'Conferência',   color: '#8b5cf6', icon: 'check-square' },
  aprovado:     { label: 'Aprovado',      color: '#10b981', icon: 'check-circle' },
  fechado:      { label: 'Fechado',       color: '#06b6d4', icon: 'lock' },
  recusado:     { label: 'Recusado',      color: '#ef4444', icon: 'x-circle' }
};

const CRM_PRIORITIES = {
  alta:  { label: 'Alta',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  media: { label: 'Média', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  baixa: { label: 'Baixa', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
};

const CRM_STAGE_ORDER = ['triagem','validacao','planejamento','conferencia','aprovado','fechado','recusado'];

// ── Permission Matrix ────────────────────────
function canUserAct(stage, role) {
  if (role === 'admin' || role === 'programador') return true;
  const perms = {
    triagem:      ['comercial'],
    validacao:    ['gerente'],
    planejamento: ['planejamento'],
    conferencia:  ['gerente'],
    aprovado:     ['comercial']
  };
  return (perms[stage] || []).includes(role);
}

function getStageActions(stage, role) {
  if (!canUserAct(stage, role)) return [];
  const actions = {
    triagem:      [{ action: 'Enviar para Gerente',         newStage: 'validacao',    style: 'primary',   icon: 'send' }],
    validacao:    [
      { action: 'Aprovar para Planejamento', newStage: 'planejamento', style: 'primary',   icon: 'check' },
      { action: 'Recusar',                   newStage: 'recusado',     style: 'danger',    icon: 'x' }
    ],
    planejamento: [{ action: 'Devolver para Conferência',   newStage: 'conferencia',  style: 'primary',   icon: 'rotate-ccw' }],
    conferencia:  [
      { action: 'Aprovação Final',           newStage: 'aprovado',     style: 'primary',   icon: 'check-circle' },
      { action: 'Devolver ao Planejamento',  newStage: 'planejamento', style: 'secondary', icon: 'rotate-ccw' }
    ],
    aprovado:     [{ action: 'Liberar para Cliente',        newStage: 'fechado',      style: 'primary',   icon: 'unlock' }]
  };
  return actions[stage] || [];
}

// ── Render CRM Workflow ──────────────────────
function renderCrmWorkflow() {
  const userRole = (typeof USER !== 'undefined' ? USER.role : 'admin');
  const carrierId = (typeof CID !== 'undefined' ? CID : null);
  const demands = DB.getCrmDemands(carrierId) || [];

  // Stats
  const total = demands.length;
  const triagem = demands.filter(d => d.stage === 'triagem').length;
  const aguardando = demands.filter(d => ['validacao','conferencia'].includes(d.stage)).length;
  const concluidas = demands.filter(d => ['fechado','aprovado'].includes(d.stage)).length;
  const emAndamento = demands.filter(d => d.stage === 'planejamento').length;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('crm-wf-total', total);
  setEl('crm-wf-triagem', triagem);
  setEl('crm-wf-aguardando', aguardando);
  setEl('crm-wf-concluidas', concluidas);

  // Kanban Board
  const board = document.getElementById('crm-workflow-board');
  if (!board) return;

  board.innerHTML = CRM_STAGE_ORDER.map(stageKey => {
    const cfg = CRM_STAGES[stageKey];
    const items = demands.filter(d => d.stage === stageKey);
    const canAct = canUserAct(stageKey, userRole);

    return `
      <div class="crm-wf-col">
        <div class="crm-wf-col-header" style="background:${cfg.color}18;border-left:3px solid ${cfg.color};">
          <i data-lucide="${cfg.icon}" style="width:14px;height:14px;color:${cfg.color};"></i>
          <span style="color:${cfg.color};">${cfg.label}</span>
          <span class="crm-wf-count" style="background:${cfg.color}22;color:${cfg.color};">${items.length}</span>
        </div>
        <div class="crm-wf-col-body">
          ${items.length ? items.map(d => {
            const pri = CRM_PRIORITIES[d.priority] || CRM_PRIORITIES.media;
            return `
              <div class="crm-wf-card ${canAct ? 'actionable' : ''}" onclick="openCrmDetail('${d.id}')" style="border-left:3px solid ${pri.color};">
                <div class="crm-wf-card-title">${d.title}</div>
                <div class="crm-wf-card-client"><i data-lucide="building" style="width:12px;height:12px;"></i> ${d.clientName}</div>
                <div class="crm-wf-card-footer">
                  <span class="crm-wf-card-value">R$ ${(d.value || 0).toLocaleString('pt-BR')}</span>
                  <span class="crm-wf-priority-badge" style="background:${pri.bg};color:${pri.color};">${pri.label}</span>
                </div>
                ${d.log && d.log.length > 0 ? `<div class="crm-wf-card-meta"><i data-lucide="clock" style="width:11px;height:11px;"></i> ${timeAgo(d.log[d.log.length-1].at)}</div>` : ''}
              </div>`;
          }).join('') : '<div class="crm-wf-empty">Nenhuma demanda</div>'}
        </div>
      </div>`;
  }).join('');

  lucide.createIcons();
}

// ── Time Ago Helper ──────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return mins + 'min';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  return days + 'd';
}

// ── Open New Demand Modal ────────────────────
function openCrmDemandModal() {
  document.getElementById('crm-demand-form').reset();
  // Populate client dropdown
  const sel = document.getElementById('crm-dem-client');
  const clients = DB._get('logistica_clients');
  sel.innerHTML = '<option value="">Selecionar cliente...</option>';
  clients.forEach(c => { sel.innerHTML += `<option value="${c.name}">${c.name}</option>`; });
  openModal('crm-demand-modal');
}

// ── Save New Demand ──────────────────────────
window.saveCrmDemand = function(e) {
  e.preventDefault();
  const userRole = (typeof USER !== 'undefined' ? USER.role : 'admin');
  const userName = (typeof USER !== 'undefined' ? USER.name : 'Admin');
  const userId = (typeof USER !== 'undefined' ? USER.id : 'admin');
  const carrierId = (typeof CID !== 'undefined' ? CID : 'carrier_1');

  const title = document.getElementById('crm-dem-title').value;
  const clientName = document.getElementById('crm-dem-client').value;
  const description = document.getElementById('crm-dem-desc').value;
  const value = parseFloat(document.getElementById('crm-dem-value').value) || 0;
  const priority = document.getElementById('crm-dem-priority').value;

  const demand = {
    id: 'dem_' + Date.now(),
    title, clientName, description, value, priority,
    stage: 'triagem',
    createdBy: userId,
    createdByName: userName,
    createdByRole: userRole,
    carrierId: carrierId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    log: [{ action: 'Demanda criada', by: userName, role: userRole, at: new Date().toISOString() }]
  };

  DB.addCrmDemand(demand);
  closeModal('crm-demand-modal');
  renderCrmWorkflow();
  showToast('Demanda criada com sucesso!');
};

// ── Open Detail Drawer ───────────────────────
function openCrmDetail(id) {
  const demand = DB.getCrmDemand(id);
  if (!demand) return;

  const userRole = (typeof USER !== 'undefined' ? USER.role : 'admin');
  const cfg = CRM_STAGES[demand.stage] || CRM_STAGES.triagem;
  const pri = CRM_PRIORITIES[demand.priority] || CRM_PRIORITIES.media;
  const actions = getStageActions(demand.stage, userRole);

  const drawer = document.getElementById('crm-detail-drawer');
  if (!drawer) return;

  // Header
  document.getElementById('crm-detail-title').textContent = demand.title;
  document.getElementById('crm-detail-stage').innerHTML = `<span class="crm-stage-badge" style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}44;"><i data-lucide="${cfg.icon}" style="width:13px;height:13px;"></i> ${cfg.label}</span>`;

  // Info
  document.getElementById('crm-detail-info').innerHTML = `
    <div class="crm-detail-row"><span class="crm-detail-label">Cliente</span><span class="crm-detail-value">${demand.clientName}</span></div>
    <div class="crm-detail-row"><span class="crm-detail-label">Valor</span><span class="crm-detail-value" style="color:var(--primary);font-weight:700;">R$ ${(demand.value||0).toLocaleString('pt-BR')}</span></div>
    <div class="crm-detail-row"><span class="crm-detail-label">Prioridade</span><span class="crm-wf-priority-badge" style="background:${pri.bg};color:${pri.color};">${pri.label}</span></div>
    <div class="crm-detail-row"><span class="crm-detail-label">Criado por</span><span class="crm-detail-value">${demand.createdByName} <span style="font-size:0.7rem;opacity:0.6;">(${demand.createdByRole})</span></span></div>
    <div class="crm-detail-row"><span class="crm-detail-label">Criado em</span><span class="crm-detail-value">${new Date(demand.createdAt).toLocaleString('pt-BR')}</span></div>
    ${demand.description ? `<div class="crm-detail-desc"><span class="crm-detail-label">Descrição</span><p>${demand.description}</p></div>` : ''}
  `;

  // Timeline / Log
  const logHtml = (demand.log || []).slice().reverse().map(entry => {
    const roleColors = { comercial: '#10b981', gerente: '#3b82f6', planejamento: '#f59e0b', admin: '#06b6d4', programador: '#8b5cf6' };
    const rc = roleColors[entry.role] || '#94a3b8';
    return `
      <div class="crm-timeline-item">
        <div class="crm-timeline-dot" style="background:${rc};"></div>
        <div class="crm-timeline-content">
          <div class="crm-timeline-action">${entry.action}</div>
          <div class="crm-timeline-meta">
            <span style="color:${rc};font-weight:600;">${entry.by}</span>
            <span>•</span>
            <span>${new Date(entry.at).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>`;
  }).join('');
  document.getElementById('crm-detail-timeline').innerHTML = logHtml || '<p style="color:var(--text-dim);font-size:0.85rem;">Nenhum registro.</p>';

  // Action Buttons
  let actionsHtml = '';
  if (actions.length > 0) {
    actionsHtml = '<div class="crm-action-bar">' + actions.map(a =>
      `<button class="btn-${a.style} crm-action-btn" onclick="advanceCrmStage('${demand.id}','${a.newStage}','${a.action}')">
        <i data-lucide="${a.icon}" style="width:16px;height:16px;"></i> ${a.action}
      </button>`
    ).join('') + '</div>';
  } else if (['fechado','recusado'].includes(demand.stage)) {
    actionsHtml = `<div class="crm-action-bar"><div style="text-align:center;width:100%;padding:0.75rem;color:var(--text-dim);font-size:0.85rem;"><i data-lucide="${demand.stage === 'fechado' ? 'check-circle' : 'x-circle'}" style="width:16px;height:16px;"></i> Demanda ${demand.stage === 'fechado' ? 'concluída' : 'recusada'}</div></div>`;
  } else {
    actionsHtml = '<div class="crm-action-bar"><div style="text-align:center;width:100%;padding:0.75rem;color:var(--text-dim);font-size:0.85rem;"><i data-lucide="clock" style="width:16px;height:16px;"></i> Aguardando ação de outro setor</div></div>';
  }
  document.getElementById('crm-detail-actions').innerHTML = actionsHtml;

  drawer.classList.add('active');
  lucide.createIcons();
}

function closeCrmDrawer() {
  document.getElementById('crm-detail-drawer').classList.remove('active');
}

// ── Advance Stage ────────────────────────────
function advanceCrmStage(id, newStage, actionLabel) {
  const userRole = (typeof USER !== 'undefined' ? USER.role : 'admin');
  const userName = (typeof USER !== 'undefined' ? USER.name : 'Admin');

  DB.addCrmDemandLog(id, {
    action: actionLabel,
    by: userName,
    role: userRole
  });

  DB.updateCrmDemand(id, {
    stage: newStage,
    updatedAt: new Date().toISOString()
  });

  closeCrmDrawer();
  renderCrmWorkflow();
  showToast(actionLabel + ' realizado!');
}
