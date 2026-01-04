/**
 * ------------------------------------------------------------------
 * UNIFIED DATA STORE
 * ------------------------------------------------------------------
 */
const Store = {
    key: "torture2_data_v1",
    data: {
        habits: [],
        achievements: [],
        habitSettings: { goal: 5, color: "blue" },
        tempSubtasks: [],
        pomodoro: {
            stats: { totalSessions: 0, totalWork: 0, totalBreak: 0, totalPaused: 0 },
            settings: { work: 25, short: 5, long: 15, longCycle: 4 },
        },
        pomodoroState: null,
        wheel: { history: [] },
        appStats: { totalUptime: 0, lastSeen: Date.now() },
        kanban: { columns: [], cards: [] },
        notifications: [],
        reader: {
            activeFileId: null,
            files: [],
            settings: { fontSize: 20, theme: 'dark' }
        },
        chat: {
            messages: [],
            isTyping: false
        },
    },

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);

                // Merge basics
                this.data.habits = parsed.habits || [];
                this.data.achievements = parsed.achievements || [];
                this.data.habitSettings = { ...this.data.habitSettings, ...parsed.habitSettings };
                this.data.tempSubtasks = parsed.tempSubtasks || [];

                // Merge Pomodoro
                if (parsed.pomodoro) {
                    this.data.pomodoro.stats = { ...this.data.pomodoro.stats, ...parsed.pomodoro.stats };
                    this.data.pomodoro.settings = { ...this.data.pomodoro.settings, ...parsed.pomodoro.settings };
                }
                this.data.pomodoroState = parsed.pomodoroState || null;

                // Merge Wheel
                this.data.wheel.history = parsed.wheel?.history || [];

                // Merge Kanban
                if (parsed.kanban) {
                    this.data.kanban = parsed.kanban;
                } else {
                    this.data.kanban = { columns: [], cards: [] };
                }

                // Merge Notifications
                this.data.notifications = parsed.notifications || [];

                // Merge Reader (CRITICAL: Preserve old data if structure matches)
                if (parsed.reader) {
                    this.data.reader.activeFileId = parsed.reader.activeFileId || null;
                    this.data.reader.files = parsed.reader.files || [];
                    this.data.reader.settings = { ...this.data.reader.settings, ...parsed.reader.settings };
                }

                // Merge Chat
                if (parsed.chat) {
                    this.data.chat.messages = parsed.chat.messages || [];
                    this.data.chat.isTyping = false;
                }

                // App Stats
                if (!parsed.appStats) {
                    this.data.appStats = { totalUptime: 0, lastSeen: Date.now() };
                } else {
                    this.data.appStats = { totalUptime: 0, ...parsed.appStats };
                    this.data.appStats.lastSeen = Date.now();
                }
                return true;
            }
            return false;
        } catch (e) {
            console.error("Ошибка загрузки:", e);
            return false;
        }
    },

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.error("Ошибка сохранения:", e);
        }
    },

    // --- HABITS ---
    addHabit(name) {
        this.data.habits.push({
            id: Date.now(),
            name,
            count: 0,
            goal: this.data.habitSettings.goal,
            color: this.data.habitSettings.color,
            subtasks: this.data.tempSubtasks.map(st => ({ ...st, dates: [] })),
            history: [],
        });
        this.data.tempSubtasks = [];
        this.save();
    },
    deleteHabit(id) {
        this.data.habits = this.data.habits.filter(h => h.id !== id);
        this.save();
    },
    incrementHabit(id) {
        const habit = this.data.habits.find(h => h.id === id);
        if (!habit) return;
        habit.count++;
        const today = new Date().toISOString().split('T')[0];
        const completedIds = habit.subtasks.filter(st => st.completed).map(st => st.id);
        habit.history.push({ date: today, subtasks: completedIds });
        habit.subtasks.forEach(st => {
            if (st.completed) {
                st.dates = st.dates || [];
                st.dates.push(today);
                st.completed = false;
            }
        });
        if (habit.count >= habit.goal && !this.data.achievements.some(a => a.name === habit.name)) {
            this.data.achievements.push({ name: habit.name, goal: habit.goal, date: today });
        }
        this.save();
    },
    toggleSubtask(habitId, subtaskId, status) {
        const habit = this.data.habits.find(h => h.id === habitId);
        if (habit) {
            const st = habit.subtasks.find(s => s.id === subtaskId);
            if (st) st.completed = status;
            this.save();
        }
    },

    // --- POMODORO ---
    updatePomodoroSettings(settings) {
        this.data.pomodoro.settings = { ...this.data.pomodoro.settings, ...settings };
        this.save();
    },
    updatePomodoroStats(type, value) {
        this.data.pomodoro.stats[type] += value;
        this.save();
    },
    resetPomodoroStats() {
        this.data.pomodoro.stats = { totalSessions: 0, totalWork: 0, totalBreak: 0, totalPaused: 0 };
        this.save();
    },
    savePomodoroState(state) {
        this.data.pomodoroState = { ...state, interval: null };
        this.save();
    },
    clearPomodoroState() {
        this.data.pomodoroState = null;
        this.save();
    },

    // --- WHEEL ---
    addToWheelHistory(activity) {
        this.data.wheel.history.push({ activity, date: new Date().toISOString() });
        this.save();
    },

    // --- APP STATS ---
    updateAppUptime(seconds) {
        if (!this.data.appStats) this.data.appStats = { totalUptime: 0, lastSeen: Date.now() };
        this.data.appStats.totalUptime += seconds;
        this.data.appStats.lastSeen = Date.now();
    },
    getAppUptime() {
        return this.data.appStats?.totalUptime || 0;
    },

    // --- KANBAN ---
    addKanbanColumn(title) {
        this.data.kanban.columns.push({ id: Date.now(), title });
        this.save();
    },
    addKanbanCard(columnId, title, description) {
        this.data.kanban.cards.push({ id: Date.now(), columnId: parseInt(columnId), title, description });
        this.save();
    },
    moveKanbanCard(cardId, newColumnId) {
        const card = this.data.kanban.cards.find(c => c.id === cardId);
        if (card) {
            card.columnId = newColumnId;
            this.save();
        }
    },
    deleteKanbanColumn(columnId) {
        this.data.kanban.columns = this.data.kanban.columns.filter(c => c.id !== columnId);
        this.data.kanban.cards = this.data.kanban.cards.filter(c => c.columnId !== columnId);
        this.save();
    },
    deleteKanbanCard(cardId) {
        this.data.kanban.cards = this.data.kanban.cards.filter(c => c.id !== cardId);
        this.save();
    },

    // --- NOTIFICATIONS ---
    addNotification(title, interval, isImportant) {
        const notif = {
            id: Date.now(),
            title,
            interval: parseInt(interval),
            isImportant: !!isImportant,
            lastTrigger: Date.now(),
            nextTrigger: Date.now() + parseInt(interval) * 60000,
            wasClicked: false
        };
        this.data.notifications.push(notif);
        this.save();
        return notif;
    },
    deleteNotification(id) {
        this.data.notifications = this.data.notifications.filter(n => n.id !== id);
        this.save();
    },
    updateNotificationTrigger(id) {
        const notif = this.data.notifications.find(n => n.id === id);
        if (notif) {
            notif.lastTrigger = Date.now();
            notif.nextTrigger = Date.now() + notif.interval * 60000;
            notif.wasClicked = false;
            this.save();
        }
    },
    markNotificationAsClicked(id) {
        const notif = this.data.notifications.find(n => n.id === id);
        if (notif) {
            notif.wasClicked = true;
            this.save();
        }
    },

    // --- READER ---
    getActiveFile() {
        if (!this.data.reader.activeFileId) return null;
        return this.data.reader.files.find(f => f.id === this.data.reader.activeFileId) || null;
    },
    addReaderFile(name, content) {
        const id = Date.now() + Math.random();
        this.data.reader.files.push({
            id,
            name,
            content,
            progress: { scrollTop: 0 },
            stats: { totalTime: 0, totalSessions: 0, sessionsHistory: [] }
        });
        this.save();
        return id;
    },
    getReaderFiles() {
        return this.data.reader.files;
    },
    setActiveFile(id) {
        if (this.data.reader.files.some(f => f.id === id)) {
            this.data.reader.activeFileId = id;
            this.save();
        }
    },
    clearActiveFile() {
        this.data.reader.activeFileId = null;
        this.save();
    },
    deleteReaderFile(id) {
        this.data.reader.files = this.data.reader.files.filter(f => f.id !== id);
        if (this.data.reader.activeFileId === id) this.data.reader.activeFileId = null;
        this.save();
    },
    updateReaderFileProgress(id, scrollTop) {
        const file = this.data.reader.files.find(f => f.id === id);
        if (file) {
            file.progress.scrollTop = scrollTop;
            this.save();
        }
    },
    addReaderSessionToFile(id, timeSeconds, wordsCount) {
        const file = this.data.reader.files.find(f => f.id === id);
        if (file) {
            file.stats.totalSessions++;
            file.stats.totalTime += timeSeconds;
            file.stats.sessionsHistory.push({
                date: new Date().toISOString(),
                time: timeSeconds,
                words: wordsCount
            });
            this.save();
        }
    },
    updateReaderSettings(settings) {
        this.data.reader.settings = { ...this.data.reader.settings, ...settings };
        this.save();
    },

    // --- CHAT ---
    addChatMessage(role, content) {
        this.data.chat.messages.push({
            id: Date.now(),
            role,
            content,
            timestamp: new Date().toLocaleTimeString()
        });
        this.save();
    },
    clearChatHistory() {
        this.data.chat.messages = [];
        this.save();
    },
    getChatMessages() {
        return this.data.chat.messages;
    }
};