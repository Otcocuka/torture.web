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
        if (this.ctx.state === "suspended") this.ctx.resume();

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(
            440,
            this.ctx.currentTime + 0.1
        );

        gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
            0.001,
            this.ctx.currentTime + 0.1
        );

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start();
        oscillator.stop(this.ctx.currentTime + 0.15);
    },
};

/**
 * ------------------------------------------------------------------
 * POMODORO LOGIC
 * ------------------------------------------------------------------
 */
/**
 * ------------------------------------------------------------------
 * POMODORO LOGIC (Fixed)
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
            interval: null,
        };
    }

    init() {
        this.resetTimer(false);
    }

    getSettings() {
        return Store.data.pomodoro.settings;
    }

    start() {
        if (this.state.isRunning) return;
        this.state.isRunning = true;

        // Если есть время, оставшееся от паузы, используем его
        if (this.state.remainingPauseTime > 0) {
            this.state.endTime = Date.now() + this.state.remainingPauseTime;
            this.state.remainingPauseTime = 0;
        } else {
            // Если таймер был сброшен до 0, берем из настроек
            if (this.state.timeLeft <= 0) {
                this.state.timeLeft = this.state.isWorking
                    ? this.getSettings().work * 60
                    : this.getSettings().short * 60;
            }
            this.state.endTime = Date.now() + this.state.timeLeft * 1000;
        }

        Store.updatePomodoroStats("totalSessions", 1);
        UI.Timer.updateStats();

        // Очистка старого интервала на всякий случай
        clearInterval(this.state.interval);
        this.state.interval = setInterval(() => this.tick(), 1000);
        UI.Timer.toggleControls(true);
    }

    pause() {
        if (!this.state.isRunning) {
            // Resume logic
            const pausedDuration = Math.floor(
                (Date.now() - this.state.lastPauseTime) / 1000
            );
            if (pausedDuration > 0) {
                Store.updatePomodoroStats("totalPaused", pausedDuration);
                UI.Timer.updateStats();
            }

            this.state.isRunning = true;
            // Восстанавливаем endTime на основе оставшегося времени паузы
            this.state.endTime = Date.now() + this.state.remainingPauseTime;
            this.state.remainingPauseTime = 0;

            clearInterval(this.state.interval);
            this.state.interval = setInterval(() => this.tick(), 1000);
            UI.Timer.toggleControls(true);
        } else {
            // Pause logic
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
        this.state.lastPauseTime = 0;

        if (fullReset) {
            this.state.cycles = 0;
            this.state.isWorking = true;
        }

        // Сброс времени
        const settings = this.getSettings();
        this.state.timeLeft = this.state.isWorking
            ? settings.work * 60
            : settings.short * 60;
        this.state.endTime = Date.now() + this.state.timeLeft * 1000; // Важно!

        UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
        UI.Timer.toggleControls(false);
    }

    // ПЕРЕПИСАННАЯ ФУНКЦИЯ СМЕНЫ ФАЗЫ
    resetTimer() {
        const settings = this.getSettings();

        // Определяем, что было до этого
        const wasWorking = this.state.isWorking;

        if (wasWorking) {
            // Рабочий цикл закончился -> Начинаем паузу
            this.state.cycles++;
            this.state.isWorking = false;

            const isLong = this.state.cycles % settings.longCycle === 0;
            this.state.timeLeft = (isLong ? settings.long : settings.short) * 60;

            this.sendNotification(
                "Break Time!",
                isLong ? "Long Break" : "Short Break"
            );
        } else {
            // Пауза закончилась -> Начинаем работу
            this.state.isWorking = true;
            this.state.timeLeft = settings.work * 60;

            this.sendNotification("Work Time!", "Get back to it.");
        }

        // ОБНОВЛЯЕМ END TIME, ЧТОБЫ ТАЙМЕР СЧИТАЛ ПРАВИЛЬНО
        this.state.endTime = Date.now() + this.state.timeLeft * 1000;

        // Звук и UI
        AudioEngine.playBeep();
        UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
    }

    tick() {
        if (!this.state.isRunning) return;

        const now = Date.now();
        let diff = Math.round((this.state.endTime - now) / 1000);
        if (diff < 0) diff = 0;

        // Обновляем только если время изменилось, чтобы не дергать UI лишний раз
        if (diff !== this.state.timeLeft) {
            this.state.timeLeft = diff;

            // Обновляем статистику (раз в секунду)
            if (this.state.isWorking) Store.updatePomodoroStats("totalWork", 1);
            else Store.updatePomodoroStats("totalBreak", 1);

            UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
        }

        if (this.state.timeLeft <= 0) {
            // Смена фазы, обновление endTime и UI
            this.resetTimer();

            // Выходим, интервал продолжит работу (this.state.isRunning == true)
            return;
        }
    }

    sendNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, icon: "" });
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
 * WHEEL LOGIC (Updated for Reliability)
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

    // NEW: Spin returns a Promise that resolves when animation finishes
    // But CRITICAL: Data is saved immediately to Store
    spin() {
        if (this.isSpinning) return Promise.resolve(); // Already spinning
        this.isSpinning = true;

        // 1. Determine Result (Instantly)
        const selectedIndex = Math.floor(Math.random() * this.activities.length);
        const result = this.activities[selectedIndex].text;

        // 2. Save to Store (Instantly - guarantees data persistence)
        Store.addToWheelHistory(result);

        // Update UI counter immediately if on Wheel tab
        const countEl = document.getElementById("wheelHistoryCount");
        if (countEl) countEl.textContent = Store.data.wheel.history.length;

        // Show Result Text immediately
        const resEl = document.getElementById("wheelResult");
        if (resEl) resEl.textContent = `🎉 ${result}`;

        // 3. Visual Animation (Async, Non-blocking)
        // We use a custom animation loop that doesn't rely on Store logic
        const slice = (2 * Math.PI) / this.activities.length;
        const extraSpins = 5 * 2 * Math.PI;
        const targetRotation = extraSpins - (selectedIndex * slice + slice / 2);

        const startRotation = this.rotation;
        const duration = 4000;
        const startTime = performance.now();

        // Возвращаем Promise для внешнего использования (если нужно)
        return new Promise((resolve) => {
            const animate = (curr) => {
                const elapsed = curr - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

                this.rotation = startRotation + (targetRotation - startRotation) * ease;
                this.draw();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.isSpinning = false;
                    AudioEngine.playBeep();
                    resolve(result); // Animation finished
                }
            };
            requestAnimationFrame(animate);
        });
    }
}

/**
 * ------------------------------------------------------------------
 * NOTIFICATION SCHEDULER
 * ------------------------------------------------------------------
 */
class NotificationScheduler {
    constructor() {
        this.checkInterval = null;
    }

    init() {
        // Проверяем каждые 30 секунд
        this.checkInterval = setInterval(() => this.check(), 30000);
        // Первый запуск сразу (небольшая задержка)
        setTimeout(() => this.check(), 2000);
        console.log("Notification Scheduler Started");
    }

    stop() {
        if (this.checkInterval) clearInterval(this.checkInterval);
    }

    check() {
        if (!Store.data.notifications || Store.data.notifications.length === 0)
            return;

        const now = Date.now();
        const toTrigger = Store.data.notifications.filter(
            (n) => n.nextTrigger <= now
        );

        toTrigger.forEach((notif) => {
            // Срабатываем
            this.fire(notif);

            // Обновляем время следующего срабатывания
            Store.updateNotificationTrigger(notif.id);

            // Сбрасываем статус клика, так как это новое срабатывание
            // (или оставляем старый, если хотим историю)
            // Давайте сбросим для чистоты:
            const n = Store.data.notifications.find((x) => x.id === notif.id);
            if (n) {
                n.wasClicked = false;
                n.lastTrigger = now; // Обновляем время срабатывания
                Store.save();
            }
        });

        // Обновляем UI
        if (UI.renderNotificationsList) UI.renderNotificationsList();
    }

    fire(notif) {
        if ("Notification" in window && Notification.permission === "granted") {
            const options = {
                body: `Интервал: ${notif.interval} мин. Нажмите, чтобы открыть приложение.`,
                requireInteraction: true, // Не исчезает
                tag: `notif-${notif.id}` // Группировка
            };

            const notification = new Notification(notif.title, options);

            // ОБРАБОТЧИК КЛИКА: Открывает новое окно
            notification.onclick = () => {
                // 1. Открываем новое окно (или вкладку)
                // _blank может открыться как новая вкладка, зависит от браузера
                const newWin = window.open(window.location.href, '_blank', 'width=500,height=800');

                // 2. Пытаемся фокусировать (на случай, если это была вкладка)
                if (newWin) {
                    try { newWin.focus(); } catch (e) { }
                }

                // 3. Помечаем в базе как "отвечено"
                Store.markNotificationAsClicked(notif.id);

                // 4. Обновляем UI списка
                if (UI.renderNotificationsList) UI.renderNotificationsList();

                // 5. Останавливаем мигание заголовка
                UI.stopFlashTitle();

                // 6. Закрываем системное уведомление
                notification.close();
            };

            // Логика "Важно" (мигание и звук)
            if (notif.isImportant) {
                AudioEngine.playBeep();
                setTimeout(() => AudioEngine.playBeep(), 250);
                if (UI.flashTitle) UI.flashTitle("ВАЖНОЕ УВЕДОМЛЕНИЕ");

                // Пробуем фокус текущую вкладку (может не сработать, но попробуем)
                window.focus();
            }
        }
    }
}
