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

                if (target === "view-habits" || target === "view-timer" || target === "view-wheel" || target === "view-notifications" || target === "view-reader" || target === "view-chat" || target === "view-todo" || target === "view-stats" || target === "view-settings" || target === "view-knowledge-avatar") {
                    this.switchView(target);
                }

                document.querySelectorAll("[data-nav]").forEach((b) =>
                    b.classList.remove("bg-white", "shadow-sm", "text-blue-600")
                );
                e.target.classList.add("bg-white", "shadow-sm", "text-blue-600");
            });
        });

        // Global modals
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
                this.cleanupContextMenus();
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

        // Bind events
        this.bindHabitsEvents();
        this.bindTimerEvents();
        this.bindWheelEvents();
        this.bindGlobalEvents();
        this.bindTodoEvents();
        this.bindNotificationsEvents();
        this.bindReaderEvents();
        this.initSettings();
        this.initReaderContextLogic();

        // Initial renders
        this.renderHabits();
        this.renderNotificationsList();

        this.switchView("view-habits");
    },

    // --- CORE NAVIGATION ---
    switchView(viewId) {
        this.cleanupContextMenus();
        document.querySelectorAll(".app-view").forEach((el) => {
            el.classList.remove("active");
            el.style.display = "none";
        });

        const target = document.getElementById(viewId);
        if (target) {
            target.style.display = "block";
            target.classList.add("active");

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
                    ? new Date(f.stats.sessionsHistory[f.stats.sessionsHistory.length - 1].date).toLocaleDateString()
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
            console.warn('No active file or view');
            this.switchView('view-reader');
            return;
        }

        // Отладка: убедимся, что контент есть
        console.log('Rendering file:', file.name);
        console.log('Content length:', file.content ? file.content.length : 0);
        if (!file.content) {
            console.error('File content is missing!');
            this.showNotification('Ошибка: файл не содержит текста');
            return;
        }

        const settings = Store.data.reader.settings;

        view.className = `app-view active p-6 max-w-6xl mx-auto w-full h-[calc(100vh-180px)] ${settings.theme === "dark" ? "bg-gray-900 text-gray-100" : "bg-white text-gray-800"}`;

        const historyHtml = (file.stats.sessionsHistory || []).slice(-3).reverse().map((h) => {
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
                <div class="reader-text-container whitespace-pre-wrap leading-relaxed"></div>
            </div>

            <!-- Bottom Panel -->
            <div class="p-3 rounded-lg shadow-sm ${settings.theme === "dark" ? "bg-gray-800" : "bg-white"}">
                <div class="flex justify-between items-center mb-2">
                    <div class="flex gap-2">
                        <button id="readerStartSession" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">▶️ Начать</button>
                        <button id="readerStopSession" class="hidden bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">⏹️ Стоп</button>
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
                    <div class="mt-1 opacity-70">💡 <i>ПКМ по тексту для объяснения через DeepSeek</i></div>
                </div>
            </div>
        </div>
    `;

        // Вставляем текст безопасно через textContent
        const textContainer = view.querySelector('.reader-text-container');
        if (textContainer) {
            textContainer.textContent = file.content;
        } else {
            console.error('Reader text container not found');
        }

        // Восстанавливаем скролл
        setTimeout(() => {
            const content = document.getElementById("readerContent");
            if (content && file.progress) {
                content.scrollTop = file.progress.scrollTop || 0;
            }
        }, 50);
    },

    // --- KNOWLEDGE AVATAR VIEW (unchanged) ---
    renderKnowledgeAvatarView() {
        const view = document.getElementById("view-knowledge-avatar");
        if (!view) return;

        const stats = Store.getCognitiveAvatarStats();
        const allUnits = Store.data.cognitive.knowledgeUnits;

        const grouped = { active: [], muted: [], ignored: [], mastered: [] };
        allUnits.forEach(unit => {
            let state = Store.data.cognitive.userKnowledgeStates.find(s => s.unitId === unit.id);
            if (!state) {
                state = { id: 'missing', unitId: unit.id, status: 'active', level: 0, history: [], lastUpdated: 0 };
            }
            const displayStatus = state.status === 'unknown' ? 'active' : state.status;
            if (grouped[displayStatus]) {
                grouped[displayStatus].push({ ...unit, state });
            }
        });

        view.innerHTML = `
        <div class="p-6 max-w-4xl mx-auto">
            <div class="flex justify-between items-end mb-6 border-b pb-4">
                <div>
                    <h2 class="text-2xl font-bold flex items-center gap-2">
                        <span>🧠</span> Мой Когнитивный Аватар
                    </h2>
                    <p class="text-gray-500 text-sm">Система хранит ${stats.total} атомов знаний.</p>
                </div>
                <div class="text-right">
                    <div class="text-3xl font-bold text-blue-600">${stats.avgLevel}%</div>
                    <div class="text-xs text-gray-400">Средний уровень владения</div>
                </div>
            </div>

            <div class="bg-blue-50 p-4 rounded-lg mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="text-center md:text-left">
                    <div class="text-sm font-bold text-blue-800 space-x-2">
                        <span class="bg-white px-2 py-1 rounded border">💡 Активных: ${grouped.active.length}</span>
                        <span class="bg-white px-2 py-1 rounded border">🏆 Мастер: ${grouped.mastered.length}</span>
                        <span class="bg-white px-2 py-1 rounded border">🙈 Игнор: ${grouped.ignored.length}</span>
                    </div>
                    <p class="text-xs text-blue-600 mt-1">Игнорируемые знания не участвуют в квизах.</p>
                </div>
                ${grouped.active.length > 0 ? `
                    <button onclick="UI.startQuizFromAvatar('active')" class="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow hover:bg-blue-700 transition whitespace-nowrap">
                        📝 Проверить активные
                    </button>
                ` : ''}

                
                <div class="flex justify-end gap-2 mb-4">
                    <button id="massDeleteActiveBtn" class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">Удалить все активные</button>
                    <button id="massDeleteIgnoredBtn" class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">Удалить все игнорируемые</button>
                    <button id="massDeleteMasteredBtn" class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">Удалить все мастер</button>
                </div>
            </div>

            <div class="flex border-b border-gray-200 mb-4 overflow-x-auto">
                <button onclick="UI.switchAvatarTab('active')" class="tab-btn px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 hover:bg-blue-50" data-tab="active">
                    Активные
                </button>
                <button onclick="UI.switchAvatarTab('mastered')" class="tab-btn px-4 py-2 font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50" data-tab="mastered">
                    Мастер
                </button>
                <button onclick="UI.switchAvatarTab('muted')" class="tab-btn px-4 py-2 font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50" data-tab="muted">
                    Приглушенные
                </button>
                <button onclick="UI.switchAvatarTab('ignored')" class="tab-btn px-4 py-2 font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50" data-tab="ignored">
                    Игнорируемые
                </button>
                <button onclick="UI.switchAvatarTab('deleted')" class="tab-btn px-4 py-2 font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50" data-tab="deleted">
                    🗑️ Удалённые
                </button>
            </div>

            <div id="avatar-content-container" class="min-h-[200px]">
            </div>

            ${allUnits.length === 0 ? `
                <div class="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl mt-4">
                    <p class="text-lg font-medium text-gray-500">Знания еще не извлечены</p>
                    <p class="text-sm mt-2">Загрузите книгу в Reader и запустите <b>AI-анализ</b>.</p>
                </div>
            ` : ''}
        </div>
        `;
        document.getElementById('massDeleteActiveBtn')?.addEventListener('click', () => {
            if (confirm('Удалить все активные знания? Их можно будет восстановить из корзины.')) {
                Store.deleteAllInCategory('active');
                this.renderKnowledgeAvatarView();
            }
        });
        document.getElementById('massDeleteIgnoredBtn')?.addEventListener('click', () => {
            if (confirm('Удалить все игнорируемые знания? Их можно будет восстановить из корзины.')) {
                Store.deleteAllInCategory('ignored');
                this.renderKnowledgeAvatarView();
            }
        });
        document.getElementById('massDeleteMasteredBtn')?.addEventListener('click', () => {
            if (confirm('Удалить все замастеренные знания? Их можно будет восстановить из корзины.')) {
                Store.deleteAllInCategory('mastered');
                this.renderKnowledgeAvatarView();
            }
        });
        this.renderAvatarTabContent('active', grouped);
    },

    switchAvatarTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.className = 'tab-btn px-4 py-2 font-medium text-blue-600 border-b-2 border-blue-600 hover:bg-blue-50';
            } else {
                btn.className = 'tab-btn px-4 py-2 font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50';
            }
        });

        const allUnits = Store.data.cognitive.knowledgeUnits;
        const grouped = { active: [], muted: [], ignored: [], mastered: [] };
        allUnits.forEach(unit => {
            let state = Store.data.cognitive.userKnowledgeStates.find(s => s.unitId === unit.id);
            if (!state) state = { status: 'active', level: 0 };
            const displayStatus = state.status === 'unknown' ? 'active' : state.status;
            if (grouped[displayStatus]) {
                grouped[displayStatus].push({ ...unit, state });
            }
        });

        this.renderAvatarTabContent(tabName, grouped);
    },

    renderAvatarTabContent(tabName, grouped) {
        const container = document.getElementById('avatar-content-container');
        if (!container) return;

        const items = grouped[tabName];
        items.sort((a, b) => (b.state.lastUpdated || 0) - (a.state.lastUpdated || 0));
        if (items.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
                    <p>Нет знаний в этой категории.</p>
                </div>
            `;
            return;
        }

        let controls = '';
        if (tabName === 'active') {
            controls = `
                <div class="mb-4 text-right">
                     <button onclick="UI.startQuizFromAvatar('active')" class="bg-blue-100 text-blue-700 px-4 py-1.5 rounded hover:bg-blue-200 text-sm font-medium">
                        📝 Начать проверку
                    </button>
                </div>
            `;
        }

        const cards = items.map(item => {
            const state = item.state;
            const progress = Math.round(state.level * 100);

            let progressColor = 'bg-blue-500';
            if (tabName === 'mastered') progressColor = 'bg-green-500';
            if (tabName === 'ignored') progressColor = 'bg-red-400';

            const statusBadge = tabName === 'active'
                ? `<span class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Активно</span>`
                : `<span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded capitalize">${tabName}</span>`;

            return `
                <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer relative group"
                     onclick="UI.showKnowledgeDetails('${item.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-semibold text-gray-800 leading-tight">${item.title}</div>
                        <div class="flex flex-col items-end gap-1">
                            ${statusBadge}
                            <span class="text-[10px] text-gray-400 font-mono uppercase">${item.type}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <div class="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div class="${progressColor} h-full rounded-full" style="width: ${progress}%"></div>
                        </div>
                        <span class="text-xs font-mono text-gray-500 w-8 text-right">${progress}%</span>
                    </div>

                    ${tabName === 'active' ? `
                        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                             <button onclick="event.stopPropagation(); UI.quickChangeStatus('${item.id}', 'ignored')" 
                                class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-100">
                                Игнор
                            </button>
                        </div>
                    ` : ''}


                    ${tabName === 'ignored' || tabName === 'muted' || tabName === 'mastered' || tabName === 'active' ? `
                        <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
                            <button onclick="event.stopPropagation(); UI.deleteKnowledgeUnit('${item.id}')" 
                                class="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-100">
                                🗑️
                            </button>
                        </div>
                    ` : ''}



                </div>
            `;
        }).join('');

        container.innerHTML = controls + `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${cards}</div>`;
    },


    async handleAddToAvatar(text) {
        const activeFile = Store.getActiveFile();
        const sourceFileId = activeFile ? activeFile.id : null;
        this.showExplanationTooltip('⏳ Анализирую выделенный текст...', 0, 0, true);
        try {
            const result = await Store.addKnowledgeFromFragment(text, 'Выделенный фрагмент', sourceFileId, (percent) => {
                UI.showProgress(percent);
            });

            if (result.success && result.unitsCount > 0) {
                this.showNotification(`✅ Добавлено знаний: ${result.unitsCount}. Обновите Аватар.`);
                if (confirm('Перейти в Аватар знаний сейчас?')) {
                    this.switchView('view-knowledge-avatar');
                }
            } else {
                this.showNotification('❌ Не удалось извлечь знания. Попробуйте другой фрагмент.');
            }
        } catch (error) {
            console.error('Add to avatar error:', error);
            this.showNotification('❌ Ошибка при добавлении знаний');
        } finally {
            const tooltip = document.getElementById('explanation-tooltip');
            if (tooltip) tooltip.remove();
        }
    },

    async handleMultipleAddToAvatar(fragments) {
        let totalAdded = 0;
        this.showProgress(0);
        for (let i = 0; i < fragments.length; i++) {
            const frag = fragments[i];
            const activeFile = Store.getActiveFile();
            const sourceFileId = activeFile ? activeFile.id : null;
            const result = await Store.addKnowledgeFromFragment(frag, 'Выделенный фрагмент', sourceFileId, (percent) => {
                // прогресс по одному фрагменту, общий прогресс = (i + percent/100) / fragments.length
                const overall = (i + percent / 100) / fragments.length;
                UI.showProgress(overall * 100);
            });
            if (result.success) totalAdded += result.unitsCount;
        }
        this.hideProgress();
        this.showNotification(`✅ Добавлено знаний: ${totalAdded}`);
        if (confirm('Перейти в Аватар знаний сейчас?')) {
            this.switchView('view-knowledge-avatar');
        }
    },

    quickChangeStatus(unitId, newStatus) {
        const stateIndex = Store.data.cognitive.userKnowledgeStates.findIndex(s => s.unitId === unitId);
        if (stateIndex === -1) return;

        Store.data.cognitive.userKnowledgeStates[stateIndex].status = newStatus;
        Store.data.cognitive.userKnowledgeStates[stateIndex].lastUpdated = Date.now();
        Store.save();

        const currentTab = document.querySelector('.tab-btn.text-blue-600').dataset.tab;
        this.switchAvatarTab(currentTab);

        this.showNotification(`Статус изменен на: ${newStatus}`);
    },


    deleteKnowledgeUnit(unitId) {
        if (confirm('Удалить это знание навсегда?')) {
            Store.deleteKnowledgeUnit(unitId);
            // Перерисовать текущую вкладку
            const currentTab = document.querySelector('.tab-btn.text-blue-600').dataset.tab;
            this.switchAvatarTab(currentTab);
            this.showNotification('Знание удалено');
        }
    },

    startQuizFromAvatar(filter) {
        const file = Store.getActiveFile();
        if (!file) {
            this.showNotification("Нет активного файла для проверки");
            return;
        }

        this.renderModal("quizModal", `<div id="quizContainer"><div class="text-center p-4 text-white">Инициализация квиза...</div></div>`);
        this.renderQuizModal(file.id);
    },

    showKnowledgeDetails(unitId) {
        const unit = Store.data.cognitive.knowledgeUnits.find(u => u.id === unitId);
        if (!unit) return;

        const block = Store.data.cognitive.semanticBlocks.find(b => b.id === unit.sourceBlockIds[0]);
        const sourceText = block ? block.summary : "Источник не найден";

        this.renderModal("knowledgeDetail", `
            <div class="bg-white rounded-lg p-6 w-[700px] max-h-[80vh] overflow-y-auto shadow-xl">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-xl font-bold text-gray-800">${unit.title}</h2>
                        <span class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">${unit.type}</span>
                    </div>
                    <button onclick="UI.closeModal('knowledgeDetail')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>
                
                <div class="mb-6">
                    <h4 class="text-sm font-bold text-gray-500 uppercase">Описание</h4>
                    <p class="text-gray-800 mt-1">${unit.description}</p>
                </div>
                
                <div class="bg-gray-50 p-4 rounded border mb-4">
                    <h4 class="text-sm font-bold text-gray-500 uppercase">Источник (контекст)</h4>
                    <p class="text-sm text-gray-600 mt-1 italic">"${sourceText}"</p>
                </div>

                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="UI.closeModal('knowledgeDetail')" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Закрыть</button>
                </div>
            </div>
        `);
    },

    renderQuizModal(fileId) {
        const container = document.getElementById("quizContainer");
        if (!container) return;

        CognitiveQuiz.startSession(fileId).then(result => {
            if (!result.success) {
                container.innerHTML = `<div class="text-red-500 p-4">${result.message}</div>`;
                return;
            }
            this.showQuizQuestion(container);
        });
    },

    showQuizQuestion(container) {
        const q = CognitiveQuiz.getCurrentQuestion();
        console.log('[Quiz] showQuizQuestion called, current question index:', CognitiveQuiz.currentQuestionIndex, 'question exists:', !!q);



        if (!q) {
            container.innerHTML = `
                <div class="text-center p-6">
                    <h3 class="text-xl font-bold text-green-600 mb-2">✅ Квиз завершен!</h3>
                    <p class="text-gray-600">Вы повторили знания. Уровень владения обновлен.</p>
                    <button onclick="UI.closeModal('quizModal')" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Закрыть</button>
                </div>
            `;
            CognitiveQuiz.reset();
            return;
        }

        container.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-[600px] shadow-xl">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-sm text-gray-500">Вопрос ${CognitiveQuiz.currentQuestionIndex + 1} из ${CognitiveQuiz.currentQuiz.questions.length}</span>
                    <span class="text-xs px-2 py-1 bg-gray-100 rounded">${q.type.toUpperCase()}</span>
                </div>
                
                <h3 class="text-xl font-bold text-gray-800 mb-6">${q.questionText}</h3>
                
                <textarea id="quizAnswerInput" class="w-full border rounded p-3 h-24 mb-4 focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Введите ваш ответ..."></textarea>
                
                <div class="flex justify-end gap-3">
                    <button onclick="UI.skipQuizQuestion()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition">
                        Пропустить
                    </button>
                    <button onclick="UI.processQuizAnswer('${q.id}')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
                        Проверить
                    </button>
                </div>
                <div id="quizFeedback" class="mt-2 h-6 text-sm font-bold"></div>
            </div>
        `;
    },

    skipQuizQuestion(e) {
        if (e) e.stopPropagation();
        console.log('[Quiz] Skip clicked');
        const q = CognitiveQuiz.getCurrentQuestion();
        if (q) {
            Store.updateKnowledgeAfterQuiz(q.id, false);
            console.log('[Quiz] Marked as incorrect (skipped) for unit:', q.id);
        }

        const next = CognitiveQuiz.nextQuestion();
        console.log('[Quiz] After skip, current index:', CognitiveQuiz.currentQuestionIndex, 'next exists:', !!next);

        const modal = document.querySelector('#quizModal');
        if (!modal) {
            console.warn('[Quiz] Modal not found, maybe already closed');
            return;
        }

        const container = modal.querySelector('#quizContainer');
        if (!container) {
            console.error('[Quiz] quizContainer not found');
            return;
        }

        if (next) {
            this.showQuizQuestion(container);
            console.log('[Quiz] Rendered next question');
        } else {
            console.log('[Quiz] No more questions, closing modal');
            this.closeModal('quizModal');
            CognitiveQuiz.reset();
        }
    },

    async processQuizAnswer(unitId) {
        const input = document.getElementById("quizAnswerInput");
        const feedback = document.getElementById("quizFeedback");
        const q = CognitiveQuiz.getCurrentQuestion();

        if (!q) return;

        input.disabled = true;
        feedback.textContent = "Проверка ответа...";

        const isCorrect = await CognitiveQuiz.checkAnswer(input.value, q);

        if (isCorrect) {
            feedback.textContent = "✅ Верно!";
            feedback.className = "mt-2 h-6 text-sm font-bold text-green-600";
            Store.updateKnowledgeAfterQuiz(unitId, true);
        } else {
            feedback.textContent = `❌ Неверно.`;
            feedback.className = "mt-2 h-6 text-sm font-bold text-red-600";
            Store.updateKnowledgeAfterQuiz(unitId, false);
        }

        const modal = document.querySelector('#quizModal');
        if (!modal) return;

        const btnContainer = modal.querySelector('.flex.justify-end.gap-3');
        if (btnContainer) {
            btnContainer.innerHTML = `
                <button onclick="UI.nextQuizStep()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition shadow">
                    Далее →
                </button>
            `;
        }
    },

    nextQuizStep(e) {
        if (e) e.stopPropagation();
        const next = CognitiveQuiz.nextQuestion();
        const modal = document.querySelector('#quizModal');
        if (modal && next) {
            this.showQuizQuestion(modal.querySelector('#quizContainer'));
        } else {
            this.closeModal('quizModal');
            CognitiveQuiz.reset();
        }
    },

    // --- SETTINGS UI ---
    initSettings() {
        const btn = document.getElementById('saveSettingsBtn');
        if (btn) {
            btn.onclick = () => {
                const settings = {
                    maxTokens: parseInt(document.getElementById('settingMaxTokens').value),
                    temperature: parseFloat(document.getElementById('settingTemperature').value),
                    autoRequest: document.getElementById('settingAutoRequest').checked,
                };
                Store.updateExplanationSettings(settings);

                const presets = [];
                const presetContainers = document.querySelectorAll('.preset-item');

                presetContainers.forEach(item => {
                    const id = item.dataset.id;
                    const nameInput = item.querySelector('.preset-name');
                    const promptInput = item.querySelector('.preset-prompt');

                    if (nameInput.value.trim() && promptInput.value.trim()) {
                        presets.push({
                            id: id || Date.now().toString(),
                            name: nameInput.value.trim(),
                            prompt: promptInput.value.trim()
                        });
                    }
                });

                if (presets.length > 0) {
                    Store.updateExplanationPresets(presets);
                }

                const status = document.getElementById('saveStatus');
                status.classList.remove('hidden');
                setTimeout(() => status.classList.add('hidden'), 2000);

                this.renderSettingsView();
            };
        }
    },

    renderSettingsView() {
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

            const addBtn = document.createElement('button');
            addBtn.className = 'w-full py-2 border border-dashed border-blue-300 text-blue-500 rounded hover:bg-blue-50 text-sm';
            addBtn.innerText = '+ Добавить пресет';
            addBtn.onclick = () => {
                const div = document.createElement('div');
                div.className = 'preset-item bg-blue-50 p-3 rounded border border-blue-200';
                div.innerHTML = `
                     <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <div><input type="text" class="preset-name w-full border rounded px-2 py-1 text-sm" placeholder="Название (например: Детский)"></div>
                        <div class="md:col-span-2"><input type="text" class="preset-prompt w-full border rounded px-2 py-1 text-sm" placeholder="Промпт..."></div>
                    </div>
                    <div class="flex justify-end"><button class="text-red-500 hover:text-red-700 text-xs delete-preset">Отмена</button></div>
                `;
                container.insertBefore(div, container.firstChild);
            };
            container.appendChild(addBtn);

            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-preset')) {
                    e.target.closest('.preset-item').remove();
                }
            });
        }

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

    // --- READER EVENTS (With AI Analyze & progress) ---
    bindReaderEvents() {
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#view-reader")) return;

            const btn = e.target.closest("button");
            if (!btn) return;

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
                this.renderModal("quizModal", `<div id="quizContainer"><div class="text-center p-4 text-white">Инициализация квиза...</div></div>`);
                this.renderQuizModal(file.id);
                return;
            }

            if (btn.id === "readerAiAnalyzeBtn") {
                const file = Store.getActiveFile();
                if (!file) return UI.showNotification("Сначала загрузите файл");

                btn.disabled = true;
                btn.innerText = "⏳ Обработка...";

                CognitiveProcessor.processFile(file.id, (progress) => {
                    btn.innerText = `⏳ ${progress}`;
                })
                    .then((result) => {
                        if (result.success) {
                            UI.showNotification(`✅ Готово! Извлечено знаний: ${result.unitsCount}`);
                            btn.innerText = `🤖 Аналитика завершена (${result.unitsCount})`;
                        } else {
                            UI.showNotification(`❌ Ошибка: ${result.error}`);
                            btn.innerText = "🤖 Ошибка, попробуйте снова";
                        }
                        if (result.success && result.unitsCount > 0) {
                            setTimeout(() => {
                                UI.switchView('view-knowledge-avatar');
                            }, 1000);
                        }
                    })
                    .catch((err) => {
                        console.error("AI-Analyze Error:", err);
                        UI.showNotification("❌ Критическая ошибка анализа");
                        btn.innerText = "🤖 Ошибка";
                    })
                    .finally(() => {
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.innerText = "🤖 AI-анализ";
                        }, 2000);
                    });

                return;
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
            <div class="bg-white rounded-lg p-6 min-w-80 shadow-xl">
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
            this.renderModal("kanbanCol", `<div class="bg-white rounded-lg p-6 min-w-80 shadow-xl"><h3 class="font-bold text-lg mb-4">Новая колонка</h3><input id="kanbanColTitle" type="text" placeholder="Название..." class="w-full border p-2 rounded mb-4"><div class="flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveKanbanCol" class="px-3 py-1 bg-blue-500 text-white rounded">Создать</button></div></div>`);
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
                    this.renderModal("kanbanCard", `<div class="bg-white rounded-lg p-6 min-w-80 shadow-xl"><h3 class="font-bold text-lg mb-4">Новая задача</h3><input id="kanbanCardTitle" type="text" placeholder="Заголовок" class="w-full border p-2 rounded mb-2"><textarea id="kanbanCardDesc" placeholder="Описание" class="w-full border p-2 rounded mb-4 h-24"></textarea><div class="flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveKanbanCard" class="px-3 py-1 bg-green-500 text-white rounded">Добавить</button></div></div>`);
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
                        this.renderModal("editCard", `<div class="bg-white rounded-lg p-6 min-w-80 shadow-xl"><h3 class="font-bold text-lg mb-4">Редактировать задачу</h3><input id="editCardTitle" type="text" value="${card.title}" class="w-full border p-2 rounded mb-2"><textarea id="editCardDesc" placeholder="Описание" class="w-full border p-2 rounded mb-4 h-24">${card.description || ""}</textarea><div class="flex justify-end gap-2"><button data-close-modal class="px-3 py-1 rounded hover:bg-gray-100">Отмена</button><button id="saveEditedCard" class="px-3 py-1 bg-blue-500 text-white rounded">Сохранить</button></div></div>`);
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

        container.innerHTML = `
            <div id="modal_${id}" class="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 modal-hidden" onclick="if(event.target.id === 'modal_${id}') UI.closeModal('${id}')">
                <div class="transform transition-all scale-95 opacity-0" id="modal_content_${id}" onclick="event.stopPropagation()">
                    ${html}
                </div>
            </div>
        `;

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
        Store.addNotificationHistory(msg, 'info'); // или 'success'/'error'
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
        document.getElementById('openNotificationsHistoryBtn')?.addEventListener('click', () => {
            this.showNotificationsHistory();
        });

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

    // --- CHAT UI LOGIC (DeepSeek only) ---
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

        Store.addChatMessage('user', message);
        this.renderChatMessages();
        this.scrollToChatBottom();
        this.setChatTyping(true);
        input.value = '';
        input.disabled = true;

        try {
            const apiUrl = window.appConfig.DEEPSEEK_API_URL;
            const headers = {
                'Authorization': `Bearer ${window.appConfig.DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json'
            };
            const body = {
                model: window.appConfig.DEEPSEEK_MODEL,
                messages: [
                    { role: 'system', content: 'Ты — полезный ассистент.' },
                    ...Store.data.chat.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
                ],
                max_tokens: 500,
                temperature: 0.7
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const reply = data.choices[0].message.content;

            Store.addChatMessage('assistant', reply);
            this.renderChatMessages();
            this.scrollToChatBottom();
        } catch (error) {
            console.error('Chat error:', error);
            Store.addChatMessage('assistant', `❌ Ошибка: ${error.message}`);
            this.renderChatMessages();
        } finally {
            this.setChatTyping(false);
            input.disabled = false;
            input.focus();
        }
    },

    setChatTyping(isTyping) {
        const el = document.getElementById('chatTypingStatus');
        if (el) el.classList.toggle('hidden', !isTyping);
        const btn = document.getElementById('chatSendBtn');
        if (btn) btn.disabled = isTyping;
        const input = document.getElementById('chatInput');
        if (input) input.disabled = isTyping;
    },

    scrollToChatBottom() {
        const el = document.getElementById('chatMessages');
        if (el) el.scrollTop = el.scrollHeight;
    },

    renderChatScreen() {
        const view = document.getElementById('view-chat');
        if (!view) return;

        const messages = Store.getChatMessages();

        view.innerHTML = `
        <div class="flex flex-col h-full bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div class="bg-gray-900 text-white p-4 font-bold flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span>💬 DeepSeek Chat</span>
                    <span class="text-xs font-normal bg-gray-700 px-2 py-0.5 rounded">${window.appConfig.DEEPSEEK_MODEL}</span>
                </div>
                <button id="chatClearBtn" class="text-xs bg-gray-700 px-3 py-1 rounded hover:bg-gray-600 transition">🗑️ Очистить</button>
            </div>
            <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                ${messages.length === 0 ? `
                    <div class="flex h-full items-center justify-center text-gray-400 flex-col gap-2">
                        <span class="text-2xl">🤖</span>
                        <span>Начните диалог с DeepSeek</span>
                    </div>
                ` : ''}
            </div>
            <div id="chatTypingStatus" class="hidden px-4 py-2 text-xs text-gray-500 bg-gray-100 border-t animate-pulse">
                DeepSeek печатает...
            </div>
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
                    <div class="text-[10px] opacity-70 mb-1">${isUser ? 'Вы' : 'DeepSeek'} · ${m.timestamp}</div>
                    <div class="whitespace-pre-wrap text-sm leading-relaxed">${m.content.replace(/</g, "&lt;")}</div>
                </div>
            </div>
        `;
        }).join('');

        container.innerHTML = html;
    },

    // --- Reader Context Menu (DeepSeek) ---
    readerSessionTimer: null,
    readerSessionStartTime: 0,
    originalTitle: document.title,

    initReaderContextLogic() {
        document.addEventListener('contextmenu', (e) => {
            const readerView = document.getElementById('view-reader');
            if (!readerView || readerView.style.display === 'none') return;

            const readerContent = document.getElementById('readerContent');
            if (!readerContent || !readerContent.contains(e.target)) return;

            const selection = window.getSelection();
            const text = selection.toString().trim();

            e.preventDefault();

            this.showLevel1Menu(e.pageX, e.pageY, text.length > 2, text);
        });

        // ---------- НОВОЕ: множественное выделение с Alt ----------
        const readerContent = document.getElementById('readerContent');
        if (!readerContent) return;

        let altPressed = false;
        let savedRanges = [];

        document.addEventListener('keydown', (e) => {
            if (e.altKey) altPressed = true;
        });
        document.addEventListener('keyup', (e) => {
            if (!e.altKey) altPressed = false;
        });

        readerContent.addEventListener('mouseup', (e) => {
            if (altPressed) {
                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    const newRange = sel.getRangeAt(0).cloneRange();
                    savedRanges.push(newRange);
                    sel.removeAllRanges();
                    savedRanges.forEach(r => sel.addRange(r));
                }
            } else {
                savedRanges = [];
            }
        });

    },

    showLevel1Menu(x, y, hasSelection, text) {
        this.cleanupContextMenus();

        const selection = window.getSelection();
        const rangeCount = selection.rangeCount;
        const hasMultiple = rangeCount > 1;

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

        // Пункт для одиночного выделения (Сноска)
        if (hasSelection && !hasMultiple) {
            const item1 = document.createElement('div');
            item1.innerHTML = '📝 <b>Сноска (DeepSeek)</b>';
            item1.style.cssText = `padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;`;
            item1.onmouseover = () => item1.style.backgroundColor = '#f0f9ff';
            item1.onmouseout = () => item1.style.backgroundColor = '#fff';
            item1.onclick = (e) => {
                e.stopPropagation();
                this.showLevel2Menu(x + 5, y + 5, text);
            };
            menu.appendChild(item1);
        }

        // Пункт для множественного выделения
        if (hasMultiple) {
            const itemMulti = document.createElement('div');
            itemMulti.innerHTML = '📌 Добавить все выделенные фрагменты в Аватар';
            itemMulti.style.cssText = `padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;`;
            itemMulti.onmouseover = () => itemMulti.style.backgroundColor = '#f0f9ff';
            itemMulti.onmouseout = () => itemMulti.style.backgroundColor = '#fff';
            itemMulti.onclick = async (e) => {
                e.stopPropagation();
                this.cleanupContextMenus();
                const fragments = [];
                for (let i = 0; i < selection.rangeCount; i++) {
                    const frag = selection.getRangeAt(i).toString().trim();
                    if (frag) fragments.push(frag);
                }
                if (fragments.length) await this.handleMultipleAddToAvatar(fragments);
            };
            menu.appendChild(itemMulti);
        }

        // Пункт "Прочитать выделенное" (если есть текст)
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

        // Пункт для одиночного выделения: Добавить в Аватар (если не множественное)
        if (hasSelection && !hasMultiple) {
            const item3 = document.createElement('div');
            item3.innerHTML = '🧠 Добавить в Аватар знаний';
            item3.style.cssText = 'padding: 10px 15px; cursor: pointer; border-top: 1px solid #f0f0f0;';
            item3.onmouseover = () => item3.style.backgroundColor = '#e8f4ff';
            item3.onmouseout = () => item3.style.backgroundColor = '#fff';
            item3.onclick = async (e) => {
                e.stopPropagation();
                this.cleanupContextMenus();
                await this.handleAddToAvatar(text);
            };
            menu.appendChild(item3);
        }

        // Если не было ни одного пункта, добавить заглушку
        if (menu.children.length === 0) {
            const empty = document.createElement('div');
            empty.innerText = 'Нет действий';
            empty.style.cssText = 'padding: 10px 15px; color: #888;';
            menu.appendChild(empty);
        }

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
            z-index: 10010!important; font-family: sans-serif; font-size: 14px;
            overflow: hidden; opacity: 0; transition: opacity 0.2s;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'padding: 8px 12px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 8px;';

        const backBtn = document.createElement('span');
        backBtn.innerHTML = '← Назад';
        backBtn.style.cssText = 'cursor: pointer; color: #555; font-weight: normal; font-size: 12px; padding: 2px 6px; border-radius: 4px; border: 1px solid #ddd; user-select: none;';
        backBtn.onclick = (e) => {
            e.stopPropagation();
            this.showLevel1Menu(x - 20, y - 20, true, text);
        };

        header.appendChild(backBtn);
        header.appendChild(document.createTextNode('Уровень объяснения'));

        menu.appendChild(header);

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

    async handleExplanationRequest(text, x, y, preset) {
        UI.showProgress(0);
        // Показываем тултип с ожиданием, передаём originalText = text
        this.showExplanationTooltip(`⏳ Запрос: ${preset.name}...`, x, y, text);
        const settings = Store.data.explanationSettings || {};

        try {
            const response = await fetch(window.appConfig.DEEPSEEK_API_URL, {

                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: window.appConfig.DEEPSEEK_MODEL,
                    messages: [
                        { role: "system", content: preset.prompt },
                        { role: "user", content: `Объясни это: "${text}"` }
                    ],
                    max_tokens: settings.maxTokens || 500,
                    temperature: settings.temperature || 0.2
                })
            });
            UI.showProgress(100);

            if (!response.ok) throw new Error("API Error");
            const data = await response.json();
            const explanation = data.choices[0].message.content;
            // После получения ответа показываем результат, передаём originalText = text
            this.showExplanationTooltip(explanation, x, y, text);
        } catch (e) {
            UI.hideProgress();
            this.showExplanationTooltip("⚠️ Ошибка: " + e.message, x, y, text);
        } finally {
            setTimeout(() => UI.hideProgress(), 500);
        }

    },

    showExplanationTooltip(text, x, y, originalText = '') {
        const old = document.getElementById('explanation-tooltip');
        if (old) old.remove();

        const div = document.createElement('div');
        div.id = 'explanation-tooltip';

        // Позиционирование
        const maxX = window.innerWidth - 360;
        const finalX = x > maxX ? maxX : x;
        div.style.position = 'fixed';
        div.style.left = finalX + 'px';
        div.style.top = y + 'px';
        div.style.width = '340px';
        div.style.minWidth = '200px';
        div.style.backgroundColor = '#ffffff';
        div.style.border = '1px solid #d1d5db';
        div.style.borderRadius = '8px';
        div.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
        div.style.zIndex = '10003';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.maxHeight = '60vh';
        div.style.overflow = 'hidden';
        div.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
        div.style.opacity = '0';
        div.style.animation = 'fadeIn 0.2s forwards';

        // Заголовок (перетаскиваемый)
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px 12px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; align-items: center; color: #1e293b; cursor: move; user-select: none;';
        header.innerText = 'Результат DeepSeek';

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

        // Содержимое
        const content = document.createElement('div');
        content.style.cssText = 'padding: 12px; overflow-y: auto; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; flex: 1;';
        content.innerText = text;

        // Кнопка добавления в аватар
        if (originalText) {
            const addBtn = document.createElement('button');
            addBtn.innerText = '🧠 Добавить в Аватар';
            addBtn.style.cssText = 'margin-top: 10px; background: #e8f4ff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 12px; width: 100%;';
            addBtn.onclick = async (e) => {
                e.stopPropagation();
                await this.handleAddToAvatar(originalText);
                div.remove();
            };
            content.appendChild(addBtn);
        }

        // Ресайз уголок
        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = 'position: absolute; bottom: 2px; right: 2px; width: 10px; height: 10px; cursor: nw-resize; background: rgba(0,0,0,0.1); border-radius: 2px;';
        let resizeActive = false;
        resizeHandle.onmousedown = (e) => {
            e.stopPropagation();
            resizeActive = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = div.offsetWidth;
            const startHeight = div.offsetHeight;
            const onMouseMove = (moveEvent) => {
                if (!resizeActive) return;
                const newWidth = startWidth + (moveEvent.clientX - startX);
                const newHeight = startHeight + (moveEvent.clientY - startY);
                if (newWidth > 200) div.style.width = newWidth + 'px';
                if (newHeight > 150) div.style.height = newHeight + 'px';
            };
            const onMouseUp = () => {
                resizeActive = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        // Перетаскивание
        let dragActive = false;
        let offsetX, offsetY;
        header.onmousedown = (e) => {
            if (e.target === copyBtn || e.target === closeBtn) return;
            dragActive = true;
            offsetX = e.clientX - div.offsetLeft;
            offsetY = e.clientY - div.offsetTop;
            const onMouseMove = (moveEvent) => {
                if (!dragActive) return;
                div.style.left = (moveEvent.clientX - offsetX) + 'px';
                div.style.top = (moveEvent.clientY - offsetY) + 'px';
            };
            const onMouseUp = () => {
                dragActive = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        div.appendChild(header);
        div.appendChild(content);
        div.appendChild(resizeHandle);
        document.body.appendChild(div);

        // Контекстное меню внутри div (для выделения текста)
        div.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            if (selectedText) {
                // Показываем меню для выделенного внутри сноски
                this.showLevel1Menu(e.pageX, e.pageY, true, selectedText);
            }
        });

        // Запрещаем закрытие при клике внутри (кроме кнопок)
        div.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    },

    // progress bar


    showProgress(percent) {
        const container = document.getElementById('globalProgress');
        const bar = document.getElementById('globalProgressBar');
        if (!container || !bar) return;
        container.classList.remove('hidden');
        bar.style.width = `${percent}%`;
    },

    hideProgress() {
        const container = document.getElementById('globalProgress');
        if (container) container.classList.add('hidden');
    },


    showNotificationsHistory() {
        const history = Store.data.notificationHistory || [];
        const html = `
        <div class="bg-white rounded-lg p-4 w-[500px] max-h-[70vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-bold">История уведомлений</h3>
                <button id="clearNotifHistoryBtn" class="text-xs text-red-500">Очистить все</button>
            </div>
            ${history.length === 0 ? '<div class="text-gray-400 text-center py-4">Нет уведомлений</div>' : ''}
            <div class="space-y-2">
                ${history.map(n => `
                    <div class="p-2 border rounded ${n.read ? 'bg-gray-50' : 'bg-blue-50'}">
                        <div class="flex justify-between">
                            <span class="text-sm">${n.message}</span>
                            <span class="text-xs text-gray-400">${new Date(n.timestamp).toLocaleTimeString()}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-3 flex justify-end">
                <button data-close-modal class="px-3 py-1 bg-gray-200 rounded">Закрыть</button>
            </div>
        </div>
    `;
        this.renderModal('notificationsHistory', html);
        document.getElementById('clearNotifHistoryBtn')?.addEventListener('click', () => {
            Store.clearNotificationHistory();
            this.closeModal('notificationsHistory');
            this.showNotificationsHistory();
        });
    },

};