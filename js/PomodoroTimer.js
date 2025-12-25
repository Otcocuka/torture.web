import { TimeTracker } from './TimeTracker.js';

export class PomodoroTimer extends TimeTracker {
    constructor() {
        super({ storageKey: 'userStats', heartbeatInterval: 30000 });

        // Pomodoro data structure
        if (!this.user.pomodoro) {
            this.user.pomodoro = {
                settings: {
                    work: 25,
                    short: 5,
                    long: 15,
                    longCycle: 4
                },
                stats: {
                    totalSessions: 0,
                    totalWork: 0,
                    totalBreak: 0,
                    totalPaused: 0,
                    lastPauseTime: null
                }
            };
        }

        // Pomodoro state
        this.isWorking = true;
        this.isPomodoroRunning = false;
        this.timeLeft = 0;
        this.pomodoroInterval = null;
        this.cycles = 0;
        this.endTime = 0;
        this.remainingPauseTime = 0;
        this.lastSaveTime = Date.now();
        this.SAVE_INTERVAL = 30000;

        // Init
        this.bindDOMElements();
        this.loadSettingsToInputs();
        this.initPomodoroTimer();
        this.updatePomodoroDisplay();
        this.updateStatsDisplay();
        this.addEventListeners();

        // Start TimeTracker (app time tracking)
        super.start();

        // Subscribe to TimeTracker ticks
        this.onTick(() => this.updateStatsDisplay());
    }

    bindDOMElements() {
        this.timerDisplay = document.getElementById("timer");
        this.startBtn = document.getElementById("startBtn");
        this.pauseBtn = document.getElementById("pauseBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.workInput = document.getElementById("workTime");
        this.shortBreakInput = document.getElementById("shortBreak");
        this.longBreakInput = document.getElementById("longBreak");
        this.longCycleInput = document.getElementById("longCycle");
        this.resetStatsBtn = document.getElementById("resetStatsBtn");
        this.totalSessions = document.getElementById("totalSessions");
        this.totalWork = document.getElementById("totalWork");
        this.totalBreak = document.getElementById("totalBreak");
        this.totalPaused = document.getElementById("totalPaused");
    }

    loadSettingsToInputs() {
        const s = this.user.pomodoro.settings;
        if (this.workInput) this.workInput.value = s.work;
        if (this.shortBreakInput) this.shortBreakInput.value = s.short;
        if (this.longBreakInput) this.longBreakInput.value = s.long;
        if (this.longCycleInput) this.longCycleInput.value = s.longCycle || 4;
    }

    savePomodoroData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.user));
        } catch (e) { /* ignore */ }
    }

    updateSettings(type, value) {
        if (type === "longCycle") {
            const parsed = Math.max(1, parseInt(value) || 1);
            if (this.user.pomodoro.settings.longCycle !== parsed) {
                this.cycles = 0;
            }
            this.user.pomodoro.settings[type] = parsed;
            this.savePomodoroData();
            return;
        }

        const normalizedValue = String(value).replace(",", ".");
        const parsed = Math.max(0.1, parseFloat(normalizedValue) || 0.1);
        this.user.pomodoro.settings[type] = parsed;
        this.savePomodoroData();

        if (!this.isPomodoroRunning) {
            this.resetPomodoro();
        }
    }

    initPomodoroTimer() {
        this.timeLeft = Math.floor(this.user.pomodoro.settings.work * 60);
        this.isWorking = true;
        this.endTime = Date.now() + this.timeLeft * 1000;
    }

    startPomodoro() {
        if (this.isPomodoroRunning) return;
        
        this.isPomodoroRunning = true;
        if (this.remainingPauseTime) {
            this.endTime = Date.now() + this.remainingPauseTime;
            this.remainingPauseTime = 0;
        } else {
            this.endTime = Date.now() + this.timeLeft * 1000;
        }
        
        this.pomodoroInterval = setInterval(() => this.tick(), 1000);
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.pauseBtn.textContent = "Pause";
        
        this.user.pomodoro.stats.totalSessions++;
        this.savePomodoroData();
        this.updateStatsDisplay();
    }

    pausePomodoro() {
        if (this.isPomodoroRunning) {
            // Pause
            this.isPomodoroRunning = false;
            this.user.pomodoro.stats.lastPauseTime = Date.now();
            clearInterval(this.pomodoroInterval);
            this.remainingPauseTime = this.endTime - Date.now();
            this.pauseBtn.textContent = "Resume";
            this.startBtn.disabled = false;
        } else {
            // Resume
            const pausedDuration = Math.floor(
                (Date.now() - (this.user.pomodoro.stats.lastPauseTime || Date.now())) / 1000
            );
            this.user.pomodoro.stats.totalPaused += pausedDuration;
            
            this.isPomodoroRunning = true;
            this.endTime = Date.now() + this.remainingPauseTime;
            this.pomodoroInterval = setInterval(() => this.tick(), 1000);
            this.pauseBtn.textContent = "Pause";
            this.startBtn.disabled = true;
            this.remainingPauseTime = 0;
        }
        this.pauseBtn.disabled = false;
        this.savePomodoroData();
        this.updateStatsDisplay();
    }

    resetPomodoro() {
        clearInterval(this.pomodoroInterval);
        this.isPomodoroRunning = false;
        this.cycles = 0;
        this.remainingPauseTime = 0;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.pauseBtn.textContent = "Pause";
        this.initPomodoroTimer();
        this.updatePomodoroDisplay();
        this.savePomodoroData();
    }

    resetStats() {
        this.user.pomodoro.settings = { work: 25, short: 5, long: 15, longCycle: 4 };
        this.user.pomodoro.stats = {
            totalSessions: 0,
            totalWork: 0,
            totalBreak: 0,
            totalPaused: 0,
            lastPauseTime: null
        };
        this.loadSettingsToInputs();
        this.savePomodoroData();
        this.updateStatsDisplay();
        this.resetPomodoro();
    }

    tick() {
        let diff = Math.round((this.endTime - Date.now()) / 1000);
        if (diff < 0) diff = 0;
        this.timeLeft = diff;

        if (this.isWorking) {
            this.user.pomodoro.stats.totalWork++;
        } else {
            this.user.pomodoro.stats.totalBreak++;
        }

        // Periodic save
        if (Date.now() - this.lastSaveTime > this.SAVE_INTERVAL) {
            this.savePomodoroData();
            this.lastSaveTime = Date.now();
        }

        this.updateStatsDisplay();

        if (this.timeLeft <= 0) {
            this.nextPhase();
            return;
        }
        this.updatePomodoroDisplay();
    }

    nextPhase() {
        this.playSound();
        if (this.isWorking) {
            this.cycles++;
            this.isWorking = false;
            const shouldLongBreak = this.cycles % (this.user.pomodoro.settings.longCycle || 4) === 0;
            this.timeLeft = shouldLongBreak
                ? Math.floor(this.user.pomodoro.settings.long * 60)
                : Math.floor(this.user.pomodoro.settings.short * 60);
            this.sendNotification("Break Time!", "Your work session has ended.");
        } else {
            this.isWorking = true;
            this.timeLeft = Math.floor(this.user.pomodoro.settings.work * 60);
            this.sendNotification("Work Time!", "Your break has ended.");
        }

        this.endTime = Date.now() + this.timeLeft * 1000;
        this.updatePomodoroDisplay();
        this.savePomodoroData();
    }

    updatePomodoroDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = Math.floor(this.timeLeft % 60).toString().padStart(2, "0");

        if (this.timerDisplay) {
            this.timerDisplay.textContent = `${minutes}:${seconds}`;
        }

        document.body.className = this.isWorking
            ? "bg-red-100 min-h-screen flex items-center justify-center"
            : "bg-green-100 min-h-screen flex items-center justify-center";

        const workEl = document.querySelector("#work");
        const restEl = document.querySelector("#rest");
        
        if (workEl) workEl.className = this.isWorking ? "block absolute text-[180px]" : "hidden";
        if (restEl) restEl.className = this.isWorking ? "hidden" : "block absolute text-[180px]";
    }

    updateStatsDisplay() {
        const stats = this.user.pomodoro.stats;
        if (this.totalSessions) this.totalSessions.textContent = stats.totalSessions || 0;
        if (this.totalWork) this.totalWork.textContent = this.formatDuration(stats.totalWork || 0);
        if (this.totalBreak) this.totalBreak.textContent = this.formatDuration(stats.totalBreak || 0);
        if (this.totalPaused) this.totalPaused.textContent = this.formatDuration(stats.totalPaused || 0);
    }

    formatDuration(totalSeconds) {
        if (!totalSeconds) return "0 сек";
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];
        if (hours > 0) parts.push(`${hours} ч`);
        if (minutes > 0) parts.push(`${minutes} мин`);
        if (seconds > 0) parts.push(`${seconds} сек`);
        return parts.join(" ");
    }

    playSound() {
        const REPEAT_COUNT = 5;
        const REPEAT_INTERVAL = 200;
        let playCounter = 0;

        const playLoop = () => {
            if (playCounter >= REPEAT_COUNT) return;
            const audio = new Audio(
                "data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU="
            );
            audio.play();
            playCounter++;
            if (playCounter < REPEAT_COUNT) {
                setTimeout(playLoop, REPEAT_INTERVAL);
            }
        };
        playLoop();
    }

    sendNotification(title, body) {
        if (Notification.permission === "granted") {
            new Notification(title, { body, icon: "icon.png" });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(title, { body, icon: "icon.png" });
                }
            });
        }
    }

    exportData() {
        return {
            app: super.exportData(),
            pomodoro: this.user.pomodoro
        };
    }

    addEventListeners() {
        if (this.startBtn) this.startBtn.addEventListener("click", () => this.startPomodoro());
        if (this.pauseBtn) this.pauseBtn.addEventListener("click", () => this.pausePomodoro());
        if (this.resetBtn) this.resetBtn.addEventListener("click", () => this.resetPomodoro());
        if (this.resetStatsBtn) this.resetStatsBtn.addEventListener("click", () => this.resetStats());
        if (this.workInput) this.workInput.addEventListener("input", (e) => this.updateSettings("work", e.target.value));
        if (this.shortBreakInput) this.shortBreakInput.addEventListener("input", (e) => this.updateSettings("short", e.target.value));
        if (this.longBreakInput) this.longBreakInput.addEventListener("input", (e) => this.updateSettings("long", e.target.value));
        if (this.longCycleInput) this.longCycleInput.addEventListener("input", (e) => this.updateSettings("longCycle", e.target.value));
    }
}