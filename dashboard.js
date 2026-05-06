// =============================================
// LogiTrack - Dashboard Logic (Admin Transportadora)
// =============================================

// ── Auth Guard ────────────────────────
const USER = DB.getCurrentUser();
if (!USER || USER.role !== 'admin') { window.location.href = 'login.html'; }
const CID = USER.carrierId;
document.getElementById('nav-greeting').textContent = `Olá, ${USER.name.split(' ')[0]}!`;

// ── Sidebar Navigation ────────────────
document.querySelectorAll('.side-nav a').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        navTo(link.dataset.tab);
    });
});

function navTo(tab) {
    document.querySelectorAll('.side-nav a').forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`.side-nav a[data-tab="${tab}"]`);
    if (link) link.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    closeMobileMenu();
    lucide.createIcons();
    if (tab === 'dashboard') refreshDashboard();
    if (tab === 'reports') refreshReports();
}

// ── Mobile Menu ───────────────────────
function toggleMobileMenu() {
    document.getElementById('hamburger-btn').classList.toggle('active');
    document.getElementById('mobile-drawer').classList.toggle('open');
    document.getElementById('drawer-overlay').classList.toggle('open');
    lucide.createIcons();
}
function closeMobileMenu() {
    document.getElementById('hamburger-btn')?.classList.remove('active');
    document.getElementById('mobile-drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('open');
}

// ── Toast ─────────────────────────────
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = `toast toast-${type} show`;
    document.getElementById('toast-text').textContent = msg;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Modal Helpers ─────────────────────
function openModal(id) { document.getElementById(id).classList.add('active'); lucide.createIcons(); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ── Status Helpers ────────────────────
const STATUS_LABELS = { pending: 'Pendente', in_transit: 'Em Trânsito', delivered: 'Entregue', cancelled: 'Cancelado' };
const STATUS_CLASSES = { pending: 'badge-pending', in_transit: 'badge-transit', delivered: 'badge-delivered', cancelled: 'badge-cancelled' };
function statusBadge(s) { return `<span class="badge ${STATUS_CLASSES[s] || ''}">${STATUS_LABELS[s] || s}</span>`; }

// ══════════════════════════════════════
// DASHBOARD TAB
// ══════════════════════════════════════
let chartStatus, chartWeekly, dashboardMap;

function refreshDashboard() {
    const dels = DB.getDeliveries(CID);
    document.getElementById('s-total').textContent = dels.length;
    document.getElementById('s-transit').textContent = dels.filter(d => d.status === 'in_transit').length;
    document.getElementById('s-delivered').textContent = dels.filter(d => d.status === 'delivered').length;
    document.getElementById('s-pending').textContent = dels.filter(d => d.status === 'pending').length;

    // Status Chart
    const counts = { pending: 0, in_transit: 0, delivered: 0, cancelled: 0 };
    dels.forEach(d => { if (counts[d.status] !== undefined) counts[d.status]++; });
    const ctx1 = document.getElementById('chart-status');
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: ['Pendentes', 'Em Trânsito', 'Entregues', 'Cancelados'],
            datasets: [{ data: Object.values(counts), backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } }, title: { display: true, text: 'Status das Entregas', color: '#e2e8f0', font: { family: 'Outfit', size: 14 } } } }
    });

    // Weekly Chart
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const weekData = new Array(7).fill(0);
    const now = new Date();
    dels.forEach(d => {
        const diff = Math.floor((now - new Date(d.createdAt)) / 86400000);
        if (diff < 7) weekData[new Date(d.createdAt).getDay()]++;
    });
    const ctx2 = document.getElementById('chart-weekly');
    if (chartWeekly) chartWeekly.destroy();
    chartWeekly = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{ label: 'Entregas', data: weekData, backgroundColor: 'rgba(6,182,212,0.6)', borderRadius: 6 }]
        },
        options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Entregas por Dia da Semana', color: '#e2e8f0', font: { family: 'Outfit', size: 14 } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { display: false } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Map
    initMap(dels);
}

function initMap(dels) {
    const container = document.getElementById('dashboard-map');
    if (!container) return;
    
    if (dashboardMap) {
        dashboardMap.remove();
    }
    
    container.innerHTML = '';
    dashboardMap = L.map(container).setView([-15.78, -47.93], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CartoDB'
    }).addTo(dashboardMap);

    const cityCoords = {
        'São Paulo': [-23.55, -46.63], 'Rio de Janeiro': [-22.91, -43.17],
        'Belo Horizonte': [-19.92, -43.94], 'Curitiba': [-25.43, -49.27],
        'Salvador': [-12.97, -38.51], 'Fortaleza': [-3.72, -38.52],
        'Brasília': [-15.78, -47.93], 'Porto Alegre': [-30.03, -51.23],
        'Manaus': [-3.12, -60.02], 'Recife': [-8.05, -34.87]
    };

    const colors = { pending: '#f59e0b', in_transit: '#3b82f6', delivered: '#10b981', cancelled: '#ef4444' };
    const drivers = DB.getDrivers(CID);
    dels.forEach(d => {
        let coords = null;
        let isRealTime = false;

        if (d.driverId) {
            const drv = drivers.find(x => x.id === d.driverId);
            if (drv && drv.lat && drv.lng) {
                coords = [drv.lat, drv.lng];
                isRealTime = true;
            }
        }

        if (!coords) coords = cityCoords[d.destination];

        if (coords) {
            let color = colors[d.status] || '#06b6d4';
            let radius = isRealTime && d.status === 'in_transit' ? 10 : 8;
            let weight = isRealTime && d.status === 'in_transit' ? 2 : 1;
            L.circleMarker(coords, { radius: radius, fillColor: color, color: '#fff', weight: weight, fillOpacity: 0.8 })
                .bindPopup(`<strong>${d.trackingCode}</strong><br>${d.clientName}<br>${d.origin} → ${d.destination}<br>${STATUS_LABELS[d.status]}${isRealTime ? '<br><span style="color:#10b981;font-size:0.75rem;">📍 GPS Ativo</span>' : ''}`)
                .addTo(dashboardMap);
        }
    });
    setTimeout(() => dashboardMap.invalidateSize(), 300);
}

// ══════════════════════════════════════
// DELIVERIES TAB
// ══════════════════════════════════════
function renderDeliveries() {
    let dels = DB.getDeliveries(CID);
    const filter = document.getElementById('del-filter').value;
    const search = document.getElementById('del-search').value.toLowerCase();
    if (filter !== 'all') dels = dels.filter(d => d.status === filter);
    if (search) dels = dels.filter(d => (d.clientName + d.trackingCode + d.origin + d.destination).toLowerCase().includes(search));

    const drivers = DB.getDrivers(CID);
    const driverMap = {};
    drivers.forEach(dr => driverMap[dr.id] = dr.name);

    const tbody = document.getElementById('deliveries-tbody');
    if (!dels.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma entrega encontrada.</td></tr>'; return; }

    tbody.innerHTML = dels.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(d => `
        <tr>
            <td><strong style="color:var(--primary);">${d.trackingCode}</strong></td>
            <td>${d.clientName}</td>
            <td>${d.origin} → ${d.destination}</td>
            <td>${driverMap[d.driverId] || '—'}</td>
            <td>${statusBadge(d.status)}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editDelivery('${d.id}')"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                <button class="btn-danger btn-sm" onclick="deleteDelivery('${d.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function openDeliveryModal(id) {
    document.getElementById('delivery-form').reset();
    document.getElementById('del-edit-id').value = '';
    document.getElementById('del-modal-title').textContent = 'Nova Entrega';
    const sel = document.getElementById('del-driver');
    sel.innerHTML = '<option value="">Selecionar...</option>';
    DB.getDrivers(CID).forEach(dr => sel.innerHTML += `<option value="${dr.id}">${dr.name}</option>`);
    openModal('delivery-modal');
}

function editDelivery(id) {
    const d = DB.getDelivery(id);
    if (!d) return;
    openDeliveryModal();
    document.getElementById('del-modal-title').textContent = 'Editar Entrega';
    document.getElementById('del-edit-id').value = d.id;
    document.getElementById('del-client').value = d.clientName;
    document.getElementById('del-phone').value = d.clientPhone || '';
    document.getElementById('del-origin').value = d.origin;
    document.getElementById('del-dest').value = d.destination;
    document.getElementById('del-address').value = d.address || '';
    document.getElementById('del-weight').value = d.weight;
    document.getElementById('del-value').value = d.value;
    document.getElementById('del-driver').value = d.driverId || '';
    document.getElementById('del-status').value = d.status;
    document.getElementById('del-notes').value = d.notes || '';
}

function saveDelivery(e) {
    e.preventDefault();
    const editId = document.getElementById('del-edit-id').value;
    const data = {
        carrierId: CID,
        clientName: document.getElementById('del-client').value,
        clientPhone: document.getElementById('del-phone').value,
        origin: document.getElementById('del-origin').value,
        destination: document.getElementById('del-dest').value,
        address: document.getElementById('del-address').value,
        weight: parseFloat(document.getElementById('del-weight').value) || 0,
        value: parseFloat(document.getElementById('del-value').value) || 0,
        driverId: document.getElementById('del-driver').value,
        status: document.getElementById('del-status').value,
        notes: document.getElementById('del-notes').value,
        updatedAt: new Date().toISOString()
    };
    if (editId) {
        DB.updateDelivery(editId, data);
        showToast('Entrega atualizada!');
    } else {
        data.id = 'del_' + Date.now();
        data.trackingCode = 'LT' + Date.now().toString(36).toUpperCase();
        data.createdAt = new Date().toISOString();
        DB.addDelivery(data);
        showToast('Entrega criada!');
    }
    closeModal('delivery-modal');
    renderDeliveries();
}

function deleteDelivery(id) {
    if (!confirm('Excluir esta entrega?')) return;
    DB.deleteDelivery(id);
    renderDeliveries();
    showToast('Entrega excluída.', 'error');
}

// ══════════════════════════════════════
// DRIVERS TAB
// ══════════════════════════════════════
function renderDrivers() {
    const drvs = DB.getDrivers(CID);
    const tbody = document.getElementById('drivers-tbody');
    if (!drvs.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum motorista.</td></tr>'; return; }
    tbody.innerHTML = drvs.map(d => {
        let locStatus = d.lat && d.lng ? '<span class="badge badge-active">Ativo</span>' : '<span class="badge badge-inactive">Inativo</span>';
        let locText = d.lat && d.lng ? `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}` : '—';
        return `
        <tr>
            <td><strong>${d.name}</strong></td>
            <td>${d.email}</td>
            <td>${locStatus}</td>
            <td style="font-size:0.8rem;color:var(--text-dim);">${locText}</td>
            <td>
                <button class="btn-danger btn-sm" onclick="deleteDriverItem('${d.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </td>
        </tr>
    `}).join('');
    lucide.createIcons();
}

function openDriverModal() {
    document.getElementById('driver-form').reset();
    document.getElementById('drv-edit-id').value = '';
    openModal('driver-modal');
}

function saveDriver(e) {
    e.preventDefault();
    const data = {
        id: 'drv_' + Date.now(),
        carrierId: CID,
        name: document.getElementById('drv-name').value,
        email: document.getElementById('drv-email').value,
        password: document.getElementById('drv-pass').value
    };
    DB.addDriver(data);
    showToast('Motorista criado!');
    closeModal('driver-modal');
    renderDrivers();
}

function deleteDriverItem(id) {
    if (!confirm('Excluir este motorista?')) return;
    DB.deleteDriver(id);
    renderDrivers();
    showToast('Motorista excluído.', 'error');
}

// ══════════════════════════════════════
// VEHICLES TAB
// ══════════════════════════════════════
function renderVehicles() {
    const vehs = DB.getVehicles(CID);
    const tbody = document.getElementById('vehicles-tbody');
    if (!vehs.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum veículo.</td></tr>'; return; }
    const sc = { active: 'badge-active', maintenance: 'badge-maintenance', inactive: 'badge-inactive' };
    const sl = { active: 'Ativo', maintenance: 'Manutenção', inactive: 'Inativo' };
    tbody.innerHTML = vehs.map(v => `
        <tr>
            <td><strong>${v.plate}</strong></td>
            <td>${v.type}</td>
            <td>${v.model}</td>
            <td>${v.year || '—'}</td>
            <td>${v.capacity || '—'}</td>
            <td><span class="badge ${sc[v.status] || ''}">${sl[v.status] || v.status}</span></td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editVehicle('${v.id}')"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                <button class="btn-danger btn-sm" onclick="deleteVehicleItem('${v.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function openVehicleModal() {
    document.getElementById('vehicle-form').reset();
    document.getElementById('veh-edit-id').value = '';
    document.getElementById('veh-modal-title').textContent = 'Novo Veículo';
    openModal('vehicle-modal');
}

function editVehicle(id) {
    const v = DB.getVehicles(CID).find(x => x.id === id);
    if (!v) return;
    openVehicleModal();
    document.getElementById('veh-modal-title').textContent = 'Editar Veículo';
    document.getElementById('veh-edit-id').value = v.id;
    document.getElementById('veh-plate').value = v.plate;
    document.getElementById('veh-type').value = v.type;
    document.getElementById('veh-model').value = v.model;
    document.getElementById('veh-year').value = v.year || '';
    document.getElementById('veh-cap').value = v.capacity || '';
    document.getElementById('veh-status').value = v.status;
}

function saveVehicle(e) {
    e.preventDefault();
    const editId = document.getElementById('veh-edit-id').value;
    const data = {
        carrierId: CID,
        plate: document.getElementById('veh-plate').value,
        type: document.getElementById('veh-type').value,
        model: document.getElementById('veh-model').value,
        year: parseInt(document.getElementById('veh-year').value) || null,
        capacity: document.getElementById('veh-cap').value,
        status: document.getElementById('veh-status').value
    };
    if (editId) {
        DB.updateVehicle(editId, data);
        showToast('Veículo atualizado!');
    } else {
        data.id = 'veh_' + Date.now();
        DB.addVehicle(data);
        showToast('Veículo cadastrado!');
    }
    closeModal('vehicle-modal');
    renderVehicles();
}

function deleteVehicleItem(id) {
    if (!confirm('Excluir este veículo?')) return;
    DB.deleteVehicle(id);
    renderVehicles();
    showToast('Veículo excluído.', 'error');
}

// ══════════════════════════════════════
// FREIGHT CALCULATOR
// ══════════════════════════════════════
function calcFreight() {
    const dist = parseFloat(document.getElementById('calc-distance').value) || 0;
    const weight = parseFloat(document.getElementById('calc-weight').value) || 0;
    const type = document.getElementById('calc-type').value;
    if (!dist || !weight) { showToast('Preencha distância e peso.', 'error'); return; }

    let ratePerKm = dist <= 100 ? 3.50 : dist <= 500 ? 2.80 : dist <= 1000 ? 2.20 : 1.80;
    let distCost = dist * ratePerKm;
    let weightCost = weight * 0.15;
    let tollCost = dist * 0.12;
    let subtotal = distCost + weightCost + tollCost;
    const multipliers = { normal: 1, fragile: 1.3, perishable: 1.5, dangerous: 1.8 };
    let total = subtotal * (multipliers[type] || 1);

    document.getElementById('calc-result').style.display = 'block';
    document.getElementById('calc-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    document.getElementById('calc-breakdown').textContent = `Distância: R$${distCost.toFixed(2)} | Peso: R$${weightCost.toFixed(2)} | Pedágio: R$${tollCost.toFixed(2)}`;
}

// ══════════════════════════════════════
// REPORTS TAB
// ══════════════════════════════════════
let chartMonthly, chartDrivers;

function refreshReports() {
    const dels = DB.getDeliveries(CID);
    const delivered = dels.filter(d => d.status === 'delivered').length;
    const rate = dels.length ? Math.round((delivered / dels.length) * 100) : 0;
    const totalVal = dels.reduce((s, d) => s + (d.value || 0), 0);
    const totalWeight = dels.reduce((s, d) => s + (d.weight || 0), 0);

    document.getElementById('r-rate').textContent = rate + '%';
    document.getElementById('r-value').textContent = 'R$ ' + totalVal.toFixed(2).replace('.', ',');
    document.getElementById('r-weight').textContent = totalWeight.toFixed(0) + ' kg';

    // Monthly chart
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthData = new Array(12).fill(0);
    dels.forEach(d => { monthData[new Date(d.createdAt).getMonth()]++; });
    if (chartMonthly) chartMonthly.destroy();
    chartMonthly = new Chart(document.getElementById('chart-monthly'), {
        type: 'line',
        data: { labels: months, datasets: [{ label: 'Entregas', data: monthData, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, plugins: { title: { display: true, text: 'Entregas por Mês', color: '#e2e8f0', font: { family: 'Outfit' } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { display: false } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });
}

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════
function loadSettings() {
    const carrier = DB.getCarrier(CID);
    if (!carrier) return;
    document.getElementById('set-name').value = carrier.name || '';
    document.getElementById('set-cnpj').value = carrier.cnpj || '';
    document.getElementById('set-phone').value = carrier.phone || '';
    document.getElementById('set-address').value = carrier.address || '';
}

function saveCarrierSettings() {
    DB.updateCarrier(CID, {
        name: document.getElementById('set-name').value,
        cnpj: document.getElementById('set-cnpj').value,
        phone: document.getElementById('set-phone').value,
        address: document.getElementById('set-address').value
    });
    showToast('Configurações salvas!');
}

function changePassword() {
    const cur = document.getElementById('set-curpass').value;
    const nw = document.getElementById('set-newpass').value;
    const conf = document.getElementById('set-confpass').value;
    if (!cur || !nw) { showToast('Preencha todos os campos.', 'error'); return; }
    if (nw.length < 6) { showToast('Senha deve ter pelo menos 6 caracteres.', 'error'); return; }
    if (nw !== conf) { showToast('As senhas não coincidem.', 'error'); return; }
    const users = DB.getUsers();
    const u = users.find(x => x.id === USER.id);
    if (!u || u.password !== cur) { showToast('Senha atual incorreta.', 'error'); return; }
    DB.updateUser(USER.id, { password: nw });
    showToast('Senha alterada!');
    document.getElementById('set-curpass').value = '';
    document.getElementById('set-newpass').value = '';
    document.getElementById('set-confpass').value = '';
}

// ══════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════
function toggleNotifications() {
    document.getElementById('notif-dropdown').classList.toggle('open');
}
function markAllRead() {
    DB.markAllNotificationsRead(USER.id);
    renderNotifications();
}
function renderNotifications() {
    const notifs = DB.getNotifications(USER.id);
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById('notif-count');
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
refreshDashboard();
renderDeliveries();
renderVehicles();
renderDrivers();
loadSettings();
renderNotifications();
