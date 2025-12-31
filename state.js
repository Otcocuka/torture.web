/**
 * ------------------------------------------------------------------
 * UNIFIED DATA STORE
 * ------------------------------------------------------------------
 */
const Store = {
    key: 'torture2_data_v1',
    data: {
        habits: [],
        achievements: [],
        habitSettings: { goal: 5, color: 'blue' },
        tempSubtasks: [],
        pomodoro: {
            stats: { totalSessions: 0, totalWork: 0, totalBreak: 0, totalPaused: 0 },
            settings: { work: 25, short: 5, long: 15, longCycle: 4 }
        },
        wheel: { history: [] }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Аккуратное слияние структур
                this.data.habits = parsed.habits || [];
                this.data.achievements = parsed.achievements || [];
                this.data.habitSettings = { ...this.data.habitSettings, ...parsed.habitSettings };
                this.data.tempSubtasks = parsed.tempSubtasks || [];
                this.data.pomodoro.stats = { ...this.data.pomodoro.stats, ...parsed.pomodoro?.stats };
                this.data.pomodoro.settings = { ...this.data.pomodoro.settings, ...parsed.pomodoro?.settings };
                this.data.wheel.history = parsed.wheel?.history || [];

                console.log("Данные загружены из LocalStorage.");
                return true;
            } else {
                console.log("LocalStorage пуст.");
                return false;
            }
        } catch (e) {
            console.error("Ошибка загрузки:", e);
            alert("Критическая ошибка загрузки: " + e.message);
            return false;
        }
    },

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.error("Ошибка сохранения:", e);
            alert("Не удалось сохранить данные! Возможно, место в браузере кончилось или режим Инкогнито.");
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
            history: []
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
            this.save();
            return true;
        }
        this.save();
        return false;
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

    // --- WHEEL ---
    addToWheelHistory(activity) {
        this.data.wheel.history.push({ activity, date: new Date().toISOString() });
        this.save();
    }
};