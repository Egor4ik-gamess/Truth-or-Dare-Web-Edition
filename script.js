// --- 1. Global State ---
let currentMode = 'kids';
let players = [];
let currentPlayerIndex = 0;
let history = [];
let rawPrompts = {};
let activeCustomList = { truth: [], dare: [] };

// --- 2. Initialization ---
window.onload = async () => {
    // List of all modes to load
    const modes = ['kids', 'classic', 'teens', 'adults', 'spicy', 'xtreme', 'couples', 'custom'];

    for (const m of modes) {
        rawPrompts[m] = { truth: [], dare: [] };
        try {
            const resT = await fetch(`./${m}_truth.txt`);
            const textT = await resT.text();
            rawPrompts[m].truth = textT.split('\n').filter(line => line.trim() !== "");

            const resD = await fetch(`./${m}_dare.txt`);
            const textD = await resD.text();
            rawPrompts[m].dare = textD.split('\n').filter(line => line.trim() !== "");
        } catch (e) {
            console.error(`Failed to load ${m} files:`, e);
        }
    }

    // Fill the Custom selection menus in the UI
    populateCustomPrompts();
    validateStart();
};

// --- 3. UI Navigation & Validation ---

function validateStart() {
    const hasPlayers = players.length >= 2;
    const startBtn = document.getElementById('start-btn');

    if (currentMode === 'custom') {
        // Check if at least one full category is checked
        const checkedModes = document.querySelectorAll('.mode-checkboxes input:checked').length;
        // Check if at least one individual prompt is hand-picked
        const hasIndividual = (activeCustomList.truth.length > 0 || activeCustomList.dare.length > 0);

        const canStart = hasPlayers && (checkedModes > 0 || hasIndividual);
        startBtn.disabled = !canStart;
    } else {
        // Standard modes (Kids, Teens, etc.) always have 75 prompts
        startBtn.disabled = !hasPlayers;
    }
}

function selectMode(m) {
    currentMode = m;

    // UI Visibility
    document.getElementById('custom-config-area').style.display = (m === 'custom') ? 'block' : 'none';
    document.getElementById('mode-opts').style.display = 'none';

    // CUSTOM RESET: Disable everything by default for a clean slate
    if (m === 'custom') {
        document.querySelectorAll('.mode-checkboxes input').forEach(cb => cb.checked = false);
        activeCustomList = { truth: [], dare: [] };
        // Reset the UI highlights for individual custom picks
        document.querySelectorAll('.custom-item').forEach(el => el.classList.remove('selected'));
    }

    // Apply Theme Colors
    document.getElementById('main-container').className = `white-box ${m}-theme`;

    validateStart();
}

// --- 4. Player Management ---

function addPlayer() {
    const input = document.getElementById('player-input');
    const name = input.value.trim();
    if (name && !players.includes(name)) {
        players.push(name);
        renderPlayers();
        input.value = "";
        validateStart();
    }
}

function removePlayer(index) {
    players.splice(index, 1);
    renderPlayers();
    validateStart();
}

function renderPlayers() {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map((p, i) => `
        <div class="player-tag">
            ${p} <span onclick="removePlayer(${i})">×</span>
        </div>
    `).join('');
}

// --- 5. Game Core Logic ---

function startGame() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    nextTurn();
}

function nextTurn() {
    document.getElementById('selection-zone').style.display = 'block';
    document.getElementById('prompt-display-zone').style.display = 'none';
    document.getElementById('player-turn-name').innerText = players[currentPlayerIndex];
}

function pickType(type) {
    let pool = [];

    if (currentMode === 'custom') {
        // 1. Get ALL prompts from checked categories (The "Full Mode" Select)
        const checkedModes = Array.from(document.querySelectorAll('.mode-checkboxes input:checked'))
                                  .map(cb => cb.value);

        checkedModes.forEach(m => {
            if (rawPrompts[m] && rawPrompts[m][type]) {
                pool = pool.concat(rawPrompts[m][type]);
            }
        });

        // 2. Add specific hand-picked individual prompts
        activeCustomList[type].forEach(idx => {
            if (rawPrompts.custom[type][idx]) {
                pool.push(rawPrompts.custom[type][idx]);
            }
        });
    } else if (currentMode === 'chaos') {
        // Chaos pulls 75x7 prompts
        ['kids', 'classic', 'teens', 'adults', 'spicy', 'xtreme', 'couples'].forEach(m => {
            pool = pool.concat(rawPrompts[m][type]);
        });
    } else {
        // Standard single mode
        pool = rawPrompts[currentMode][type];
    }

    if (pool.length === 0) {
        alert("Pool is empty! Select modes in Custom settings.");
        return;
    }

    // Random selection with repeat protection
    let selected;
    let attempts = 0;
    do {
        selected = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
    } while (history.includes(selected) && attempts < 20);

    history.push(selected);
    if (history.length > 50) history.shift();

    // Display
    showPrompt(type, selected);
}

function showPrompt(type, text) {
    document.getElementById('selection-zone').style.display = 'none';
    document.getElementById('prompt-display-zone').style.display = 'block';

    document.getElementById('current-player-name').innerText = players[currentPlayerIndex];
    document.getElementById('prompt-text').innerText = text;

    const label = document.getElementById('type-label');
    label.innerText = type.toUpperCase();
    label.style.color = (type === 'truth') ? "#007bff" : "#ff4d4d";
    document.getElementById('prompt-box').style.borderColor = label.style.color;
}

function completeTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    nextTurn();
}

// --- 6. Individual Custom Selection UI ---

function populateCustomPrompts() {
    const tList = document.getElementById('custom-truths-list');
    const dList = document.getElementById('custom-dares-list');

    rawPrompts.custom.truth.forEach((text, i) => {
        const div = document.createElement('div');
        div.className = 'custom-item';
        div.innerText = text;
        div.onclick = () => toggleCustomItem('truth', i, div);
        tList.appendChild(div);
    });

    rawPrompts.custom.dare.forEach((text, i) => {
        const div = document.createElement('div');
        div.className = 'custom-item';
        div.innerText = text;
        div.onclick = () => toggleCustomItem('dare', i, div);
        dList.appendChild(div);
    });
}

function toggleCustomItem(type, index, element) {
    const list = activeCustomList[type];
    if (list.includes(index)) {
        activeCustomList[type] = list.filter(i => i !== index);
        element.classList.remove('selected');
    } else {
        list.push(index);
        element.classList.add('selected');
    }
    validateStart();
}

function openModeMenu() {
    document.getElementById('mode-opts').style.display = 'block';
}