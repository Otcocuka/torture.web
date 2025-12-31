/**
 * ------------------------------------------------------------------
 * UI CONTROLLER
 * ------------------------------------------------------------------
 */
const UI = {
    init() {
        // Navigation
        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.nav;
                if (target === 'view-stats') UI.renderStatsView();
                UI.switchView(target);
                document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-blue-600'));
                e.target.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
            });
        });

        // Start with Habits view
        this.switchView('view-habits');
        document.querySelector('[data-nav="view-habits"]').classList.add('bg-white', 'shadow-sm', 'text-blue-600');

        this.bindHabitsEvents();
        this.bindTimerEvents();
        this.bindWheelEvents();
        this.bindGlobalEvents();
        this.renderHabits();
    },

    switchView(viewId) {
        document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(viewId);
        if (target) target.classList.add('active');

        if (viewId === 'view-wheel' && window.Controllers && window.Controllers.wheel) {
            window.Controllers.wheel.draw();
            const countEl = document.getElementById('wheelHistoryCount');
            if (countEl) countEl.textContent = Store.data.wheel.history.length;
        }
    },

    // --- HABITS UI ---
    bindHabitsEvents() {
        document.getElementById('addHabitBtn').onclick = () => {
            const input = document.getElementById('habitInput');
            const name = input.value.trim();

            if (name) {
                const hadAchievement = Store.addHabit(name);
                input.value = '';
                this.renderHabits();
                if (hadAchievement) this.showNotification('🏆 Ачивка получена!');
            }
        };

        document.getElementById('habitSettingsBtn').onclick = () => this.showHabitSettingsModal();
        document.getElementById('viewAchievementsBtn').onclick = () => this.showAchievementsModal();

        document.getElementById('habitsList').addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            const id = parseInt(target.dataset.id);

            if (target.classList.contains('delete-btn')) {
                this.showConfirmDelete(id);
            } else if (target.dataset.action === 'increment') {
                const hasAchievement = Store.incrementHabit(id);
                this.renderHabits();
                if (hasAchievement) this.showNotification('🏆 Ачивка получена!');
            }
        });

        document.getElementById('habitsList').addEventListener('change', (e) => {
            if (e.target.dataset.action === 'toggle-subtask') {
                Store.toggleSubtask(
                    parseInt(e.target.dataset.habitId),
                    parseInt(e.target.dataset.subtaskId),
                    e.target.checked
                );
            }
        });
    },

    renderHabits() {
        const container = document.getElementById('habitsList');
        if (!container) return;
        const habits = Store.data.habits;
        if (habits.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-8">Нет привычек. Добавьте первую!</div>';
            return;
        }

        container.innerHTML = habits.map(h => {
            const color = h.color || 'blue';
            return `
                <div class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-${color}-500 animate-fade-in">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold">${h.name}</h3>
                        <div class="flex items-center gap-2">
                            <span class="text-xs bg-gray-100 px-2 py-1 rounded">${h.count} дн.</span>
                            <button class="delete-btn text-gray-300 hover:text-red-500 text-lg px-2" data-id="${h.id}">×</button>
                        </div>
                    </div>
                    ${h.subtasks?.length ? `
                        <div class="space-y-1 ml-2 mb-2 pl-2 border-l border-gray-100">
                            ${h.subtasks.map(st => `
                                <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                    <input type="checkbox" class="rounded text-${color}-500"
                                        data-action="toggle-subtask" data-habit-id="${h.id}" data-subtask-id="${st.id}"
                                        ${st.completed ? 'checked' : ''}>
                                    <span class="${st.completed ? 'line-through text-gray-400' : ''}">${st.text}</span>
                                    <span class="text-xs text-gray-400">(${st.dates?.length || 0})</span>
                                </label>
                            `).join('')}
                        </div>
                    ` : ''}
                    <button data-action="increment" data-id="${h.id}" class="w-full mt-2 py-1.5 rounded text-sm bg-${color}-100 text-${color}-800 hover:bg-${color}-200 font-medium">
                        Отметить выполнение
                    </button>
                    ${h.history.length ? `
                        <details class="mt-2 text-xs text-gray-500">
                            <summary class="cursor-pointer hover:text-blue-500">История (${h.history.length})</summary>
                            <div class="mt-1 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                                ${h.history.slice(-3).reverse().map(hi => `
                                    <div>${new Date(hi.date).toLocaleDateString()}: ${hi.subtasks.length} подп.</div>
                                `).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    showHabitSettingsModal() {
        const s = Store.data.habitSettings;
        this.renderModal('settingsModal', `
            <div class="bg-white rounded-lg p-6 w-80 shadow-xl">
                <h3 class="font-bold text-lg mb-4">Настройки привычек</h3>
                <div class="space-y-3">
                    <div>
                        <label class="text-sm block mb-1">Цель (дней)</label>
                        <input id="hGoal" type="number" value="${s.goal}" class="w-full border p-2 rounded">
                    </div>
                    <div>
                        <label class="text-sm block mb-1">Цвет</label>
                        <select id="hColor" class="w-full border p-2 rounded">
                            <option value="blue" ${s.color === 'blue' ? 'selected' : ''}>Синий</option>
                            <option value="green" ${s.color === 'green' ? 'selected' : ''}>Зеленый</option>
                            <option value="purple" ${s.color === 'purple' ? 'selected' : ''}>Фиолетовый</option>
                        </select>
                    </div>
                    <div class="border-t pt-3">
                        <label class="text-sm block mb-1">Подпункты (новые)</label>
                        <div id="tempSubList" class="space-y-1 mb-2 max-h-20 overflow-y-auto text-xs"></div>
                        <div class="flex gap-1">
                            <input id="tempSubInput" type="text" placeholder="Текст..." class="flex-1 border p-1 rounded text-xs">
                            <button id="addSubBtn" class="bg-gray-200 px-2 rounded hover:bg-gray-300">+</button>
                        </div>
                    </div>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button>
                    <button id="saveHSet" class="px-3 py-1 bg-blue-500 text-white rounded">Сохранить</button>
                </div>
            </div>
        `);

        const renderTemp = () => {
            const list = document.getElementById('tempSubList');
            if (!list) return;
            list.innerHTML = Store.data.tempSubtasks.map(s => `
                <div class="flex justify-between bg-gray-100 px-2 py-1 rounded">
                    <span>${s.text}</span>
                    <span class="cursor-pointer text-red-500" onclick="Store.data.tempSubtasks = Store.data.tempSubtasks.filter(x=>x.id!==${s.id}); UI.renderTempSubtasksInternal()">×</span>
                </div>
            `).join('');
        };
        this.renderTempSubtasksInternal = renderTemp;
        renderTemp();

        const addBtn = document.getElementById('addSubBtn');
        if (addBtn) {
            addBtn.onclick = () => {
                const val = document.getElementById('tempSubInput').value.trim();
                if (val) {
                    Store.data.tempSubtasks.push({ id: Date.now(), text: val, completed: false });
                    document.getElementById('tempSubInput').value = '';
                    renderTemp();
                }
            };
        }

        const saveBtn = document.getElementById('saveHSet');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const goalVal = document.getElementById('hGoal').value;
                const colorVal = document.getElementById('hColor').value;
                if (goalVal && colorVal) {
                    Store.data.habitSettings = {
                        goal: parseInt(goalVal) || 5,
                        color: colorVal
                    };
                    Store.save();
                    this.closeModal('settingsModal');
                }
            };
        }
    },

    showAchievementsModal() {
        const list = Store.data.achievements;
        const html = list.length
            ? list.map(a => `<div class="flex justify-between bg-green-50 p-2 rounded"><span>${a.name}</span><span class="font-bold">x${a.goal}</span></div>`).join('')
            : '<div class="text-gray-500 text-center">Нет достижений</div>';

        this.renderModal('achModal', `
            <div class="bg-white rounded-lg p-6 w-80 max-h-[80vh] flex flex-col shadow-xl">
                <h3 class="font-bold text-lg mb-2">Достижения</h3>
                <div class="flex-1 overflow-y-auto space-y-2">${html}</div>
                <button data-close-modal class="mt-4 w-full py-2 bg-gray-100 rounded">Закрыть</button>
            </div>
        `);
    },

    showConfirmDelete(id) {
        this.renderModal('confirm', `
            <div class="bg-white rounded-lg p-6 w-72 text-center shadow-xl">
                <p class="mb-4">Удалить привычку?</p>
                <div class="flex justify-center gap-2">
                    <button data-close-modal class="px-3 py-1 bg-gray-100 rounded">Нет</button>
                    <button id="doDelete" class="px-3 py-1 bg-red-500 text-white rounded">Да</button>
                </div>
            </div>
        `);
        const btn = document.getElementById('doDelete');
        if (btn) {
            btn.onclick = () => {
                Store.deleteHabit(id);
                this.closeModal('confirm');
                this.renderHabits();
            };
        }
    },

    // --- TIMER UI ---
    bindTimerEvents() {
        const startBtn = document.getElementById('timerStart');
        const pauseBtn = document.getElementById('timerPause');
        const resetBtn = document.getElementById('timerReset');
        const saveSetBtn = document.getElementById('saveTimerSettings');
        const resetStatBtn = document.getElementById('resetStatsBtn');

        if (startBtn) startBtn.onclick = () => window.Controllers.pomodoro.start();
        if (pauseBtn) pauseBtn.onclick = () => window.Controllers.pomodoro.pause();
        if (resetBtn) resetBtn.onclick = () => {
            window.Controllers.pomodoro.reset(true);
            this.updateStats();
        };

        if (saveSetBtn) {
            saveSetBtn.onclick = () => {
                const s = {
                    work: parseInt(document.getElementById('settingWork').value) || 25,
                    short: parseInt(document.getElementById('settingShort').value) || 5,
                    long: parseInt(document.getElementById('settingLong').value) || 15,
                    longCycle: parseInt(document.getElementById('settingCycle').value) || 4
                };
                Store.updatePomodoroSettings(s);
                window.Controllers.pomodoro.reset(true);
                this.showNotification('Настройки таймера применены');
            };
        }

        if (resetStatBtn) {
            resetStatBtn.onclick = () => {
                if (confirm('Сбросить статистику?')) {
                    Store.resetPomodoroStats();
                    this.updateStats();
                }
            };
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => window.Controllers.pomodoro.requestNotificationPermission(), { once: true });
        }
    },

    updateTimerDisplay(mins, secs, isWorking) {
        const display = document.getElementById('timerDisplay');
        const phase = document.getElementById('timerPhaseText');
        const container = document.getElementById('timerContainer');

        if (display) display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (isWorking) {
            if (phase) phase.textContent = "РАБОТА";
            if (container) container.className = "bg-white p-8 rounded-2xl shadow-lg text-center mb-6 transition-standard theme-work";
        } else {
            if (phase) phase.textContent = "ОТДЫХ";
            if (container) container.className = "bg-white p-8 rounded-2xl shadow-lg text-center mb-6 transition-standard theme-rest";
        }
    },

    updateStats() {
        const s = Store.data.pomodoro.stats;
        const el = document.getElementById('statSessions');
        if (el) el.textContent = s.totalSessions;
        const el2 = document.getElementById('statWork');
        if (el2) el2.textContent = this.formatDuration(s.totalWork);
        const el3 = document.getElementById('statBreak');
        if (el3) el3.textContent = this.formatDuration(s.totalBreak);
        const el4 = document.getElementById('statPaused');
        if (el4) el4.textContent = s.totalPaused + 'с';
    },

    formatDuration(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h > 0 ? `${h}ч ${m}м` : `${m}м`;
    },

    Timer: {
        toggleControls(isRunning) {
            const start = document.getElementById('timerStart');
            const pause = document.getElementById('timerPause');
            if (start) {
                start.disabled = isRunning;
                start.style.opacity = isRunning ? 0.5 : 1;
            }
            if (pause) {
                pause.disabled = !isRunning;
                pause.style.opacity = !isRunning ? 0.5 : 1;
            }
        },
        updateDisplay(timeLeft, isWorking) {
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            UI.updateTimerDisplay(m, s, isWorking);
        },
        updateStats() { UI.updateStats(); }
    },

    // --- WHEEL UI ---
    bindWheelEvents() {
        const btn = document.getElementById('spinWheelBtn');
        if (btn) btn.onclick = () => window.Controllers.wheel.spin();
    },

    // --- MODAL SYSTEM ---
    renderModal(id, html) {
        const container = document.getElementById('modalContainer');
        if (!container) return;
        container.innerHTML = `
            <div id="modal_${id}" class="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 modal-hidden" onclick="if(event.target===this) UI.closeModal('${id}')">
                <div class="transform transition-all scale-95 opacity-0" id="modal_content_${id}">
                    ${html}
                </div>
            </div>
        `;
        setTimeout(() => {
            const wrap = document.getElementById(`modal_${id}`);
            const content = document.getElementById(`modal_content_${id}`);
            if (wrap && content) {
                wrap.classList.remove('modal-hidden');
                content.classList.remove('scale-95', 'opacity-0');
            }
        }, 10);
    },

    closeModal(id) {
        const wrap = document.getElementById(`modal_${id}`);
        const content = document.getElementById(`modal_content_${id}`);
        if (wrap && content) {
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                wrap.classList.add('modal-hidden');
                wrap.remove();
            }, 200);
        }
    },

    showNotification(msg) {
        const n = document.createElement('div');
        n.className = "fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in z-[60]";
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    },

    // --- STATS VIEW (ИСПРАВЛЕНО) ---
    renderStatsView() {
        // 1. Pomodoro
        const p = Store.data.pomodoro.stats;
        const s1 = document.getElementById('stat-t-sessions'); if (s1) s1.textContent = p.totalSessions;
        const s2 = document.getElementById('stat-t-work'); if (s2) s2.textContent = this.formatDuration(p.totalWork);
        const s3 = document.getElementById('stat-t-break'); if (s3) s3.textContent = this.formatDuration(p.totalBreak);
        const s4 = document.getElementById('stat-t-paused'); if (s4) s4.textContent = p.totalPaused + 'с';

        // 2. Habits
        const hCont = document.getElementById('stat-habits-container');
        const habits = Store.data.habits;

        // Генерация подписей месяцев (просто для вида)
        const mContainer = document.getElementById('calendar-months');
        if (mContainer) {
            // Генерируем 12 подписей
            let mHtml = '';
            for (let i = 0; i < 12; i++) mHtml += `<span style="width:30px">${i + 1}</span>`;
            mContainer.innerHTML = mHtml;
        }

        if (hCont) {
            if (habits.length === 0) {
                hCont.innerHTML = '<div class="text-gray-500 text-sm">Нет активных привычек</div>';
            } else {
                hCont.innerHTML = habits.map(habit => {
                    // Подготовка данных: Считаем количество выполнений за дату
                    const today = new Date();
                    const map = {};
                    if (habit.history) {
                        habit.history.forEach(h => {
                            map[h.date] = (map[h.date] || 0) + 1;
                        });
                    }

                    // Рендер 365 дней
                    let html = '';
                    for (let i = 0; i < 365; i++) {
                        const d = new Date(today);
                        d.setDate(today.getDate() - i);
                        const iso = d.toISOString().split('T')[0];

                        // --- ЛОГИКА ЦВЕТОВ ---
                        const count = map[iso] || 0;
                        let colorClass = 'bg-gray-200'; // Уровень 0 (нет выполнений)

                        if (count >= 1) colorClass = 'bg-green-300'; // level-1
                        if (count >= 2) colorClass = 'bg-green-500'; // level-2
                        if (count >= 3) colorClass = 'bg-green-600'; // level-3
                        if (count >= 4) colorClass = 'bg-green-800'; // level-4+ (темнее для контраста)
                        // ---------------------

                        html += `<div class="w-[10px] h-[10px] rounded-[2px] ${colorClass}" title="${iso}: ${count} раз"></div>`;
                    }

                    // ВАЖНО: СОХРАНЯЕМ ВАШУ РАССТАНОВКУ
                    // scale-y-[-1] + direction: rtl обеспечивает движение снизу-справа вверх-влево
                    return `
                        <div class="bg-white p-3 rounded-lg border border-purple-100 shadow-sm mb-4">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-bold text-gray-800">${habit.name}</span>
                                <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Дней: ${habit.count}</span>
                            </div>
                            <div class="flex  h-auto">
                                <!-- Левая часть с подписями -->
                                <div class="grid grid-rows-7 grid-flow-col gap-[2px] h-[82px] text-[8px] text-gray-400">
                                    <div>Pn</div><div>Vt</div><div>Sr</div><div>Ch</div><div>Pt</div><div>Sb</div><div>Vs</div>
                                </div>
                                <!-- Правая часть с графиком -->
                                <div class="overflow-x-auto scale-y-[-1]" style="direction: rtl;">
                                    <div class="grid grid-rows-7 grid-flow-col gap-[2px] w-max">
                                        ${html}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Wheel (без изменений)
        const wCont = document.getElementById('stat-wheel-container');
        if (wCont) {
            const history = Store.data.wheel.history;
            if (history.length === 0) {
                wCont.innerHTML = '<div class="text-gray-500 text-sm">Нет данных</div>';
            } else {
                const counts = {};
                history.forEach(h => counts[h.activity] = (counts[h.activity] || 0) + 1);
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                wCont.innerHTML = `<div class="text-xs text-gray-500 mb-2">Всего прокруток: ${history.length}</div>` +
                    sorted.map(([name, count]) => `<div class="flex justify-between items-center text-sm"><span class="text-gray-700">${name}</span><span class="text-indigo-600 font-bold">${count} раз</span></div>`).join('');
            }
        }
    },

    // --- GLOBAL EVENTS (Import/Export) ---
    bindGlobalEvents() {
        // Export
        document.getElementById('btnExport')?.addEventListener('click', (e) => {
            const dataStr = JSON.stringify(Store.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `torture2_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Import
        document.getElementById('fileImport')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target.result);
                    if (json && typeof json === 'object') {
                        Store.data = { ...Store.data, ...json };
                        Store.save();
                        location.reload();
                    } else {
                        alert("Неверный формат файла!");
                    }
                } catch (err) {
                    alert("Ошибка чтения файла: " + err);
                }
            };
            reader.readAsText(file);
        });
    }
};