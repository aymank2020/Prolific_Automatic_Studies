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
    const aiProvider = document.getElementById("aiProvider") as HTMLSelectElement;
    const customUrlGroup = document.getElementById("customUrlGroup") as HTMLElement;

    if (!aiEnabled || !aiShadowMode || !aiSettingsGroup || !aiApiKey || !aiBaseUrl || !aiModel || !aiProvider || !customUrlGroup) return;

    // Load saved settings
    const result = await chrome.storage.sync.get(["aiEnabled", "aiShadowMode", "aiApiKey", "aiBaseUrl", "aiModel", "aiProvider"]);
    
    aiEnabled.checked = result["aiEnabled"] === true;
    aiShadowMode.checked = result["aiShadowMode"] === true;
    aiSettingsGroup.style.display = aiEnabled.checked ? "block" : "none";
    
    if (result["aiApiKey"]) aiApiKey.value = result["aiApiKey"];
    aiBaseUrl.value = result["aiBaseUrl"] || "https://api.openai.com/v1";
    if (result["aiProvider"]) aiProvider.value = result["aiProvider"];
    if (result["aiModel"]) aiModel.value = result["aiModel"];

    // Update UI based on provider
    const updateProviderUI = () => {
        const provider = aiProvider.value;
        customUrlGroup.style.display = provider === "custom" ? "block" : "none";
        
        // Show/hide optgroups
        const groups = aiModel.querySelectorAll('optgroup');
        groups.forEach(g => {
            const id = g.id;
            if (id === `opt-${provider}` || provider === "custom") {
                (g as HTMLElement).style.display = "";
            } else {
                (g as HTMLElement).style.display = "none";
            }
        });

        // Set default base URL for OpenCode
        if (provider === "opencode" && (!aiBaseUrl.value || aiBaseUrl.value.includes("openai.com") || aiBaseUrl.value.includes("/go/"))) {
            aiBaseUrl.value = "https://opencode.ai/zen/v1";
            chrome.storage.sync.set({ ["aiBaseUrl"]: aiBaseUrl.value });
        } else if (provider === "opencode-go" && (!aiBaseUrl.value || aiBaseUrl.value.includes("openai.com") || aiBaseUrl.value.includes("/zen/"))) {
            aiBaseUrl.value = "https://opencode.ai/go/v1";
            chrome.storage.sync.set({ ["aiBaseUrl"]: aiBaseUrl.value });
        }
        
        // Auto-select first visible option if current is hidden
        const selected = aiModel.selectedOptions[0];
        if (selected && selected.parentElement && (selected.parentElement as HTMLElement).style.display === "none") {
            const firstVisible = aiModel.querySelector('optgroup:not([style*="display: none"]) option') as HTMLOptionElement;
            if (firstVisible) {
                aiModel.value = firstVisible.value;
                chrome.storage.sync.set({ ["aiModel"]: aiModel.value });
            }
        }
    };

    updateProviderUI();

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

    aiProvider.addEventListener("change", async () => {
        await chrome.storage.sync.set({ ["aiProvider"]: aiProvider.value });
        updateProviderUI();
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
            const status = item.status || 'detected';
            const statusColor = status === 'reserved' ? '#10b981' : '#6b7280';
            const statusText = status === 'reserved' ? 'RESERVED' : 'DETECTED';

            const studyLink = item.url || `https://app.prolific.com/studies/${item.id}`;
            
            return `
                <div class="history-item">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <a href="${studyLink}" target="_blank" style="font-weight: bold; color: #1e3a8a; text-decoration: none; flex: 1; margin-right: 8px;">${title}</a>
                        <span style="font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}30;">${statusText}</span>
                    </div>
                    ${researcher ? `<div style="font-size: 11px; margin-bottom: 4px; color: #4b5563;">${researcher}</div>` : ''}
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                        <span>Pay: <strong>${payStr}</strong>${payHourStr}</span>
                        <span>Time: ${item.duration ? item.duration + ' mins' : 'N/A'}</span>
                    </div>
                    ${item.completionCode ? `
                        <div style="background: #f0fdf4; border: 1px dashed #22c55e; padding: 4px 8px; border-radius: 4px; margin: 6px 0; font-size: 11px; color: #15803d; display: flex; justify-content: space-between; align-items: center;">
                            <span>Code: <strong>${item.completionCode}</strong></span>
                            <span style="font-size: 9px; cursor: pointer; text-decoration: underline;" onclick="navigator.clipboard.writeText('${item.completionCode}')">Copy</span>
                        </div>
                    ` : ''}
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

async function updateStatus(isInitial = false): Promise<void> {
    const statusCard = document.getElementById("statusCard");
    const statusText = document.getElementById("statusText");
    const studyCount = document.getElementById("studyCount");
    const reservedCount = document.getElementById("reservedCount");
    const uptime = document.getElementById("uptime");

    if (!statusCard || !statusText) return;

    // 1. Ensure Background Service Worker is awake (Up to 10 retries on initial load)
    let bgReady = false;
    const bgRetries = isInitial ? 10 : 3;
    for (let i = 0; i < bgRetries; i++) {
        try {
            const res = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ target: 'background', type: 'ping' }, (response) => {
                    if (chrome.runtime.lastError) resolve(null);
                    else resolve(response);
                });
            });
            if (res) { bgReady = true; break; }
        } catch (e) {}
        await new Promise(r => setTimeout(r, isInitial ? 300 : 100));
    }

    if (!bgReady && isInitial) {
        statusCard.classList.add("disconnected");
        statusText.textContent = "Background sleeping...";
        return;
    }

    // 2. Query for Prolific tab
    chrome.tabs.query({ url: "*://*.prolific.com/*" }, async (tabs) => {
        if (chrome.runtime.lastError || tabs.length === 0) {
            statusCard.classList.add("disconnected");
            statusText.textContent = "No Prolific tab open";
            return;
        }

        const targetTab = tabs[0];
        if (!targetTab.id) return;

        // 3. Try to contact Content Script with retries (Up to 10 retries on initial load)
        let response = null;
        const csRetries = isInitial ? 10 : 3;
        for (let i = 0; i < csRetries; i++) {
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
            await new Promise(r => setTimeout(r, isInitial ? 500 : 200));
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

document.addEventListener('DOMContentLoaded', function () {
    // 1. START STATUS UPDATES IMMEDIATELY
    updateStatus(true);
    const statusInterval = setInterval(() => updateStatus(false), 3000);

    // 2. RUN OTHER SETUP IN BACKGROUND (Don't block the UI)
    const runSetup = async () => {
        try {
            // Clear badge
            chrome.runtime.sendMessage({
                type: 'clear-badge',
                target: 'background',
            }).catch(() => {});

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

            if (autoAudio) await setAudioCheckbox(autoAudio).catch(() => {});
            if (selectAudio) await setAudioOption(selectAudio).catch(() => {});
            if (counter) await setCounter(counter).catch(() => {});
            if (playAudioBtn) playAudioBtn.addEventListener("click", playAlert);
            if (showNotification) await setShowNotification(showNotification).catch(() => {});
            if (openProlific) await setOpenProlific(openProlific).catch(() => {});
            if (volume) await setVolume(volume).catch(() => {});

            // New auto-reserve controls
            await setupAutoReserve().catch(() => {});
            await setupForceCheck().catch(() => {});
            await setupAISettings().catch(() => {});
            
            // Initial history load
            loadHistory();
        } catch (err) {
            console.error("Popup setup error:", err);
        }
    };

    runSetup();
});
