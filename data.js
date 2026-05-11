// =============================================
// LogiTrack - Data Layer (Firebase + localStorage fallback)
// =============================================

const DB = {
    _useFirebase: false,

    init() {
        this._useFirebase = typeof isFirebaseConfigured === 'function' && isFirebaseConfigured();
        if (!this._useFirebase) {
            console.log('[DB] Modo demo (localStorage). Configure Firebase para persistência real.');
            this._seedDemoData();
            this._migrateRoles();
        } else {
            console.log('[DB] Firebase configurado. Aguardando inicialização do SDK...');
            if (window.dbFirestore) {
                this._setupFirebaseSync();
            } else {
                window.addEventListener('firebaseReady', () => this._setupFirebaseSync());
            }
        }
    },

    _setupFirebaseSync() {
        console.log('[DB] Iniciando sincronização com Firestore...');
        
        // Setup initial push if empty
        window.dbFirestore.collection('database').doc('main').get().then(doc => {
            const docData = doc.exists ? doc.data() : {};
            if (!doc.exists || !docData.logistica_users || docData.logistica_users.length <= 2) {
                console.log("[DB] Firestore vazio ou incompleto, subindo dados iniciais locais...");
                this._seedDemoData();
                this._migrateRoles();
                
                const keys = ['logistica_users', 'logistica_carriers', 'logistica_deliveries', 'logistica_vehicles', 'logistica_notifications'];
                const payload = {};
                keys.forEach(k => { payload[k] = localStorage.getItem(k) || '[]'; });
                window.dbFirestore.collection('database').doc('main').set(payload);
            }
        });

        // Listen for remote changes
        window.dbFirestore.collection('database').doc('main').onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                let changed = false;
                
                Object.keys(data).forEach(key => {
                    if (localStorage.getItem(key) !== data[key]) {
                        localStorage.setItem(key, data[key]);
                        changed = true;
                    }
                });
                
                if (changed) {
                    console.log("[DB] Dados sincronizados da nuvem.");
                    // Atualiza a tela (dependendo de qual tela o usuário está)
                    if (typeof refreshDashboard === 'function') refreshDashboard();
                    if (typeof renderDeliveries === 'function') renderDeliveries();
                    if (typeof renderVehicles === 'function') renderVehicles();
                    if (typeof renderDrivers === 'function') renderDrivers();
                    if (typeof renderMyDeliveries === 'function') renderMyDeliveries();
                }
            }
        });
    },

    _migrateRoles() {
        const users = this.getUsers();
        let changed = false;
        
        // Update programador credentials
        users.forEach(u => {
            if (u.role === 'superadmin' || u.role === 'programador') {
                u.role = 'programador';
                u.name = 'Guilherme';
                u.email = 'gs1178546@gmail.com';
                u.password = 'Menino0503';
                changed = true;
            }
        });

        if (changed) {
            this.saveUsers(users);
        }

        // Update current session if logged in
        const curUser = this.getCurrentUser();
        if (curUser && (curUser.role === 'superadmin' || curUser.role === 'programador')) {
            curUser.role = 'programador';
            curUser.name = 'Guilherme';
            curUser.email = 'gs1178546@gmail.com';
            this.setCurrentUser(curUser);
        }

        // Clean up drivers data
        localStorage.removeItem('logistica_drivers');
    },

    // ── Generic CRUD ──────────────────────────────
    _get(key) {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    },
    _set(key, data) {
        const strData = JSON.stringify(data);
        localStorage.setItem(key, strData);
        
        // Push para Firebase
        if (this._useFirebase && window.dbFirestore) {
            window.dbFirestore.collection('database').doc('main').set({
                [key]: strData
            }, { merge: true }).catch(err => console.error("Firebase sync error:", err));
        }
    },
    _getObj(key) {
        try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
    },

    // ── USERS ─────────────────────────────────────
    getUsers() { return this._get('logistica_users'); },
    saveUsers(users) { this._set('logistica_users', users); },
    findUser(email, password) {
        return this.getUsers().find(u => u.email && u.email.trim().toLowerCase() === email.trim().toLowerCase() && u.password === password);
    },
    findUserByEmail(email) {
        return this.getUsers().find(u => u.email && u.email.trim().toLowerCase() === email.trim().toLowerCase());
    },
    addUser(user) {
        const users = this.getUsers();
        users.push(user);
        this.saveUsers(users);
        return user;
    },
    updateUser(id, updates) {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx >= 0) { Object.assign(users[idx], updates); this.saveUsers(users); }
        return users[idx];
    },
    deleteUser(id) {
        this.saveUsers(this.getUsers().filter(u => u.id !== id));
    },

    // ── SESSION ───────────────────────────────────
    setCurrentUser(user) {
        localStorage.setItem('logistica_currentUser', JSON.stringify(user));
    },
    getCurrentUser() {
        try { return JSON.parse(localStorage.getItem('logistica_currentUser') || 'null'); } catch { return null; }
    },
    logout() {
        localStorage.removeItem('logistica_currentUser');
        window.location.href = 'login.html';
    },

    // ── CARRIERS (Transportadoras) ────────────────
    getCarriers() { return this._get('logistica_carriers'); },
    saveCarriers(c) { this._set('logistica_carriers', c); },
    getCarrier(id) { return this.getCarriers().find(c => c.id === id); },
    addCarrier(carrier) {
        const list = this.getCarriers();
        list.push(carrier);
        this.saveCarriers(list);
        return carrier;
    },
    updateCarrier(id, updates) {
        const list = this.getCarriers();
        const idx = list.findIndex(c => c.id === id);
        if (idx >= 0) { Object.assign(list[idx], updates); this.saveCarriers(list); }
        return list[idx];
    },
    deleteCarrier(id) {
        this.saveCarriers(this.getCarriers().filter(c => c.id !== id));
    },

    // ── DRIVERS (Motoristas) ──────────────────────
    getDrivers(carrierId) {
        const all = this._get('logistica_users').filter(u => u.role === 'driver');
        if (!carrierId) return all;
        return all.filter(d => d.carrierId === carrierId);
    },
    addDriver(driver) {
        const users = this.getUsers();
        driver.role = 'driver';
        driver.createdAt = new Date().toISOString();
        users.push(driver);
        this.saveUsers(users);
        return driver;
    },
    updateDriver(id, updates) {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.id === id && u.role === 'driver');
        if (idx >= 0) { Object.assign(users[idx], updates); this.saveUsers(users); }
        return users[idx];
    },
    deleteDriver(id) {
        this.saveUsers(this.getUsers().filter(u => u.id !== id));
    },

    // ── DELIVERIES (Entregas) ─────────────────────
    getAllDeliveries() { return this._get('logistica_deliveries'); },
    getDeliveries(carrierId) {
        const all = this.getAllDeliveries();
        if (!carrierId) return all;
        return all.filter(d => d.carrierId === carrierId);
    },
    getDelivery(id) { return this.getAllDeliveries().find(d => d.id === id); },
    addDelivery(delivery) {
        const list = this.getAllDeliveries();
        list.push(delivery);
        this._set('logistica_deliveries', list);
        return delivery;
    },
    updateDelivery(id, updates) {
        const list = this.getAllDeliveries();
        const idx = list.findIndex(d => d.id === id);
        if (idx >= 0) { Object.assign(list[idx], updates); this._set('logistica_deliveries', list); }
        return list[idx];
    },
    deleteDelivery(id) {
        this._set('logistica_deliveries', this.getAllDeliveries().filter(d => d.id !== id));
    },

    // ── VEHICLES (Veículos) ───────────────────────
    getAllVehicles() { return this._get('logistica_vehicles'); },
    getVehicles(carrierId) {
        const all = this.getAllVehicles();
        if (!carrierId) return all;
        return all.filter(v => v.carrierId === carrierId);
    },
    addVehicle(vehicle) {
        const list = this.getAllVehicles();
        list.push(vehicle);
        this._set('logistica_vehicles', list);
        return vehicle;
    },
    updateVehicle(id, updates) {
        const list = this.getAllVehicles();
        const idx = list.findIndex(v => v.id === id);
        if (idx >= 0) { Object.assign(list[idx], updates); this._set('logistica_vehicles', list); }
        return list[idx];
    },
    deleteVehicle(id) {
        this._set('logistica_vehicles', this.getAllVehicles().filter(v => v.id !== id));
    },

    // ── NOTIFICATIONS ─────────────────────────────
    getNotifications(userId) {
        return this._get('logistica_notifications').filter(n => n.userId === userId);
    },
    addNotification(notif) {
        const list = this._get('logistica_notifications');
        list.push({ id: Date.now(), read: false, createdAt: new Date().toISOString(), ...notif });
        this._set('logistica_notifications', list);
    },
    markNotificationRead(id) {
        const list = this._get('logistica_notifications');
        const n = list.find(x => x.id === id);
        if (n) { n.read = true; this._set('logistica_notifications', list); }
    },
    markAllNotificationsRead(userId) {
        const list = this._get('logistica_notifications');
        list.forEach(n => { if (n.userId === userId) n.read = true; });
        this._set('logistica_notifications', list);
    },

    // ── MESSAGES (Chat) ───────────────────────────
    getMessages(carrierId) {
        return this._get('logistica_messages').filter(m => m.carrierId === carrierId);
    },
    addMessage(msg) {
        const list = this._get('logistica_messages');
        list.push({ id: Date.now(), createdAt: new Date().toISOString(), ...msg });
        this._set('logistica_messages', list);
    },

    // ── SEED DEMO DATA ───────────────────────────
    _seedDemoData() {
        if (localStorage.getItem('logistica_seeded')) return;

        const carriers = [
            { id: 'carrier_1', name: 'TransRapido Express', cnpj: '12.345.678/0001-01', phone: '(11) 3456-7890', address: 'Av. Paulista, 1000 - São Paulo/SP', email: 'contato@transrapido.com', status: 'active', createdAt: '2025-01-15T10:00:00Z' },
            { id: 'carrier_2', name: 'LogiMaster Transportes', cnpj: '98.765.432/0001-02', phone: '(21) 2345-6789', address: 'Rua do Porto, 500 - Rio de Janeiro/RJ', email: 'contato@logimaster.com', status: 'active', createdAt: '2025-02-20T10:00:00Z' },
            { id: 'carrier_3', name: 'CargoVelocity BR', cnpj: '55.444.333/0001-03', phone: '(31) 3333-4444', address: 'Av. Amazonas, 2000 - Belo Horizonte/MG', email: 'contato@cargovelocity.com', status: 'active', createdAt: '2025-03-10T10:00:00Z' }
        ];

        const users = [
            { id: 'sa_1', name: 'Guilherme', email: 'gs1178546@gmail.com', password: 'Menino0503', role: 'programador', createdAt: '2025-01-01T00:00:00Z' }
        ];

        const vehicles = [
            { id: 'veh_1', plate: 'ABC-1234', type: 'Van', model: 'Fiat Ducato', year: 2023, capacity: '1.5 ton', carrierId: 'carrier_1', status: 'active' },
            { id: 'veh_2', plate: 'DEF-5678', type: 'Caminhão', model: 'VW Delivery 11.180', year: 2022, capacity: '6 ton', carrierId: 'carrier_1', status: 'active' },
            { id: 'veh_3', plate: 'GHI-9012', type: 'Van', model: 'Mercedes Sprinter', year: 2024, capacity: '2 ton', carrierId: 'carrier_2', status: 'active' },
            { id: 'veh_4', plate: 'JKL-3456', type: 'Caminhão', model: 'Volvo FH 540', year: 2023, capacity: '25 ton', carrierId: 'carrier_2', status: 'maintenance' },
            { id: 'veh_5', plate: 'MNO-7890', type: 'Truck', model: 'Scania R450', year: 2024, capacity: '15 ton', carrierId: 'carrier_3', status: 'active' }
        ];

        const now = new Date();
        const deliveries = [];
        const statuses = ['pending', 'in_transit', 'delivered', 'cancelled'];
        const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Salvador', 'Fortaleza', 'Brasília', 'Porto Alegre', 'Manaus', 'Recife'];

        // Generate deliveries for each carrier
        [{ cid: 'carrier_1' }, { cid: 'carrier_2' }, { cid: 'carrier_3' }].forEach(({ cid }) => {
            for (let i = 0; i < 15; i++) {
                const daysAgo = Math.floor(Math.random() * 30);
                const date = new Date(now - daysAgo * 86400000);
                const status = statuses[Math.floor(Math.random() * statuses.length)];
                const origin = cities[Math.floor(Math.random() * cities.length)];
                let dest = cities[Math.floor(Math.random() * cities.length)];
                while (dest === origin) dest = cities[Math.floor(Math.random() * cities.length)];
                const weight = (Math.random() * 5000 + 100).toFixed(1);
                const value = (Math.random() * 5000 + 200).toFixed(2);

                deliveries.push({
                    id: `del_${cid}_${i}`,
                    carrierId: cid,
                    trackingCode: `LT${Date.now().toString(36).toUpperCase()}${i}`,
                    clientName: ['Empresa ABC', 'Loja Virtual XYZ', 'Distribuidora 123', 'Comércio Rápido', 'Marketplace BR'][Math.floor(Math.random() * 5)],
                    clientPhone: `(11) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
                    origin: origin,
                    destination: dest,
                    address: `Rua ${Math.floor(Math.random() * 900 + 100)}, nº ${Math.floor(Math.random() * 500)}`,
                    weight: parseFloat(weight),
                    value: parseFloat(value),
                    status: status,
                    notes: '',
                    createdAt: date.toISOString(),
                    updatedAt: date.toISOString()
                });
            }
        });

        this._set('logistica_carriers', carriers);
        this._set('logistica_users', users);
        this._set('logistica_vehicles', vehicles);
        this._set('logistica_deliveries', deliveries);
        this._set('logistica_notifications', []);
        this._set('logistica_messages', []);

        // Seed new modules
        const stages=['prospect','proposal','negotiation','contract','active'];
        const pipeline=[];
        ['Tech Solutions','Varejo Express','FoodLog Brasil','AutoPeças SP','Farma Distribuidora','E-Commerce Total','Agro Norte','Indústria Metal'].forEach((n,i)=>{
            pipeline.push({id:'pipe_'+i,name:n,stage:stages[i%5],value:Math.floor(Math.random()*50000+5000),contact:'(11) 9'+Math.floor(1000+Math.random()*9000)+'-'+Math.floor(1000+Math.random()*9000),carrierId:'carrier_1',createdAt:new Date(Date.now()-i*5*86400000).toISOString()});
        });
        this._set('logistica_pipeline',pipeline);

        const clients=[];
        ['Empresa ABC','Loja Virtual XYZ','Distribuidora 123','Comércio Rápido','Marketplace BR'].forEach((n,i)=>{
            clients.push({id:'cli_'+i,name:n,cnpj:`${10+i}.${100+i}.${200+i}/0001-0${i}`,contact:'(11) 3456-'+Math.floor(1000+Math.random()*9000),sla:90+Math.floor(Math.random()*8),status:'Ativo',carrierId:'carrier_1',createdAt:new Date().toISOString()});
        });
        this._set('logistica_clients',clients);

        const contracts=[];
        clients.forEach((c,i)=>{
            contracts.push({id:'ctr_'+i,clientId:c.id,clientName:c.name,sla:c.sla,value:Math.floor(Math.random()*20000+3000),startDate:new Date(Date.now()-180*86400000).toISOString(),endDate:new Date(Date.now()+(180-i*60)*86400000).toISOString(),carrierId:'carrier_1'});
        });
        this._set('logistica_contracts',contracts);

        const collections=[];
        for(let i=0;i<20;i++){
            const done=Math.random()>0.2;
            collections.push({id:'col_'+i,clientName:clients[i%clients.length].name,status:done?'done':'failed',weight:done?Math.floor(Math.random()*2000+100):0,volumes:done?Math.floor(Math.random()*30+1):0,reason:done?'':['Cliente fechado','Acesso negado','Cancelamento','Sem embalagem'][Math.floor(Math.random()*4)],driver:'Motorista '+(i%3+1),date:new Date(Date.now()-i*86400000).toISOString(),carrierId:'carrier_1'});
        }
        this._set('logistica_collections',collections);

        const occurrences=[];
        const occTypes=['avaria total','avaria parcial','extravio confirmado','extravio em apuração'];
        for(let i=0;i<6;i++){
            occurrences.push({id:'occ_'+i,type:occTypes[i%4],cost:Math.floor(Math.random()*3000+200),route:cities[i%cities.length]+'→'+cities[(i+3)%cities.length],driver:'Motorista '+(i%3+1),code:'LT'+Date.now().toString(36).toUpperCase()+i,status:i<3?'resolved':'pending',date:new Date(Date.now()-i*3*86400000).toISOString(),carrierId:'carrier_1'});
        }
        this._set('logistica_occurrences',occurrences);

        const nps=[];
        for(let i=0;i<25;i++){nps.push({id:'nps_'+i,score:Math.floor(Math.random()*10+1),client:clients[i%clients.length].name,date:new Date(Date.now()-i*2*86400000).toISOString(),carrierId:'carrier_1'});}
        this._set('logistica_nps',nps);

        localStorage.setItem('logistica_seeded', 'true');
    }
};

// Initialize on load
DB.init();

// Globais para Máscaras de Input
window.maskCNPJ = function(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length > 14) v = v.slice(0, 14);
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
    input.value = v;
};

window.maskPhone = function(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    input.value = v;
};

// Efeito Global de Transição de Página
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), filter 0.6s ease';
    document.body.style.transform = 'translateY(15px) scale(0.99)';
    document.body.style.filter = 'blur(4px)';
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            document.body.style.opacity = '1';
            document.body.style.transform = 'translateY(0) scale(1)';
            document.body.style.filter = 'blur(0)';
        }, 50);
    });
});

document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (link && link.href && !link.href.includes('#') && !link.hasAttribute('data-tab') && !link.hasAttribute('target') && link.host === window.location.host) {
        e.preventDefault();
        document.body.style.opacity = '0';
        document.body.style.transform = 'translateY(-15px) scale(0.99)';
        document.body.style.filter = 'blur(4px)';
        setTimeout(() => { window.location = link.href; }, 400);
    }
});
