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
    document.getElementById('start-btn').disabled = !hasPlayers;
    document.getElementById('skip-btn').disabled = false;
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
    document.getElementById('mode-opts').style.display = 'none';
    document.getElementById('main-container').className = `white-box ${m}-theme`;
}

function toggleLeaderboardPref() {
    isCompetitive = document.getElementById('comp-toggle').checked;
}

function pickType(type) {
    window.currentType = type;
    let pool = [];

    if (currentMode === 'custom') {
        const checkedModes = Array.from(document.querySelectorAll('.mode-checkboxes input:checked'))
                                  .map(el => el.value);
        checkedModes.forEach(m => {
            if (rawPrompts[m] && rawPrompts[m][type]) {
                pool = pool.concat(rawPrompts[m][type]);
            }
        });
        // Add specific hand-picked custom items
        const customItems = activeCustomList[type].map(i => rawPrompts.custom[type][i]);
        pool = pool.concat(customItems);
    } else if (currentMode === 'chaos') {
        // All modes except custom
        ['kids', 'teens', 'classic', 'spicy', 'xtreme', 'adults', 'couples'].forEach(m => {
            pool = pool.concat(rawPrompts[m][type]);
        });
    } else {
        // Standard mode selection
        pool = rawPrompts[currentMode][type];
    }

    if (!pool || pool.length === 0) {
        alert("No prompts available for this selection!");
        return;
    }

    let history = (type === 'truth') ? truthHistory : dareHistory;
    let available = pool.filter(p => !history.includes(p));

    if (available.length === 0) {
        if (type === 'truth') truthHistory = []; else dareHistory = [];
        available = pool;
    }

    const selectedPrompt = available[Math.floor(Math.random() * available.length)];
    history.push(selectedPrompt);
    if (history.length > COOLDOWN_LIMIT) history.shift();

    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('game-view').style.display = 'flex';
    document.getElementById('prompt-text').innerText = selectedPrompt;
    document.getElementById('active-player-name').innerText = isSkipMode ? "" : players[currentIndex].name;
    document.getElementById('card').style.backgroundColor = (type === 'truth') ? 'var(--bg-blue)' : 'var(--bg-magenta)';
    document.getElementById('unable-btn').style.display = (type === 'dare') ? 'block' : 'none';

    startTimer();
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