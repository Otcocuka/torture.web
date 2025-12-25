// js/TimeTracker.js
// Базовый минимальный трекер времени приложения.
// - Считает totalAppTime (в секундах) на всех страницах,
// - Использует простой лидер через localStorage: activeTabId + activeTabHeartbeat
// - Heartbeat сохраняет каждые HEARTBEAT_INTERVAL миллисекунд (по умолчанию 30s)
// - Обрабатывается beforeunload для финального сохранения
// - Минимальная sleep-детекция: пропускаем очень большие дельты (> SLEEP_THRESHOLD)
// API:
//   constructor(options)
//   start()
//   stop()
//   getTotalAppTime() -> seconds
//   exportData() -> { totalAppTime, sessionsCount, firstSessionDate }
//   onTick(callback) // опционально: уведомление каждое HEARTBEAT_INTERVAL
// Примечание: хранилище — localStorage под ключом 'userStats' (JSON). Можно заменить на другой key.

export class TimeTracker {
    constructor(options = {}) {
        this.STORAGE_KEY = options.storageKey || 'userStats';
        this.HEARTBEAT_INTERVAL = options.heartbeatInterval || 30000; // ms (30s)
        this.HEARTBEAT_STALE = options.heartbeatStale || 35000; // ms (leader considered dead)
        this.SLEEP_THRESHOLD = options.sleepThreshold || 5 * 60 * 1000; // ms (5min)
        this.tabId = this._generateId();
        this.isLeader = false;
        this.heartbeatTimer = null;
        this.sessionStart = null;
        this.lastHeartbeatLocal = null; // local timestamp of last heartbeat we wrote
        this.onTickCallbacks = [];

        // load or init user stats
        this.user = this._loadUser() || {
            stats: {
                totalAppTime: 0, // seconds
                sessionsCount: 0,
                firstSessionDate: null,
                lastHeartbeat: null // timestamp millis, for cross-check
            },
            settings: {}
        };

        // bind storage event to detect leader changes
        window.addEventListener('storage', (e) => this._onStorage(e));
        window.addEventListener('beforeunload', () => this._beforeUnload());
    }

    start() {
        if (this.sessionStart) return; // already started
        this.sessionStart = Date.now();
        if (!this.user.stats.firstSessionDate) {
            this.user.stats.firstSessionDate = new Date().toISOString();
        }
        this.user.stats.sessionsCount = (this.user.stats.sessionsCount || 0) + 1;

        // Attempt leader capture immediately
        this._tryClaimLeadership();

        // Heartbeat loop (will attempt to maintain leadership)
        this.heartbeatTimer = setInterval(() => this._heartbeatLoop(), this.HEARTBEAT_INTERVAL);

        // Immediate heartbeat to reduce race window
        this._heartbeatLoop();
    }

    stop() {
        if (!this.sessionStart) return;
        // compute session delta and add to totalAppTime if we are/were leader
        const now = Date.now();
        if (this.isLeader) {
            const deltaMs = now - this.sessionStart;
            const deltaSec = Math.max(0, Math.floor(deltaMs / 1000));
            this.user.stats.totalAppTime = (this.user.stats.totalAppTime || 0) + deltaSec;
        }
        this.sessionStart = null;

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        // if leader, clear activeTabId so others can take over
        const payload = this._readLeaderPayload();
        if (payload && payload.activeTabId === this.tabId) {
            try {
                localStorage.removeItem('activeTab'); // simple cleanup
            } catch (e) {
                // ignore
            }
        }

        this._saveUser();
        this.isLeader = false;
    }

    getTotalAppTime() {
        return this.user.stats.totalAppTime || 0;
    }

    exportData() {
        return {
            totalAppTime: this.user.stats.totalAppTime || 0,
            sessionsCount: this.user.stats.sessionsCount || 0,
            firstSessionDate: this.user.stats.firstSessionDate || null
        };
    }

    onTick(cb) {
        if (typeof cb === 'function') this.onTickCallbacks.push(cb);
    }

    // ---- internal ----

    _heartbeatLoop() {
        const now = Date.now();
        const leader = this._readLeaderPayload();

        if (!leader || (now - leader.heartbeat) > this.HEARTBEAT_STALE) {
            // claim leadership
            this._writeLeaderPayload({ activeTabId: this.tabId, heartbeat: now });
            this.isLeader = true;
        } else if (leader.activeTabId === this.tabId) {
            // I'm leader, update heartbeat and accumulate time since last heartbeat
            const last = this.lastHeartbeatLocal || this.sessionStart || now;
            const delta = now - last;

            // sleep/hiccup detection
            if (delta > this.SLEEP_THRESHOLD) {
                // big jump (likely system sleep). Count only nominal HEARTBEAT_INTERVAL to be safe.
                const nominalSec = Math.floor(this.HEARTBEAT_INTERVAL / 1000);
                this.user.stats.totalAppTime = (this.user.stats.totalAppTime || 0) + nominalSec;
            } else {
                this.user.stats.totalAppTime = (this.user.stats.totalAppTime || 0) + Math.floor(delta / 1000);
            }

            this.lastHeartbeatLocal = now;
            this._writeLeaderPayload({ activeTabId: this.tabId, heartbeat: now });
            this.user.stats.lastHeartbeat = now;
            this._saveUser();
            this._fireTick();
        } else {
            // someone else is leader — do not count
            this.isLeader = false;
            // update user.lastHeartbeat from leader for visibility
            this.user.stats.lastHeartbeat = leader.heartbeat;
            // still notify onTick so UI can update if needed
            this._fireTick();
        }
    }

    _tryClaimLeadership() {
        const now = Date.now();
        const leader = this._readLeaderPayload();
        if (!leader || (now - leader.heartbeat) > this.HEARTBEAT_STALE) {
            this._writeLeaderPayload({ activeTabId: this.tabId, heartbeat: now });
            this.isLeader = true;
            this.lastHeartbeatLocal = now;
        } else {
            this.isLeader = leader.activeTabId === this.tabId;
        }
    }

    _onStorage(e) {
        // react to external leader changes
        if (e.key === 'activeTab') {
            // other tab changed leadership; we'll react on next heartbeat loop
            // optional: immediate update
            // no heavy logic here to keep implementation simple
        } else if (e.key === this.STORAGE_KEY) {
            // external change to user stats — reload so UI stays in sync
            const ext = this._loadUser();
            if (ext) this.user = ext;
            this._fireTick();
        }
    }

    _beforeUnload() {
        // finalize current session if leader
        if (this.isLeader && this.sessionStart) {
            const now = Date.now();
            const deltaMs = now - this.sessionStart;
            const deltaSec = Math.max(0, Math.floor(deltaMs / 1000));
            this.user.stats.totalAppTime = (this.user.stats.totalAppTime || 0) + deltaSec;
        }
        this._saveUser();

        // If we are leader — remove activeTab so others can claim immediately
        const leader = this._readLeaderPayload();
        if (leader && leader.activeTabId === this.tabId) {
            try {
                localStorage.removeItem('activeTab');
            } catch (e) {
                // ignore
            }
        }
    }

    _readLeaderPayload() {
        try {
            const raw = localStorage.getItem('activeTab');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    _writeLeaderPayload(payload) {
        try {
            localStorage.setItem('activeTab', JSON.stringify(payload));
        } catch (e) {
            // ignore storage errors
        }
    }

    _loadUser() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    _saveUser() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.user));
        } catch (e) {
            // ignore
        }
    }

    _generateId() {
        // small random id
        return 't_' + Math.random().toString(36).slice(2, 9);
    }

    _fireTick() {
        for (const cb of this.onTickCallbacks) {
            try { cb(this.exportData()); } catch (e) { /*ignore*/ }
        }
    }
}