// Data structure for all modes
let rawPrompts = {
    kids: { truth: [], dare: [] },
    teens: { truth: [], dare: [] },
    classic: { truth: [], dare: [] },
    spicy: { truth: [], dare: [] },
    xtreme: { truth: [], dare: [] },
    adults: { truth: [], dare: [] },
    couples: { truth: [], dare: [] },
    custom: { truth: [], dare: [] }
};

let activeCustomList = { truth: [], dare: [] };
let players = [];
let currentIndex = 0;
let currentMode = 'classic';
let isSkipMode = false;
let isCompetitive = true;
let timerInterval;

let truthHistory = [];
let dareHistory = [];
const COOLDOWN_LIMIT = 20;

const modeEmojis = {
    kids: "👶", teens: "😎", classic: "🎲", adults: "👨",
    spicy: "🌶️", xtreme: "😈", couples: "❤️", chaos: "🌀", custom: "🛠️"
};

async function loadData() {
    const modes = ['kids', 'teens', 'classic', 'spicy', 'xtreme', 'adults', 'couples', 'custom'];
    const types = ['truth', 'dare'];
    const fetchTasks = [];

    modes.forEach(m => {
        types.forEach(t => {
            let fileName = (m === 'custom') ? `total_${t}.txt` : `${m}_${t}.txt`;
            fetchTasks.push({ m, t, u: fileName });
        });
    });

    for (const f of fetchTasks) {
        try {
            const res = await fetch(f.u);
            if (!res.ok) continue;
            const text = await res.text();
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            rawPrompts[f.m][f.t] = lines;
            if (f.m === 'custom') activeCustomList[f.t] = lines.map((_, i) => i);
        } catch (e) {
            console.warn(`File ${f.u} not found.`);
        }
    }
    validateStart();
}

loadData();

// --- Background Visuals ---
const bg = document.getElementById('bg-canvas');
function cycleBg() {
    bg.style.backgroundColor = Math.random() > 0.5 ? 'var(--bg-blue)' : 'var(--bg-magenta)';
    setTimeout(cycleBg, 6000);
}
cycleBg();

function spawnCircle() {
    const c = document.createElement('div');
    const size = Math.random() * 50 + 40;
    c.className = 'circle';
    c.style.width = size+'px'; c.style.height = size+'px';
    c.style.left = Math.random()*100+'vw'; c.style.top = '-100px';
    bg.appendChild(c);
    let pos = -100;
    let interval = setInterval(() => {
        pos += 1.6; c.style.top = pos+'px';
        if(pos > window.innerHeight) { clearInterval(interval); c.remove(); }
    }, 16);
    setTimeout(spawnCircle, 200);
}
spawnCircle();

// --- Core Game Logic ---
function validateStart() {
    const hasPlayers = players.length >= 2;
    const checkedModes = document.querySelectorAll('.mode-checkboxes input:checked').length;
    const hasCustomPrompts = (activeCustomList.truth.length > 0 || activeCustomList.dare.length > 0);

    // If in custom mode, we need at least one mode checked OR one custom prompt selected
    if (currentMode === 'custom') {
        const canStart = (checkedModes > 0 || hasCustomPrompts);
        document.getElementById('start-btn').disabled = !(hasPlayers && canStart);
        document.getElementById('skip-btn').disabled = !canStart;
    } else {
        // For standard modes, we just check if players exist (standard modes are never empty)
        document.getElementById('start-btn').disabled = !hasPlayers;
        document.getElementById('skip-btn').disabled = false;
    }
}
function selectMode(m) {
    currentMode = m;
    const modeNames = {
        kids: "KIDS", teens: "TEENS", classic: "CLASSIC", adults: "ADULTS",
        spicy: "SPICY [18+]", xtreme: "XTREME [18+]", couples: "COUPLES [18+]",
        chaos: "CHAOS [18+]", custom: "CUSTOM"
    };

    document.getElementById('selected-mode-text').innerText = modeNames[m] || m.toUpperCase();
    document.getElementById('custom-config-area').style.display = (m === 'custom') ? 'block' : 'none';

    // Disable all checkboxes by default when switching to Custom
    if (m === 'custom') {
        document.querySelectorAll('.mode-checkboxes input').forEach(cb => cb.checked = false);
    }

    document.getElementById('mode-opts').style.display = 'none';
    document.getElementById('main-container').className = `white-box ${m}-theme`;
    validateStart();
}

function toggleLeaderboardPref() {
    isCompetitive = document.getElementById('comp-toggle').checked;
}

function pickType(type) {
    window.currentType = type; // Keep track of if we are doing Truth or Dare
    let pool = [];

    // --- 1. BUILD THE POOL BASED ON MODE ---
    if (currentMode === 'custom') {
        // Find all modes checked in the Custom config (e.g., Kids, Xtreme)
        const checkedModes = Array.from(document.querySelectorAll('.mode-checkboxes input:checked'))
                                  .map(el => el.value);

        // Add ALL prompts from every checked mode pool
        checkedModes.forEach(m => {
            if (rawPrompts[m] && rawPrompts[m][type]) {
                pool = pool.concat(rawPrompts[m][type]);
            }
        });

        // Add the specific individual prompts hand-picked from the "Custom" lists
        const customItems = activeCustomList[type].map(index => rawPrompts.custom[type][index]);
        pool = pool.concat(customItems);

    } else if (currentMode === 'chaos') {
        // Chaos pulls every single prompt from every single file
        ['kids', 'teens', 'classic', 'spicy', 'xtreme', 'adults', 'couples'].forEach(m => {
            if (rawPrompts[m] && rawPrompts[m][type]) {
                pool = pool.concat(rawPrompts[m][type]);
            }
        });
    } else {
        // Standard mode: just use the specific file (e.g., just teens_truth.txt)
        pool = rawPrompts[currentMode][type];
    }

    // --- 2. VALIDATION ---
    if (!pool || pool.length === 0) {
        alert("The prompt pool is empty! Please select a mode or prompts in Custom settings.");
        return;
    }

    // --- 3. SELECT RANDOM PROMPT ---
    let randomIndex;
    let selectedPrompt;
    let attempts = 0;

    // Try to find a prompt that hasn't been used recently
    do {
        randomIndex = Math.floor(Math.random() * pool.length);
        selectedPrompt = pool[randomIndex];
        attempts++;
    } while (history.includes(selectedPrompt) && attempts < 20);

    // Update history (keep last 50 to avoid immediate repeats)
    history.push(selectedPrompt);
    if (history.length > 50) history.shift();

    // --- 4. UPDATE THE UI ---
    // Hide the selection buttons, show the prompt box
    document.getElementById('selection-zone').style.display = 'none';
    document.getElementById('prompt-display-zone').style.display = 'block';

    // Set the text and the player name
    document.getElementById('current-player-name').innerText = players[currentPlayerIndex];
    document.getElementById('prompt-text').innerText = selectedPrompt;

    // Update colors based on type
    const promptBox = document.getElementById('prompt-box');
    if (type === 'truth') {
        promptBox.style.borderColor = "#007bff";
        document.getElementById('type-label').innerText = "TRUTH";
        document.getElementById('type-label').style.color = "#007bff";
    } else {
        promptBox.style.borderColor = "#ff4d4d";
        document.getElementById('type-label').innerText = "DARE";
        document.getElementById('type-label').style.color = "#ff4d4d";
    }
}

function skipPrompt() {
    clearInterval(timerInterval);
    pickType(window.currentType);
}

function startTimer() {
    let t = 180;
    document.getElementById('timer-sec').innerText = t;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        t--;
        document.getElementById('timer-sec').innerText = t;
        if (t <= 0) vote(false);
    }, 1000);
}

function vote(win) {
    clearInterval(timerInterval);
    if (!isSkipMode && players.length > 0) {
        players[currentIndex].score += win ? (window.currentType === 'truth' ? 0.25 : 1) : -1;
        currentIndex = (currentIndex + 1) % players.length;
    }
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('selection-view').style.display = 'flex';
    updateTurn();
}

function addPlayer() {
    const input = document.getElementById('player-input');
    const name = input.value.trim();
    if (name) {
        players.push({ name: name, score: 0 });
        const div = document.createElement('div');
        div.className = "player-entry";
        div.innerText = name;
        document.getElementById('player-list').appendChild(div);
        input.value = '';
        validateStart();
    }
}

function startGame(skip) {
    isSkipMode = skip;
    currentIndex = 0;
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('selection-view').style.display = 'flex';
    const lb = document.getElementById('lb-container');
    lb.style.display = (skip || !isCompetitive) ? 'none' : 'block';
    updateTurn();
}

function updateTurn() {
    if (players.length === 0 && !isSkipMode) return;
    const turnText = isSkipMode ? "CHOOSE A CARD" : `${players[currentIndex].name.toUpperCase()}'S TURN`;
    document.getElementById('turn-display').innerText = turnText;
    if (!isSkipMode && isCompetitive) updateLeaderboard();
}

function updateLeaderboard() {
    const list = document.getElementById('lb-list');
    list.innerHTML = '';
    [...players].sort((a,b) => b.score - a.score).forEach(p => {
        const entry = document.createElement('div');
        entry.className = "player-entry";
        entry.innerHTML = `<b>${p.name}</b>: ${p.score.toFixed(2)}`;
        list.appendChild(entry);
    });
}

function openConfig(type) {
    window.currentConfigType = type;
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('config-view').style.display = 'flex';
    renderConfigList();
}

function renderConfigList() {
    const container = document.getElementById('config-list');
    container.innerHTML = '';
    const type = window.currentConfigType;
    if (!rawPrompts.custom[type]) return;
    rawPrompts.custom[type].forEach((text, i) => {
        const item = document.createElement('div');
        item.className = 'player-entry';
        const isChecked = activeCustomList[type].includes(i);
        item.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="togglePrompt(${i})">
            <span style="font-size:0.9rem; margin-left:10px;">${text}</span>`;
        container.appendChild(item);
    });
}

function togglePrompt(idx) {
    let list = activeCustomList[window.currentConfigType];
    if (list.includes(idx)) {
        activeCustomList[window.currentConfigType] = list.filter(i => i !== idx);
    } else {
        activeCustomList[window.currentConfigType].push(idx);
    }
}

function toggleAllConfigs(sel) {
    activeCustomList[window.currentConfigType] = sel ? rawPrompts.custom[window.currentConfigType].map((_, i) => i) : [];
    renderConfigList();
}

function closeConfig() {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('setup-view').style.display = 'flex';
    validateStart();
}

function toggleDropdown(id) {
    const el = document.getElementById(id);
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
}