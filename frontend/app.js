const API_BASE = 'http://localhost:3000/api';
let dbClient = null;
let currentSession = null;

// DOM Elements
const loginContainer = document.getElementById('loginContainer');
const registerContainer = document.getElementById('registerContainer');
const appContainer = document.getElementById('appContainer');

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPass = document.getElementById('loginPass');
const loginBtn = document.getElementById('loginSubmitBtn');

const registerForm = document.getElementById('registerForm');
const regEmail = document.getElementById('regEmail');
const regPass = document.getElementById('regPass');
const regBtn = document.getElementById('regSubmitBtn');

const userDisplayTag = document.getElementById('userDisplayTag');
const logoutBtn = document.getElementById('logoutBtn');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const uploadPercentage = document.getElementById('uploadPercentage');
const uploadFileName = document.getElementById('uploadFileName');
const fileList = document.getElementById('fileList');
const emptyState = document.getElementById('emptyState');
const loader = document.getElementById('loader');
const toastEl = document.getElementById('toast');

// --- Switch Handlers (Called by onClick in HTML) ---
window.switchToRegister = function() {
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'block';
};

window.switchToLogin = function() {
    registerContainer.style.display = 'none';
    loginContainer.style.display = 'block';
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Fetching API Config...");
        const response = await fetch(`${API_BASE}/config`);
        const config = await response.json();
        
        dbClient = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
        console.log("Supabase linked!");

        const { data, error } = await dbClient.auth.getSession();
        
        if (data && data.session) {
            handleSessionReceived(data.session);
        }

        dbClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                showAuthScreen();
            } else if (session) {
                handleSessionReceived(session);
            }
        });

    } catch (err) {
        console.error("Failed to initialize:", err);
        showToast("Backend not running. Please start server.", "error");
    }
});

// --- UI Management ---
function handleSessionReceived(session) {
    currentSession = session;
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'none';
    appContainer.style.display = 'block';
    userDisplayTag.textContent = session.user.email;
    fetchFiles();
}

function showAuthScreen() {
    currentSession = null;
    loginContainer.style.display = 'block';
    registerContainer.style.display = 'none';
    appContainer.style.display = 'none';
    loginEmail.value = ''; loginPass.value = '';
    regEmail.value = ''; regPass.value = '';
}

// --- Forms ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regBtn.disabled = true;
    regBtn.textContent = 'Processing...';

    const email = regEmail.value;
    const password = regPass.value;

    try {
        const { data, error } = await dbClient.auth.signUp({ email, password });
        if (error) throw error;
        showToast('Created successfully! Logging in...', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        regBtn.disabled = false;
        regBtn.textContent = 'Create Account Now';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = 'Processing...';

    const email = loginEmail.value;
    const password = loginPass.value;

    try {
        const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Logged in successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Secure Log In';
    }
});

logoutBtn.addEventListener('click', async () => {
    await dbClient.auth.signOut();
    showToast('Logged out securely', 'success');
});

// --- File Handling remains same... ---
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleUpload(e.target.files[0]);
    }
});

async function handleUpload(file) {
    if (!file || !currentSession) return;

    progressContainer.style.display = 'block';
    uploadFileName.textContent = file.name;
    progressBar.style.width = '0%';
    uploadPercentage.textContent = '0%';
    
    let simProgress = 0;
    const interval = setInterval(() => {
        simProgress += Math.random() * 10;
        if(simProgress > 85) simProgress = 85; 
        updateProgress(simProgress);
    }, 200);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentSession.access_token}`
            },
            body: formData
        });

        clearInterval(interval);
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed.');
        }

        updateProgress(100);
        showToast('File stored securely!', 'success');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1500);

        fetchFiles();

    } catch (error) {
        clearInterval(interval);
        progressContainer.style.display = 'none';
        showToast(error.message, 'error');
    } finally {
        fileInput.value = '';
    }
}

async function fetchFiles() {
    if(!currentSession) return;

    fileList.innerHTML = '';
    emptyState.style.display = 'none';
    loader.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/files`, {
            headers: {
                'Authorization': `Bearer ${currentSession.access_token}`
            }
        });
        
        const files = await response.json();
        loader.style.display = 'none';

        if (!response.ok) throw new Error(files.error || 'Failed to fetch personal files');

        if (files.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        files.forEach(file => {
            const card = document.createElement('a');
            card.href = file.url;
            card.target = '_blank';
            card.className = 'file-card';
            
            const date = new Date(file.createdAt).toLocaleDateString();

            let svgIcon = `<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
            if(file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                svgIcon = `<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
            }

            card.innerHTML = `
                ${svgIcon}
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-date">${date}</div>
            `;
            fileList.appendChild(card);
        });

    } catch (error) {
        loader.style.display = 'none';
        showToast(error.message, 'error');
    }
}

function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
    uploadPercentage.textContent = `${Math.round(percent)}%`;
}

function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} show`;
    
    setTimeout(() => {
        toastEl.className = 'toast';
    }, 3000);
}