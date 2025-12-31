/**
 * ------------------------------------------------------------------
 * INITIALIZATION (With Safety Check)
 * ------------------------------------------------------------------
 */
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Waiting for modules...");

    const tryInit = () => {
        // Проверяем наличие всех зависимостей
        if (typeof Store === 'undefined' || typeof UI === 'undefined' || typeof PomodoroController === 'undefined' || typeof WheelController === 'undefined') {
            console.log("Modules not ready yet...");
            requestAnimationFrame(tryInit); // Пробуем снова в следующем кадре
            return;
        }

        console.log("Modules ready. Initializing App...");

        // 1. Load Data
        const hasData = Store.load();

        // 2. Recovery Logic
        if (!hasData) {
            const choice = confirm("Локальные данные пусты.\n\nХотите загрузить резервную копию (JSON) прямо сейчас?");
            if (choice) {
                document.getElementById('fileImport')?.click();
                return;
            }
        }

        // 3. Init Controllers
        window.Controllers = {
            pomodoro: new PomodoroController(),
            wheel: new WheelController()
        };

        // 4. Init UI
        UI.init();

        // 5. Populate Inputs (Settings)
        const s = Store.data.pomodoro.settings;
        const wIn = document.getElementById('settingWork');
        if (wIn) wIn.value = s.work;
        const shIn = document.getElementById('settingShort');
        if (shIn) shIn.value = s.short;
        const lIn = document.getElementById('settingLong');
        if (lIn) lIn.value = s.long;
        const cIn = document.getElementById('settingCycle');
        if (cIn) cIn.value = s.longCycle;

        // 6. Init Logic
        UI.renderHabits();
        window.Controllers.pomodoro.init();
        UI.updateStats();
        window.Controllers.wheel.draw();
    };

    // Запускаем проверку
    tryInit();
});