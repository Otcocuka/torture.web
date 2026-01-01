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
        pomodoroState: null, // {isRunning, isWorking, timeLeft, cycles, endTime}
        wheel: { history: [] },
        appStats: { totalUptime: 0, lastSeen: Date.now() },
        kanban: { columns: [], cards: [] },
        notifications: [],
    },

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);

                this.data.habits = parsed.habits || [];
                this.data.achievements = parsed.achievements || [];
                this.data.habitSettings = { ...this.data.habitSettings, ...parsed.habitSettings };
                this.data.tempSubtasks = parsed.tempSubtasks || [];

                if (parsed.pomodoro) {
                    this.data.pomodoro.stats = { ...this.data.pomodoro.stats, ...parsed.pomodoro.stats };
                    this.data.pomodoro.settings = { ...this.data.pomodoro.settings, ...parsed.pomodoro.settings };
                }
                
                // Восстановление состояния таймера
                this.data.pomodoroState = parsed.pomodoroState || null;

                this.data.wheel.history = parsed.wheel?.history || [];
                
                // Kanban
                if (parsed.kanban) {
                    this.data.kanban = parsed.kanban;
                } else {
                    this.data.kanban = { columns: [], cards: [] };
                }

                // Notifications
                this.data.notifications = parsed.notifications || [];

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
    }
};