/**
 * Prolific Auto-Reserve Popup Script
 * Handles: Tab switching, all original settings, auto-reserve controls, live status
 */

// ======================== TAB SWITCHING ========================
function setupTabs(): void {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = (tab as HTMLElement).dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetEl = document.getElementById(`tab-${target}`);
            if (targetEl) targetEl.classList.add('active');
            
            if (target === 'history') {
                loadHistory();
            }
        });
    });
}

// ======================== ORIGINAL SETTINGS (preserved) ========================

async function setVolume(volume: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("volume");
    const vol = result["volume"];
    if (vol !== undefined) {
        volume.value = String(vol);
    }
    updateVolumeDisplay(volume.value);
    volume.addEventListener("input", async function () {
        await chrome.storage.sync.set({ ["volume"]: parseFloat(volume.value) });
        updateVolumeDisplay(volume.value);
    });
}

function updateVolumeDisplay(value: string): void {
    const display = document.getElementById("volumeValue");
    if (display) display.textContent = `${value}%`;
}

async function setCounter(counter: HTMLSpanElement): Promise<void> {
    const result = await chrome.storage.sync.get("counter");
    const count = result["counter"];
    if (count !== undefined) {
        counter.innerText = count.toString();
    }
}

async function playAlert(): Promise<void> {
    await chrome.runtime.sendMessage({
        type: 'play-sound',
        target: 'background',
    });
    const playAudio = document.getElementById("playAudio") as HTMLButtonElement;
    if (playAudio) {
        playAudio.disabled = true;
        playAudio.classList.add("btn-fail");
        setTimeout(() => {
            playAudio.disabled = false;
            playAudio.classList.remove("btn-fail");
        }, 500);
    }
}

async function setAudioOption(selectAudio: HTMLSelectElement): Promise<void> {
    const result = await chrome.storage.sync.get("audio");
    if (result["audio"]) selectAudio.value = result["audio"];
    selectAudio.addEventListener("change", async function (): Promise<void> {
        await chrome.storage.sync.set({ ["audio"]: selectAudio.value });
    });
}

async function setAudioCheckbox(autoAudio: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("audioActive");
    autoAudio.checked = result["audioActive"] !== false;
    autoAudio.addEventListener("change", async function (): Promise<void> {
        await chrome.storage.sync.set({ ["audioActive"]: autoAudio.checked });
    });
}

async function setShowNotification(showNotification: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("showNotification");
    showNotification.checked = result["showNotification"] !== false;
    showNotification.addEventListener("change", async function (): Promise<void> {
        await chrome.storage.sync.set({ ["showNotification"]: showNotification.checked });
    });
}

async function setOpenProlific(openProlific: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get("openProlific");
    openProlific.checked = result["openProlific"] === true;
    openProlific.addEventListener("change", async function (): Promise<void> {
        await chrome.storage.sync.set({ ["openProlific"]: openProlific.checked });
    });
}

// ======================== AUTO-RESERVE CONTROLS ========================

async function setupAutoReserve(): Promise<void> {
    const toggle = document.getElementById("autoReserve") as HTMLInputElement;
    if (!toggle) return;

    const result = await chrome.storage.sync.get("autoReserveEnabled");
    toggle.checked = result["autoReserveEnabled"] !== false;

    toggle.addEventListener("change", async () => {
        await chrome.storage.sync.set({ ["autoReserveEnabled"]: toggle.checked });
        chrome.runtime.sendMessage({
            target: 'background',
            type: 'toggle-auto-reserve',
            data: { enabled: toggle.checked },
        });
    });
}

async function setupForceCheck(): Promise<void> {
    const btn = document.getElementById("forceCheck") as HTMLButtonElement;
    if (!btn) return;

    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Checking...";

        try {
            chrome.runtime.sendMessage({
                target: 'background',
                type: 'force-check',
            });
        } catch (e) { }

        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = "Force Check Now";
        }, 2000);
    });
}

// ======================== AI AUTO-SOLVER CONTROLS ========================

async function setupAISettings(): Promise<void> {
    const aiEnabled = document.getElementById("aiEnabled") as HTMLInputElement;
    const aiShadowMode = document.getElementById("aiShadowMode") as HTMLInputElement;
    const aiSettingsGroup = document.getElementById("aiSettingsGroup") as HTMLDivElement;
    const aiApiKey = document.getElementById("aiApiKey") as HTMLInputElement;
    const aiBaseUrl = document.getElementById("aiBaseUrl") as HTMLInputElement;
    const aiModel = document.getElementById("aiModel") as HTMLSelectElement;

    if (!aiEnabled || !aiShadowMode || !aiSettingsGroup || !aiApiKey || !aiBaseUrl || !aiModel) return;

    // Load saved settings
    const result = await chrome.storage.sync.get(["aiEnabled", "aiShadowMode", "aiApiKey", "aiBaseUrl", "aiModel"]);
    
    aiEnabled.checked = result["aiEnabled"] === true;
    aiShadowMode.checked = result["aiShadowMode"] === true;
    aiSettingsGroup.style.display = aiEnabled.checked ? "block" : "none";
    
    if (result["aiApiKey"]) aiApiKey.value = result["aiApiKey"];
    aiBaseUrl.value = result["aiBaseUrl"] || "https://api.openai.com/v1";
    if (result["aiModel"]) aiModel.value = result["aiModel"];

    // Event listeners
    aiEnabled.addEventListener("change", async () => {
        await chrome.storage.sync.set({ ["aiEnabled"]: aiEnabled.checked });
        aiSettingsGroup.style.display = aiEnabled.checked ? "block" : "none";
    });

    aiShadowMode.addEventListener("change", async () => {
        await chrome.storage.sync.set({ ["aiShadowMode"]: aiShadowMode.checked });
    });

    aiApiKey.addEventListener("input", async () => {
        await chrome.storage.sync.set({ ["aiApiKey"]: aiApiKey.value });
    });

    aiBaseUrl.addEventListener("input", async () => {
        await chrome.storage.sync.set({ ["aiBaseUrl"]: aiBaseUrl.value });
    });

    aiModel.addEventListener("change", async () => {
        await chrome.storage.sync.set({ ["aiModel"]: aiModel.value });
    });
}

// ======================== HISTORY ========================

async function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    try {
        const result = await chrome.storage.local.get('studyHistory');
        const history = result.studyHistory || [];

        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-item">No reserved studies yet.</div>';
            return;
        }

        historyList.innerHTML = history.map((item: any) => {
            const timeStr = new Date(item.timestamp).toLocaleString();
            
            // Format currency if it exists
            let payStr = 'N/A';
            if (item.pay !== undefined && item.pay !== 0) {
                payStr = `£${(item.pay / 100).toFixed(2)}`;
            }
            
            let payHourStr = '';
            if (item.payPerHour) {
                payHourStr = ` (£${(item.payPerHour / 100).toFixed(2)} /hr)`;
            }

            const title = item.title && item.title !== 'Unknown Study' ? item.title : `Study ${item.id.substring(0,8)}...`;
            const researcher = item.researcher && item.researcher !== 'Unknown Researcher' ? item.researcher : '';
            
            return `
                <div class="history-item">
                    <div style="font-weight: bold; margin-bottom: 4px; color: #1e3a8a;">${title}</div>
                    ${researcher ? `<div style="font-size: 11px; margin-bottom: 4px; color: #4b5563;">${researcher}</div>` : ''}
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                        <span>Pay: <strong>${payStr}</strong>${payHourStr}</span>
                        <span>Time: ${item.duration ? item.duration + ' mins' : 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; border-top: 1px solid #eee; padding-top: 4px; margin-top: 4px;">
                        <span>${timeStr}</span>
                        <span>Source: ${item.source}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        historyList.innerHTML = '<div class="history-item">Error loading history</div>';
    }
}

// ======================== LIVE STATUS ========================

async function updateStatus(): Promise<void> {
    const statusCard = document.getElementById("statusCard");
    const statusText = document.getElementById("statusText");
    const studyCount = document.getElementById("studyCount");
    const reservedCount = document.getElementById("reservedCount");
    const uptime = document.getElementById("uptime");

    if (!statusCard || !statusText) return;

    // 1. Ensure Background Service Worker is awake
    let bgReady = false;
    for (let i = 0; i < 3; i++) {
        try {
            const res = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ target: 'background', type: 'ping' }, (response) => {
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(response);
                });
            });
            if (res) { bgReady = true; break; }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
    }

    if (!bgReady) {
        statusCard.classList.add("disconnected");
        statusText.textContent = "Background waking up...";
        // We don't return here, we'll let the next interval try again
    }

    // 2. Query for Prolific tab
    chrome.tabs.query({ url: "*://*.prolific.com/*" }, async (tabs) => {
        if (chrome.runtime.lastError) {
            statusText.textContent = "Query Error";
            statusCard.classList.add("disconnected");
            return;
        }

        if (tabs.length === 0) {
            statusCard.classList.add("disconnected");
            statusText.textContent = "No Prolific tab open";
            return;
        }

        const targetTab = tabs[0];
        if (!targetTab.id) return;

        // 3. Try to contact Content Script with retries (for the very first load)
        let response = null;
        for (let i = 0; i < 3; i++) {
            response = await new Promise((resolve) => {
                chrome.tabs.sendMessage(targetTab.id!, {
                    target: 'content-script',
                    type: 'get-status',
                }, (res) => {
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(res);
                });
            });
            if (response) break;
            await new Promise(r => setTimeout(r, 300));
        }

        if (!response) {
            statusCard.classList.add("disconnected");
            statusText.textContent = "Content Script missing (Refresh Page)";
            return;
        }

        // 4. Success! Update UI
        statusCard.classList.remove("disconnected");
        statusText.textContent = response.enabled ? "Active & Monitoring" : "Paused";
        
        if (studyCount) studyCount.textContent = (response.studyCount || 0).toString();
        
        // Persistent reserved count for the day
        chrome.storage.local.get('studyHistory', (res) => {
            const history = res.studyHistory || [];
            const today = new Date().setHours(0,0,0,0);
            const todayCount = history.filter((h: any) => h.timestamp > today).length;
            if (reservedCount) reservedCount.textContent = todayCount.toString();
        });

        if (uptime) uptime.textContent = formatUptime(response.uptime || 0);
    });
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

// ======================== INIT ========================

document.addEventListener('DOMContentLoaded', async function () {
    // Clear badge
    await chrome.runtime.sendMessage({
        type: 'clear-badge',
        target: 'background',
    });

    // Setup tabs
    setupTabs();

    // Original settings
    const autoAudio = document.getElementById("autoAudio") as HTMLInputElement;
    const selectAudio = document.getElementById("selectAudio") as HTMLSelectElement;
    const counter = document.getElementById("counter") as HTMLSpanElement;
    const playAudioBtn = document.getElementById("playAudio") as HTMLButtonElement;
    const showNotification = document.getElementById("showNotification") as HTMLInputElement;
    const volume = document.getElementById("volume") as HTMLInputElement;
    const openProlific = document.getElementById("openProlific") as HTMLInputElement;

    if (autoAudio) await setAudioCheckbox(autoAudio);
    if (selectAudio) await setAudioOption(selectAudio);
    if (counter) await setCounter(counter);
    if (playAudioBtn) playAudioBtn.addEventListener("click", playAlert);
    if (showNotification) await setShowNotification(showNotification);
    if (openProlific) await setOpenProlific(openProlific);
    if (volume) await setVolume(volume);

    // New auto-reserve controls
    await setupAutoReserve();
    await setupForceCheck();
    await setupAISettings();

    // Live status updates
    updateStatus();
    setInterval(updateStatus, 3000);
    
    // Initial history load
    loadHistory();
});
