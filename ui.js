/**
 * ------------------------------------------------------------------
 * UI CONTROLLER (All Features) - WITH KNOWLEDGE AVATAR
 * ------------------------------------------------------------------
 */
const UI = {
    init() {
        // Navigation
        document.querySelectorAll("[data-nav]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                const target = e.target.dataset.nav;

                // ВСЕ переключения вьюх теперь обрабатываются внутри switchView
                // Это гарантирует, что view станет visible и вызовется нужный рендер
                if (target === "view-habits" || target === "view-timer" || target === "view-wheel" || target === "view-notifications" || target === "view-reader" || target === "view-chat" || target === "view-todo" || target === "view-stats" || target === "view-settings" || target === "view-knowledge-avatar") {
                    this.switchView(target);
                }

                // Обновляем активную кнопку в навигации
                document.querySelectorAll("[data-nav]").forEach((b) =>
                    b.classList.remove("bg-white", "shadow-sm", "text-blue-600")
                );
                e.target.classList.add("bg-white", "shadow-sm", "text-blue-600");
            });
        });

        // --- Глобальные обработчики (Modals) ---
        document.addEventListener("click", (e) => {
            if (e.target.matches("[data-close-modal]") || e.target.closest("[data-close-modal]")) {
                const modalContent = e.target.closest('[id^="modal_content_"]');
                if (modalContent) {
                    const modalId = modalContent.id.replace("modal_content_", "");
                    this.closeModal(modalId);
                }
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                // Закрываем контекстные меню ридера
                this.cleanupContextMenus();

                // Закрываем модальные окна
                const container = document.getElementById("modalContainer");
                if (container && container.children.length > 0) {
                    const modalElement = container.firstElementChild;
                    if (modalElement && modalElement.id.startsWith("modal_")) {
                        const modalId = modalElement.id.replace("modal_", "");
                        this.closeModal(modalId);
                    }
                }
            }
        });

        // --- Bind Events for all modules ---
        this.bindHabitsEvents();
        this.bindTimerEvents();
        this.bindWheelEvents();
        this.bindGlobalEvents();
        this.bindTodoEvents();
        this.bindNotificationsEvents();
        this.bindReaderEvents();
        this.initSettings();

        // *** NEW: Initialize Layered Context Menu Logic ***
        this.initReaderContextLogic();

        // --- Initial Renders ---
        this.renderHabits();
        this.renderNotificationsList();

        // Start with Habits view (UI state)
        this.switchView("view-habits");
    },

    // --- CORE NAVIGATION ---
    switchView(viewId) {
        // При переключении вьюхи обязательно закрываем любые висящие контекстные меню
        this.cleanupContextMenus();

        // Скрываем все вьюхи
        document.querySelectorAll(".app-view").forEach((el) => {
            el.classList.remove("active");
            el.style.display = "none";
        });

        const target = document.getElementById(viewId);
        if (target) {
            target.style.display = "block";
            target.classList.add("active");

            // Вызов рендеринга для нужных вьюх (отдельных логик)
            if (viewId === "view-reader") {
                target.innerHTML = "";
                const file = Store.getActiveFile();
                if (file) {
                    this.renderReaderView();
                } else {
                    this.renderReaderHub();
                }
            }

            if (viewId === "view-wheel" && window.Controllers && window.Controllers.wheel) {
                window.Controllers.wheel.draw();
                const countEl = document.getElementById("wheelHistoryCount");
                if (countEl) countEl.textContent = Store.data.wheel.history.length;
            }

            if (viewId === "view-chat") {
                this.renderChatScreen();
            }

            if (viewId === "view-knowledge-avatar") {
                this.renderKnowledgeAvatarView();
            }

            if (viewId === "view-todo") {
                this.renderKanban();
            }

            if (viewId === "view-stats") {
                this.renderStatsView();
            }

            if (viewId === "view-settings") {
                this.renderSettingsView();
            }
        }
    },

    // --- READER UI HELPERS ---
    renderReaderHub() {
        const view = document.getElementById("view-reader");
        if (!view) return;

        const files = Store.getReaderFiles();
        const settings = Store.data.reader.settings;

        view.className = `app-view active p-6 max-w-6xl mx-auto w-full ${settings.theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-800"}`;

        let html = `
        <div class="max-w-4xl mx-auto space-y-6">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-bold">📚 Библиотека (${files.length})</h2>
                <div class="flex gap-2">
                    <input type="file" id="readerFileInput" accept=".txt,.md,.html" class="hidden">
                    <button id="readerLoadBtn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">📂 Загрузить</button>
                </div>
            </div>

            <div class="p-4 border rounded flex gap-4 items-center text-sm ${settings.theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}">
                <span class="font-semibold">Настройки:</span>
                <label>Шрифт: <select id="readerFontSize" class="border rounded p-1 w-20 ${settings.theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}">
                    <option value="16" ${settings.fontSize === 16 ? "selected" : ""}>16</option>
                    <option value="20" ${settings.fontSize === 20 ? "selected" : ""}>20</option>
                    <option value="24" ${settings.fontSize === 24 ? "selected" : ""}>24</option>
                </select></label>
                <label>Тема: <select id="readerTheme" class="border rounded p-1 ${settings.theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}">
                    <option value="light" ${settings.theme === "light" ? "selected" : ""}>Светлая</option>
                    <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Темная</option>
                </select></label>
            </div>

            <div class="space-y-2">
        `;

        if (files.length === 0) {
            html += `<div class="p-12 text-center opacity-50 border-2 border-dashed rounded-xl">Загрузите вашу первую книгу</div>`;
        } else {
            const sortedFiles = [...files].reverse();
            sortedFiles.forEach((f) => {
                const lastSess = f.stats.sessionsHistory.length
                    ? new Date(f.stats.sessionsHistory[f.stats.sessionsHistory - 1].date).toLocaleDateString()
                    : "—";
                const totalT = f.stats.totalTime;
                const tStr = `${Math.floor(totalT / 60)}м${totalT % 60}с`;

                html += `
                <div class="p-3 rounded border flex justify-between items-center ${settings.theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}">
                    <div class="flex-1 mr-4">
                        <div class="font-bold">${f.name}</div>
                        <div class="text-xs ${settings.theme === "dark" ? "text-gray-400" : "text-gray-500"}">
                            ${f.stats.totalSessions} сессий | Время: ${tStr} | Последняя: ${lastSess}
                        </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="Store.setActiveFile(${f.id}); UI.switchView('view-reader');" 
                                class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">Читать</button>
                        <button onclick="Store.deleteReaderFile(${f.id}); UI.renderReaderHub();" 
                                class="px-2 text-gray-400 hover:text-red-500">🗑️</button>
                    </div>
                </div>
            `;
            });
        }

        html += `</div></div>`;
        view.innerHTML = html;
    },

    renderReaderView() {
        const file = Store.getActiveFile();
        const view = document.getElementById("view-reader");

        if (!file || !view) {
            this.switchView('view-reader');
            return;
        }

        const settings = Store.data.reader.settings;

        view.className = `app-view active p-6 max-w-6xl mx-auto w-full h-[calc(100vh-180px)] ${settings.theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-white text-gray-800"}`;

        const historyHtml = file.stats.sessionsHistory.slice(-3).reverse().map((h) => {
            const d = new Date(h.date).toLocaleDateString();
            const t = `${Math.floor(h.time / 60)}м${h.time % 60}с`;
            return `<div class="flex justify-between border-b border-gray-100 py-1"><span>${d}</span><span>${t} / ${h.words} слов</span></div>`;
        }).join("") || '<div class="text-gray-400 text-xs">Нет сессий</div>';

        view.innerHTML = `
        <div class="flex flex-col gap-4 h-full">
            <!-- Top Panel -->
            <div class="p-3 rounded-lg shadow-sm flex justify-between items-center ${settings.theme === "dark" ? "bg-gray-800" : "bg-white"}">
                <div class="flex items-center gap-3">
                    <button onclick="Store.clearActiveFile(); UI.switchView('view-reader')" class="bg-gray-200 ${settings.theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"} px-3 py-1 rounded hover:bg-gray-300 text-sm font-bold">← Список</button>
                    <div>
                        <div class="font-bold text-lg">${file.name}</div>
                        <div class="text-xs opacity-70">${FileReaderUtil.countWords(file.content)} слов</div>
                    </div>
                </div>
                <div class="flex gap-2 items-center text-sm">
                    <label>Шрифт: <select id="readerFontSize" class="border rounded p-1 w-16 ${settings.theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}">
                        <option value="16" ${settings.fontSize === 16 ? "selected" : ""}>16</option>
                        <option value="20" ${settings.fontSize === 20 ? "selected" : ""}>20</option>
                        <option value="24" ${settings.fontSize === 24 ? "selected" : ""}>24</option>
                    </select></label>
                    <label>Тема: <select id="readerTheme" class="border rounded p-1 ${settings.theme === "dark" ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}">
                        <option value="light" ${settings.theme === "light" ? "selected" : ""}>Светлая</option>
                        <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Темная</option>
                    </select></label>
                </div>
            </div>

            <!-- Text Area -->
            <div id="readerContent" class="flex-1 p-8 rounded-lg overflow-y-auto shadow-inner transition-colors duration-300 ${settings.theme === "dark" ? "reader-theme-dark" : "reader-theme-light"}">
                <div class="reader-text-container whitespace-pre-wrap leading-relaxed">${file.content.replace(/</g, "&lt;")}</div>
            </div>

            <!-- Bottom Panel -->
            <div class="p-3 rounded-lg shadow-sm ${settings.theme === "dark" ? "bg-gray-800" : "bg-white"}">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex gap-2">
                        <button id="readerStartSession" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">▶️ Начать</button>
                        <button id="readerStopSession" class="hidden bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">⏹️ Стоп</button>
                        <!-- НОВАЯ КНОПКА AI-АНАЛИЗ -->
                        <button id="readerAiAnalyzeBtn" class="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">🤖 AI-анализ</button>
                    </div>
                    <button id="readerQuizBtn" class="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">🧠 Квиз</button>
                </div>
                
                <div id="readerSessionStats" class="text-xs bg-gray-50 p-2 rounded flex gap-4 hidden ${settings.theme === "dark" ? "bg-gray-700 text-gray-200" : ""}">
                    <span>⏳ <b id="sessionTime">00:00</b></span>
                    <span>📊 Слов: <b id="sessionWords">0</b></span>
                    <span>📍 Скролл: <b id="sessionProgress">0%</b></span>
                </div>

                <div class="mt-2 text-xs ${settings.theme === "dark" ? "text-gray-400" : "text-gray-500"}">
                    <div class="font-semibold mb-1">История сессий (${file.stats.totalSessions}):</div>
                    <div class="max-h-16 overflow-y-auto">${historyHtml}</div>
                    <div class="mt-1 opacity-70">💡 <i>ПКМ по тексту для объяснения через MiMo</i></div>
                </div>
            </div>
        </div>
        `;

        setTimeout(() => {
            const content = document.getElementById("readerContent");
            if (content && file.progress) content.scrollTop = file.progress.scrollTop || 0;
        }, 50);
    },

    // --- KNOWLEDGE AVATAR VIEW (NEW) ---
    renderKnowledgeAvatarView() {
        const view = document.getElementById("view-knowledge-avatar");
        if (!view) return;

        const avatar = Store.data.cognitive.cognitiveAvatar;
        const states = Store.data.cognitive.userKnowledgeStates;
        const units = Store.data.cognitive.knowledgeUnits;

        // Собираем данные для отображения
        const data = states
            .map(state => {
                const unit = units.find(u => u.id === state.unitId);
                if (!unit) return null;
                return { ...state, ...unit };
            })
            .filter(Boolean) // Удаляем null (если знание удалено)
            .sort((a, b) => {
                // Сортировка: сначала активные, потом по уровню
                if (a.status === 'ignored' && b.status !== 'ignored') return 1;
                if (a.status !== 'ignored' && b.status === 'ignored') return -1;
                return b.level - a.level;
            });

        // Базовая статистика
        const activeCount = data.filter(d => d.status !== 'ignored').length;
        const total = data.length;

        const cardsHtml = data.map(item => {
            let statusColor = 'bg-gray-100 text-gray-700';
            let statusLabel = 'Активен';
            let actionLabel = 'Приглушить';
            let actionAction = 'mute';
            let nextStatus = 'muted';

            if (item.status === 'muted') {
                statusColor = 'bg-blue-100 text-blue-700';
                statusLabel = 'Приглушен';
                actionLabel = 'Вернуть';
                actionAction = 'active';
                nextStatus = 'active';
            } else if (item.status === 'ignored') {
                statusColor = 'bg-red-100 text-red-700';
                statusLabel = 'Игнорируется';
                actionLabel = 'Игнорировать'; // Оставляем как есть, для возврата нужно подтвердить
                actionAction = 'restore';
                nextStatus = 'active';
            }

            // Определяем иконку по типу
            const typeIcons = {
                concept: '🔷',
                fact: '📌',
                procedure: '⚙️',
                relation: '🔗',
                example: '💡'
            };
            const icon = typeIcons[item.type] || '📄';

            return `
            <div class="border rounded-lg p-3 ${item.status === 'ignored' ? 'opacity-50' : ''} shadow-sm hover:shadow-md transition-shadow" data-unit-id="${item.id}">
                <div class="flex justify-between items-start mb-1">
                    <div class="font-semibold">${icon} ${item.title}</div>
                    <div class="text-xs px-2 py-0.5 rounded ${statusColor}">${statusLabel}</div>
                </div>
                <div class="text-xs text-gray-500 mb-2">Тип: ${item.type.toUpperCase()} | Уровень: ${(item.level * 100).toFixed(0)}%</div>
                <div class="text-sm text-gray-700 mb-2">${item.description}</div>
                
                <div class="flex gap-2 mt-2">
                    <!-- Кнопка управления статусом -->
                    <button onclick="UI.changeKnowledgeStatus('${item.id}', '${nextStatus}')" 
                            class="text-xs px-2 py-1 rounded border hover:bg-gray-50">
                        ${actionLabel}
                    </button>
                    <!-- Кнопка игнорирования (прямо к Ignored) -->
                    ${item.status !== 'ignored' ? `
                        <button onclick="UI.changeKnowledgeStatus('${item.id}', 'ignored')" 
                                class="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">
                            Игнорировать
                        </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        view.innerHTML = `
        <div class="p-6 max-w-6xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold">🧠 Аватар знаний</h2>
                    <p class="text-gray-600">Управляйте тем, что система считает вашими знаниями.</p>
                </div>
                <div class="text-right text-sm">
                    <div><span class="font-bold">${activeCount}</span> активных знаний</div>
                    <div class="text-gray-400">Всего: ${total}</div>
                </div>
            </div>

            <!-- Фильтры и тулбар -->
            <div class="flex gap-2 mb-4">
                <button onclick="UI.filterAvatar('all')" class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 text-sm">Все</button>
                <button onclick="UI.filterAvatar('active')" class="px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm">Активные</button>
                <button onclick="UI.filterAvatar('muted')" class="px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm">Приглушенные</button>
                <button onclick="UI.filterAvatar('ignored')" class="px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-sm">Игнорируемые</button>
            </div>

            <div id="avatarCardsContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${cardsHtml || '<div class="col-span-full text-center text-gray-500 py-10">Нет знаний. Проанализируйте документ через Reader.</div>'}
            </div>
        </div>
        `;
    },

    /**
     * Изменяет статус знания (Контроль пользователя)
     * @param {string} unitId - ID знания
     * @param {string} status - 'active', 'muted', 'ignored'
     */
    changeKnowledgeStatus(unitId, status) {
        const stateIndex = Store.data.cognitive.userKnowledgeStates.findIndex(s => s.unitId === unitId);
        if (stateIndex === -1) {
            console.warn("Knowledge state not found for unit:", unitId);
            return;
        }

        // Обновляем статус и уровень (для игнорируемых — сбрасываем уровень)
        Store.data.cognitive.userKnowledgeStates[stateIndex].status = status;
        if (status === 'ignored') {
            Store.data.cognitive.userKnowledgeStates[stateIndex].level = 0;
        }
        // Обновляем таймстемп
        Store.data.cognitive.userKnowledgeStates[stateIndex].lastUpdated = Date.now();

        // Сохраняем
        Store.save();

        // Обновляем отображение
        this.renderKnowledgeAvatarView();
        
        // Feedback
        this.showNotification(`Статус обновлен: ${status}`);
    },

    /**
     * Фильтрация списка в Аватаре
     * @param {string} filter - 'all', 'active', 'muted', 'ignored'
     */
    filterAvatar(filter) {
        const container = document.getElementById("avatarCardsContainer");
        if (!container) return;

        // Берем все карточки
        const cards = container.querySelectorAll("[data-unit-id]");
        
        cards.forEach(card => {
            const state = Store.data.cognitive.userKnowledgeStates.find(s => s.unitId === card.dataset.unitId);
            if (!state) {
                card.style.display = "none";
                return;
            }

            let show = false;
            if (filter === 'all') show = true;
            else if (filter === 'active' && state.status === 'active') show = true;
            else if (filter === 'muted' && state.status === 'muted') show = true;
            else if (filter === 'ignored' && state.status === 'ignored') show = true;

            card.style.display = show ? "block" : "none";
        });
    },

    // --- SETTINGS UI (UPDATED FOR PRESETS) ---
    initSettings() {
        const btn = document.getElementById('saveSettingsBtn');
        if (btn) {
            btn.onclick = () => {
                // 1. Сохраняем настройки API
                const settings = {
                    maxTokens: parseInt(document.getElementById('settingMaxTokens').value),
                    temperature: parseFloat(document.getElementById('settingTemperature').value),
                    autoRequest: document.getElementById('settingAutoRequest').checked,
                };
                Store.updateExplanationSettings(settings);

                // 2. Собираем и сохраняем пресеты
                const presets = [];
                const presetContainers = document.querySelectorAll('.preset-item');

                presetContainers.forEach(item => {
                    const id = item.dataset.id;
                    const nameInput = item.querySelector('.preset-name');
                    const promptInput = item.querySelector('.preset-prompt');

                    if (nameInput.value.trim() && promptInput.value.trim()) {
                        presets.push({
                            id: id || Date.now().toString(), // Новый ID, если не задан
                            name: nameInput.value.trim(),
                            prompt: promptInput.value.trim()
                        });
                    }
                });

                if (presets.length > 0) {
                    Store.updateExplanationPresets(presets);
                }

                // UI Feedback
                const status = document.getElementById('saveStatus');
                status.classList.remove('hidden');
                setTimeout(() => status.classList.add('hidden'), 2000);

                // Обновляем UI (на случай если добавились новые пресеты)
                this.renderSettingsView();
            };
        }
    },

    renderSettingsView() {
        // 1. Заполняем стандартные настройки
        const s = Store.data.explanationSettings || { maxTokens: 500, temperature: 0.2, autoRequest: false };
        const elMax = document.getElementById('settingMaxTokens');
        const elTemp = document.getElementById('settingTemperature');
        const elAuto = document.getElementById('settingAutoRequest');

        if (elMax) {
            elMax.value = s.maxTokens;
            const labelMax = document.getElementById('labelMaxTokens');
            if (labelMax) labelMax.innerText = `(Текущее: ${s.maxTokens})`;
            elMax.oninput = (e) => { if (labelMax) labelMax.innerText = `(Текущее: ${e.target.value})`; };
        }
        if (elTemp) {
            elTemp.value = s.temperature;
            const labelTemp = document.getElementById('labelTemp');
            if (labelTemp) labelTemp.innerText = `(Текущее: ${s.temperature})`;
            elTemp.oninput = (e) => { if (labelTemp) labelTemp.innerText = `(Текущее: ${e.target.value})`; };
        }
        if (elAuto) elAuto.checked = s.autoRequest;

        // 2. Рендерим пресеты
        const container = document.getElementById('presetsContainer');
        if (container) {
            const presets = Store.data.explanationPresets || [];
            container.innerHTML = '';

            presets.forEach((p, index) => {
                const div = document.createElement('div');
                div.className = 'preset-item bg-gray-50 p-3 rounded border border-gray-200 relative';
                div.dataset.id = p.id;

                div.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <div>
                            <label class="block text-xs text-gray-500">Название</label>
                            <input type="text" class="preset-name w-full border rounded px-2 py-1 text-sm" value="${p.name}">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-xs text-gray-500">Системный промпт</label>
                            <input type="text" class="preset-prompt w-full border rounded px-2 py-1 text-sm" value="${p.prompt}">
                        </div>
                    </div>
                    <div class="flex justify-end">
                        <button class="text-red-500 hover:text-red-700 text-xs delete-preset">Удалить</button>
                    </div>
                `;
                container.appendChild(div);
            });

            // Кнопка добавления нового пресета
            const addBtn = document.createElement('button');
            addBtn.className = 'w-full py-2 border border-dashed border-blue-300 text-blue-500 rounded hover:bg-blue-50 text-sm';
            addBtn.innerText = '+ Добавить пресет';
            addBtn.onclick = () => {
                // Добавляем пустой элемент в UI (сохранится при нажатии основной кнопки)
                const div = document.createElement('div');
                div.className = 'preset-item bg-blue-50 p-3 rounded border border-blue-200';
                div.innerHTML = `
                     <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <div><input type="text" class="preset-name w-full border rounded px-2 py-1 text-sm" placeholder="Название (например: Детский)"></div>
                        <div class="md:col-span-2"><input type="text" class="preset-prompt w-full border rounded px-2 py-1 text-sm" placeholder="Промпт..."></div>
                    </div>
                    <div class="flex justify-end"><button class="text-red-500 hover:text-red-700 text-xs delete-preset">Отмена</button></div>
                `;
                container.insertBefore(div, container.firstChild); // Вверху списка
            };
            container.appendChild(addBtn);

            // Обработчик удаления (делегирование событий, так как элементы динамические)
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-preset')) {
                    e.target.closest('.preset-item').remove();
                }
            });
        }

        // Показываем view, если он скрыт (при переключении из меню)
        const view = document.getElementById("view-settings");
        if (view && view.style.display === "none") {
            document.querySelectorAll(".app-view").forEach((el) => {
                el.classList.remove("active");
                el.style.display = "none";
            });
            view.style.display = "block";
            view.classList.add("active");
        }
    },

    // --- READER EVENTS (With AI Analyze) ---
    bindReaderEvents() {
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#view-reader")) return;

            const btn = e.target.closest("button");
            if (!btn) return;

            // --- СУЩЕСТВУЮЩИЕ ОБРАБОТЧИКИ (оставьте их как есть) ---
            if (btn.id === "readerLoadBtn") {
                document.getElementById("readerFileInput").click();
                return;
            }
            if (btn.id === "readerStartSession") {
                this.startReaderSession();
                return;
            }
            if (btn.id === "readerStopSession") {
                this.stopReaderSession();
                return;
            }
            if (btn.id === "readerQuizBtn") {
                const file = Store.getActiveFile();
                if (!file) return this.showNotification("Нет активного файла");
                this.renderModal("quizModal", `
                    <div class="bg-white rounded-lg p-6 w-[500px] shadow-xl">
                        <h3 class="font-bold text-lg mb-2">Квиз: ${file.name}</h3>
                        <div class="bg-gray-100 p-3 rounded mb-4 text-sm font-serif">"...${file.content.substring(0, 300)}..."</div>
                        <p class="text-sm mb-2">Вопрос: О чем текст?</p>
                        <div class="mt-4 text-right"><button data-close-modal class="bg-gray-800 text-white px-4 py-2 rounded">Закрыть</button></div>
                    </div>
                `);
                return;
            }

            // --- НОВЫЙ ОБРАБОТЧИК: Запуск AI-анализа ---
            if (btn.id === "readerAiAnalyzeBtn") {
                const file = Store.getActiveFile();
                if (!file) return UI.showNotification("Сначала загрузите файл");

                // Блокируем кнопку, чтобы предотвратить двойные клики
                btn.disabled = true;
                btn.innerText = "⏳ Обработка...";

                // Вызываем процессор
                CognitiveProcessor.processFile(file.id)
                    .then((result) => {
                        if (result.success) {
                            // Используем существующий UI.showNotification для результата
                            UI.showNotification(`✅ Готово! Извлечено знаний: ${result.unitsCount}`);

                            // Обновляем текст кнопки для наглядности
                            btn.innerText = `🤖 Аналитика завершена (${result.unitsCount})`;
                        } else {
                            UI.showNotification(`❌ Ошибка: ${result.error}`);
                            btn.innerText = "🤖 Ошибка, попробуйте снова";
                        }
                    })
                    .catch((err) => {
                        console.error("AI-Analyze Error:", err);
                        UI.showNotification("❌ Критическая ошибка анализа");
                        btn.innerText = "🤖 Ошибка";
                    })
                    .finally(() => {
                        // Возвращаем кнопку в активное состояние через 2 секунды
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.innerText = "🤖 AI-анализ";
                        }, 2000);
                    });

                return; // Предотвращаем дальнейшую обработку
            }
        });

        document.addEventListener("change", (e) => {
            if (!e.target.closest("#view-reader")) return;

            if (e.target.id === "readerFileInput") {
                const file = e.target.files[0];
                if (!file) return;
                const btn = document.getElementById("readerLoadBtn");
                if (btn) btn.disabled = true;

                FileReaderUtil.read(file)
                    .then((text) => {
                        Store.addReaderFile(file.name, text);
                        this.renderReaderHub();
                        this.showNotification(`✅ Загружено: ${file.name}`);
                        e.target.value = "";
                    })
                    .catch((err) => this.showNotification(`❌ Ошибка: ${err}`))
                    .finally(() => { if (btn) btn.disabled = false; });
            }

            if (e.target.id === "readerFontSize" || e.target.id === "readerTheme") {
                const settings = {
                    fontSize: parseInt(document.getElementById("readerFontSize").value) || 20,
                    theme: document.getElementById("readerTheme").value
                };
                Store.updateReaderSettings(settings);
                const file = Store.getActiveFile();
                if (file) this.renderReaderView();
                else this.renderReaderHub();
            }
        });

        document.addEventListener("scroll", (e) => {
            if (e.target.id === "readerContent") {
                const file = Store.getActiveFile();
                if (file) {
                    clearTimeout(this._readerScrollTimeout);
                    this._readerScrollTimeout = setTimeout(() => {
                        Store.updateReaderFileProgress(file.id, e.target.scrollTop);
                    }, 500);
                }
            }
        }, true);
    },

    startReaderSession() {
        const file = Store.getActiveFile();
        if (!file) return this.showNotification("Нет файла для сессии");
        if (this.readerSessionStartTime) return;

        this.readerSessionStartTime = Date.now();
        const startBtn = document.getElementById("readerStartSession");
        const stopBtn = document.getElementById("readerStopSession");
        const statsBlock = document.getElementById("readerSessionStats");

        if (startBtn) startBtn.classList.add("hidden");
        if (stopBtn) stopBtn.classList.remove("hidden");
        if (statsBlock) statsBlock.classList.remove("hidden");

        this.readerSessionTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.readerSessionStartTime) / 1000);
            const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
            const s = (elapsed % 60).toString().padStart(2, "0");

            if (document.getElementById("sessionTime")) {
                document.getElementById("sessionTime").textContent = `${m}:${s}`;
                const content = document.getElementById("readerContent");
                if (content) {
                    const prog = (content.scrollTop / (content.scrollHeight - content.clientHeight)) * 100;
                    document.getElementById("sessionProgress").textContent = `${Math.round(prog)}%`;
                }
                document.getElementById("sessionWords").textContent = FileReaderUtil.countWords(file.content);
            }
        }, 1000);
    },

    stopReaderSession() {
        if (!this.readerSessionStartTime) return;

        clearInterval(this.readerSessionTimer);
        const duration = Math.floor((Date.now() - this.readerSessionStartTime) / 1000);
        const file = Store.getActiveFile();
        const words = FileReaderUtil.countWords(file.content);

        Store.addReaderSessionToFile(file.id, duration, words);

        const startBtn = document.getElementById("readerStartSession");
        const stopBtn = document.getElementById("readerStopSession");
        const statsBlock = document.getElementById("readerSessionStats");

        if (startBtn) startBtn.classList.remove("hidden");
        if (stopBtn) stopBtn.classList.add("hidden");
        if (statsBlock) statsBlock.classList.add("hidden");

        this.readerSessionStartTime = 0;
        this.renderReaderView();
        this.showNotification("Сессия сохранена!");
    },

    // --- HABITS UI ---
    bindHabitsEvents() {
        document.getElementById("addHabitBtn").onclick = () => {
            const input = document.getElementById("habitInput");
            const name = input.value.trim();
            if (name) {
                Store.addHabit(name);
                input.value = "";
                this.renderHabits();
            }
        };
        document.getElementById("habitSettingsBtn").onclick = () => this.showHabitSettingsModal();
        document.getElementById("viewAchievementsBtn").onclick = () => this.showAchievementsModal();

        document.getElementById("habitsList").addEventListener("click", (e) => {
            const target = e.target.closest("button");
            if (!target) return;
            const id = parseInt(target.dataset.id);

            if (target.classList.contains("delete-btn")) {
                this.showConfirmDelete(id);
            } else if (target.dataset.action === "increment") {
                const hasAchievement = Store.incrementHabit(id);
                this.renderHabits();
                if (hasAchievement) this.showNotification("🏆 Ачивка получена!");
            }
        });

        document.getElementById("habitsList").addEventListener("change", (e) => {
            if (e.target.dataset.action === "toggle-subtask") {
                Store.toggleSubtask(
                    parseInt(e.target.dataset.habitId),
                    parseInt(e.target.dataset.subtaskId),
                    e.target.checked
                );
            }
        });
    },

    renderHabits() {
        const container = document.getElementById("habitsList");
        if (!container) return;
        const habits = Store.data.habits;
        if (habits.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 py-8">Нет привычек. Добавьте первую!</div>';
            return;
        }

        container.innerHTML = habits.map((h) => {
            const color = h.color || "blue";
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
                        ${h.subtasks.map((st) => `
                            <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                <input type="checkbox" class="rounded text-${color}-500"
                                    data-action="toggle-subtask" data-habit-id="${h.id}" data-subtask-id="${st.id}"
                                    ${st.completed ? "checked" : ""}>
                                <span class="${st.completed ? "line-through text-gray-400" : ""}">${st.text}</span>
                                <span class="text-xs text-gray-400">(${st.dates?.length || 0})</span>
                            </label>`).join("")}
                    </div>` : ""}
                <button data-action="increment" data-id="${h.id}" class="w-full mt-2 py-1.5 rounded text-sm bg-${color}-100 text-${color}-800 hover:bg-${color}-200 font-medium">Отметить выполнение</button>
                ${h.history.length ? `
                    <details class="mt-2 text-xs text-gray-500">
                        <summary class="cursor-pointer hover:text-blue-500">История (${h.history.length})</summary>
                        <div class="mt-1 bg-gray-50 p-2 rounded max-h-16 overflow-y-auto">
                            ${h.history.slice(-3).reverse().map((hi) => `<div>${new Date(hi.date).toLocaleDateString()}: ${hi.subtasks.length} подп.</div>`).join("")}
                        </div>
                    </details>` : ""}
            </div>`;
        }).join("");
    },

    showHabitSettingsModal() {
        const s = Store.data.habitSettings;
        this.renderModal("settingsModal", `
            <div class="bg-white rounded-lg p-6 w-80 shadow-xl">
                <h3 class="font-bold text-lg mb-4">Настройки привычек</h3>
                <div class="space-y-3">
                    <div><label class="text-sm block mb-1">Цель (дней)</label><input id="hGoal" type="number" value="${s.goal}" class="w-full border p-2 rounded"></div>
                    <div><label class="text-sm block mb-1">Цвет</label><select id="hColor" class="w-full border p-2 rounded"><option value="blue" ${s.color === "blue" ? "selected" : ""}>Синий</option><option value="green" ${s.color === "green" ? "selected" : ""}>Зеленый</option><option value="purple" ${s.color === "purple" ? "selected" : ""}>Фиолетовый</option></select></div>
                    <div class="border-t pt-3"><label class="text-sm block mb-1">Подпункты (новые)</label><div id="tempSubList" class="space-y-1 mb-2 max-h-20 overflow-y-auto text-xs"></div><div class="flex gap-1"><input id="tempSubInput" type="text" placeholder="Текст..." class="flex-1 border p-1 rounded text-xs"><button id="addSubBtn" class="bg-gray-200 px-2 rounded hover:bg-gray-300">+</button></div></div>
                </div>
                <div class="mt-4 flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveHSet" class="px-3 py-1 bg-blue-500 text-white rounded">Сохранить</button></div>
            </div>`);

        const renderTemp = () => {
            const list = document.getElementById("tempSubList");
            if (list) list.innerHTML = Store.data.tempSubtasks.map(s => `<div class="flex justify-between bg-gray-100 px-2 py-1 rounded"><span>${s.text}</span><span class="cursor-pointer text-red-500" onclick="Store.data.tempSubtasks = Store.data.tempSubtasks.filter(x=>x.id!==${s.id}); UI.renderTempSubtasksInternal()">×</span></div>`).join("");
        };
        this.renderTempSubtasksInternal = renderTemp;
        renderTemp();

        const addBtn = document.getElementById("addSubBtn");
        if (addBtn) addBtn.onclick = () => {
            const val = document.getElementById("tempSubInput").value.trim();
            if (val) {
                Store.data.tempSubtasks.push({ id: Date.now(), text: val, completed: false });
                document.getElementById("tempSubInput").value = "";
                renderTemp();
            }
        };
        const saveBtn = document.getElementById("saveHSet");
        if (saveBtn) saveBtn.onclick = () => {
            const goalVal = document.getElementById("hGoal").value;
            const colorVal = document.getElementById("hColor").value;
            if (goalVal && colorVal) {
                Store.data.habitSettings = { goal: parseInt(goalVal) || 5, color: colorVal };
                Store.save();
                this.closeModal("settingsModal");
            }
        };
    },

    showAchievementsModal() {
        const list = Store.data.achievements;
        const html = list.length ? list.map(a => `<div class="flex justify-between bg-green-50 p-2 rounded"><span>${a.name}</span><span class="font-bold">x${a.goal}</span></div>`).join("") : '<div class="text-gray-500 text-center">Нет достижений</div>';
        this.renderModal("achModal", `<div class="bg-white rounded-lg p-6 w-80 max-h-[80vh] flex flex-col shadow-xl"><h3 class="font-bold text-lg mb-2">Достижения</h3><div class="flex-1 overflow-y-auto space-y-2">${html}</div><button data-close-modal class="mt-4 w-full py-2 bg-gray-100 rounded">Закрыть</button></div>`);
    },

    showConfirmDelete(id) {
        this.renderModal("confirm", `<div class="bg-white rounded-lg p-6 w-72 text-center shadow-xl"><p class="mb-4">Удалить привычку?</p><div class="flex justify-center gap-2"><button data-close-modal class="px-3 py-1 bg-gray-100 rounded">Нет</button><button id="doDelete" class="px-3 py-1 bg-red-500 text-white rounded">Да</button></div></div>`);
        const btn = document.getElementById("doDelete");
        if (btn) btn.onclick = () => { Store.deleteHabit(id); this.closeModal("confirm"); this.renderHabits(); };
    },

    // --- TIMER UI ---
    bindTimerEvents() {
        const startBtn = document.getElementById("timerStart");
        const pauseBtn = document.getElementById("timerPause");
        const resetBtn = document.getElementById("timerReset");
        const saveSetBtn = document.getElementById("saveTimerSettings");
        const resetStatBtn = document.getElementById("resetStatsBtn");

        if (startBtn) startBtn.onclick = () => window.Controllers.pomodoro.start();
        if (pauseBtn) pauseBtn.onclick = () => window.Controllers.pomodoro.pause();
        if (resetBtn) resetBtn.onclick = () => { window.Controllers.pomodoro.reset(true); this.updateStats(); };

        if (saveSetBtn) {
            saveSetBtn.onclick = () => {
                const s = { work: parseInt(document.getElementById("settingWork").value) || 25, short: parseInt(document.getElementById("settingShort").value) || 5, long: parseInt(document.getElementById("settingLong").value) || 15, longCycle: parseInt(document.getElementById("settingCycle").value) || 4 };
                Store.updatePomodoroSettings(s);
                window.Controllers.pomodoro.reset(true);
                this.showNotification("Настройки таймера применены");
            };
        }
        if (resetStatBtn) resetStatBtn.onclick = () => { if (confirm("Сбросить статистику?")) { Store.resetPomodoroStats(); this.updateStats(); } };
        if (startBtn) startBtn.addEventListener("click", () => window.Controllers.pomodoro.requestNotificationPermission(), { once: true });
    },

    updateTimerDisplay(mins, secs, isWorking) {
        const display = document.getElementById("timerDisplay");
        const phase = document.getElementById("timerPhaseText");
        const container = document.getElementById("timerContainer");
        if (display) display.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
        const el = document.getElementById("statSessions"); if (el) el.textContent = s.totalSessions;
        const el2 = document.getElementById("statWork"); if (el2) el2.textContent = this.formatDuration(s.totalWork);
        const el3 = document.getElementById("statBreak"); if (el3) el3.textContent = this.formatDuration(s.totalBreak);
        const el4 = document.getElementById("statPaused"); if (el4) el4.textContent = s.totalPaused + "с";
    },

    formatDuration(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h > 0 ? `${h}ч ${m}м` : `${m}м`;
    },

    formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return `${d}д ${h}ч`;
        if (h > 0) return `${h}ч ${m}м`;
        return `${m}м`;
    },

    Timer: {
        toggleControls(isRunning) {
            const start = document.getElementById("timerStart");
            const pause = document.getElementById("timerPause");
            if (start) { start.disabled = isRunning; start.style.opacity = isRunning ? 0.5 : 1; }
            if (pause) { pause.disabled = !isRunning; pause.style.opacity = !isRunning ? 0.5 : 1; }
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
        const btn = document.getElementById("spinWheelBtn");
        if (btn) btn.onclick = () => { if (window.Controllers && window.Controllers.wheel) { window.Controllers.wheel.spin(); } };
    },

    // --- TODO/KANBAN UI ---
    bindTodoEvents() {
        document.getElementById("addKanbanColBtn")?.addEventListener("click", () => {
            this.renderModal("kanbanCol", `<div class="bg-white rounded-lg p-6 w-80 shadow-xl"><h3 class="font-bold text-lg mb-4">Новая колонка</h3><input id="kanbanColTitle" type="text" placeholder="Название..." class="w-full border p-2 rounded mb-4"><div class="flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveKanbanCol" class="px-3 py-1 bg-blue-500 text-white rounded">Создать</button></div></div>`);
            document.getElementById("saveKanbanCol").onclick = () => {
                const title = document.getElementById("kanbanColTitle").value.trim();
                if (title) { Store.addKanbanColumn(title); this.closeModal("kanbanCol"); this.renderKanban(); }
            };
        });

        const board = document.getElementById("kanbanBoard");
        if (board) {
            board.addEventListener("dragstart", (e) => {
                if (e.target.dataset.cardId) { e.dataTransfer.setData("text/card", e.target.dataset.cardId); e.target.classList.add("opacity-50"); return; }
                if (e.target.dataset.columnId && e.target.dataset.type === "column") { e.dataTransfer.setData("text/column", e.target.dataset.columnId); e.target.classList.add("opacity-50", "bg-yellow-100"); }
            });
            board.addEventListener("dragend", (e) => {
                if (e.target.dataset.cardId) e.target.classList.remove("opacity-50");
                if (e.target.dataset.columnId) { e.target.classList.remove("opacity-50", "bg-yellow-100"); document.querySelectorAll('[draggable="true"][data-type="column"]').forEach((el) => el.classList.remove("bg-yellow-100", "border-dashed", "border-blue-400")); }
            });
            board.addEventListener("dragover", (e) => {
                e.preventDefault();
                const draggingCard = e.dataTransfer.getData("text/card");
                const draggingColumn = e.dataTransfer.getData("text/column");
                if (draggingCard) { const column = e.target.closest(".kanban-column-inner"); if (column) column.classList.add("bg-blue-50"); return; }
                if (draggingColumn) { const header = e.target.closest('[draggable="true"][data-type="column"]'); if (header && header.dataset.columnId !== draggingColumn) { header.classList.add("bg-yellow-100", "border-dashed", "border-blue-400"); } }
            });
            board.addEventListener("dragleave", (e) => {
                const column = e.target.closest(".kanban-column-inner"); if (column) column.classList.remove("bg-blue-50");
                const header = e.target.closest('[draggable="true"][data-type="column"]'); if (header) header.classList.remove("bg-yellow-100", "border-dashed", "border-blue-400");
            });
            board.addEventListener("drop", (e) => {
                e.preventDefault();
                const cardId = e.dataTransfer.getData("text/card");
                if (cardId) {
                    const column = e.target.closest(".kanban-column-inner");
                    if (column) {
                        column.classList.remove("bg-blue-50");
                        const newColId = parseInt(column.dataset.columnId);
                        const oldCardElement = document.querySelector(`[data-card-id="${cardId}"]`);
                        const oldColId = oldCardElement ? parseInt(oldCardElement.dataset.columnId) : 0;
                        if (newColId !== oldColId) { Store.moveKanbanCard(parseInt(cardId), newColId); this.renderKanban(); } else { this.renderKanban(); }
                    }
                    return;
                }
                const columnId = e.dataTransfer.getData("text/column");
                if (columnId) {
                    document.querySelectorAll('[draggable="true"][data-type="column"]').forEach((el) => el.classList.remove("bg-yellow-100", "border-dashed", "border-blue-400"));
                    const targetHeader = e.target.closest('[draggable="true"][data-type="column"]');
                    if (targetHeader && targetHeader.dataset.columnId !== columnId) {
                        const targetColumnId = parseInt(targetHeader.dataset.columnId);
                        const cols = Store.data.kanban.columns;
                        const fromIndex = cols.findIndex((c) => c.id == columnId);
                        const toIndex = cols.findIndex((c) => c.id == targetColumnId);
                        if (fromIndex !== -1 && toIndex !== -1) {
                            const [movedCol] = cols.splice(fromIndex, 1);
                            cols.splice(toIndex, 0, movedCol);
                            Store.save();
                            this.renderKanban();
                        }
                    } else { this.renderKanban(); }
                }
            });
            board.addEventListener("click", (e) => {
                const btn = e.target.closest("button");
                if (!btn) return;
                if (btn.dataset.action === "add-card") {
                    const colId = btn.dataset.columnId;
                    this.renderModal("kanbanCard", `<div class="bg-white rounded-lg p-6 w-80 shadow-xl"><h3 class="font-bold text-lg mb-4">Новая задача</h3><input id="kanbanCardTitle" type="text" placeholder="Заголовок" class="w-full border p-2 rounded mb-2"><textarea id="kanbanCardDesc" placeholder="Описание" class="w-full border p-2 rounded mb-4 h-24"></textarea><div class="flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveKanbanCard" class="px-3 py-1 bg-green-500 text-white rounded">Добавить</button></div></div>`);
                    document.getElementById("saveKanbanCard").onclick = () => {
                        const title = document.getElementById("kanbanCardTitle").value.trim();
                        const desc = document.getElementById("kanbanCardDesc").value.trim();
                        if (title) { Store.addKanbanCard(colId, title, desc); this.closeModal("kanbanCard"); this.renderKanban(); }
                    };
                }
                if (btn.dataset.action === "edit-card") {
                    const cardId = btn.dataset.cardId;
                    const card = Store.data.kanban.cards.find((c) => c.id == cardId);
                    if (card) {
                        this.renderModal("editCard", `<div class="bg-white rounded-lg p-6 w-80 shadow-xl"><h3 class="font-bold text-lg mb-4">Редактировать задачу</h3><input id="editCardTitle" type="text" value="${card.title}" class="w-full border p-2 rounded mb-2"><textarea id="editCardDesc" placeholder="Описание" class="w-full border p-2 rounded mb-4 h-24">${card.description || ""}</textarea><div class="flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveEditedCard" class="px-3 py-1 bg-blue-500 text-white rounded">Сохранить</button></div></div>`);
                        document.getElementById("saveEditedCard").onclick = () => {
                            const newTitle = document.getElementById("editCardTitle").value.trim();
                            const newDesc = document.getElementById("editCardDesc").value.trim();
                            if (newTitle) { card.title = newTitle; card.description = newDesc; Store.save(); this.closeModal("editCard"); this.renderKanban(); }
                        };
                    }
                }
                if (btn.dataset.action === "delete-column") { if (confirm("Удалить колонку и все задачи в ней?")) { Store.deleteKanbanColumn(parseInt(btn.dataset.columnId)); this.renderKanban(); } }
                if (btn.dataset.action === "delete-card") { Store.deleteKanbanCard(parseInt(btn.dataset.cardId)); this.renderKanban(); }
            });
        }
    },

    renderKanban() {
        const board = document.getElementById("kanbanBoard");
        if (!board) return;
        const data = Store.data.kanban;
        if (!data.columns.length) { board.innerHTML = '<div class="text-gray-400 p-4">Нет колонок. Добавьте первую!</div>'; return; }
        board.innerHTML = data.columns.map((col) => {
            const cards = data.cards.filter((c) => c.columnId === col.id);
            return `<div class="flex-shrink-0 w-72 bg-gray-100 rounded-lg p-2 flex flex-col max-h-[600px]"><div class="flex justify-between items-center mb-2 bg-white p-2 rounded shadow-sm" draggable="true" data-column-id="${col.id}" data-type="column"><div class="flex items-center gap-2"><span class="cursor-grab text-gray-400">☰</span><h3 class="font-bold text-gray-700 truncate">${col.title}</h3></div><div class="flex gap-1"><button data-action="add-card" data-column-id="${col.id}" class="text-green-600 font-bold text-xl hover:text-green-800">+</button><button data-action="delete-column" data-column-id="${col.id}" class="text-red-300 font-bold hover:text-red-500">×</button></div></div><div class="kanban-column-inner flex-1 overflow-y-auto space-y-2 p-1" data-column-id="${col.id}">${cards.length ? cards.map((card) => `<div class="kanban-card bg-white p-3 rounded shadow-sm border-l-4 border-blue-400 cursor-move hover:shadow-md transition-shadow" draggable="true" data-card-id="${card.id}" data-column-id="${col.id}"><div class="flex justify-between items-start mb-1"><span class="font-semibold text-sm text-gray-800 card-title">${card.title}</span><div class="flex gap-1"><button data-action="edit-card" data-card-id="${card.id}" class="text-blue-400 hover:text-blue-600 text-xs px-1" title="Редактировать">✏️</button><button data-action="delete-card" data-card-id="${card.id}" class="text-gray-300 hover:text-red-500 text-xs px-1">×</button></div></div>${card.description ? `<div class="text-xs text-gray-500 card-desc">${card.description}</div>` : ""}</div>`).join("") : '<div class="text-xs text-gray-400 text-center py-2">Пусто</div>'}</div></div>`;
        }).join("");
        board.scrollLeft = board.scrollWidth;
    },

    // --- MODAL & NOTIFICATIONS & STATS & GLOBALS ---
    renderModal(id, html) {
        const container = document.getElementById("modalContainer");
        if (!container) return;
        container.innerHTML = `<div id="modal_${id}" class="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 modal-hidden" onclick="if(event.target===this) UI.closeModal('${id}')"><div class="transform transition-all scale-95 opacity-0" id="modal_content_${id}">${html}</div></div>`;
        setTimeout(() => {
            const wrap = document.getElementById(`modal_${id}`);
            const content = document.getElementById(`modal_content_${id}`);
            if (wrap && content) { wrap.classList.remove("modal-hidden"); content.classList.remove("scale-95", "opacity-0"); }
        }, 10);
    },

    closeModal(id) {
        const wrap = document.getElementById(`modal_${id}`);
        const content = document.getElementById(`modal_content_${id}`);
        if (wrap && content) {
            content.classList.add("scale-95", "opacity-0");
            setTimeout(() => { wrap.classList.add("modal-hidden"); wrap.remove(); }, 200);
        }
    },

    showNotification(msg) {
        const n = document.createElement("div");
        n.className = "fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in z-[60]";
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    },

    renderStatsView() {
        const p = Store.data.pomodoro.stats;
        const s1 = document.getElementById("stat-t-sessions"); if (s1) s1.textContent = p.totalSessions;
        const s2 = document.getElementById("stat-t-work"); if (s2) s2.textContent = this.formatDuration(p.totalWork);
        const s3 = document.getElementById("stat-t-break"); if (s3) s3.textContent = this.formatDuration(p.totalBreak);
        const s4 = document.getElementById("stat-t-paused"); if (s4) s4.textContent = p.totalPaused + "с";

        const uEl = document.getElementById("stat-total-uptime");
        if (uEl) {
            let uptimeSecs = Store.getAppUptime ? Store.getAppUptime() : 0;
            if (AppTracker && AppTracker.startTime) {
                const currentSession = (Date.now() - AppTracker.startTime) / 1000;
                if (currentSession > 0) uptimeSecs += currentSession;
            }
            uEl.textContent = this.formatUptime(Math.floor(uptimeSecs));
        }

        const hCont = document.getElementById("stat-habits-container");
        const habits = Store.data.habits;
        const mContainer = document.getElementById("calendar-months");
        if (mContainer) { let mHtml = ""; for (let i = 0; i < 12; i++) mHtml += `<span style="width:30px">${i + 1}</span>`; mContainer.innerHTML = mHtml; }
        if (hCont) {
            if (habits.length === 0) {
                hCont.innerHTML = '<div class="text-gray-500 text-sm">Нет активных привычек</div>';
            } else {
                hCont.innerHTML = habits.map((habit) => {
                    const today = new Date();
                    const map = {};
                    if (habit.history) habit.history.forEach((h) => map[h.date] = (map[h.date] || 0) + 1);
                    let html = "";
                    for (let i = 0; i < 365; i++) {
                        const d = new Date(today);
                        d.setDate(today.getDate() - i);
                        const iso = d.toISOString().split("T")[0];
                        const count = map[iso] || 0;
                        let colorClass = "bg-gray-200";
                        if (count >= 1) colorClass = "bg-green-300";
                        if (count >= 2) colorClass = "bg-green-500";
                        if (count >= 3) colorClass = "bg-green-600";
                        if (count >= 4) colorClass = "bg-green-800";
                        html += `<div class="w-[10px] h-[10px] rounded-[2px] ${colorClass}" title="${iso}: ${count} раз"></div>`;
                    }
                    return `<div class="bg-white p-3 rounded-lg border border-purple-100 shadow-sm mb-4"><div class="flex justify-between items-center mb-2"><span class="font-bold text-gray-800">${habit.name}</span><span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Дней: ${habit.count}</span></div><div class="flex h-auto"><div class="grid grid-rows-7 grid-flow-col gap-[2px] h-[82px] text-[8px] text-gray-400 pt-[2px]"><div>Pn</div><div>Vt</div><div>Sr</div><div>Ch</div><div>Pt</div><div>Sb</div><div>Vs</div></div><div class="overflow-x-auto scale-y-[-1]" style="direction: rtl;"><div class="grid grid-rows-7 grid-flow-col gap-[2px] w-max">${html}</div></div></div></div>`;
                }).join("");
            }
        }

        const wCont = document.getElementById("stat-wheel-container");
        if (wCont) {
            const history = Store.data.wheel.history;
            if (!history || history.length === 0) {
                wCont.innerHTML = '<div class="text-gray-500 text-sm">Нет данных</div>';
            } else {
                const counts = {};
                history.forEach((h) => counts[h.activity] = (counts[h.activity] || 0) + 1);
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                const topList = sorted.slice(0, 5);
                let html = `<div class="text-sm font-bold text-gray-800 mb-2">Всего прокруток: ${history.length}</div>`;
                if (topList.length > 0) {
                    html += `<div class="text-xs text-gray-500 mb-1">Топ активностей:</div>`;
                    html += topList.map(([name, count]) => `<div class="flex justify-between items-center text-sm"><span class="text-gray-700">${name}</span><span class="text-indigo-600 font-bold">${count}</span></div>`).join("");
                }
                wCont.innerHTML = html;
            }
        }
    },

    bindGlobalEvents() {
        document.getElementById("btnExport")?.addEventListener("click", (e) => {
            const dataStr = JSON.stringify(Store.data, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `torture2_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
        document.getElementById("fileImport")?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target.result);
                    if (json && typeof json === "object") { Store.data = { ...Store.data, ...json }; Store.save(); location.reload(); }
                    else { alert("Неверный формат файла!"); }
                } catch (err) { alert("Ошибка чтения файла: " + err); }
            };
            reader.readAsText(file);
        });
    },

    flashTitle(message) {
        if (this.titleInterval) clearInterval(this.titleInterval);
        let on = false;
        this.titleInterval = setInterval(() => { document.title = on ? this.originalTitle : `⚠️ ${message} ⚠️`; on = !on; }, 500);
        setTimeout(() => this.stopFlashTitle(), 20000);
    },
    stopFlashTitle() {
        if (this.titleInterval) { clearInterval(this.titleInterval); this.titleInterval = null; document.title = this.originalTitle; }
    },

    bindNotificationsEvents() {
        document.getElementById("addNotifBtn")?.addEventListener("click", () => {
            const title = document.getElementById("notifTitle").value.trim();
            const interval = document.getElementById("notifInterval").value;
            const isImportant = document.getElementById("notifImportant").checked;
            if (title && interval) {
                Store.addNotification(title, interval, isImportant);
                document.getElementById("notifTitle").value = "";
                document.getElementById("notifInterval").value = 20;
                document.getElementById("notifImportant").checked = false;
                this.renderNotificationsList();
                this.showNotification("Уведомление добавлено");
                if (Notification.permission !== "granted") Notification.requestPermission();
            }
        });
        document.getElementById("notificationsList")?.addEventListener("click", (e) => {
            if (e.target.dataset.action === "delete-notif") {
                const id = parseInt(e.target.dataset.id);
                Store.deleteNotification(id);
                this.renderNotificationsList();
            }
        });
    },

    renderNotificationsList() {
        const container = document.getElementById("notificationsList");
        if (!container) return;
        const list = Store.data.notifications;
        if (list.length === 0) { container.innerHTML = '<div class="text-gray-400 text-center py-4">Нет активных уведомлений</div>'; return; }
        container.innerHTML = list.map((n) => {
            const nextTime = new Date(n.nextTrigger).toLocaleTimeString();
            const importantBadge = n.isImportant ? '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">ВАЖНО</span>' : "";
            const minsSinceLast = (Date.now() - n.lastTrigger) / 60000;
            let statusHtml = "";
            if (n.wasClicked) statusHtml = '<span class="text-green-600 font-bold text-xs flex items-center gap-1">✓ Отвечено</span>';
            else if (minsSinceLast < 1) statusHtml = '<span class="text-orange-500 text-xs flex items-center gap-1">⏳ Сейчас активно</span>';
            else if (minsSinceLast > n.interval) statusHtml = '<span class="text-gray-400 text-xs flex items-center gap-1">错过了 (Пропущено)</span>';
            else statusHtml = '<span class="text-gray-500 text-xs flex items-center gap-1">⏳ Ожидание</span>';
            return `<div class="bg-white p-3 rounded-lg shadow-sm border border-gray-200"><div class="flex justify-between items-center mb-2"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">${n.interval}м</div><div><div class="font-medium">${n.title}</div><div class="text-xs text-gray-500">След: ${nextTime}</div></div>${importantBadge}</div><button data-action="delete-notif" data-id="${n.id}" class="text-gray-400 hover:text-red-500 px-2 py-1">×</button></div><div class="flex justify-between items-center border-t pt-2 mt-1"><div class="flex items-center gap-2">${statusHtml}</div><div class="text-[10px] text-gray-400 font-mono">ID:${n.id}</div></div></div>`;
        }).join("");
    },

    // --- CHAT UI LOGIC (Updated) ---
    bindChatEvents() {
        const view = document.getElementById('view-chat');
        if (!view) return;

        view.addEventListener('click', (e) => {
            if (e.target.id === 'chatSendBtn') this.initiateChatSend();
            if (e.target.id === 'chatClearBtn') {
                Store.clearChatHistory();
                this.renderChatMessages();
            }
        });

        view.addEventListener('keydown', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.initiateChatSend();
            }
        });
    },

    async initiateChatSend() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;

        const tempUserMsg = { id: Date.now(), role: 'user', content: message, timestamp: new Date().toLocaleTimeString() };

        // 1. Визуально показываем
        Store.data.chat.messages.push(tempUserMsg); // Временно в память
        this.renderChatMessages();
        this.scrollToChatBottom();
        this.setChatTyping(true);
        input.value = '';

        // 2. Получаем ЧИСТУЮ историю
        const cleanHistory = Store.data.chat.messages.filter(m => m.role === 'user' || (m.role === 'assistant' && !m.content.startsWith('❌')));

        // 3. Логика
        const result = await ChatLogic.sendMessage(cleanHistory, message);

        // 4. Результат
        if (result.success) {
            Store.addChatMessage('assistant', result.data);
        } else {
            Store.data.chat.messages = Store.data.chat.messages.filter(m => m.id !== tempUserMsg.id);
            this.addSystemMessage(result.message);
        }

        this.setChatTyping(false);
        this.renderChatMessages();
        this.scrollToChatBottom();
    },

    setChatTyping(isTyping) {
        const el = document.getElementById('chatTypingStatus');
        if (el) el.classList.toggle('hidden', !isTyping);
        const btn = document.getElementById('chatSendBtn');
        if (btn) btn.disabled = isTyping;
        const input = document.getElementById('chatInput');
        if (input) input.disabled = isTyping;
    },

    addSystemMessage(text) {
        const container = document.getElementById('chatMessages');
        if (container) {
            const div = document.createElement('div');
            div.className = "flex w-full justify-start";
            div.innerHTML = `
                <div class="max-w-[85%] p-3 rounded-xl bg-gray-100 text-gray-900 border border-gray-200">
                    <div class="text-[10px] opacity-70 mb-1">System · ${new Date().toLocaleTimeString()}</div>
                    <div class="whitespace-pre-wrap text-sm leading-relaxed text-red-600 font-bold">${text}</div>
                </div>
            `;
            container.appendChild(div);
            const el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }
    },

    scrollToChatBottom() {
        const el = document.getElementById('chatMessages');
        if (el) el.scrollTop = el.scrollHeight;
    },

    renderChatScreen() {
        const view = document.getElementById('view-chat');
        if (!view) return;

        const messages = Store.getChatMessages();
        const modelName = window.appConfig?.MIMO_MODEL || "mimo-v2-flash";

        view.innerHTML = `
        <div class="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div class="bg-gray-900 text-white p-4 font-bold flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span>💬 MiMo Chat</span>
                    <span class="text-xs font-normal bg-gray-700 px-2 py-0.5 rounded">${modelName}</span>
                </div>
                <button id="chatClearBtn" class="text-xs bg-gray-700 px-3 py-1 rounded hover:bg-gray-600 transition">🗑️ Очистить</button>
            </div>

            <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                ${messages.length === 0 ? `
                    <div class="flex h-full items-center justify-center text-gray-400 flex-col gap-2">
                        <span class="text-2xl">🤖</span>
                        <span>Напишите что-нибудь...</span>
                    </div>
                ` : ''}
            </div>

            <div id="chatTypingStatus" class="hidden px-4 py-2 text-xs text-gray-500 bg-gray-100 border-t animate-pulse">Бот печатает...</div>

            <div class="p-4 border-t bg-white flex gap-2 items-end">
                <textarea id="chatInput"
                    class="flex-1 border border-gray-300 rounded-lg p-3 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Введите сообщение... (Enter - отправить, Shift+Enter - новая строка)"
                    rows="2"></textarea>
                <button id="chatSendBtn"
                    class="bg-indigo-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap">
                    Отправить
                </button>
            </div>
        </div>
        `;

        this.bindChatEvents();
        this.renderChatMessages();
    },

    renderChatMessages() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const messages = Store.getChatMessages();

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="flex h-full items-center justify-center text-gray-400 flex-col gap-2">
                    <span class="text-2xl">🤖</span>
                    <span>Начните диалог</span>
                </div>`;
            return;
        }

        const html = messages.map(m => {
            const isUser = m.role === 'user';
            return `
            <div class="flex w-full ${isUser ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[85%] p-3 rounded-xl ${isUser ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900 border border-gray-200'}">
                    <div class="text-[10px] opacity-70 mb-1">${isUser ? 'Вы' : 'MiMo'} · ${m.timestamp}</div>
                    <div class="whitespace-pre-wrap text-sm leading-relaxed">${m.content.replace(/</g, "&lt;")}</div>
                </div>
            </div>
        `;
        }).join('');

        container.innerHTML = html;
    },

    // --- Объявление переменных для Reader ---
    readerSessionTimer: null,
    readerSessionStartTime: 0,
    originalTitle: document.title,

    // ------------------------------------------------------------------
    // NEW: LAYERED CONTEXT MENU LOGIC FOR READER
    // ------------------------------------------------------------------

    initReaderContextLogic() {
        document.addEventListener('contextmenu', (e) => {
            // 1. Проверяем, активен ли ридер
            const readerView = document.getElementById('view-reader');
            if (!readerView || readerView.style.display === 'none') return;

            // 2. Проверяем, кликнули ли мы внутри текстового блока
            const readerContent = document.getElementById('readerContent');
            if (!readerContent || !readerContent.contains(e.target)) return;

            // 3. Получаем выделенный текст
            const selection = window.getSelection();
            const text = selection.toString().trim();

            e.preventDefault();

            // 4. Вызываем Первый Уровень (всегда, даже без текста, для UX)
            // Передаем text и флаг hasSelection
            this.showLevel1Menu(e.pageX, e.pageY, text.length > 2, text);
        });

        // Закрытие меню по клику вне меню
        document.addEventListener('click', (e) => {
            this.cleanupContextMenus();
        });
    },

    showLevel1Menu(x, y, hasSelection, text) {
        this.cleanupContextMenus();

        const menu = document.createElement('div');
        menu.className = 'context-menu-layer';
        menu.id = 'context-menu-level-1';

        menu.style.cssText = `
            position: absolute; left: ${x}px; top: ${y}px;
            width: 220px; background: #fff; border: 1px solid #ccc;
            border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10001; font-family: sans-serif; font-size: 14px;
            overflow: hidden; opacity: 0; transform: scale(0.95);
            transition: opacity 0.15s, transform 0.15s;
        `;

        // Пункт: Сноска (Мнемоника)
        const item1 = document.createElement('div');
        item1.innerHTML = hasSelection ? '📝 <b>Сноска (MiMo)</b>' : '📝 <span style="color:#999">Сноска (нет текста)</span>';
        item1.style.cssText = `
            padding: 10px 15px; 
            cursor: ${hasSelection ? 'pointer' : 'not-allowed'}; 
            background: ${hasSelection ? '#fff' : '#f3f4f6'}; 
            border-bottom: 1px solid #f0f0f0;
        `;

        if (hasSelection) {
            item1.onmouseover = () => item1.style.backgroundColor = '#f0f9ff';
            item1.onmouseout = () => item1.style.backgroundColor = '#fff';
            // При нажатии на "Сноска" вызываем Второй Уровень
            item1.onclick = (e) => {
                e.stopPropagation();
                this.showLevel2Menu(x + 5, y + 5, text);
            };
        }

        // Пункт: Прочитать вслух (доступен всегда, если есть текст)
        if (text && text.length > 0) {
            const item2 = document.createElement('div');
            item2.innerHTML = '🔊 Прочитать выделенное';
            item2.style.cssText = 'padding: 10px 15px; cursor: pointer;';
            item2.onmouseover = () => item2.style.backgroundColor = '#f9f9f9';
            item2.onmouseout = () => item2.style.backgroundColor = '#fff';
            item2.onclick = (e) => {
                e.stopPropagation();
                this.speakText(text);
                this.cleanupContextMenus();
            };
            menu.appendChild(item2);
        }

        // Добавляем "Сноска" первым, если есть выделение
        if (hasSelection) menu.appendChild(item1);

        document.body.appendChild(menu);
        requestAnimationFrame(() => {
            menu.style.opacity = '1';
            menu.style.transform = 'scale(1)';
        });
    },

    showLevel2Menu(x, y, text) {
        this.cleanupContextMenus();

        const presets = Store.data.explanationPresets || [];
        if (presets.length === 0) return;

        const menu = document.createElement('div');
        menu.className = 'context-menu-layer';
        menu.id = 'context-menu-level-2';

        menu.style.cssText = `
            position: absolute; left: ${x}px; top: ${y}px;
            width: 280px; background: #fff; border: 1px solid #ccc;
            border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            z-index: 10002; font-family: sans-serif; font-size: 14px;
            overflow: hidden; opacity: 0; transition: opacity 0.2s;
        `;

        // Заголовок с кнопкой "Назад"
        const header = document.createElement('div');
        header.style.cssText = 'padding: 8px 12px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 8px;';

        const backBtn = document.createElement('span');
        backBtn.innerHTML = '← Назад';
        backBtn.style.cssText = 'cursor: pointer; color: #555; font-weight: normal; font-size: 12px; padding: 2px 6px; border-radius: 4px; border: 1px solid #ddd; user-select: none;';
        backBtn.onclick = (e) => {
            e.stopPropagation();
            // Возвращаемся к первому меню, чуть сдвинув координаты
            this.showLevel1Menu(x - 20, y - 20, true, text);
        };

        header.appendChild(backBtn);
        header.appendChild(document.createTextNode('Уровень объяснения'));

        menu.appendChild(header);

        // Генерация пресетов
        presets.forEach(preset => {
            const item = document.createElement('div');
            item.innerText = preset.name;
            item.style.cssText = 'padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;';

            item.onmouseover = () => item.style.backgroundColor = '#f0f9ff';
            item.onmouseout = () => item.style.backgroundColor = '#fff';

            item.onclick = (e) => {
                e.stopPropagation();
                menu.remove();
                this.handleExplanationRequest(text, x, y, preset);
            };

            menu.appendChild(item);
        });

        // Кнопка отмены
        const cancel = document.createElement('div');
        cancel.innerText = 'Отмена';
        cancel.style.cssText = 'padding: 10px; text-align: center; color: #888; cursor: pointer; background: #fafafa;';
        cancel.onclick = (e) => { e.stopPropagation(); this.cleanupContextMenus(); };
        menu.appendChild(cancel);

        document.body.appendChild(menu);

        requestAnimationFrame(() => menu.style.opacity = '1');
    },

    cleanupContextMenus() {
        const menus = document.querySelectorAll('.context-menu-layer');
        menus.forEach(m => m.remove());
    },

    speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ru-RU';
            window.speechSynthesis.speak(utterance);
        } else {
            this.showNotification('Синтез речи не поддерживается');
        }
    },

    // Обработчик запроса (вызывается из Level 2)
    async handleExplanationRequest(text, x, y, preset) {
        this.showExplanationTooltip(`⏳ Запрос: ${preset.name}...`, x, y);

        const settings = Store.data.explanationSettings || {};

        try {
            const response = await fetch(window.appConfig.MIMO_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.MIMO_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: window.appConfig.MIMO_MODEL,
                    messages: [
                        { role: "system", content: preset.prompt },
                        { role: "user", content: `Объясни это: "${text}"` }
                    ],
                    ...(settings.maxTokens && { max_completion_tokens: settings.maxTokens }),
                    temperature: settings.temperature || 0.2
                })
            });

            if (!response.ok) throw new Error("API Error");

            const data = await response.json();
            const explanation = data.choices[0].message.content;
            this.showExplanationTooltip(explanation, x, y);

        } catch (e) {
            this.showExplanationTooltip("⚠️ Ошибка: " + e.message, x, y);
        }
    },

    showExplanationTooltip(text, x, y) {
        const old = document.getElementById('explanation-tooltip');
        if (old) old.remove();

        const div = document.createElement('div');
        div.id = 'explanation-tooltip';

        // Позиционирование (корректировка, чтобы не вылетало за экран)
        const maxX = window.innerWidth - 360;
        const finalX = x > maxX ? maxX : x;

        div.style.cssText = `
            position: fixed; 
            left: ${finalX}px; 
            top: ${y}px;
            width: 340px; 
            background: #ffffff; 
            border: 1px solid #d1d5db;
            border-radius: 8px; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            z-index: 10003; 
            display: flex; flex-direction: column;
            max-height: 60vh; 
            overflow: hidden; 
            font-family: ui-sans-serif, system-ui, sans-serif;
            opacity: 0; animation: fadeIn 0.2s forwards;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px 12px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; align-items: center; color: #1e293b;';
        header.innerText = 'Результат MiMo';

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '8px';

        const copyBtn = document.createElement('button');
        copyBtn.innerText = '📋';
        copyBtn.title = 'Копировать';
        copyBtn.style.cssText = 'cursor: pointer; background: none; border: none; padding: 0; font-size: 14px; opacity: 0.7;';
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(text);
            copyBtn.innerText = '✅';
            setTimeout(() => copyBtn.innerText = '📋', 1000);
        };

        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        closeBtn.style.cssText = 'cursor: pointer; background: none; border: none; padding: 0; font-size: 16px; font-weight: bold; opacity: 0.5;';
        closeBtn.onclick = (e) => { e.stopPropagation(); div.remove(); };

        controls.appendChild(copyBtn);
        controls.appendChild(closeBtn);
        header.appendChild(controls);

        const content = document.createElement('div');
        content.style.cssText = 'padding: 12px; overflow-y: auto; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; flex: 1;';
        content.innerText = text;

        div.appendChild(header);
        div.appendChild(content);
        document.body.appendChild(div);
    }
};