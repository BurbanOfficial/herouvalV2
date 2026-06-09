import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
    apiKey: "TON_API_KEY",
    authDomain: "TON_PROJET.firebaseapp.com",
    projectId: "TON_PROJET",
    storageBucket: "TON_PROJET.appspot.com",
    messagingSenderId: "ID",
    appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- NAVIGATION ---
window.switchTab = (tab) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if(tab === 'agent') startCamera();
    else stopCamera();
};

// --- CAMÉRA & OCR (Tesseract.js) ---
const video = document.getElementById('camera-feed');
const btnScan = document.getElementById('btn-scan');
const statusText = document.getElementById('ocr-status');
let stream = null;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Erreur caméra", err);
    }
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
}

btnScan.addEventListener('click', async () => {
    statusText.innerText = "Analyse en cours... (Patientez)";
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    try {
        // Tesseract pur front-end
        const { data: { text } } = await Tesseract.recognize(canvas, 'fra');
        
        // Regex stricte pour plaque française : ex: AB-123-CD ou AB 123 CD
        const regexPlaque = /[A-Z]{2}[-\s]?[0-9]{3}[-\s]?[A-Z]{2}/i;
        const match = text.match(regexPlaque);
        
        if (match) {
            let plaquePropre = match[0].toUpperCase().replace(/\s/g, '-');
            document.getElementById('plaque').value = plaquePropre;
            statusText.innerText = "Plaque détectée avec succès !";
            statusText.style.color = "green";
        } else {
            statusText.innerText = "Plaque non trouvée, réessayez ou tapez manuellement.";
            statusText.style.color = "red";
        }
    } catch (e) {
        statusText.innerText = "Erreur OCR.";
    }
});

// --- SIGNATURE CANVAS ---
const canvas = document.getElementById('signature-pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;

// Ajuster la taille du canvas
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

const startPosition = (e) => { isDrawing = true; draw(e); };
const endPosition = () => { isDrawing = false; ctx.beginPath(); };
const draw = (e) => {
    if (!isDrawing) return;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    
    // Gérer souris et touch
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
};

canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', startPosition);
canvas.addEventListener('touchend', endPosition);
canvas.addEventListener('touchmove', draw);

window.clearSignature = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// --- SOUMISSION DU FORMULAIRE (AGENT) ---
document.getElementById('bus-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit');
    btnSubmit.innerText = "Enregistrement...";
    btnSubmit.disabled = true;

    try {
        // 1. Sauvegarder la signature
        const signatureDataUrl = canvas.toDataURL('image/png');
        const signatureRef = ref(storage, `signatures/sig_${Date.now()}.png`);
        await uploadString(signatureRef, signatureDataUrl, 'data_url');
        const signatureUrl = await getDownloadURL(signatureRef);

        // 2. Enregistrer les données dans Firestore
        await addDoc(collection(db, "buses"), {
            timestamp: new Date(),
            plaque: document.getElementById('plaque').value,
            couleur: document.getElementById('couleur').value,
            ecole: document.getElementById('ecole').value,
            cp: document.getElementById('cp').value,
            ville: document.getElementById('ville').value,
            nb_enfants: document.getElementById('nb_enfants').value,
            nb_adultes: document.getElementById('nb_adultes').value,
            responsable: document.getElementById('responsable').value,
            signature_url: signatureUrl
        });

        alert("Bus enregistré avec succès !");
        document.getElementById('bus-form').reset();
        clearSignature();
        statusText.innerText = "";
    } catch (error) {
        console.error("Erreur d'ajout :", error);
        alert("Erreur lors de l'enregistrement.");
    } finally {
        btnSubmit.innerText = "Valider l'entrée";
        btnSubmit.disabled = false;
    }
});

// --- TEMPS RÉEL (CAISSE) ---
const q = query(collection(db, "buses"), orderBy("timestamp", "desc"));
let allBuses = [];

onSnapshot(q, (snapshot) => {
    allBuses = [];
    snapshot.forEach((doc) => allBuses.push(doc.data()));
    renderTable(allBuses);
});

function renderTable(data) {
    const tbody = document.getElementById('buses-list');
    tbody.innerHTML = "";
    data.forEach(bus => {
        const date = bus.timestamp.toDate();
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${timeStr}</strong></td>
            <td><span style="background:#eee; padding:4px 8px; border-radius:4px; font-family:monospace;">${bus.plaque}</span></td>
            <td>${bus.ecole}</td>
            <td>${bus.ville} (${bus.cp})</td>
            <td>${bus.nb_enfants}</td>
            <td>${bus.nb_adultes}</td>
            <td><img src="${bus.signature_url}" class="sig-img" alt="signature"></td>
        `;
        tbody.appendChild(tr);
    });
}

// Recherche
document.getElementById('search-bar').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allBuses.filter(b => 
        b.ecole.toLowerCase().includes(term) || 
        b.plaque.toLowerCase().includes(term)
    );
    renderTable(filtered);
});

// Init
startCamera();