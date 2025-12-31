/**
 * ------------------------------------------------------------------
 * APP UPTIME TRACKER (Global)
 * ------------------------------------------------------------------
 */
const AppTracker = {
    startTime: Date.now(),
    interval: null,

    init() {
        // Сброс startTime на текущий момент при старте сессии
        this.startTime = Date.now();
        
        // Запускаем таймер обновления (каждые 5 сек)
        this.interval = setInterval(() => {
            this.tick();
        }, 5000);

        // События
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.tick(true); // Сохранить при уходе
            } else {
                this.startTime = Date.now(); // Сброс счетчика при возврате
            }
        });

        window.addEventListener('beforeunload', () => {
            this.tick(true);
        });

        console.log("App Tracker Initialized");
    },

    tick(forced = false) {
        const now = Date.now();
        const sessionTime = (now - this.startTime) / 1000; // секунды
        
        if (sessionTime > 0 && sessionTime < 86400) { // Защита от глюков времени
            // ВАЖНО: Проверяем, существует ли метод, чтобы избежать краша
            if (typeof Store.updateAppUptime === 'function') {
                Store.updateAppUptime(Math.floor(sessionTime));
            }
            
            // Сброс счетчика сессии
            this.startTime = now;
            
            if (forced && typeof Store.save === 'function') {
                Store.save();
            }
        }
    }
};

/**
 * ------------------------------------------------------------------
 * INITIALIZATION
 * ------------------------------------------------------------------
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Waiting for modules...");

    const tryInit = () => {
        // Проверяем наличие всех необходимых объектов
        const isReady = 
            typeof Store !== 'undefined' && 
            typeof Store.load === 'function' && // Проверка загрузки Store
            typeof UI !== 'undefined' && 
            typeof PomodoroController !== 'undefined' && 
            typeof WheelController !== 'undefined';

        if (!isReady) {
            requestAnimationFrame(tryInit);
            return;
        }

        console.log("Modules ready. Initializing App...");

        // 1. Load Data
        const hasData = Store.load();

        // 2. Init Uptime Tracker (После загрузки Store)
        AppTracker.init();

        // 3. Recovery Logic
        if (!Store.data.habits.length && !Store.data.pomodoro.stats.totalSessions && (Store.data.appStats?.totalUptime || 0) === 0) {
            // Только если действительно пусто
             // Можно предложить импорт, но давайте не будем доставать пользователя сразу
        }

        // 4. Init Controllers
        window.Controllers = {
            pomodoro: new PomodoroController(),
            wheel: new WheelController()
        };

        // 5. Init UI
        UI.init();

        // 6. Populate Inputs
        const s = Store.data.pomodoro.settings;
        const wIn = document.getElementById('settingWork');
        if (wIn) wIn.value = s.work;
        const shIn = document.getElementById('settingShort');
        if (shIn) shIn.value = s.short;
        const lIn = document.getElementById('settingLong');
        if (lIn) lIn.value = s.long;
        const cIn = document.getElementById('settingCycle');
        if (cIn) cIn.value = s.longCycle;

        // 7. Init Logic & View
        UI.renderHabits();
        window.Controllers.pomodoro.init();
        UI.updateStats();
        window.Controllers.wheel.draw();
    };

    tryInit();
});