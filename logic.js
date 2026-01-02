/**
 * ------------------------------------------------------------------
 * AUDIO ENGINE
 * ------------------------------------------------------------------
 */
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playBeep() {
        this.init();
        if (this.ctx.state === "suspended") this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }
};


/**
 * ------------------------------------------------------------------
 * READER FILE LOADER
 * ------------------------------------------------------------------
 */
const FileReaderUtil = {
    read(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject("Файл не выбран");

            // Лимит 2MB
            if (file.size > 2 * 1024 * 1024) return reject("Файл > 2MB");

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                // Проверяем, что текст не пустой
                if (text && text.trim().length > 0) resolve(text.trim());
                else reject("Файл пустой");
            };
            reader.onerror = () => reject("Ошибка чтения файла");
            reader.readAsText(file);
        });
    },
    countWords(text) {
        if (!text) return 0;
        // Считаем слова, игнорируя лишние пробелы
        return text.trim().split(/\s+/).length;
    }
};

/**
 * ------------------------------------------------------------------
 * POMODORO CONTROLLER (FIXED)
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
            interval: null
        };
    }

    init() {
        const saved = Store.loadPomodoroState();

        // Если есть сохраненное состояние и время еще не вышло
        if (saved && saved.timeLeft > 0) {
            this.state = { ...saved, interval: null };

            if (this.state.isRunning) {
                const now = Date.now();
                const diff = Math.floor((this.state.endTime - now) / 1000);

                if (diff <= 0) {
                    // Время вышло пока страницы не было, запускаем смену фазы
                    this.resetTimer(true); // true = не показывать уведомление повторно
                } else {
                    // Таймер еще идет, восстанавливаем
                    this.state.timeLeft = diff;
                    this.state.endTime = now + diff * 1000;
                    this.state.isRunning = true;
                    clearInterval(this.state.interval);
                    this.state.interval = setInterval(() => this.tick(), 1000);
                    UI.Timer.toggleControls(true);
                }
            } else {
                // Просто показываем оставшееся время (на паузе)
                UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
                UI.Timer.toggleControls(false);
            }
        } else {
            // Инициализация с настройками
            this.reset(false);
        }
    }

    getSettings() { return Store.data.pomodoro.settings; }

    start() {
        if (this.state.isRunning) return;
        this.state.isRunning = true;

        // Если таймер был на нуле, берем из настроек
        if (this.state.timeLeft <= 0) {
            this.state.timeLeft = this.state.isWorking ? this.getSettings().work * 60 : this.getSettings().short * 60;
        }

        this.state.endTime = Date.now() + this.state.timeLeft * 1000;

        // Увеличиваем сессии ТОЛЬКО при новом старте (не при восстановлении)
        if (!this.state.justRestored) {
            Store.updatePomodoroStats('totalSessions', 1);
            UI.Timer.updateStats();
        }
        this.state.justRestored = false; // Сбросить флаг

        clearInterval(this.state.interval);
        this.state.interval = setInterval(() => this.tick(), 1000);

        Store.savePomodoroState(this.state);
        UI.Timer.toggleControls(true);
    }

    pause() {
        if (!this.state.isRunning) {
            // Resume
            const pausedDuration = Math.floor((Date.now() - this.state.lastPauseTime) / 1000);
            if (pausedDuration > 0) {
                Store.updatePomodoroStats('totalPaused', pausedDuration);
                UI.Timer.updateStats();
            }

            this.state.isRunning = true;
            this.state.endTime = Date.now() + this.state.remainingPauseTime;
            this.state.remainingPauseTime = 0;

            clearInterval(this.state.interval);
            this.state.interval = setInterval(() => this.tick(), 1000);
            UI.Timer.toggleControls(true);
        } else {
            // Pause
            this.state.isRunning = false;
            this.state.lastPauseTime = Date.now();
            this.state.remainingPauseTime = this.state.endTime - Date.now();
            clearInterval(this.state.interval);
            UI.Timer.toggleControls(false);
        }
        Store.savePomodoroState(this.state);
    }

    reset(fullReset = true) {
        clearInterval(this.state.interval);
        this.state.isRunning = false;
        this.state.remainingPauseTime = 0;
        this.state.lastPauseTime = 0;
        this.state.justRestored = false;

        if (fullReset) {
            this.state.cycles = 0;
            this.state.isWorking = true;
        }

        const settings = this.getSettings();
        this.state.timeLeft = this.state.isWorking ? settings.work * 60 : settings.short * 60;
        this.state.endTime = Date.now() + this.state.timeLeft * 1000;

        UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
        UI.Timer.toggleControls(false);

        Store.savePomodoroState(this.state);
    }

    // isRecovery - если true, не спрашиваем разрешение, не показываем уведомление
    resetTimer(isRecovery = false) {
        clearInterval(this.state.interval);
        const settings = this.getSettings();
        const wasWorking = this.state.isWorking;

        if (wasWorking) {
            this.state.cycles++;
            this.state.isWorking = false;
            const isLong = this.state.cycles % settings.longCycle === 0;
            this.state.timeLeft = (isLong ? settings.long : settings.short) * 60;
            if (!isRecovery) this.sendNotification("Break Time!", isLong ? "Long Break" : "Short Break");
        } else {
            this.state.isWorking = true;
            this.state.timeLeft = settings.work * 60;
            if (!isRecovery) this.sendNotification("Work Time!", "Get back to it.");
        }

        this.state.isRunning = false; // Остановить, пока пользователь не нажмет Start
        this.state.endTime = Date.now() + this.state.timeLeft * 1000;

        if (!isRecovery) {
            AudioEngine.playBeep();
            UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
        }

        Store.savePomodoroState(this.state);

        // Обновить UI, если вкладка была неактивна
        UI.Timer.toggleControls(false);
    }

    tick() {
        if (!this.state.isRunning) return;

        const now = Date.now();
        let diff = Math.round((this.state.endTime - now) / 1000);
        if (diff < 0) diff = 0;

        if (diff !== this.state.timeLeft) {
            this.state.timeLeft = diff;

            if (this.state.isWorking) Store.updatePomodoroStats('totalWork', 1);
            else Store.updatePomodoroStats('totalBreak', 1);

            UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);

            // Сохраняем каждую секунду (безопасно для простоты)
            Store.savePomodoroState(this.state);
        }

        if (this.state.timeLeft <= 0) {
            this.resetTimer();
        }
    }

    sendNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body });
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
 * WHEEL CONTROLLER (Без изменений)
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
            { text: "Уборка", color: "#C084FC" },
        ];
        this.canvas = document.getElementById("wheelCanvas");
        if (this.canvas) this.ctx = this.canvas.getContext("2d");
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
        if (this.isSpinning) return Promise.resolve();
        this.isSpinning = true;

        const selectedIndex = Math.floor(Math.random() * this.activities.length);
        const result = this.activities[selectedIndex].text;

        Store.addToWheelHistory(result);

        const countEl = document.getElementById("wheelHistoryCount");
        if (countEl) countEl.textContent = Store.data.wheel.history.length;

        const resEl = document.getElementById("wheelResult");
        if (resEl) resEl.textContent = `🎉 ${result}`;

        const slice = (2 * Math.PI) / this.activities.length;
        const extraSpins = 5 * 2 * Math.PI;
        const targetRotation = extraSpins - (selectedIndex * slice + slice / 2);

        const startRotation = this.rotation;
        const duration = 4000;
        const startTime = performance.now();

        return new Promise((resolve) => {
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
                    AudioEngine.playBeep();
                    resolve(result);
                }
            };
            requestAnimationFrame(animate);
        });
    }
}

/**
 * ------------------------------------------------------------------
 * NOTIFICATION SCHEDULER (FIXED)
 * ------------------------------------------------------------------
 */
class NotificationScheduler {
    constructor() {
        this.checkInterval = null;
    }

    init() {
        // 1. Проверяем пропущенные при старте (разово)
        this.checkMissed();

        // 2. Запускаем цикл проверки (каждые 30 секунд)
        this.checkInterval = setInterval(() => this.check(), 30000);

        // 3. Первая быстрая проверка через 2 секунды (для старта)
        setTimeout(() => this.check(), 2000);
    }

    stop() {
        if (this.checkInterval) clearInterval(this.checkInterval);
    }

    // Проверяет, что случилось, пока страницы не было
    checkMissed() {
        if (!Store.data.notifications || Store.data.notifications.length === 0) return;

        const now = Date.now();
        const missed = Store.data.notifications.filter(n => n.nextTrigger <= now);

        if (missed.length > 0) {
            // Просто обновляем время, не показывая уведомления за прошлое
            missed.forEach(notif => {
                Store.updateNotificationTrigger(notif.id);
            });

            // Обновляем UI
            if (UI.renderNotificationsList) UI.renderNotificationsList();

            console.log(`Найдено ${missed.length} пропущенных уведомлений, время обновлено.`);
        }
    }

    // Регулярная проверка (работает в реальном времени)
    check() {
        if (!Store.data.notifications || Store.data.notifications.length === 0) return;

        const now = Date.now();
        const toTrigger = Store.data.notifications.filter(n => n.nextTrigger <= now);

        if (toTrigger.length > 0) {
            toTrigger.forEach(notif => {
                this.fire(notif);
                Store.updateNotificationTrigger(notif.id);
            });
            if (UI.renderNotificationsList) UI.renderNotificationsList();
        }
    }

    fire(notif) {
        if ("Notification" in window && Notification.permission === "granted") {
            const options = {
                body: `Интервал: ${notif.interval} мин.`,
                requireInteraction: true,
                tag: `notif-${notif.id}`
            };

            const notification = new Notification(notif.title, options);

            notification.onclick = () => {
                // Открываем новое окно
                const newWin = window.open(window.location.href, '_blank', 'width=500,height=800');
                if (newWin) try { newWin.focus(); } catch (e) { }

                // Помечаем как отвечено
                Store.markNotificationAsClicked(notif.id);

                // Обновляем UI
                if (UI.renderNotificationsList) UI.renderNotificationsList();

                UI.stopFlashTitle();
                notification.close();
            };

            if (notif.isImportant) {
                AudioEngine.playBeep();
                setTimeout(() => AudioEngine.playBeep(), 250);
                if (UI.flashTitle) UI.flashTitle("ВАЖНОЕ УВЕДОМЛЕНИЕ");
                window.focus();
            }
        }
    }
}