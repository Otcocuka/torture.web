/**
 * ------------------------------------------------------------------
 * AUDIO ENGINE (Web Audio API - No External Files)
 * ------------------------------------------------------------------
 */
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playBeep() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start();
        oscillator.stop(this.ctx.currentTime + 0.15);
    }
};

/**
 * ------------------------------------------------------------------
 * POMODORO LOGIC
 * ------------------------------------------------------------------
 */
class PomodoroController {
    constructor() {
        this.state = {
            isRunning: false,
            isWorking: true,
            timeLeft: 0,
            cycles: 0,
            endTime: 0,
            remainingPauseTime: 0,
            lastPauseTime: 0,
            interval: null
        };
    }

    init() {
        this.resetTimer(false);
    }

    getSettings() { return Store.data.pomodoro.settings; }

    start() {
        if (this.state.isRunning) return;
        this.state.isRunning = true;

        if (this.state.remainingPauseTime > 0) {
            this.state.endTime = Date.now() + this.state.remainingPauseTime;
            this.state.remainingPauseTime = 0;
        } else {
            this.state.endTime = Date.now() + this.state.timeLeft * 1000;
        }

        Store.updatePomodoroStats('totalSessions', 1);
        UI.Timer.updateStats();

        this.state.interval = setInterval(() => this.tick(), 1000);
        UI.Timer.toggleControls(true);
    }

    pause() {
        if (!this.state.isRunning) {
            const pausedDuration = Math.floor((Date.now() - this.state.lastPauseTime) / 1000);
            Store.updatePomodoroStats('totalPaused', pausedDuration);
            UI.Timer.updateStats();

            this.state.isRunning = true;
            this.state.endTime = Date.now() + this.state.remainingPauseTime;
            this.state.interval = setInterval(() => this.tick(), 1000);
            UI.Timer.toggleControls(true);
        } else {
            this.state.isRunning = false;
            this.state.lastPauseTime = Date.now();
            this.state.remainingPauseTime = this.state.endTime - Date.now();
            clearInterval(this.state.interval);
            UI.Timer.toggleControls(false);
        }
    }

    reset(fullReset = true) {
        clearInterval(this.state.interval);
        this.state.isRunning = false;
        this.state.remainingPauseTime = 0;
        if (fullReset) {
            this.state.cycles = 0;
            this.state.isWorking = true;
        }
        this.resetTimer(false);
        UI.Timer.toggleControls(false);
    }

    resetTimer(keepState = true) {
        const settings = this.getSettings();
        if (!keepState) {
            this.state.timeLeft = this.state.isWorking ? settings.work * 60 : settings.short * 60;
        } else {
            if (this.state.isWorking) {
                this.state.cycles++;
                this.state.isWorking = false;
                const isLong = this.state.cycles % settings.longCycle === 0;
                this.state.timeLeft = (isLong ? settings.long : settings.short) * 60;
                this.sendNotification("Break Time!", isLong ? "Long Break" : "Short Break");
            } else {
                this.state.isWorking = true;
                this.state.timeLeft = settings.work * 60;
                this.sendNotification("Work Time!", "Get back to it.");
            }
        }
        AudioEngine.playBeep();
        UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
    }

    tick() {
        const now = Date.now();
        let diff = Math.round((this.state.endTime - now) / 1000);
        if (diff < 0) diff = 0;
        this.state.timeLeft = diff;

        if (this.state.isWorking) Store.updatePomodoroStats('totalWork', 1);
        else Store.updatePomodoroStats('totalBreak', 1);

        UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);

        if (this.state.timeLeft <= 0) {
            this.resetTimer(true);
        }
    }

    sendNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, icon: '' });
        }
    }

    requestNotificationPermission() {
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }
}

/**
 * ------------------------------------------------------------------
 * WHEEL LOGIC
 * ------------------------------------------------------------------
 */
class WheelController {
    constructor() {
        this.isSpinning = false;
        this.rotation = 0;
        this.activities = [
            { text: "1 мин. зарядки", color: "#60A5FA" },
            { text: "Любимая песня", color: "#34D399" },
            { text: "Обнять подушку", color: "#FBBF24" },
            { text: "Стакан воды", color: "#F87171" },
            { text: "Растяжка", color: "#A78BFA" },
            { text: "Дыхание 1 мин", color: "#F472B6" },
            { text: "Успех", color: "#4ADE80" },
            { text: "Нюхать", color: "#86EFAC" },
            { text: "Окно", color: "#60A5FA" },
            { text: "Уборка", color: "#C084FC" }
        ];
        this.canvas = document.getElementById('wheelCanvas');
        this.ctx = this.canvas.getContext('2d');
    }

    draw() {
        if (!this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = cx - 10;
        const slice = (2 * Math.PI) / this.activities.length;

        this.ctx.clearRect(0, 0, w, h);

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.rotation);
        this.ctx.translate(-cx, -cy);

        this.activities.forEach((act, i) => {
            const start = i * slice;
            const end = start + slice;

            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.arc(cx, cy, r, start, end);
            this.ctx.closePath();
            this.ctx.fillStyle = act.color;
            this.ctx.fill();
            this.ctx.strokeStyle = "white";
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Text
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(start + slice / 2);
            this.ctx.textAlign = "right";
            this.ctx.fillStyle = "white";
            this.ctx.font = "bold 11px Arial";
            this.ctx.fillText(act.text, r - 8, 4);
            this.ctx.restore();
        });

        this.ctx.restore();
    }

    spin() {
        if (this.isSpinning) return;
        this.isSpinning = true;

        const selectedIndex = Math.floor(Math.random() * this.activities.length);
        const slice = (2 * Math.PI) / this.activities.length;
        const extraSpins = 5 * 2 * Math.PI;
        const targetRotation = extraSpins - (selectedIndex * slice + slice / 2);

        const startRotation = this.rotation;
        const duration = 4000;
        const startTime = performance.now();

        const animate = (curr) => {
            const elapsed = curr - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            this.rotation = startRotation + (targetRotation - startRotation) * ease;
            this.draw();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isSpinning = false;
                const result = this.activities[selectedIndex].text;
                const resEl = document.getElementById('wheelResult');
                if (resEl) resEl.textContent = `🎉 ${result}`;
                Store.addToWheelHistory(result);
                const countEl = document.getElementById('wheelHistoryCount');
                if (countEl) countEl.textContent = Store.data.wheel.history.length;
            }
        };
        requestAnimationFrame(animate);
    }
}