// --- 1. GLOBAL STATE ---
let currentMode = 'classic';
let players = [];
let scores = {}; // Track success for leaderboard
let currentPlayerIndex = 0;
let rawPrompts = {};
let activeCustomList = { truth: [], dare: [] };
let leaderboardEnabled = true;
let lastTypeUsed = 'truth';
let gameTimer = null;

// --- 2. INITIALIZATION ---
window.onload = async () => {
    initParticles();
    const modes = ['kids', 'classic', 'teens', 'adults', 'spicy', 'xtreme', 'couples', 'custom'];
    modes.forEach(m => { rawPrompts[m] = { truth: [], dare: [] }; });

    await Promise.all(modes.map(async (mode) => {
        try {
            const [resT, resD] = await Promise.all([
                fetch(`./${mode}_truth.txt`),
                fetch(`./${mode}_dare.txt`)
            ]);
            if (resT.ok) {
                const text = await resT.text();
                rawPrompts[mode].truth = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            }
            if (resD.ok) {
                const text = await resD.text();
                rawPrompts[mode].dare = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            }
        } catch (e) { console.warn(`Missing: ${mode} data files.`); }
    }));
    validateStart();
};

// --- 3. BACKGROUND ENGINE ---
function initParticles() {
    const canvas = document.createElement('canvas');
    const container = document.getElementById('bg-canvas');
    if (!container) return;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];

    const resize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.size = (Math.random() * 3 + 1) * (Math.random() * 1.5 + 1);
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.alpha = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > w) this.vx *= -1;
            if (this.y < 0 || this.y > h) this.vy *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.fill();
        }
    }
    for (let i = 0; i < 60; i++) particles.push(new Particle());
    function anim() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(anim);
    }
    anim();
}

// --- 4. NAVIGATION & UI ---
function toggleDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isVisible = el.style.display === 'block';
    document.querySelectorAll('.dropdown-options, .lb-content').forEach(d => d.style.display = 'none');
    el.style.display = isVisible ? 'none' : 'block';
}

function selectMode(m) {
    currentMode = m;
    const textEl = document.getElementById('selected-mode-text');
    if(textEl) textEl.innerText = m.toUpperCase();
    applyTheme(m);
    const configArea = document.getElementById('custom-config-area');
    if (configArea) configArea.style.display = (m === 'custom') ? 'block' : 'none';
    toggleDropdown('mode-opts');
    validateStart();
}

// --- UPDATED THEME ENGINE ---
function applyTheme(m) {
    currentMode = m;
    const root = document.documentElement;
    const colors = {
        kids: '#4ade80', classic: '#00d2ff', teens: '#f472b6', adults: '#a78bfa',
        spicy: '#fb7185', xtreme: '#dc2626', couples: '#ec4899', chaos: '#ff007f', custom: '#94a3b8'
    };
    const activeColor = colors[m] || colors.classic;

    // Update 30px outline and background glow
    root.style.setProperty('--theme-color', activeColor);
    document.body.style.background = `radial-gradient(circle at center, #080c14 0%, ${activeColor}22 100%)`;
}

// --- 5. PLAYER & GAME CORE ---
function addPlayer() {
    const input = document.getElementById('player-input');
    const name = input.value.trim();
    if (name && !players.includes(name)) {
        players.push(name);
        scores[name] = 0;
        input.value = "";
        renderPlayers();
        validateStart();
    }
}

function renderPlayers() {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map((p, i) => `
        <div class="player-entry">
            <span>${p}</span>
            <button onclick="removePlayer(${i})">×</button>
        </div>
    `).join('');
}

function removePlayer(i) {
    const name = players[i];
    delete scores[name];
    players.splice(i, 1);
    renderPlayers();
    validateStart();
}

function validateStart() {
    const startBtn = document.getElementById('start-btn');
    const skipBtn = document.getElementById('skip-btn');
    const hasPlayers = players.length >= 2;

    if (currentMode === 'custom') {
        const checkedModes = document.querySelectorAll('.mode-checkboxes input:checked').length;
        startBtn.disabled = !(hasPlayers && checkedModes > 0);
        if (skipBtn) skipBtn.disabled = false;
    } else {
        startBtn.disabled = !hasPlayers;
        if (skipBtn) skipBtn.disabled = false;
    }
}

function startGame(isSkip) {
    if (isSkip && players.length < 2) {
        players = ["PLAYER 1", "PLAYER 2"];
        players.forEach(p => scores[p] = 0);
        renderPlayers();
    }
    currentPlayerIndex = 0;
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('selection-view').style.display = 'block';

    const lb = document.getElementById('lb-container');
    if (lb) lb.style.display = leaderboardEnabled ? 'block' : 'none';

    updateTurnDisplay();
    updateLeaderboard();
}

function updateTurnDisplay() {
    const name = players[currentPlayerIndex] || "PLAYER";
    const el = document.getElementById('turn-display');
    if (el) el.innerText = `${name.toUpperCase()}'S TURN`;
}

function pickType(type) {
    lastTypeUsed = type;
    let pool = [];

    if (currentMode === 'custom') {
        const checked = Array.from(document.querySelectorAll('.mode-checkboxes input:checked')).map(c => c.value);
        checked.forEach(m => pool = pool.concat(rawPrompts[m][type]));
    } else if (currentMode === 'chaos') {
        ['kids','classic','teens','adults','spicy','xtreme','couples'].forEach(m => {
            pool = pool.concat(rawPrompts[m][type]);
        });
    } else {
        pool = rawPrompts[currentMode][type];
    }

    const text = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : "No prompts found!";
    document.getElementById('prompt-text').innerText = text;
    document.getElementById('active-player-name').innerText = players[currentPlayerIndex];

    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'block';
    startTimer();
}

function startTimer() {
    let timeLeft = 180;
    const display = document.getElementById('timer-sec');
    if (gameTimer) clearInterval(gameTimer);

    gameTimer = setInterval(() => {
        timeLeft--;
        if (display) display.innerText = timeLeft;
        if (timeLeft <= 0) clearInterval(gameTimer);
    }, 1000);
}

// --- DYNAMIC POINT SYSTEM ---
function vote(success) {
    const player = players[currentPlayerIndex];
    let multiplier = 1;

    // Mode-specific Multipliers
    if (currentMode === 'spicy' || currentMode === 'xtreme') multiplier = 1; // Base is 1, we handle the logic below

    if (success) {
        if (lastTypeUsed === 'truth') {
            let gain = (currentMode === 'spicy' || currentMode === 'xtreme') ? (0.25 * 3) : 0.25;
            scores[player] += gain;
        } else {
            let gain = (currentMode === 'spicy' || currentMode === 'xtreme') ? (1 * 4) : 1;
            scores[player] += gain;
        }
    } else {
        if (lastTypeUsed === 'truth') {
            let loss = (currentMode === 'spicy' || currentMode === 'xtreme') ? (0.5 * 5) : 0.5;
            scores[player] -= loss;
        } else {
            let loss = (currentMode === 'spicy' || currentMode === 'xtreme') ? (1 * 7) : 1;
            scores[player] -= loss;
        }
    }

    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('selection-view').style.display = 'block';
    if (gameTimer) clearInterval(gameTimer);
    updateTurnDisplay();
    updateLeaderboard();
}

// --- UNABLE TO DO (SWAP MECHANIC) ---
function skipPrompt() {
    // Shake effect for feedback
    const card = document.getElementById('card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'pulse 0.4s ease-in-out';

    // Pick new prompt of same type
    pickType(lastTypeUsed);
}

// --- 6. LEADERBOARD & CONFIG ---
function updateLeaderboard() {
    const list = document.getElementById('lb-list');
    if (!list) return;
    const sorted = [...players].sort((a, b) => scores[b] - scores[a]);
    list.innerHTML = sorted.map(p => `<div>${p}: ${scores[p]} pts</div>`).join('');
}

function toggleLeaderboardPref() {
    leaderboardEnabled = document.getElementById('comp-toggle').checked;
}

function openConfig(type) {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('config-view').style.display = 'block';
    document.getElementById('config-title').innerText = `CONFIGURE ${type.toUpperCase()}S`;
    // Note: Since raw files are remote, this assumes checkboxes in setup handle bulk inclusion.
}

function closeConfig() {
    document.getElementById('config-view').style.display = 'none';
    document.getElementById('setup-view').style.display = 'block';
}

// --- 7. ADVANCED CONFIGURATION (FILTERING) ---

let currentConfigType = 'truth'; // Global tracker for which list we are editing

function openConfig(type) {
    currentConfigType = type;
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('config-view').style.display = 'block';
    document.getElementById('config-title').innerText = `CONFIGURE ${type.toUpperCase()}S`;

    const listContainer = document.getElementById('config-list');
    listContainer.innerHTML = ''; // Clear previous list

    // Combine all prompts from checked modes to let user filter them
    let combinedPool = [];
    const checkedModes = Array.from(document.querySelectorAll('.mode-checkboxes input:checked')).map(c => c.value);

    if (checkedModes.length === 0) {
        listContainer.innerHTML = '<p style="color: #64748b;">Please select at least one mode in Setup first!</p>';
        return;
    }

    checkedModes.forEach(mode => {
        rawPrompts[mode][type].forEach(prompt => {
            combinedPool.push({ text: prompt, mode: mode });
        });
    });

    // Render the list with checkboxes
    listContainer.innerHTML = combinedPool.map((item, index) => `
        <div class="config-item" style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; text-align: left; background: #f8fafc; padding: 10px; border-radius: 10px;">
            <input type="checkbox" checked class="prompt-checkbox" data-text="${item.text.replace(/"/g, '&quot;')}" id="prompt-${index}">
            <label for="prompt-${index}" style="font-size: 0.9rem; cursor: pointer;">
                <small style="color: #64748b; display: block;">[${item.mode.toUpperCase()}]</small>
                ${item.text}
            </label>
        </div>
    `).join('');
}

function toggleAllConfigs(select) {
    const checkboxes = document.querySelectorAll('.prompt-checkbox');
    checkboxes.forEach(cb => cb.checked = select);
}

// Update the closeConfig to actually save the filtered list
function closeConfig() {
    const checkboxes = document.querySelectorAll('.prompt-checkbox');
    // Save the specific list of what the user wants to keep
    activeCustomList[currentConfigType] = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.getAttribute('data-text'));

    document.getElementById('config-view').style.display = 'none';
    document.getElementById('setup-view').style.display = 'block';
}

// --- 8. UPDATED PICK LOGIC ---
// Replace your existing pickType with this version to respect the custom config
function pickType(type) {
    lastTypeUsed = type;
    let pool = [];

    // --- ADD THESE LINES ---
    const cardColor = (type === 'truth') ? '#00d2ff' : '#ff007f';
    document.getElementById('card').style.setProperty('--card-bg', cardColor);
    // -----------------------

    if (currentMode === 'custom') {
        // Use the filtered list if it exists, otherwise fallback to the checked modes
        if (activeCustomList[type].length > 0) {
            pool = activeCustomList[type];
        } else {
            const checked = Array.from(document.querySelectorAll('.mode-checkboxes input:checked')).map(c => c.value);
            checked.forEach(m => pool = pool.concat(rawPrompts[m][type]));
        }
    } else if (currentMode === 'chaos') {
        ['kids','classic','teens','adults','spicy','xtreme','couples'].forEach(m => {
            pool = pool.concat(rawPrompts[m][type]);
        });
    } else {
        pool = rawPrompts[currentMode][type];
    }

    const text = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : "No prompts found! Check your configuration.";
    document.getElementById('prompt-text').innerText = text;
    document.getElementById('active-player-name').innerText = players[currentPlayerIndex];

    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'block';
    startTimer();
}

function endGame() {
    // Stop any active timers
    if (gameTimer) clearInterval(gameTimer);

    // Reset state but keep player names (usually preferred)
    currentPlayerIndex = 0;
    for (let player in scores) {
        scores[player] = 0;
    }

    // Navigate back to setup
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('setup-view').style.display = 'block';

    updateLeaderboard();
}

// --- 9. DYNAMIC THEME ENGINE (The Final Piece) ---
function applyTheme(m) {
    const container = document.getElementById('main-container');
    const root = document.documentElement;

    const themeColors = {
        kids: '#4ade80',
        classic: '#00d2ff',
        teens: '#f472b6',
        adults: '#a78bfa',
        spicy: '#fb7185',
        xtreme: '#dc2626',
        couples: '#ec4899',
        chaos: '#ff007f',
        custom: '#94a3b8'
    };

    const color = themeColors[m] || themeColors.classic;

    // 1. Update the CSS Variable for the 30px Outline and Buttons
    root.style.setProperty('--theme-color', color);

    // 2. Update the Body Background with a deep radial glow
    document.body.style.background = `radial-gradient(circle at center, #0b111d 0%, ${color}33 100%)`;

    // 3. Apply the class for the center container border
    container.className = `white-box ${m}-theme`;
}

// --- 10. UNABLE TO DO (MECHANIC) ---
function skipPrompt() {
    // Shaking effect for the card to show it's being swapped
    const card = document.getElementById('card');
    card.style.animation = 'none';
    void card.offsetWidth; // Trigger reflow
    card.style.animation = 'pulse 0.5s ease-in-out';

    // Pull a new prompt of the same type without changing the player
    pickType(lastTypeUsed);
}

// --- 11. RESPONSIVE INITIALIZATION ---
window.addEventListener('resize', () => {
    // If you add any canvas resizing logic, it triggers here
    const canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});