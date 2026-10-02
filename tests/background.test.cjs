const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function worker(local = {}, sync = { audioActive: false, showNotification: false }) {
    const listeners = {};
    const alarms = new Map();
    const event = name => ({ addListener: callback => { listeners[name] = callback; } });
    const storage = data => ({
        get: (key, callback) => {
            const value = structuredClone(typeof key === 'string' ? { [key]: data[key] } : data);
            if (callback) callback(value);
            return Promise.resolve(value);
        },
        set: async value => Object.assign(data, structuredClone(value)),
    });
    const context = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout: () => 1,
        clearTimeout() {},
        self: { addEventListener() {} },
        chrome: {
            storage: { local: storage(local), sync: storage(sync), onChanged: event('storage') },
            runtime: { onMessage: event('message'), onInstalled: event('install'), onStartup: event('startup'), getURL: path => path },
            notifications: { onClicked: event('click'), onButtonClicked: event('button'), create: async () => 'notification', clear: async () => true },
            alarms: { onAlarm: event('alarm'), create: async (name, options) => alarms.set(name, options), clear: async name => alarms.delete(name) },
            tabs: { onUpdated: event('tab'), query: async () => [], create: async () => ({}), sendMessage: async () => ({}) },
            action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
        },
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('dist/background.js', 'utf8'), context);
    return { context, local, sync, alarms, listeners };
}

test('history appends to the same local storage read by the popup', async () => {
    const state = worker({ studyHistory: [{ id: 'existing', timestamp: 1 }] });
    await state.context.addToHistory({ id: 'new', status: 'detected' });
    assert.deepEqual(state.local.studyHistory.map(entry => entry.id), ['new', 'existing']);
});

test('simultaneous notifications preserve both history records', async () => {
    const state = worker();
    await Promise.all([state.context.addToHistory({ id: 'a' }), state.context.addToHistory({ id: 'b' })]);
    assert.deepEqual(state.local.studyHistory.map(entry => entry.id), ['b', 'a']);
});

test('one reserved message produces one reserved history record', async () => {
    const state = worker();
    state.listeners.message({ target: 'background', type: 'study-reserved', data: { id: 'a', count: 1 } }, {}, () => {});
    await new Promise(setImmediate);
    assert.equal(state.local.studyHistory.length, 1);
    assert.equal(state.local.studyHistory[0].status, 'reserved');
});

test('completion code update preserves earlier local history', async () => {
    const state = worker({ studyHistory: [{ id: 'a', timestamp: Date.now(), completionCode: null }] });
    await state.context.updateHistoryWithCode('CODE', 'https://example.test');
    assert.equal(state.local.studyHistory[0].completionCode, 'CODE');
});

test('rate-limit pause survives a new worker instance and expires via an alarm', async () => {
    const state = worker();
    state.listeners.message({ target: 'background', type: 'rate-limit-detected' }, {}, () => {});
    await new Promise(setImmediate);
    assert.equal(state.sync.autoReserveEnabled, false);
    assert.ok(state.local.prolificCooldownUntil > Date.now());
    const resumed = worker(state.local, state.sync);
    await resumed.context.setupAlarms();
    assert.equal(resumed.alarms.has('prolific-api-poll'), false);
    assert.equal(resumed.alarms.get('prolific-cooldown-expired').when, state.local.prolificCooldownUntil);
    resumed.local.prolificCooldownUntil = Date.now() - 1;
    await resumed.listeners.alarm({ name: 'prolific-cooldown-expired' });
    assert.equal(resumed.alarms.has('prolific-api-poll'), true);
    assert.equal(state.sync.autoReserveEnabled, false);
});

test('sound notifications declare the required offscreen permission', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    assert.ok(manifest.permissions.includes('offscreen'));
});
