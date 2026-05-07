const fs = require('fs');

// Initial Data
const demoCarriers = [{ id: 'car_123', name: 'TransRápido Logística', cnpj: '12.345.678/0001-99', phone: '(11) 99999-9999', address: 'São Paulo, SP' }];

const demoUsers = [
    { id: 'usr_super', name: 'Super Admin', email: 'admin@logitrack.com', password: 'admin', role: 'superadmin' },
    { id: 'usr_1', name: 'Carlos (Admin)', email: 'carlos@transrapido.com', password: 'admin', role: 'admin', carrierId: 'car_123' },
    { id: 'usr_prog', name: 'Guilherme', email: 'gs1178546@gmail.com', password: 'Menino0503', role: 'programador' }
];

const demoVehicles = [
    { id: 'veh_1', carrierId: 'car_123', plate: 'ABC-1234', type: 'Caminhão Baú', model: 'Volvo FH', capacity: '15000 kg', status: 'active', year: 2020 }
];

const demoDeliveries = [
    { id: 'del_1', carrierId: 'car_123', trackingCode: 'LT123456789BR', clientName: 'João Silva', origin: 'São Paulo', destination: 'Rio de Janeiro', status: 'in_transit', weight: 50, value: 1200, createdAt: new Date().toISOString() }
];

const payload = {
    fields: {
        logistica_carriers: { stringValue: JSON.stringify(demoCarriers) },
        logistica_users: { stringValue: JSON.stringify(demoUsers) },
        logistica_vehicles: { stringValue: JSON.stringify(demoVehicles) },
        logistica_deliveries: { stringValue: JSON.stringify(demoDeliveries) },
        logistica_notifications: { stringValue: "[]" }
    }
};

const url = 'https://firestore.googleapis.com/v1/projects/logitrack-painel/databases/(default)/documents/database/main?key=AIzaSyDKpLQH632kXD2Zg0bEpnCJgGN7MzAkZ0Q';

fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => {
    console.log("Firestore Seeded Successfully:");
    console.log(data);
})
.catch(err => {
    console.error("Error seeding Firestore:", err);
});
