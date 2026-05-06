"use strict";
/**
 * Prolific Auto-Reserve Popup Script
 * Handles: Tab switching, all original settings, auto-reserve controls, live status
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ======================== TAB SWITCHING ========================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetEl = document.getElementById(`tab-${target}`);
            if (targetEl)
                targetEl.classList.add('active');
            if (target === 'history') {
                loadHistory();
            }
        });
    });
}
// ======================== ORIGINAL SETTINGS (preserved) ========================
function setVolume(volume) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("volume");
        const vol = result["volume"];
        if (vol !== undefined) {
            volume.value = String(vol);
        }
        updateVolumeDisplay(volume.value);
        volume.addEventListener("input", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["volume"]: parseFloat(volume.value) });
                updateVolumeDisplay(volume.value);
            });
        });
    });
}
function updateVolumeDisplay(value) {
    const display = document.getElementById("volumeValue");
    if (display)
        display.textContent = `${value}%`;
}
function setCounter(counter) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("counter");
        const count = result["counter"];
        if (count !== undefined) {
            counter.innerText = count.toString();
        }
    });
}
function playAlert() {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.runtime.sendMessage({
            type: 'play-sound',
            target: 'background',
        });
        const playAudio = document.getElementById("playAudio");
        if (playAudio) {
            playAudio.disabled = true;
            playAudio.classList.add("btn-fail");
            setTimeout(() => {
                playAudio.disabled = false;
                playAudio.classList.remove("btn-fail");
            }, 500);
        }
    });
}
function setAudioOption(selectAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("audio");
        if (result["audio"])
            selectAudio.value = result["audio"];
        selectAudio.addEventListener("change", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["audio"]: selectAudio.value });
            });
        });
    });
}
function setAudioCheckbox(autoAudio) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("audioActive");
        autoAudio.checked = result["audioActive"] !== false;
        autoAudio.addEventListener("change", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["audioActive"]: autoAudio.checked });
            });
        });
    });
}
function setShowNotification(showNotification) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("showNotification");
        showNotification.checked = result["showNotification"] !== false;
        showNotification.addEventListener("change", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["showNotification"]: showNotification.checked });
            });
        });
    });
}
function setOpenProlific(openProlific) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield chrome.storage.sync.get("openProlific");
        openProlific.checked = result["openProlific"] === true;
        openProlific.addEventListener("change", function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield chrome.storage.sync.set({ ["openProlific"]: openProlific.checked });
            });
        });
    });
}
// ======================== AUTO-RESERVE CONTROLS ========================
function setupAutoReserve() {
    return __awaiter(this, void 0, void 0, function* () {
        const toggle = document.getElementById("autoReserve");
        if (!toggle)
            return;
        const result = yield chrome.storage.sync.get("autoReserveEnabled");
        toggle.checked = result["autoReserveEnabled"] !== false;
        toggle.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
            yield chrome.storage.sync.set({ ["autoReserveEnabled"]: toggle.checked });
            chrome.runtime.sendMessage({
                target: 'background',
                type: 'toggle-auto-reserve',
                data: { enabled: toggle.checked },
            });
        }));
    });
}
function setupForceCheck() {
    return __awaiter(this, void 0, void 0, function* () {
        const btn = document.getElementById("forceCheck");
        if (!btn)
            return;
        btn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
            btn.disabled = true;
            btn.textContent = "Checking...";
            try {
                chrome.runtime.sendMessage({
                    target: 'background',
                    type: 'force-check',
                });
            }
            catch (e) { }
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = "Force Check Now";
            }, 2000);
        }));
    });
}
// ======================== AI AUTO-SOLVER CONTROLS ========================
function setupAISettings() {
    return __awaiter(this, void 0, void 0, function* () {
        const aiEnabled = document.getElementById("aiEnabled");
        const aiShadowMode = document.getElementById("aiShadowMode");
        const aiSettingsGroup = document.getElementById("aiSettingsGroup");
        const aiApiKey = document.getElementById("aiApiKey");
        const aiBaseUrl = document.getElementById("aiBaseUrl");
        const aiModel = document.getElementById("aiModel");
        if (!aiEnabled || !aiShadowMode || !aiSettingsGroup || !aiApiKey || !aiBaseUrl || !aiModel)
            return;
        // Load saved settings
        const result = yield chrome.storage.sync.get(["aiEnabled", "aiShadowMode", "aiApiKey", "aiBaseUrl", "aiModel"]);
        aiEnabled.checked = result["aiEnabled"] === true;
        aiShadowMode.checked = result["aiShadowMode"] === true;
        aiSettingsGroup.style.display = aiEnabled.checked ? "block" : "none";
        if (result["aiApiKey"])
            aiApiKey.value = result["aiApiKey"];
        aiBaseUrl.value = result["aiBaseUrl"] || "https://api.openai.com/v1";
        if (result["aiModel"])
            aiModel.value = result["aiModel"];
        // Event listeners
        aiEnabled.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
            yield chrome.storage.sync.set({ ["aiEnabled"]: aiEnabled.checked });
            aiSettingsGroup.style.display = aiEnabled.checked ? "block" : "none";
        }));
        aiShadowMode.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
            yield chrome.storage.sync.set({ ["aiShadowMode"]: aiShadowMode.checked });
        }));
        aiApiKey.addEventListener("input", () => __awaiter(this, void 0, void 0, function* () {
            yield chrome.storage.sync.set({ ["aiApiKey"]: aiApiKey.value });
        }));
        aiBaseUrl.addEventListener("input", () => __awaiter(this, void 0, void 0, function* () {
            yield chrome.storage.sync.set({ ["aiBaseUrl"]: aiBaseUrl.value });
        }));
        aiModel.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
            yield chrome.storage.sync.set({ ["aiModel"]: aiModel.value });
        }));
    });
}
// ======================== HISTORY ========================
function loadHistory() {
    return __awaiter(this, void 0, void 0, function* () {
        const historyList = document.getElementById('historyList');
        if (!historyList)
            return;
        try {
            const result = yield chrome.storage.local.get('studyHistory');
            const history = result.studyHistory || [];
            if (history.length === 0) {
                historyList.innerHTML = '<div class="history-item">No reserved studies yet.</div>';
                return;
            }
            historyList.innerHTML = history.map((item) => {
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
                const title = item.title && item.title !== 'Unknown Study' ? item.title : `Study ${item.id.substring(0, 8)}...`;
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
        }
        catch (e) {
            historyList.innerHTML = '<div class="history-item">Error loading history</div>';
        }
    });
}
// ======================== LIVE STATUS ========================
function updateStatus() {
    const statusCard = document.getElementById("statusCard");
    const statusText = document.getElementById("statusText");
    const studyCount = document.getElementById("studyCount");
    const reservedCount = document.getElementById("reservedCount");
    const uptime = document.getElementById("uptime");
    if (!statusCard || !statusText)
        return;
    // Use a broader query to ensure we find the Prolific tab
    chrome.tabs.query({ url: "*://*.prolific.com/*" }, (tabs) => {
        if (chrome.runtime.lastError) {
            statusText.textContent = "Query Error: " + chrome.runtime.lastError.message;
            statusCard.classList.add("disconnected");
            return;
        }
        if (tabs.length === 0) {
            statusCard.classList.add("disconnected");
            statusText.textContent = "No Prolific tab open";
            return;
        }
        // Try the first available tab
        const targetTab = tabs[0];
        if (!targetTab.id)
            return;
        chrome.tabs.sendMessage(targetTab.id, {
            target: 'content-script',
            type: 'get-status',
        }, (response) => {
            if (chrome.runtime.lastError) {
                statusCard.classList.add("disconnected");
                const err = chrome.runtime.lastError.message || "";
                if (err.includes("Could not establish connection")) {
                    statusText.textContent = "Content Script missing (Refresh Prolific tab)";
                }
                else {
                    statusText.textContent = "Error: " + err.substring(0, 30);
                }
                return;
            }
            if (!response) {
                statusCard.classList.add("disconnected");
                statusText.textContent = "No response from page";
                return;
            }
            statusCard.classList.remove("disconnected");
            statusText.textContent = response.enabled ? "Active & Monitoring" : "Paused";
            if (studyCount)
                studyCount.textContent = (response.studyCount || 0).toString();
            if (reservedCount)
                reservedCount.textContent = (response.reservedCount || 0).toString();
            if (uptime)
                uptime.textContent = formatUptime(response.uptime || 0);
        });
    });
}
function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)
        return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}
// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', function () {
    return __awaiter(this, void 0, void 0, function* () {
        // Clear badge
        yield chrome.runtime.sendMessage({
            type: 'clear-badge',
            target: 'background',
        });
        // Setup tabs
        setupTabs();
        // Original settings
        const autoAudio = document.getElementById("autoAudio");
        const selectAudio = document.getElementById("selectAudio");
        const counter = document.getElementById("counter");
        const playAudioBtn = document.getElementById("playAudio");
        const showNotification = document.getElementById("showNotification");
        const volume = document.getElementById("volume");
        const openProlific = document.getElementById("openProlific");
        if (autoAudio)
            yield setAudioCheckbox(autoAudio);
        if (selectAudio)
            yield setAudioOption(selectAudio);
        if (counter)
            yield setCounter(counter);
        if (playAudioBtn)
            playAudioBtn.addEventListener("click", playAlert);
        if (showNotification)
            yield setShowNotification(showNotification);
        if (openProlific)
            yield setOpenProlific(openProlific);
        if (volume)
            yield setVolume(volume);
        // New auto-reserve controls
        yield setupAutoReserve();
        yield setupForceCheck();
        yield setupAISettings();
        // Live status updates
        updateStatus();
        setInterval(updateStatus, 3000);
        // Initial history load
        loadHistory();
    });
});
