/**
 * ------------------------------------------------------------------
 * UNIFIED DATA STORE
 * ------------------------------------------------------------------
 */
const Store = {
    key: "torture2_data_v1",
    data: {
        habits: [],
        achievements: [],
        habitSettings: { goal: 5, color: "blue" },
        tempSubtasks: [],
        pomodoro: {
            stats: { totalSessions: 0, totalWork: 0, totalBreak: 0, totalPaused: 0 },
            settings: { work: 25, short: 5, long: 15, longCycle: 4 },
        },
        pomodoroState: null,
        wheel: { history: [] },
        appStats: { totalUptime: 0, lastSeen: Date.now() },
        kanban: { columns: [], cards: [] },
        notifications: [],
        reader: {
            activeFileId: null,
            files: [],
            settings: { fontSize: 20, theme: 'dark' }
        },
        chat: {
            messages: [],
            isTyping: false
        },
        // Важно: структура должна быть идентичной той, что сохраняется
        explanationSettings: {
            maxTokens: 500,
            temperature: 0.2,
            autoRequest: false, // Лучше false, чтобы пользователь осознанно выбирал пресет
        },
        // Новый массив пресетов
        explanationPresets: [
            {
                id: 'p1',
                name: '🤔 Совсем не понимаю (как пятилетнему)',
                prompt: 'Ты — терпеливый учитель. Объясни смысл этого текста максимально просто, без сложных терминов, будто я ребенок 5 лет.'
            },
            {
                id: 'p2',
                name: '📚 Обычный (владею контекстом)',
                prompt: 'Ты — эксперт. Объясни смысл выделенного фрагмента текста на русском языке. Учитывай, что у меня есть базовое понимание темы.'
            },
            {
                id: 'p3',
                name: '🚀 Гуру (только суть)',
                prompt: 'Ты — профессионал. Дай краткий, структурированный разбор, убери "воду". Я знаком с контекстом, мне нужны только ключевые выводы.'
            }
        ],

        // ------------------------------------------------------------------
        // NEW: COGNITIVE CORE ARCHITECTURE (PHASE 1)
        // ------------------------------------------------------------------
        cognitive: {
            // Документы: связь между Reader файлами и семантической моделью
            documents: [],
            // Семантические блоки: структурированные фрагменты текста
            semanticBlocks: [],
            // Атомы знаний: индексируемые сущности (факты, концепции, процедуры)
            knowledgeUnits: [],
            // Состояние знаний пользователя: прогресс для каждого атома
            userKnowledgeStates: [],
            // Когнитивный аватар: профиль пользователя и фокусы
            cognitiveAvatar: {
                id: 'main',
                knowledgeGraph: [], // IDs userKnowledgeStates
                focusTopics: [], // titles knowledgeUnits
                stats: {
                    totalUnits: 0,
                    masteredUnits: 0,
                    conceptsLearned: 0
                }
            }
        }
    },

    // Метод инициализации и загрузки данных
    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);

                // --- Логика слияния (Merge) ---

                // Basics
                this.data.habits = parsed.habits || [];
                this.data.achievements = parsed.achievements || [];
                this.data.habitSettings = { ...this.data.habitSettings, ...parsed.habitSettings };
                this.data.tempSubtasks = parsed.tempSubtasks || [];

                // Pomodoro
                if (parsed.pomodoro) {
                    this.data.pomodoro.stats = { ...this.data.pomodoro.stats, ...parsed.pomodoro.stats };
                    this.data.pomodoro.settings = { ...this.data.pomodoro.settings, ...parsed.pomodoro.settings };
                }
                this.data.pomodoroState = parsed.pomodoroState || null;

                // Wheel
                this.data.wheel.history = parsed.wheel?.history || [];

                // Kanban
                if (parsed.kanban) {
                    this.data.kanban = parsed.kanban;
                } else {
                    this.data.kanban = { columns: [], cards: [] };
                }

                // Notifications
                this.data.notifications = parsed.notifications || [];

                // Reader
                if (parsed.reader) {
                    this.data.reader.activeFileId = parsed.reader.activeFileId || null;
                    this.data.reader.files = parsed.reader.files || [];
                    this.data.reader.settings = { ...this.data.reader.settings, ...parsed.reader.settings };
                }

                // Chat
                if (parsed.chat) {
                    this.data.chat.messages = parsed.chat.messages || [];
                    this.data.chat.isTyping = false;
                }

                // *** ИСПРАВЛЕНО: Загрузка настроек сносок ***
                if (parsed.explanationSettings) {
                    this.data.explanationSettings = {
                        ...this.data.explanationSettings,
                        ...parsed.explanationSettings
                    };
                }

                // App Stats
                if (parsed.appStats) {
                    this.data.appStats = { totalUptime: 0, ...parsed.appStats };
                    this.data.appStats.lastSeen = Date.now();
                }

                // *** NEW: COGNITIVE CORE LOAD ***
                if (parsed.cognitive) {
                    this.data.cognitive = {
                        documents: parsed.cognitive.documents || [],
                        semanticBlocks: parsed.cognitive.semanticBlocks || [],
                        knowledgeUnits: parsed.cognitive.knowledgeUnits || [],
                        userKnowledgeStates: parsed.cognitive.userKnowledgeStates || [],
                        cognitiveAvatar: {
                            id: 'main',
                            knowledgeGraph: parsed.cognitive.cognitiveAvatar?.knowledgeGraph || [],
                            focusTopics: parsed.cognitive.cognitiveAvatar?.focusTopics || [],
                            stats: { totalUnits: 0, masteredUnits: 0, conceptsLearned: 0, ...(parsed.cognitive.cognitiveAvatar?.stats || {}) }
                        }
                    };
                }

                return true;
            }
            return false;
        } catch (e) {
            console.error("Ошибка загрузки:", e);
            return false;
        }
    },

    // Метод сохранения
    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.error("Ошибка сохранения:", e);
        }
    },

    // --- HABITS ---
    addHabit(name) {
        this.data.habits.push({
            id: Date.now(),
            name,
            count: 0,
            goal: this.data.habitSettings.goal,
            color: this.data.habitSettings.color,
            subtasks: this.data.tempSubtasks.map(st => ({ ...st, dates: [] })),
            history: [],
        });
        this.data.tempSubtasks = [];
        this.save();
    },
    deleteHabit(id) {
        this.data.habits = this.data.habits.filter(h => h.id !== id);
        this.save();
    },
    incrementHabit(id) {
        const habit = this.data.habits.find(h => h.id === id);
        if (!habit) return;
        habit.count++;
        const today = new Date().toISOString().split('T')[0];
        const completedIds = habit.subtasks.filter(st => st.completed).map(st => st.id);
        habit.history.push({ date: today, subtasks: completedIds });
        habit.subtasks.forEach(st => {
            if (st.completed) {
                st.dates = st.dates || [];
                st.dates.push(today);
                st.completed = false;
            }
        });
        if (habit.count >= habit.goal && !this.data.achievements.some(a => a.name === habit.name)) {
            this.data.achievements.push({ name: habit.name, goal: habit.goal, date: today });
        }
        this.save();
    },
    toggleSubtask(habitId, subtaskId, status) {
        const habit = this.data.habits.find(h => h.id === habitId);
        if (habit) {
            const st = habit.subtasks.find(s => s.id === subtaskId);
            if (st) st.completed = status;
            this.save();
        }
    },

    // --- POMODORO ---
    updatePomodoroSettings(settings) {
        this.data.pomodoro.settings = { ...this.data.pomodoro.settings, ...settings };
        this.save();
    },
    updatePomodoroStats(type, value) {
        this.data.pomodoro.stats[type] += value;
        this.save();
    },
    resetPomodoroStats() {
        this.data.pomodoro.stats = { totalSessions: 0, totalWork: 0, totalBreak: 0, totalPaused: 0 };
        this.save();
    },
    savePomodoroState(state) {
        this.data.pomodoroState = { ...state, interval: null };
        this.save();
    },
    clearPomodoroState() {
        this.data.pomodoroState = null;
        this.save();
    },

    // --- WHEEL ---
    addToWheelHistory(activity) {
        this.data.wheel.history.push({ activity, date: new Date().toISOString() });
        this.save();
    },

    // --- APP STATS ---
    updateAppUptime(seconds) {
        if (!this.data.appStats) this.data.appStats = { totalUptime: 0, lastSeen: Date.now() };
        this.data.appStats.totalUptime += seconds;
        this.data.appStats.lastSeen = Date.now();
    },
    getAppUptime() {
        return this.data.appStats?.totalUptime || 0;
    },

    // --- KANBAN ---
    addKanbanColumn(title) {
        this.data.kanban.columns.push({ id: Date.now(), title });
        this.save();
    },
    addKanbanCard(columnId, title, description) {
        this.data.kanban.cards.push({ id: Date.now(), columnId: parseInt(columnId), title, description });
        this.save();
    },
    moveKanbanCard(cardId, newColumnId) {
        const card = this.data.kanban.cards.find(c => c.id === cardId);
        if (card) {
            card.columnId = newColumnId;
            this.save();
        }
    },
    deleteKanbanColumn(columnId) {
        this.data.kanban.columns = this.data.kanban.columns.filter(c => c.id !== columnId);
        this.data.kanban.cards = this.data.kanban.cards.filter(c => c.columnId !== columnId);
        this.save();
    },
    deleteKanbanCard(cardId) {
        this.data.kanban.cards = this.data.kanban.cards.filter(c => c.id !== cardId);
        this.save();
    },

    // --- NOTIFICATIONS ---
    addNotification(title, interval, isImportant) {
        const notif = {
            id: Date.now(),
            title,
            interval: parseInt(interval),
            isImportant: !!isImportant,
            lastTrigger: Date.now(),
            nextTrigger: Date.now() + parseInt(interval) * 60000,
            wasClicked: false
        };
        this.data.notifications.push(notif);
        this.save();
        return notif;
    },
    deleteNotification(id) {
        this.data.notifications = this.data.notifications.filter(n => n.id !== id);
        this.save();
    },
    updateNotificationTrigger(id) {
        const notif = this.data.notifications.find(n => n.id === id);
        if (notif) {
            notif.lastTrigger = Date.now();
            notif.nextTrigger = Date.now() + notif.interval * 60000;
            notif.wasClicked = false;
            this.save();
        }
    },
    markNotificationAsClicked(id) {
        const notif = this.data.notifications.find(n => n.id === id);
        if (notif) {
            notif.wasClicked = true;
            this.save();
        }
    },

    // --- READER ---
    getActiveFile() {
        if (!this.data.reader.activeFileId) return null;
        return this.data.reader.files.find(f => f.id === this.data.reader.activeFileId) || null;
    },
    addReaderFile(name, content) {
        const id = Date.now() + Math.random();
        this.data.reader.files.push({
            id,
            name,
            content,
            progress: { scrollTop: 0 },
            stats: { totalTime: 0, totalSessions: 0, sessionsHistory: [] }
        });
        this.save();
        return id;
    },
    getReaderFiles() {
        return this.data.reader.files;
    },
    setActiveFile(id) {
        if (this.data.reader.files.some(f => f.id === id)) {
            this.data.reader.activeFileId = id;
            this.save();
        }
    },
    clearActiveFile() {
        this.data.reader.activeFileId = null;
        this.save();
    },
    deleteReaderFile(id) {
        this.data.reader.files = this.data.reader.files.filter(f => f.id !== id);
        if (this.data.reader.activeFileId === id) this.data.reader.activeFileId = null;
        this.save();
    },
    updateReaderFileProgress(id, scrollTop) {
        const file = this.data.reader.files.find(f => f.id === id);
        if (file) {
            file.progress.scrollTop = scrollTop;
            this.save();
        }
    },
    addReaderSessionToFile(id, timeSeconds, wordsCount) {
        const file = this.data.reader.files.find(f => f.id === id);
        if (file) {
            file.stats.totalSessions++;
            file.stats.totalTime += timeSeconds;
            file.stats.sessionsHistory.push({
                date: new Date().toISOString(),
                time: timeSeconds,
                words: wordsCount
            });
            this.save();
        }
    },
    updateReaderSettings(settings) {
        this.data.reader.settings = { ...this.data.reader.settings, ...settings };
        this.save();
    },

    // --- CHAT ---
    addChatMessage(role, content) {
        this.data.chat.messages.push({
            id: Date.now(),
            role,
            content,
            timestamp: new Date().toLocaleTimeString()
        });
        this.save();
    },
    clearChatHistory() {
        this.data.chat.messages = [];
        this.save();
    },
    getChatMessages() {
        return this.data.chat.messages;
    },

    // --- EXPLANATION SETTINGS (NEW) ---
    updateExplanationSettings(newSettings) {
        // 1. Проверяем, есть ли текущие настройки
        if (!this.data.explanationSettings) {
            this.data.explanationSettings = {};
        }

        // 2. Объединяем старые и новые настройки (...spread оператор)
        this.data.explanationSettings = {
            ...this.data.explanationSettings,
            ...newSettings
        };

        // 3. Сохраняем в localStorage
        this.save();
        console.log("Настройки сносок сохранены:", this.data.explanationSettings);
    },

    // Внутри Store:
    updateExplanationPresets(newPresets) {
        this.data.explanationPresets = newPresets;
        this.save();
    },

    // ------------------------------------------------------------------
    // NEW: COGNITIVE MODULE METHODS (PHASE 1 + 2)
    // ------------------------------------------------------------------

    /**
     * Создает новую запись Документа в системе когнитивного чтения.
     * @param {string} name - Имя документа
     * @param {number} sourceFileId - ID файла из Reader
     * @returns {string} - ID созданного документа
     */
    createCognitiveDocument(name, sourceFileId) {
        const docId = `doc_${Date.now()}`;
        this.data.cognitive.documents.push({
            id: docId,
            name,
            sourceFileId,
            status: 'raw',
            createdAt: Date.now()
        });
        this.save();
        return docId;
    },

    /**
     * Создает или обновляет Атом Знания (KnowledgeUnit).
     * Логика обновления: если знание с таким title и type уже существует,
     * обновляем description и добавляем sourceBlockId в историю.
     * Иначе создаем новое.
     * @param {object} unitData - { title, type, description, sourceBlockId, confidence }
     * @returns {string} - ID знания
     */
    upsertKnowledgeUnit(unitData) {
        const { title, type, description, sourceBlockId, confidence } = unitData;

        // Простая нормализация (lowercase, trim)
        const normTitle = title.trim().toLowerCase();

        // Поиск существующего (простая логика для MVP)
        let existing = this.data.cognitive.knowledgeUnits.find(
            u => u.title.toLowerCase() === normTitle && u.type === type
        );

        if (existing) {
            // Обновляем
            if (description) existing.description = description;
            if (sourceBlockId && !existing.sourceBlockIds.includes(sourceBlockId)) {
                existing.sourceBlockIds.push(sourceBlockId);
            }
            existing.confidence = Math.max(existing.confidence || 0, confidence);
        } else {
            // Создаем новое
            const unitId = `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            this.data.cognitive.knowledgeUnits.push({
                id: unitId,
                title: title.trim(),
                type, // 'concept', 'fact', 'procedure', 'relation', 'example'
                description: description.trim(),
                sourceBlockIds: [sourceBlockId],
                confidence: confidence || 0.5
            });

            // Сразу создаем состояние знания для пользователя (статус unknown)
            this.createUserKnowledgeState(unitId);
        }

        this.save();
        return existing ? existing.id : this.data.cognitive.knowledgeUnits[this.data.cognitive.knowledgeUnits.length - 1].id;
    },

    /**
     * Создает начальное состояние знания для пользователя.
     * @param {string} unitId
     */
    createUserKnowledgeState(unitId) {
        const stateId = `uk_${Date.now()}`;
        const newState = {
            id: stateId,
            unitId,
            status: 'unknown', // unknown, learning, learned, mastered
            level: 0, // 0 - 1
            history: [{ action: 'read', timestamp: Date.now() }],
            lastUpdated: Date.now()
        };

        this.data.cognitive.userKnowledgeStates.push(newState);

        // Ссылка в аватаре (проверяем дубликаты)
        if (!this.data.cognitive.cognitiveAvatar.knowledgeGraph.includes(stateId)) {
            this.data.cognitive.cognitiveAvatar.knowledgeGraph.push(stateId);
        }

        // Обновляем статистику
        this.data.cognitive.cognitiveAvatar.stats.totalUnits += 1;

        this.save();
    },

    /**
     * Обновляет статус знания пользователя (основной механизм интерактивности).
     * @param {string} unitId
     * @param {string} action - 'read', 'tested', 'explained', 'mastered'
     * @param {number} level - опциональный уровень (0-1)
     */
    updateCognitiveState(unitId, action, level = null) {
        const state = this.data.cognitive.userKnowledgeStates.find(s => s.unitId === unitId);
        if (!state) {
            // Если состояния нет (например, старый KnowledgeUnit), создаем его
            this.createUserKnowledgeState(unitId);
            return this.updateCognitiveState(unitId, action, level);
        }

        state.history.push({ action, timestamp: Date.now() });
        state.lastUpdated = Date.now();

        // Логика изменения статуса и уровня на основе действия
        // Это упрощенная логика для MVP. В реальности нужна более сложная модель.
        if (action === 'read') {
            if (state.status === 'unknown') state.status = 'learning';
            state.level = Math.min(1, state.level + 0.1);
        } else if (action === 'tested') {
            state.level = Math.min(1, state.level + 0.2); // Углубляем знание
            if (state.level >= 0.5 && state.status === 'learning') state.status = 'learned';
        } else if (action === 'mastered') {
            state.status = 'mastered';
            state.level = 1.0;
            this.data.cognitive.cognitiveAvatar.stats.masteredUnits += 1;
        } else if (action === 'explained') { // Объяснение другому
            state.level = Math.min(1, state.level + 0.15);
            if (state.level >= 0.7) state.status = 'learned';
        }

        this.save();
    },

    /**
     * Получение данных для следующего шага (Фаза 2).
     * Возвращает ID документа и его текст, готовый к сегментации.
     * @param {string} documentId
     * @returns {object|null}
     */
    getCognitiveDocumentData(documentId) {
        const doc = this.data.cognitive.documents.find(d => d.id === documentId);
        if (!doc) return null;

        const file = this.data.reader.files.find(f => f.id === doc.sourceFileId);
        if (!file) return null;

        return {
            document: doc,
            rawText: file.content
        };
    },

    /**
     * Добавление семантического блока.
     * @param {object} blockData
     */
    addSemanticBlock(blockData) {
        const blockId = `sb_${Date.now()}`;
        this.data.cognitive.semanticBlocks.push({
            id: blockId,
            ...blockData
        });
        this.save();
        return blockId;
    },

    /**
     * MVP: Полный цикл обработки документа для извлечения знаний.
     * 1. Получает текст.
     * 2. Делит на блоки (простейшая логика).
     * 3. Отправляет каждый блок в LLM.
     * 4. Сохраняет знания.
     * @param {string} documentId - ID документа в cognitive.documents
     * @param {function} onProgress - callback для UI (опционально)
     */
    async processDocumentToKnowledge(documentId, onProgress = null) {
        const docData = this.getCognitiveDocumentData(documentId);
        if (!docData) return { error: "Документ не найден" };

        const { document, rawText } = docData;

        // Запоминаем начальное количество знаний для подсчета итога
        const initialUnitsCount = this.data.cognitive.knowledgeUnits.length;

        // 1. СЕГМЕНТАЦИЯ ТЕКСТА (SemanticBlock)
        // Простейший парсер: разбиваем по заголовкам (#) и пустым строкам.
        const blocks = this._segmentText(rawText);

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];

            // Сохраняем блок в Store
            const blockId = this.addSemanticBlock({
                documentId: document.id,
                type: block.type,
                sourceRange: block.range,
                summary: block.text.substring(0, 100) + (block.text.length > 100 ? '...' : '')
            });

            // Callback прогресса для UI
            if (onProgress) onProgress(`Обработка блока ${i + 1} из ${blocks.length}`);

            // 2. ЭКСТРАКЦИЯ ЗНАНИЙ (LLM)
            try {
                const atoms = await this._extractKnowledgeFromBlock(block.text, block.type);

                if (atoms && atoms.length) {
                    atoms.forEach(atom => {
                        // 3. СОХРАНЕНИЕ (Upsert)
                        this.upsertKnowledgeUnit({
                            title: atom.title,
                            type: atom.type,
                            description: atom.description,
                            sourceBlockId: blockId,
                            confidence: 0.8 // AI дает уверенность 0.8 для MVP
                        });
                    });
                }
            } catch (e) {
                console.warn(`Ошибка обработки блока ${blockId}:`, e);
            }
        }

        // Обновляем статус документа
        const docIndex = this.data.cognitive.documents.findIndex(d => d.id === documentId);
        if (docIndex !== -1) {
            this.data.cognitive.documents[docIndex].status = 'processed';
            this.save();
        }

        // Считаем количество новых знаний
        const unitsCount = this.data.cognitive.knowledgeUnits.length - initialUnitsCount;

        return { success: true, blocksProcessed: blocks.length, unitsCount: unitsCount };
    },

    // ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Сегментация текста (простейшая логика)
    _segmentText(text) {
        const lines = text.split('\n');
        const blocks = [];
        let currentBlock = [];
        let currentType = 'paragraph';
        let currentStartChar = 0;
        let globalCharPos = 0;

        // Проходим по всем строкам
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Определение типа блока по началу строки
            if (trimmed.startsWith('#')) {
                // Если был предыдущий блок, сохраняем его
                if (currentBlock.length > 0) {
                    const text = currentBlock.join('\n');
                    blocks.push({
                        type: currentType,
                        text: text,
                        range: { start: currentStartChar, end: currentStartChar + text.length }
                    });
                    currentBlock = [];
                }
                currentType = 'header';
                currentStartChar = globalCharPos;
            } else if (trimmed === '') {
                // Пустая строка — разделитель абзацев
                if (currentBlock.length > 0) {
                    const text = currentBlock.join('\n');
                    blocks.push({
                        type: currentType,
                        text: text,
                        range: { start: currentStartChar, end: currentStartChar + text.length }
                    });
                    currentBlock = [];
                    currentType = 'paragraph'; // Сброс к абзацу
                    currentStartChar = globalCharPos + 1; // Смещаемся за пустую строку
                }
            }

            // Добавляем строку в текущий блок (даже если это заголовок)
            // Заголовок добавляется как часть своего блока
            if (trimmed !== '') {
                currentBlock.push(line);
            }

            globalCharPos += line.length + 1; // +1 для \n
        }

        // Добавляем последний блок
        if (currentBlock.length > 0) {
            const text = currentBlock.join('\n');
            blocks.push({
                type: currentType,
                text: text,
                range: { start: currentStartChar, end: currentStartChar + text.length }
            });
        }

        return blocks;
    },

    // ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Запрос к LLM для извлечения знаний
    // ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Запрос к LLM для извлечения знаний
    async _extractKnowledgeFromBlock(text, type) {
        if (!window.appConfig || !window.appConfig.MIMO_API_URL) {
            console.warn("Конфиг API не найден");
            return [];
        }

        // Строгий промпт с маркерами JSON
        const systemPrompt = `Ты — AI-аналитик. Проанализируй текст и верни только JSON.
        Тип блока: ${type}.
        Определи 1-3 атома знаний (concept, fact, procedure).
        Формат: <BEGIN_KNOWLEDGE_JSON>
        { "atoms": [{ "title": "...", "type": "concept|fact|procedure", "description": "..." }] }
        <END_KNOWLEDGE_JSON>`;

        const payload = {
            model: window.appConfig.MIMO_MODEL || "mimo-v2-flash",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Текст: "${text.substring(0, 1000)}"` } // Безопасное ограничение длины
            ],
            max_tokens: 1000,
            temperature: 0.1
        };

        try {
            const response = await fetch(window.appConfig.MIMO_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.MIMO_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Лог для отладки (сырой ответ)
            console.log(`[LLM Raw Response for ${type}]:`, content);

            // Извлекаем JSON между маркерами
            const jsonRegex = /<BEGIN_KNOWLEDGE_JSON>([\s\S]*?)<END_KNOWLEDGE_JSON>/;
            const match = content.match(jsonRegex);

            if (!match || !match[1]) {
                console.warn("LLM ответ не содержит валидных маркеров JSON");
                return [];
            }

            const jsonStr = match[1].trim();
            const parsed = JSON.parse(jsonStr);

            return parsed.atoms || [];

        } catch (e) {
            console.warn("Ошибка запроса LLM или парсинга:", e);
            return [];
        }
    },

    // ------------------------------------------------------------------
    // NEW: COGNITIVE QUIZ & CONTROL METHODS
    // ------------------------------------------------------------------

    /**
     * Получает данные для квиза по ID документа.
     * Фильтрует знания со статусом 'ignored'.
     * @param {string} documentId
     */
    getCognitiveUnitsForQuiz(documentId) {
        // 1. Находим блоки текста, принадлежащие документу
        const blockIds = this.data.cognitive.semanticBlocks
            .filter(b => b.documentId === documentId)
            .map(b => b.id);

        // 2. Находим знания, связанные с этими блоками
        const relevantUnits = this.data.cognitive.knowledgeUnits.filter(u =>
            u.sourceBlockIds.some(blockId => blockIds.includes(blockId))
        );

        // 3. Расширяем данными состояния пользователя
        const quizData = relevantUnits.map(unit => {
            const state = this.data.cognitive.userKnowledgeStates.find(s => s.unitId === unit.id);
            return {
                ...unit,
                userStatus: state ? state.status : 'active',
                userLevel: state ? state.level : 0,
                userStateId: state ? state.id : null
            };
        });

        // 4. Исключаем игнорируемые
        return quizData.filter(item => item.userStatus !== 'ignored');
    },

    /**
     * Обновляет состояние знания после ответа на вопрос.
     * @param {string} unitId
     * @param {boolean} isCorrect
     */
    updateKnowledgeAfterQuiz(unitId, isCorrect) {
        const stateIndex = this.data.cognitive.userKnowledgeStates.findIndex(s => s.unitId === unitId);
        if (stateIndex === -1) return; // Не нашли состояние

        const state = this.data.cognitive.userKnowledgeStates[stateIndex];
        const action = isCorrect ? 'tested_success' : 'tested_fail';

        // Логика изменения уровня
        const levelChange = isCorrect ? 0.15 : -0.05;
        state.level = Math.max(0, Math.min(1, state.level + levelChange));

        // Логика смены статуса
        if (state.level >= 0.7 && state.status === 'learning') state.status = 'learned';
        if (state.level >= 0.9 && state.status === 'learned') state.status = 'mastered';
        if (state.level <= 0.1 && state.status === 'learned') state.status = 'learning'; // Откат

        state.history.push({ action, timestamp: Date.now() });
        state.lastUpdated = Date.now();
        
        this.save();
    },

    /**
     * Статистика аватара для UI.
     */
    getCognitiveAvatarStats() {
        const units = this.data.cognitive.knowledgeUnits;
        const states = this.data.cognitive.userKnowledgeStates;
        
        const total = units.length;
        const active = states.filter(s => s.status === 'active').length;
        const mastered = states.filter(s => s.status === 'mastered').length;
        
        const avgLevel = states.length > 0 
            ? (states.reduce((sum, s) => sum + s.level, 0) / states.length) * 100 
            : 0;

        return { total, active, mastered, avgLevel: avgLevel.toFixed(1) };
    }
};