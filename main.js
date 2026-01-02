/**
 * ------------------------------------------------------------------
 * APP UPTIME TRACKER (Global)
 * ------------------------------------------------------------------
 */
const AppTracker = {
    startTime: Date.now(),
    interval: null,

    init() {
        this.startTime = Date.now();
        this.interval = setInterval(() => this.tick(), 5000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.tick(true);
            } else {
                this.startTime = Date.now();
            }
        });

        window.addEventListener('beforeunload', () => {
            this.tick(true);
        });
    },

    tick(forced = false) {
        const now = Date.now();
        const sessionTime = (now - this.startTime) / 1000;

        if (sessionTime > 0 && sessionTime < 86400) {
            if (typeof Store.updateAppUptime === 'function') {
                Store.updateAppUptime(Math.floor(sessionTime));
            }
            this.startTime = now;

            if (forced && typeof Store.save === 'function') {
                Store.save();
            }
        }
    }
};

/**
 * ------------------------------------------------------------------
 * INITIALIZATION (FIXED ORDER)
 * ------------------------------------------------------------------
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing...");

    // 1. Загрузка данных
    Store.load();

    // 2. Инициализация трекера
    AppTracker.init();

    // 3. Создание контроллеров
    window.Controllers = {
        pomodoro: new PomodoroController(),
        wheel: new WheelController(),
        scheduler: new NotificationScheduler()
    };

    // 4. Инициализация UI (ВАЖНО: bindReaderEvents сработает здесь)
    UI.init();

    // 5. Восстановление Pomodoro
    window.Controllers.pomodoro.init();

    // 6. Восстановление Notifications
    window.Controllers.scheduler.init();

    // 7. Заполнение настроек Pomodoro
    const s = Store.data.pomodoro.settings;
    const wIn = document.getElementById('settingWork'); if (wIn) wIn.value = s.work;
    const shIn = document.getElementById('settingShort'); if (shIn) shIn.value = s.short;
    const lIn = document.getElementById('settingLong'); if (lIn) lIn.value = s.long;
    const cIn = document.getElementById('settingCycle'); if (cIn) cIn.value = s.longCycle;

    // 8. Первоначальный рендер (добавляем рендер читалки если нужно, но UI.init уже все сделал)
    UI.renderHabits();
    UI.updateStats();
    if (window.Controllers && window.Controllers.wheel) window.Controllers.wheel.draw();
});