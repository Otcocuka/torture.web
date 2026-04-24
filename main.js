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
        scheduler: new NotificationScheduler(),
        miro: new MiroController()  // Создаём, но не инициализируем сразу
    };

    // 4. Инициализация UI
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

    // 8. Первоначальный рендер
    UI.renderHabits();
    UI.updateStats();
    if (window.Controllers && window.Controllers.wheel) window.Controllers.wheel.draw();

    // 9. FIX: Проверяем, если Miro активен по умолчанию (например, по хешу или сохранённому состоянию)
    const checkMiroActivation = () => {
        const miroView = document.getElementById('view-miro');
        const isMiroActive = miroView && miroView.classList.contains('active');

        if (isMiroActive || window.location.hash === '#miro') {
            console.log('Main: Auto-activating Miro view');

            // Switch to Miro view
            UI.switchView('view-miro');

            // Force initialization with delay
            setTimeout(() => {
                if (window.Controllers && window.Controllers.miro) {
                    window.Controllers.miro.init();

                    // Force stats update
                    setTimeout(() => {
                        if (window.Controllers.miro.updateStats) {
                            window.Controllers.miro.updateStats();
                        }
                    }, 200);
                }
            }, 300);
        }
    };

    // Проверяем после небольшой задержки
    setTimeout(checkMiroActivation, 200);

    // FIX: Вешаем обработчик на кнопку Miro
    const miroBtn = document.querySelector('[data-nav="view-miro"]');
    if (miroBtn) {
        // Удаляем старые обработчики
        const newMiroBtn = miroBtn.cloneNode(true);
        miroBtn.parentNode.replaceChild(newMiroBtn, miroBtn);

        newMiroBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('Miro navigation clicked');

            // Переключаем вьюху через UI
            UI.switchView('view-miro');

            // Обновляем стиль навигации
            document.querySelectorAll("[data-nav]").forEach((b) =>
                b.classList.remove("bg-white", "shadow-sm", "text-blue-600")
            );
            this.classList.add("bg-white", "shadow-sm", "text-blue-600");

            // Принудительно инициализируем Miro через 100мс
            setTimeout(() => {
                if (window.Controllers && window.Controllers.miro) {
                    window.Controllers.miro.init();
                    setTimeout(() => {
                        if (window.Controllers.miro.centerView) {
                            window.Controllers.miro.centerView();
                        }
                    }, 150);
                }
            }, 100);
        });
    }
    // FIX: Обработка хэша URL
    if (window.location.hash === '#miro') {
        setTimeout(() => {
            const miroBtn = document.querySelector('[data-nav="view-miro"]');
            if (miroBtn) miroBtn.click();
        }, 300);
    }



    // FIX: Убедиться, что навигация всегда работает
    document.addEventListener('click', (e) => {
        // Если клик по навигации и мы в Miro view
        if (e.target.closest('nav') && document.querySelector('#view-miro.active')) {
            // Принудительно обновить курсор
            document.body.style.cursor = 'default';

            // Сбросить состояние Miro
            if (window.Controllers && window.Controllers.miro) {
                window.Controllers.miro.isDragging = false;
                window.Controllers.miro.isPanning = false;
                window.Controllers.miro.draggedElement = null;
                window.Controllers.miro.canvas.style.cursor = 'grab';
            }
        }
    });

    // FIX: Добавить кнопку "Вернуться" в Miro toolbar
    const miroHtml = document.querySelector('#view-miro').innerHTML;
    if (miroHtml.includes('miroToolbar')) {
        // Добавить кнопку возврата в навигацию
        document.querySelector('#miroToolbar').innerHTML =
            '<button onclick="UI.switchView(\'view-habits\')" class="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 mr-2">← Back</button>' +
            document.querySelector('#miroToolbar').innerHTML;
    }
});



// FIX: Глобальный сброс состояния Miro при клике вне canvas
document.addEventListener('click', (e) => {
    // Если клик по навигации и мы в Miro view
    if (e.target.closest('nav') && document.querySelector('#view-miro.active')) {
        // Принудительно обновить курсор
        document.body.style.cursor = 'default';
        
        // Сбросить состояние Miro
        if (window.Controllers && window.Controllers.miro) {
            window.Controllers.miro.isDragging = false;
            window.Controllers.miro.isPanning = false;
            window.Controllers.miro.draggedElement = null;
            if (window.Controllers.miro.canvas) {
                window.Controllers.miro.canvas.style.cursor = 'grab';
            }
        }
    }
});

// FIX: Обработка изменения видимости вкладки
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.Controllers && window.Controllers.miro) {
        // Сохраняем состояние при скрытии вкладки
        window.Controllers.miro.saveToStorage();
    }
});