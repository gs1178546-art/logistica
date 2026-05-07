// =============================================
// LogiTrack - Super Admin Logic
// =============================================

const SA_USER = DB.getCurrentUser();
if (!SA_USER || SA_USER.role !== 'programador') { window.location.href = 'login.html'; }

// ── Nav ───────────────────────────────
document.querySelectorAll('.side-nav a').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); saNavTo(link.dataset.tab); });
});

function saNavTo(tab) {
    document.querySelectorAll('.side-nav a').forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`.side-nav a[data-tab="${tab}"]`);
    if (link) link.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('mobile-drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('open');
    document.getElementById('hamburger-btn')?.classList.remove('active');
    lucide.createIcons();
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.className = `toast toast-${type} show`;
    document.getElementById('toast-text').textContent = msg;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Overview ──────────────────────────
function refreshOverview() {
    const carriers = DB.getCarriers();
    const dels = DB.getAllDeliveries();
    const vehs = DB.getAllVehicles();

    document.getElementById('sa-carriers').textContent = carriers.length;
    document.getElementById('sa-deliveries').textContent = dels.length;
    document.getElementById('sa-vehicles').textContent = vehs.length;

    // Deliveries per carrier
    new Chart(document.getElementById('sa-chart-carriers'), {
        type: 'bar',
        data: {
            labels: carriers.map(c => c.name.split(' ')[0]),
            datasets: [{ label: 'Entregas', data: carriers.map(c => dels.filter(d => d.carrierId === c.id).length), backgroundColor: ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'], borderRadius: 6 }]
        },
        options: { responsive: true, plugins: { title: { display: true, text: 'Entregas por Transportadora', color: '#e2e8f0', font: { family: 'Outfit' } }, legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { display: false } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Global status
    const counts = { pending: 0, in_transit: 0, delivered: 0, cancelled: 0 };
    dels.forEach(d => { if (counts[d.status] !== undefined) counts[d.status]++; });
    new Chart(document.getElementById('sa-chart-status'), {
        type: 'doughnut',
        data: {
            labels: ['Pendentes', 'Em Trânsito', 'Entregues', 'Cancelados'],
            datasets: [{ data: Object.values(counts), backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } }, title: { display: true, text: 'Status Global', color: '#e2e8f0', font: { family: 'Outfit' } } } }
    });
}

// ── Carriers ──────────────────────────
function renderCarriers() {
    const carriers = DB.getCarriers();
    const dels = DB.getAllDeliveries();
    const tbody = document.getElementById('carriers-tbody');
    tbody.innerHTML = carriers.map(c => {
        const count = dels.filter(d => d.carrierId === c.id).length;
        const sc = c.status === 'active' ? 'badge-active' : 'badge-inactive';
        const sl = c.status === 'active' ? 'Ativa' : 'Inativa';
        return `<tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.cnpj || '—'}</td>
            <td>${c.phone || '—'}</td>
            <td>${count}</td>
            <td><span class="badge ${sc}">${sl}</span></td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editCarrier('${c.id}')"><i data-lucide="edit-2" style="width:14px;height:14px;"></i></button>
                <button class="btn-danger btn-sm" onclick="deleteCarrierItem('${c.id}')"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}

function openCarrierModal() {
    document.getElementById('carrier-form').reset();
    document.getElementById('car-edit-id').value = '';
    document.getElementById('carrier-modal-title').textContent = 'Nova Transportadora';
    document.getElementById('car-admin-pass').value = 'admin123';
    document.getElementById('carrier-modal').classList.add('active');
    lucide.createIcons();
}

function editCarrier(id) {
    const c = DB.getCarrier(id);
    if (!c) return;
    openCarrierModal();
    document.getElementById('carrier-modal-title').textContent = 'Editar Transportadora';
    document.getElementById('car-edit-id').value = c.id;
    document.getElementById('car-name').value = c.name;
    document.getElementById('car-cnpj').value = c.cnpj || '';
    document.getElementById('car-phone').value = c.phone || '';
    document.getElementById('car-address').value = c.address || '';
    document.getElementById('car-email').value = c.email || '';
}

function saveCarrier(e) {
    e.preventDefault();
    const editId = document.getElementById('car-edit-id').value;
    const data = {
        name: document.getElementById('car-name').value,
        cnpj: document.getElementById('car-cnpj').value,
        phone: document.getElementById('car-phone').value,
        address: document.getElementById('car-address').value,
        email: document.getElementById('car-email').value,
        status: 'active'
    };

    if (editId) {
        DB.updateCarrier(editId, data);
        showToast('Transportadora atualizada!');
    } else {
        data.id = 'carrier_' + Date.now();
        data.createdAt = new Date().toISOString();
        DB.addCarrier(data);

        // Create admin user
        const adminEmail = document.getElementById('car-admin-email').value.trim().toLowerCase();
        const adminName = document.getElementById('car-admin-name').value.trim();
        const adminPass = document.getElementById('car-admin-pass').value || 'admin123';
        
        if (adminEmail) {
            if (DB.findUserByEmail(adminEmail)) {
                showToast('Atenção: Transportadora criada, mas o E-mail do Admin já existe no sistema!', 'error');
            } else {
                DB.addUser({
                    id: 'adm_' + Date.now(),
                    name: adminName,
                    email: adminEmail,
                    password: adminPass,
                    role: 'admin',
                    carrierId: data.id,
                    createdAt: new Date().toISOString()
                });
                showToast('Transportadora e Admin criados com sucesso!');
            }
        } else {
            showToast('Transportadora criada!');
        }
    }

    document.getElementById('carrier-modal').classList.remove('active');
    renderCarriers();
    refreshOverview();
}

function deleteCarrierItem(id) {
    if (!confirm('Excluir esta transportadora e todos os seus dados?')) return;
    DB.deleteCarrier(id);
    renderCarriers();
    refreshOverview();
    showToast('Transportadora excluída.', 'error');
}

// ── Users ─────────────────────────────
function renderUsers() {
    const users = DB.getUsers();
    const carriers = DB.getCarriers();
    const cMap = {};
    carriers.forEach(c => cMap[c.id] = c.name);
    const roles = { programador: 'Programador', admin: 'Admin' };

    document.getElementById('users-tbody').innerHTML = users.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td><span class="badge ${u.role === 'programador' ? 'badge-cancelled' : u.role === 'admin' ? 'badge-transit' : 'badge-active'}">${roles[u.role] || u.role}</span></td>
            <td>${cMap[u.carrierId] || '—'}</td>
            <td>${new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
            <td>
                ${u.role === 'programador' ? '—' : `<button class="btn-danger btn-sm" onclick="deleteUserItem('${u.id}')" title="Excluir"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>`}
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function deleteUserItem(id) {
    if (!confirm('Tem certeza que deseja excluir este usuário permanentemente?')) return;
    DB.deleteUser(id);
    renderUsers();
    showToast('Usuário excluído com sucesso.', 'error');
}

// ── Init ──────────────────────────────
refreshOverview();
renderCarriers();
renderUsers();
