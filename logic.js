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
        const saved = Store.data.pomodoroState;
        if (saved && saved.timeLeft > 0) {
            this.state = { ...saved, interval: null, justRestored: true };
            if (this.state.isRunning) {
                const now = Date.now();
                const diff = Math.floor((this.state.endTime - now) / 1000);
                if (diff <= 0) {
                    this.resetTimer(true);
                } else {
                    this.state.timeLeft = diff;
                    this.state.endTime = now + diff * 1000;
                    this.state.isRunning = true;
                    clearInterval(this.state.interval);
                    this.state.interval = setInterval(() => this.tick(), 1000);
                    UI.Timer.toggleControls(true);
                }
            } else {
                UI.Timer.updateDisplay(this.state.timeLeft, this.state.isWorking);
                UI.Timer.toggleControls(false);
            }
        } else {
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

        this.state.isRunning = false;
        Store.logResearchEvent('pomodoro', { phase: wasWorking ? 'work' : 'break', duration: this.state.timeLeft });
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
        this._lastKnowledgeNotifTime = 0;
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

        // --- FIX: cooldown 60 минут между уведомлениями о повторении ---
        const KNOWLEDGE_NOTIF_COOLDOWN_MS = 60 * 60 * 1000; // 1 час
        if (now - this._lastKnowledgeNotifTime < KNOWLEDGE_NOTIF_COOLDOWN_MS) return;

        const dueKnowledge = Store.data.cognitive.userKnowledgeStates.filter(s =>
            s.nextReview &&
            s.nextReview <= now &&
            s.status !== 'ignored' &&
            s.status !== 'deleted'
        );

        if (dueKnowledge.length > 0 && Notification.permission === 'granted') {
            new Notification('📚 Пора повторить знания!', {
                body: `${dueKnowledge.length} знаний ждут повторения в Аватаре`,
                tag: 'spaced-repetition-reminder' // браузер не дублирует уведомления с одним tag
            });
            this._lastKnowledgeNotifTime = now; // обновляем таймер
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


/**
 * ------------------------------------------------------------------
 * COGNITIVE PROCESSOR (MVP)
 * ------------------------------------------------------------------
 * Обертка для вызова когнитивной логики из Store.
 * Используется для запуска процесса из UI.
 */
const CognitiveProcessor = {
    /**
     * Запускает обработку документа.
     * @param {number} fileId - ID файла из Reader
     * @returns {Promise<{success: boolean, unitsCount?: number, error?: string}>}
     */
    async processFile(fileId, onProgress, opts = {}) {
        // 1. Проверяем, есть ли уже Cognitive Document для этого файла
        const existingDoc = Store.data.cognitive.documents.find(d => d.sourceFileId === fileId);
        let documentId;

        if (existingDoc) {
            documentId = existingDoc.id;
            console.log(`CognitiveProcessor: Документ уже существует, ID: ${documentId}`);
        } else {
            // Создаем новый документ в Cognitive Core
            const file = Store.data.reader.files.find(f => f.id === fileId);
            if (!file) {
                console.error("Файл не найден");
                return { success: false, error: "Файл не найден" };
            }
            documentId = Store.createCognitiveDocument(file.name, fileId);
            console.log(`CognitiveProcessor: Создан новый документ, ID: ${documentId}`);
        }

        // 2. Запускаем процессор из Store
        // Передаем callback для логирования (можно заменить на UI-обновление)
        const result = await Store.processDocumentToKnowledge(documentId, (progress) => {
            console.log(`[CognitiveProcessor Progress] ${progress}`);
        }, opts);

        // const result = await Store.processDocumentToKnowledge(documentId, onProgress || (() => {console.log(`[CognitiveProcessor Progress] ${progress}`);}));

        if (result.success) {
            console.log(`CognitiveProcessor: Успех! Обработано блоков: ${result.blocksProcessed}, извлечено знаний: ${result.unitsCount}`);
            // Логируем итоги для отладки
            if (result.unitsCount > 0) {
                console.log("Новые Knowledge Units:", Store.data.cognitive.knowledgeUnits.slice(-result.unitsCount));
            }


            // Возвращаем объект с результатом для UI
            return { success: true, unitsCount: result.unitsCount };
        } else {
            console.error("CognitiveProcessor: Ошибка", result.error);
            return { success: false, error: result.error };
        }

    },


    /**
     * (Отладочная) Пример функции для обновления статуса знания "вручную".
     * Демонстрирует, как UI может взаимодействовать с когнитивным ядром.
     * @param {string} unitTitle - Название понятия
     * @param {string} action - Действие: 'read', 'tested', 'explained'
     */
    logUserAction(unitTitle, action) {
        const unit = Store.data.cognitive.knowledgeUnits.find(u => u.title === unitTitle);
        if (unit) {
            Store.updateCognitiveState(unit.id, action);
            console.log(`CognitiveProcessor: Статус для "${unitTitle}" обновлен: ${action}`);
        } else {
            console.warn(`CognitiveProcessor: Знание "${unitTitle}" не найдено`);
        }
    }
};

/**
 * ------------------------------------------------------------------
 * COGNITIVE QUIZ ENGINE
 * ------------------------------------------------------------------
 * Генерирует вопросы на основе KnowledgeUnit и обрабатывает ответы.
 */
const CognitiveQuiz = {
    currentQuiz: null,
    currentQuestionIndex: 0,

    /**
     * Запускает сессию квиза для документа.
     * @param {string} fileId - ID файла из Reader
     */
    async startSession(fileId) {
        // 1. Получаем Cognitive Document для файла
        const doc = Store.data.cognitive.documents.find(d => d.sourceFileId === fileId);
        if (!doc) {
            return { success: false, message: "Для этого файла еще не проведен AI-анализ." };
        }

        // 2. Получаем знания (без игнорируемых)
        const rawData = Store.getCognitiveUnitsForQuiz(doc.id);
        console.log(`[CognitiveQuiz] Found ${rawData.length} knowledge units for file ${fileId}`);


        if (rawData.length === 0) {
            return { success: false, message: "Нет знаний для проверки (возможно, все игнорируются)." };
        }

        // 3. Выбираем вопросы (максимум 3, сортируем по низкому level)
        const questionsData = rawData.sort((a, b) => a.userLevel - b.userLevel).slice(0, 3);

        // 4. Генерируем текстовые вопросы через LLM
        const questions = [];
        for (const item of questionsData) {
            const question = await this.generateQuestionForUnit(item);
            if (question) {
                questions.push({
                    ...item,
                    questionText: question,
                    userAnswer: null,
                    isCorrect: null
                });
            }
        }

        if (questions.length === 0) {
            return { success: false, message: "Ошибка генерации вопросов." };
        }

        this.currentQuiz = {
            questions: questions,
            docId: doc.id,
            fileId: fileId,
            startTime: Date.now()
        };
        this.currentQuestionIndex = 0;

        return { success: true, totalQuestions: questions.length };
    },

    /**
     * Генерация вопроса для конкретной единицы знания через LLM.
     */
    async generateQuestionForUnit(unit) {
        const systemPrompt = `Ты — система проверки знаний.
Знание: "${unit.title}" (Тип: ${unit.type}).
Описание: "${unit.description}".
Создай ОДИН конкретный вопрос, на который можно ответить кратким текстом.
Не используй формулировки "Опиши" или "Объясни". Задавай вопрос прямо.`;

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
                        { role: "system", content: systemPrompt },
                        { role: "user", content: "Сгенерируй вопрос на русском языке." }
                    ],
                    max_tokens: 300,
                    temperature: 0.7
                })
            });

            if (!response.ok) throw new Error('DeepSeek Error');
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (e) {
            console.warn("Ошибка генерации вопроса:", e);
            return `Что такое "${unit.title}"?`;
        }
    },

    /**
     * Проверка ответа пользователя через LLM.
     */
    async checkAnswer(userAnswer, correctUnit) {
        const systemPrompt = `Ты — система оценки знаний.
Вопрос: "${correctUnit.questionText}"
Правильный ответ (контекст знания): "${correctUnit.description}"
Ответ пользователя: "${userAnswer}"
Оцени ответ по шкале от 0 до 100, где 0 — совершенно неверно, 100 — идеально.
Верни ТОЛЬКО число (целое).`;
        try {
            const response = await fetch(window.appConfig.DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: window.appConfig.DEEPSEEK_MODEL,
                    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Оцени ответ" }],
                    max_tokens: 10,
                    temperature: 0.1
                })
            });
            const data = await response.json();
            const score = parseInt(data.choices[0].message.content.trim());
            return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
        } catch (e) {
            console.warn("Ошибка оценки:", e);
            return 50;
        }
    },

    getCurrentQuestion() {
        if (!this.currentQuiz || this.currentQuestionIndex >= this.currentQuiz.questions.length) return null;
        console.log('[CognitiveQuiz] getCurrentQuestion returns:', this.currentQuiz.questions[this.currentQuestionIndex]);
        return this.currentQuiz.questions[this.currentQuestionIndex];
    },

    nextQuestion() {
        this.currentQuestionIndex++;
        console.log(`[CognitiveQuiz] nextQuestion: index now ${this.currentQuestionIndex}, total ${this.currentQuiz?.questions.length || 0}`);
        if (!this.currentQuiz || this.currentQuestionIndex >= this.currentQuiz.questions.length) {
            console.log('[CognitiveQuiz] No more questions');
            return null;
        }
        return this.getCurrentQuestion();
    },

    reset() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
    },

    // Новый метод: запуск квиза по списку unitId
    async startSessionFromUnits(unitIds, sourceName = 'Выбранные знания') {
        const unitsData = [];
        for (const unitId of unitIds) {
            const unit = Store.data.cognitive.knowledgeUnits.find(u => u.id === unitId);
            if (!unit) continue;
            const state = Store.data.cognitive.userKnowledgeStates.find(s => s.unitId === unitId);
            const userLevel = state ? state.level : 0;
            const userStatus = state ? state.status : 'active';
            if (userStatus === 'ignored') continue;
            unitsData.push({
                ...unit,
                userLevel,
                userStatus,
                userStateId: state ? state.id : null
            });
        }
        if (unitsData.length === 0) return { success: false, message: 'Нет знаний для проверки' };

        // Сортируем по низкому уровню, берём до 5
        const questionsData = unitsData.sort((a, b) => a.userLevel - b.userLevel).slice(0, 5);
        const questions = [];
        for (const item of questionsData) {
            const question = await this.generateQuestionForUnit(item);
            if (question) {
                questions.push({
                    ...item,
                    questionText: question,
                    userAnswer: null,
                    isCorrect: null
                });
            }
        }
        if (questions.length === 0) return { success: false, message: 'Ошибка генерации вопросов' };

        this.currentQuiz = {
            questions,
            sourceName,
            startTime: Date.now()
        };
        this.currentQuestionIndex = 0;
        return { success: true, totalQuestions: questions.length };
    },
};





const ChatLogic = {
    async sendMessage(history, newMessage) {
        try {
            // Проверка конфигурации
            if (!window.appConfig?.MIMO_API_KEY) {
                return {
                    success: false,
                    message: "❌ API ключ не настроен. Проверьте config.js"
                };
            }

            const response = await fetch(window.appConfig.MIMO_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.MIMO_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: window.appConfig.MIMO_MODEL || "mimo-v2-flash",
                    messages: [
                        ...history.map(msg => ({
                            role: msg.role,
                            content: msg.content
                        })),
                        { role: 'user', content: newMessage }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Chat API Error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }

            const data = await response.json();
            console.log('Chat response:', data);

            return {
                success: true,
                data: data.choices[0].message.content
            };

        } catch (error) {
            console.error('Chat error:', error);
            return {
                success: false,
                message: `❌ Ошибка подключения: ${error.message}`
            };
        }
    }
};



/**
 * ------------------------------------------------------------------
 * SIMPLE AI API CLIENT (Минимальная версия)
 * ------------------------------------------------------------------
 */
const AIClient = {
    // Просто переключаем URL в зависимости от провайдера
    async request(messages, options = {}) {
        const provider = options.provider || 'deepseek';

        let url, key, model;

        if (provider === 'deepseek') {
            url = 'http://localhost:3000/api/deepseek/chat/completions';
            key = window.appConfig?.DEEPSEEK_API_KEY;
            model = 'deepseek-chat';
        } else {
            url = 'http://localhost:3000/api/chat/completions';
            key = window.appConfig?.MIMO_API_KEY;
            model = 'mimo-v2-flash';
        }

        if (!key) {
            throw new Error(`API key for ${provider} is not configured`);
        }

        const payload = {
            model: model,
            messages: messages,
            max_tokens: options.max_tokens || 1000,
            temperature: options.temperature || 0.1
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
            }

            const data = await response.json();
            return {
                success: true,
                content: data.choices[0].message.content,
                provider: provider
            };

        } catch (error) {
            console.error(`[${provider.toUpperCase()} API Error]:`, error);
            throw error;
        }
    },

    // Специальный метод для извлечения знаний с DeepSeek
    async extractKnowledgeFromText(text, blockType) {
        const systemPrompt = `Ты — AI-аналитик знаний. Проанализируй текст и извлеки атомарные знания.
Тип блока: ${blockType}.
Определи 1-3 атома знаний (concept, fact, procedure).
Верни строго в формате JSON:
{
  "atoms": [
    {
      "title": "Название концепта",
      "type": "concept|fact|procedure",
      "description": "Подробное описание на русском языке"
    }
  ]
}`;

        return this.request([
            { role: "system", content: systemPrompt },
            { role: "user", content: `Текст: "${text.substring(0, 1500)}"` }
        ], {
            provider: 'deepseek',
            max_tokens: 1500,
            temperature: 0.1
        });
    }
};

/**
 * ------------------------------------------------------------------
 * MIRO-LIKE CANVAS CONTROLLER (MVP)
 * ------------------------------------------------------------------
 */
class MiroController {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.elements = new Map(); // id → {type, x, y, width, height, text, color, parentId, childrenIds}
        this.nextId = 1;

        // Viewport state (world coordinates)
        this.viewport = {
            x: 0,
            y: 0,
            scale: 1
        };


        // FIX: Флаг для отладки координат
        this.debugCoords = true;


        // FIX: Инициализация viewport с предсказуемыми значениями
        this.viewport = {
            x: 0,
            y: 0,
            scale: 1
        };
        this._viewportSynced = false;

        // FIX: Последние координаты мыши
        this.lastMouseScreen = { x: 0, y: 0 };
        this.lastMouseWorld = { x: 0, y: 0 };

        // FIX: Инициализация значений
        this.NODE_WIDTH = 160;
        this.NODE_HEIGHT = 100;

        console.log('MiroController: Constructor initialized');

        // Interaction state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.draggedElement = null;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.hoveredElement = null;
        this.hoverSide = null; // 'left' | 'right'

        // Constants
        this.NODE_WIDTH = 160;
        this.NODE_HEIGHT = 100;  // ← ИСПРАВЛЕНО: было [?]0
        this.NODE_PADDING = 10;
        this.CHILD_OFFSET_X = 200;
        this.CHILD_OFFSET_Y = 120;
        this.PLUS_BUTTON_SIZE = 20;

        // Render loop
        this.animationId = null;
        this.lastFrameTime = 0;

        // Key states
        this.keys = new Set();

        // Bind methods
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);



        this.needsRedraw = true;
        this.renderQueue = [];
        this.lastRenderTime = 0;
        this.FPS_LIMIT = 60;
        this.FRAME_TIME = 1000 / this.FPS_LIMIT;
        this.gridEnabled = true;
        this.gridSize = 50; // pixels at scale=1
        this.gridColor = '#e5e7eb';
        this.gridOpacity = 0.3;

        // Для отладки
        this.debug = false;
    }

    /**
     * Initialize controller (called from UI.initMiroView)
     */
    init() {
        this.canvas = document.getElementById('miroCanvas');
        if (!this.canvas) {
            console.error('MiroController: Canvas element not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();

        // КРИТИЧНЫЙ FIX: Принудительный сброс viewport при каждом открытии
        setTimeout(() => {
            console.log('[Miro] Force resetting viewport to default state');
            this.viewport = {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                scale: 1
            };
            this._viewportSynced = true;

            // Принудительная перерисовка
            this.scheduleRedraw();
            this.updateStats();

            console.log(`[Miro] Viewport установлен: (${this.viewport.x}, ${this.viewport.y}), scale=${this.viewport.scale}`);
        }, 100);
        this.loadFromStorage();
        this.startAnimation();
        this.setupEventListeners();

        console.log('MiroController: Initialized');
    }

    // ===== ИСПРАВЛЕННАЯ НАСТРОЙКА КАНВАСА =====
    setupCanvas() {
        console.log('MiroController: Setting up canvas...');

        const container = this.canvas.parentElement;
        if (!container) {
            console.error('No container found for canvas');
            return;
        }

        const updateCanvasSize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            // Устанавливаем реальные размеры
            this.canvas.width = width;
            this.canvas.height = height;

            // CSS должен совпадать
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';

            console.log(`Canvas: ${width}x${height}`);

            this.scheduleRedraw();
        };

        // Первоначальная настройка
        updateCanvasSize();

        // Resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => updateCanvasSize());
            });
            this.resizeObserver.observe(container);
        } else {
            window.addEventListener('resize', () => {
                requestAnimationFrame(() => updateCanvasSize());
            });
        }
    }


    setupEventListeners() {
        if (!this.canvas) return;

        // Existing listeners...
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('wheel', this.onWheel);
        this.canvas.addEventListener('contextmenu', this.onContextMenu);

        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);

        // CRITICAL FIX: ПРЕВЕНТ ДЕФОЛТ КОНТЕКСТНОГО МЕНЮ
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, { passive: false });

        // Enhanced toolbar handlers
        document.getElementById('miroClearBtn')?.addEventListener('click', () => this.clearBoard());
        document.getElementById('miroExportBtn')?.addEventListener('click', () => this.exportJSON());

        // NEW: Import button
        document.getElementById('miroImportBtn')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = this.importJSON(event.target.result);
                    if (result.success) {
                        UI.showNotification(`✅ Imported ${result.count} elements`);
                    } else {
                        UI.showNotification(`❌ Import failed: ${result.error}`);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });

        // NEW: Double-click to edit
        this.canvas.addEventListener('dblclick', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const hit = this.getElementAt(x, y);
            if (hit && hit.element) {
                this.showEditDialog(hit.element);
            }
        });
    }

    removeEventListeners() {
        if (!this.canvas) return;

        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);

        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }

    // ===== COORDINATE TRANSFORMATIONS =====

    /**
 * Преобразует координаты canvas в мировые координаты
 * FIX: Viewport хранит смещение canvas относительно мировых координат
 */
    screenToWorld(canvasX, canvasY) {
        return {
            x: canvasX - this.viewport.x,  // КРИТИЧНЫЙ FIX: убрал деление на scale для простоты
            y: canvasY - this.viewport.y
        };
    }

    /**
     * Преобразует мировые координаты в координаты canvas
     * FIX: Система теперь симметрична
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX + this.viewport.x,
            y: worldY + this.viewport.y
        };
    }


    // ===== HIT TESTING =====

    // FIX: ИСПРАВИТЬ метод getElementAt для правильного определения хита
    getElementAt(canvasX, canvasY) {
        // Сохранить для отладки
        this.lastMouseScreen = { x: canvasX, y: canvasY };
        this.lastMouseWorld = this.screenToWorld(canvasX, canvasY);

        console.log(`🎯 Хит-тест: Canvas(${canvasX},${canvasY}) -> World(${this.lastMouseWorld.x.toFixed(0)},${this.lastMouseWorld.y.toFixed(0)})`);

        const elementsArray = Array.from(this.elements.values()).reverse();

        console.log(`🔍 Проверка ${elementsArray.length} элементов`);

        for (const el of elementsArray) {
            if (el.type === 'node' || el.type === 'knowledge-node') {
                const width = el.width || this.NODE_WIDTH;
                const height = el.height || this.NODE_HEIGHT;

                // Проверка попадания в ноду (МИРОВЫЕ координаты!)
                const inNode = this.lastMouseWorld.x >= el.x &&
                    this.lastMouseWorld.x <= el.x + width &&
                    this.lastMouseWorld.y >= el.y &&
                    this.lastMouseWorld.y <= el.y + height;

                console.log(`  📍 Нода "${el.text}"`);
                console.log(`    Мировые координаты: (${el.x}, ${el.y})`);
                console.log(`    Размер: ${width}x${height}`);
                console.log(`    Курсор в мире: (${this.lastMouseWorld.x.toFixed(0)}, ${this.lastMouseWorld.y.toFixed(0)})`);
                console.log(`    Попадание в ноду: ${inNode}`);

                if (inNode) {
                    console.log(`  ✅ ХИТ! Попал в ноду "${el.text}"`);

                    // Теперь проверяем кнопки в ЭКРАННЫХ координатах
                    const screenPos = this.worldToScreen(el.x, el.y);
                    const screenWidth = width * this.viewport.scale;
                    const screenHeight = height * this.viewport.scale;

                    const plusSize = this.PLUS_BUTTON_SIZE * this.viewport.scale;

                    // Правая кнопка "+"
                    const plusRightX = screenPos.x + screenWidth - plusSize;
                    const plusRightY = screenPos.y + screenHeight / 2 - plusSize / 2;

                    // Левая кнопка "+"
                    const plusLeftX = screenPos.x;
                    const plusLeftY = plusRightY;

                    console.log(`    Экранные координаты ноды: (${screenPos.x.toFixed(0)}, ${screenPos.y.toFixed(0)})`);
                    console.log(`    Экранный размер: ${screenWidth.toFixed(0)}x${screenHeight.toFixed(0)}`);
                    console.log(`    Кнопка + справа: (${plusRightX.toFixed(0)}, ${plusRightY.toFixed(0)}), размер ${plusSize.toFixed(0)}px`);
                    console.log(`    Кнопка + слева: (${plusLeftX.toFixed(0)}, ${plusLeftY.toFixed(0)})`);

                    let hoverSide = null;

                    // Проверка попадания в кнопки (ЭКРАННЫЕ координаты!)
                    const inRightButton = canvasX >= plusRightX && canvasX <= plusRightX + plusSize &&
                        canvasY >= plusRightY && canvasY <= plusRightY + plusSize;

                    const inLeftButton = canvasX >= plusLeftX && canvasX <= plusLeftX + plusSize &&
                        canvasY >= plusLeftY && canvasY <= plusLeftY + plusSize;

                    console.log(`    Курсор в canvas: (${canvasX},${canvasY})`);
                    console.log(`    В правой кнопке: ${inRightButton}`);
                    console.log(`    В левой кнопке: ${inLeftButton}`);

                    if (inRightButton) {
                        hoverSide = 'right';
                        console.log(`    ↪ hoverSide = 'right'`);
                    } else if (inLeftButton) {
                        hoverSide = 'left';
                        console.log(`    ↪ hoverSide = 'left'`);
                    } else {
                        console.log(`    ↪ hoverSide = null`);
                    }

                    return { element: el, hoverSide };
                }
            }
        }

        console.log(`❌ НЕТ ХИТА для всех ${elementsArray.length} элементов`);
        return null;
    }
    // Создать простую функцию проверки попадания
    testHitCoordinates() {
        const canvasX = 961;
        const canvasY = 550;

        const worldPos = this.screenToWorld(canvasX, canvasY);
        console.log(`=== ТЕСТ ПРОСТОГО ХИТА ===`);
        console.log(`Canvas: (${canvasX}, ${canvasY})`);
        console.log(`World: (${worldPos.x.toFixed(0)}, ${worldPos.y.toFixed(0)})`);

        // Проверить попадание в первую ноду
        const firstNode = Array.from(this.elements.values()).find(el => el.type === 'node');
        if (firstNode) {
            console.log(`Нода: "${firstNode.text}"`);
            console.log(`Мировые координаты ноды: (${firstNode.x}, ${firstNode.y})`);
            console.log(`Размер ноды: ${this.NODE_WIDTH}x${this.NODE_HEIGHT}`);

            const hitX = worldPos.x >= firstNode.x && worldPos.x <= firstNode.x + this.NODE_WIDTH;
            const hitY = worldPos.y >= firstNode.y && worldPos.y <= firstNode.y + this.NODE_HEIGHT;

            console.log(`Попадание по X: ${hitX} (${worldPos.x.toFixed(0)} >= ${firstNode.x} && ${worldPos.x.toFixed(0)} <= ${firstNode.x + this.NODE_WIDTH})`);
            console.log(`Попадание по Y: ${hitY} (${worldPos.y.toFixed(0)} >= ${firstNode.y} && ${worldPos.y.toFixed(0)} <= ${firstNode.y + this.NODE_HEIGHT})`);
            console.log(`Общее попадание: ${hitX && hitY}`);

            // Проверить кнопку +
            const screenPos = this.worldToScreen(firstNode.x, firstNode.y);
            const plusSize = this.PLUS_BUTTON_SIZE;
            const screenWidth = this.NODE_WIDTH * this.viewport.scale;
            const screenHeight = this.NODE_HEIGHT * this.viewport.scale;

            const rightX = screenPos.x + screenWidth - plusSize;
            const rightY = screenPos.y + screenHeight / 2 - plusSize / 2;

            console.log(`Экранные координаты ноды: (${screenPos.x.toFixed(0)}, ${screenPos.y.toFixed(0)})`);
            console.log(`Кнопка + справа: (${rightX.toFixed(0)}, ${rightY.toFixed(0)})`);

            const inButton = canvasX >= rightX && canvasX <= rightX + plusSize &&
                canvasY >= rightY && canvasY <= rightY + plusSize;

            console.log(`Попадание в кнопку: ${inButton}`);
        } else {
            console.log("Ноды не найдены");
        }
    }

    // ===== ИСПРАВЛЕННЫЙ КООРДИНАТНЫЙ ТЕСТ =====
    testCoordinates() {
        if (!this.canvas) {
            console.log("Canvas не инициализирован!");
            return;
        }

        console.log("=== ТЕСТ КООРДИНАТ ===");

        // Центр экрана
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        console.log(`Canvas: ${this.canvas.width}x${this.canvas.height}`);
        console.log(`Центр экрана: Canvas(${centerX}, ${centerY})`);

        const worldCenter = this.screenToWorld(centerX, centerY);
        console.log(`Центр экрана в мировых: (${worldCenter.x}, ${worldCenter.y})`);

        // Viewport
        console.log(`Viewport: (${this.viewport.x}, ${this.viewport.y}), Scale: ${this.viewport.scale}`);

        // Проверка существующих нод
        if (this.elements.size === 0) {
            console.log("Нод нет");
        } else {
            this.elements.forEach((node, i) => {
                const screenPos = this.worldToScreen(node.x, node.y);
                console.log(`Нода ${i}: "${node.text}"`);
                console.log(`  Мировые: (${node.x}, ${node.y})`);
                console.log(`  Экранные: (${screenPos.x.toFixed(0)}, ${screenPos.y.toFixed(0)})`);

                // Прямоугольник кнопки +
                const screenWidth = (node.width || this.NODE_WIDTH) * this.viewport.scale;
                const screenHeight = (node.height || this.NODE_HEIGHT) * this.viewport.scale;
                const plusSize = this.PLUS_BUTTON_SIZE * this.viewport.scale;

                const rightX = screenPos.x + screenWidth - plusSize;
                const rightY = screenPos.y + screenHeight / 2 - plusSize / 2;

                console.log(`  Кнопка + справа: (${rightX.toFixed(0)}, ${rightY.toFixed(0)}) размер ${plusSize.toFixed(0)}px`);
            });
        }
    }
    // ===== RENDERING =====

    startAnimation() {
        const animate = (timestamp) => {
            const delta = timestamp - this.lastRenderTime;

            if (this.needsRedraw && delta >= this.FRAME_TIME) {
                this.draw();
                this.needsRedraw = false;
                this.lastRenderTime = timestamp;
            }

            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }


    // Добавляем метод для планирования перерисовки
    scheduleRedraw() {
        this.needsRedraw = true;
    }


    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Обновить draw метод для включения debug
    draw() {
        if (!this.canvas || !this.ctx) {
            console.warn('[Miro] Canvas not ready, skipping draw');
            return;
        }

        const { ctx, canvas } = this;
        const { width, height } = canvas;

        // Проверка размеров
        if (width === 0 || height === 0) {
            console.warn('[Miro] Canvas has zero dimensions');
            return;
        }

        // Очистка
        ctx.clearRect(0, 0, width, height);

        // FIX: Принудительная синхронизация viewport если не синхронизирован
        if (!this._viewportSynced) {
            this.viewport = {
                x: width / 2,
                y: height / 2,
                scale: 1
            };
            this._viewportSynced = true;
            console.log('[Miro] Viewport auto-synced in draw()');
        }


        // 1. Сетка
        this.drawGrid();

        // 2. Сохранить трансформацию
        ctx.save();

        // 3. Применить viewport трансформацию
        ctx.translate(this.viewport.x, this.viewport.y);
        ctx.scale(this.viewport.scale, this.viewport.scale);

        // 4. Соединительные линии (под нодами)
        this.drawConnections();

        // 5. Ноды
        this.drawNodes();

        // 6. Восстановить трансформацию
        ctx.restore();

        // 7. Кнопки "+" если ховер (должно быть ПОСЛЕ восстановления трансформации!)
        if (this.hoveredElement && this.hoverSide) {
            this.drawPlusButton(this.hoveredElement.element, this.hoverSide);
        }

        // 8. Отладочная информация
        if (this.debugCoords) {
            this.drawDebugInfo();
        }

        // Обновить статистику
        this.updateStats();
    }


    // ===== ДЕТАЛЬНАЯ ОТЛАДКА КООРДИНАТ =====
    drawDebugInfo() {
        if (!this.debugCoords || !this.ctx) return;

        const { ctx } = this;
        const mouseWorld = this.screenToWorld(this.lastMouseScreen.x, this.lastMouseScreen.y);

        ctx.save();
        ctx.resetTransform();

        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 400, 180);

        // Текст
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';

        const lines = [
            `=== MIRO DEBUG ===`,
            `Canvas: ${this.canvas.width}x${this.canvas.height}`,
            `Viewport: ${this.viewport.x.toFixed(0)}, ${this.viewport.y.toFixed(0)}`,
            `Scale: ${this.viewport.scale.toFixed(2)}`,
            `=== Последний клик ===`,
            `Canvas: ${this.lastMouseScreen.x}, ${this.lastMouseScreen.y}`,
            `World: ${mouseWorld.x.toFixed(1)}, ${mouseWorld.y.toFixed(1)}`,
            `=== Элементы ===`,
            `Nodes: ${this.elements.size}`,
            `Hover: ${this.hoveredElement ? this.hoveredElement.element.text : 'none'}`,
            `HoverSide: ${this.hoverSide || 'none'}`
        ];

        lines.forEach((line, i) => {
            ctx.fillText(line, 20, 30 + i * 20);
        });

        // 1. Зеленая точка - центр viewport (где мировые координаты (0,0))
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(this.viewport.x, this.viewport.y, 6, 0, Math.PI * 2);
        ctx.fill();


        // Внутри drawDebugInfo, после зеленой точки:
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(this.canvas.width / 2, this.canvas.height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`ЦЕНТР ЭКРАНА (0,0 world)`, this.canvas.width / 2 + 15, this.canvas.height / 2 - 10);
        // 2. Красная точка - где кликнули
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(this.lastMouseScreen.x, this.lastMouseScreen.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // 3. Линия от центра к курсору
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.viewport.x, this.viewport.y);
        ctx.lineTo(this.lastMouseScreen.x, this.lastMouseScreen.y);
        ctx.stroke();

        // 4. Текст координат для обеих точек
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`CENTER (0,0)`, this.viewport.x + 10, this.viewport.y - 10);

        ctx.fillStyle = '#ff0000';
        ctx.fillText(`CLICK (${mouseWorld.x.toFixed(0)},${mouseWorld.y.toFixed(0)})`,
            this.lastMouseScreen.x + 10, this.lastMouseScreen.y - 10);

        ctx.restore();


        if (this.elements.size > 0) {
            const lastNode = Array.from(this.elements.values()).pop();
            ctx.fillText(`Последняя нода: "${lastNode.text}"`, 20, 180);
            ctx.fillText(`Мировые: (${lastNode.x.toFixed(1)}, ${lastNode.y.toFixed(1)})`, 20, 200);
            ctx.fillText(`Экранные: (${this.worldToScreen(lastNode.x, lastNode.y).x.toFixed(0)}, ${this.worldToScreen(lastNode.x, lastNode.y).y.toFixed(0)})`, 20, 220);
        }
    }

    // ДОБАВИТЬ новый метод для быстрых уведомлений
    showNotification(message, duration = 2000) {
        const notification = document.getElementById('miroNotification');
        if (!notification) return;

        notification.textContent = message;
        notification.classList.remove('hidden');

        setTimeout(() => {
            notification.classList.add('hidden');
        }, duration);
    }

    // Добавить в MiroController
    debugButtonCoordinates(canvasX, canvasY) {
        const hit = this.getElementAt(canvasX, canvasY);

        if (hit && hit.element) {
            console.log("=== ДЕТАЛЬНЫЙ ДЕБАГ КНОПКИ ===");

            const el = hit.element;
            const screenPos = this.worldToScreen(el.x, el.y);
            const screenWidth = (el.width || this.NODE_WIDTH) * this.viewport.scale;
            const screenHeight = (el.height || this.NODE_HEIGHT) * this.viewport.scale;
            const plusSize = this.PLUS_BUTTON_SIZE * this.viewport.scale;

            const rightX = screenPos.x + screenWidth - plusSize;
            const rightY = screenPos.y + screenHeight / 2 - plusSize / 2;

            const leftX = screenPos.x;
            const leftY = rightY;

            console.log(`Нода: "${el.text}"`);
            console.log(`Мировые: (${el.x}, ${el.y})`);
            console.log(`Экранные: (${screenPos.x.toFixed(0)}, ${screenPos.y.toFixed(0)})`);
            console.log(`Размер экранный: ${screenWidth.toFixed(0)}x${screenHeight.toFixed(0)}`);
            console.log(`Кнопка + справа: (${rightX.toFixed(0)}, ${rightY.toFixed(0)}), размер ${plusSize.toFixed(0)}px`);
            console.log(`Кнопка + слева: (${leftX.toFixed(0)}, ${leftY.toFixed(0)})`);
            console.log(`Курсор: (${canvasX}, ${canvasY})`);

            // Проверка попадания
            const inRight = canvasX >= rightX && canvasX <= rightX + plusSize &&
                canvasY >= rightY && canvasY <= rightY + plusSize;

            const inLeft = canvasX >= leftX && canvasX <= leftX + plusSize &&
                canvasY >= leftY && canvasY <= leftY + plusSize;

            console.log(`В правой кнопке: ${inRight}`);
            console.log(`В левой кнопке: ${inLeft}`);
            console.log(`Результат хит-теста: hoverSide=${hit.hoverSide}`);
        } else {
            console.log("Не попал в ноду");
        }
    }


    drawGrid() {
        if (!this.gridEnabled || !this.ctx) return;

        const { ctx, canvas, viewport } = this;
        const { width, height } = canvas;

        // Calculate visible grid area in world coordinates
        const worldTopLeft = this.screenToWorld(0, 0);
        const worldBottomRight = this.screenToWorld(width, height);

        // Grid size in world units
        const gridWorldSize = this.gridSize;

        // Calculate start positions in world coordinates
        const startX = Math.floor(worldTopLeft.x / gridWorldSize) * gridWorldSize;
        const startY = Math.floor(worldTopLeft.y / gridWorldSize) * gridWorldSize;
        const endX = Math.ceil(worldBottomRight.x / gridWorldSize) * gridWorldSize;
        const endY = Math.ceil(worldBottomRight.y / gridWorldSize) * gridWorldSize;

        // Set grid style
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = this.gridOpacity;

        // Draw vertical lines
        for (let x = startX; x <= endX; x += gridWorldSize) {
            const screenX = this.worldToScreen(x, 0).x;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = startY; y <= endY; y += gridWorldSize) {
            const screenY = this.worldToScreen(0, y).y;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(width, screenY);
            ctx.stroke();
        }

        // Draw dots at intersections (optional)
        ctx.fillStyle = this.gridColor;
        ctx.globalAlpha = this.gridOpacity * 0.7;

        for (let x = startX; x <= endX; x += gridWorldSize) {
            for (let y = startY; y <= endY; y += gridWorldSize) {
                const screenPos = this.worldToScreen(x, y);
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, 1.5 * viewport.scale, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = 1.0;
    }



    drawConnections() {
        const { ctx, viewport } = this;

        for (const element of this.elements.values()) {
            if (element.type === 'node' && element.parentId) {
                const parent = this.elements.get(element.parentId);
                if (!parent) continue;

                const childPos = this.worldToScreen(
                    element.x + this.NODE_WIDTH / 2,
                    element.y + this.NODE_HEIGHT / 2
                );
                const parentPos = this.worldToScreen(
                    parent.x + this.NODE_WIDTH / 2,
                    parent.y + this.NODE_HEIGHT / 2
                );

                // Line with arrow
                ctx.beginPath();
                ctx.moveTo(parentPos.x, parentPos.y);
                ctx.lineTo(childPos.x, childPos.y);
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 2 * viewport.scale;
                ctx.stroke();

                // Arrow
                const angle = Math.atan2(childPos.y - parentPos.y, childPos.x - parentPos.x);
                const arrowLength = 10 * viewport.scale;
                const arrowX = childPos.x - arrowLength * Math.cos(angle);
                const arrowY = childPos.y - arrowLength * Math.sin(angle);

                ctx.beginPath();
                ctx.moveTo(arrowX, arrowY);
                ctx.lineTo(
                    arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
                    arrowY - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(arrowX, arrowY);
                ctx.lineTo(
                    arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
                    arrowY - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.stroke();
            }
        }
    }

    drawNodes() {
        for (const element of this.elements.values()) {
            if (element.type === 'node') {
                this.drawNode(element);
            }
        }
    }

    // ===== ИСПРАВЛЕННЫЙ METОД ОТРИСОВКИ НОДЫ =====
    drawNode(node) {
        const { ctx, viewport } = this;

        // КРИТИЧНО: получаем экранные координаты для отрисовки
        const screenPos = this.worldToScreen(node.x, node.y);
        const width = this.NODE_WIDTH * viewport.scale;
        const height = this.NODE_HEIGHT * viewport.scale;

        // Зеленая точка для отладки
        if (this.debugCoords) {
            ctx.save();
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(screenPos.x - 3, screenPos.y - 3, 6, 6);
            ctx.restore();
        }

        // Нода
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 8 * viewport.scale;
        ctx.shadowOffsetY = 2 * viewport.scale;

        ctx.fillStyle = node.color || '#3b82f6';
        ctx.fillRect(screenPos.x, screenPos.y, width, height);

        ctx.strokeStyle = node === this.hoveredElement?.element ? '#1d4ed8' : '#2563eb';
        ctx.lineWidth = 2 * viewport.scale;
        ctx.strokeRect(screenPos.x, screenPos.y, width, height);

        ctx.restore();

        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(12, 14 * viewport.scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textX = screenPos.x + width / 2;
        const textY = screenPos.y + height / 2;
        ctx.fillText(node.text.substring(0, 20), textX, textY);
    }


    drawPlusButton(element, side) {
        const { ctx, viewport } = this;

        // Получить экранные координаты ноды
        const screenPos = this.worldToScreen(element.x, element.y);
        const width = (element.width || this.NODE_WIDTH) * viewport.scale;
        const height = (element.height || this.NODE_HEIGHT) * viewport.scale;

        const plusSize = this.PLUS_BUTTON_SIZE * viewport.scale;
        let plusX, plusY;

        if (side === 'right') {
            plusX = screenPos.x + width - plusSize;
        } else { // left
            plusX = screenPos.x;
        }

        plusY = screenPos.y + height / 2 - plusSize / 2;

        // Отладочная рамка (показывать всегда если debugCoords)
        if (this.debugCoords) {
            ctx.save();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.strokeRect(plusX, plusY, plusSize, plusSize);
            ctx.fillStyle = '#ff0000';
            ctx.font = '10px monospace';
            ctx.fillText(side, plusX + 3, plusY + plusSize - 3);
            ctx.restore();
        }

        // Круглая кнопка
        ctx.save();
        ctx.beginPath();
        ctx.arc(plusX + plusSize / 2, plusY + plusSize / 2, plusSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();

        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 1 * viewport.scale;
        ctx.stroke();

        // Знак плюса
        ctx.fillStyle = '#ffffff';
        const barWidth = plusSize / 3;
        const barHeight = plusSize / 2;

        // Горизонтальная черта
        ctx.fillRect(
            plusX + plusSize / 2 - barWidth / 2,
            plusY + plusSize / 4,
            barWidth,
            barHeight
        );

        // Вертикальная черта
        ctx.fillRect(
            plusX + plusSize / 4,
            plusY + plusSize / 2 - barWidth / 2,
            barHeight,
            barWidth
        );

        ctx.restore();
    }


    // ===== INTERACTION HANDLERS =====

    onKeyDown(e) {
        this.keys.add(e.code);

        if (e.code === 'Space' && !this.isPanning) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grab';
        }

        // Enter for adding child node when focused
        if (e.code === 'Enter' && this.hoveredElement && !e.altKey) {
            e.preventDefault();
            const childId = this.createChildNode(this.hoveredElement.element.id, this.hoverSide || 'right');
            if (childId) {
                this.saveToStorage();
                this.draw();
            }
        }
    }

    onKeyUp(e) {
        this.keys.delete(e.code);

        if (e.code === 'Space') {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    // ===== ИСПРАВЛЕННЫЙ onMouseDown =====
    onMouseDown(e) {
        e.preventDefault();

        const canvasXY = this.getCanvasXY(e.clientX, e.clientY);
        this.lastMouseScreen = { x: canvasXY.x, y: canvasXY.y };
        this.lastMouseWorld = this.screenToWorld(canvasXY.x, canvasXY.y);

        console.log(`🖱️ Mouse down: Canvas(${canvasXY.x}, ${canvasXY.y}), World(${this.lastMouseWorld.x.toFixed(0)}, ${this.lastMouseWorld.y.toFixed(0)})`);

        const hit = this.getElementAt(canvasXY.x, canvasXY.y);

        if (e.button === 0) {
            if (hit && hit.hoverSide) {
                // Клик по кнопке "+"
                console.log(`➕ Clicked plus button on side: ${hit.hoverSide}`);
                const childId = this.createChildNode(hit.element.id, hit.hoverSide);
                if (childId) {
                    this.saveToStorage();
                    this.scheduleRedraw();
                }
                return;
            }

            if (hit) {
                // Начало перетаскивания ноды
                this.draggedElement = hit.element;
                this.dragStart = { x: canvasXY.x, y: canvasXY.y };
                this.isDragging = true;
                this.canvas.style.cursor = 'move';

                // КРИТИЧНЫЙ FIX: Сохраняем начальную мировую позицию для корректного смещения детей
                this._dragStartWorld = { x: hit.element.x, y: hit.element.y };

                console.log(`Dragging node: "${hit.element.text}" from world(${hit.element.x}, ${hit.element.y})`);
            } else {
                // Начало панорамирования
                this.isPanning = true;
                this.panStart = { x: canvasXY.x, y: canvasXY.y };
                this.canvas.style.cursor = 'grabbing';

                console.log('Starting pan');
            }
        }
    }



    onMouseMove(e) {
        e.preventDefault();

        // Получить координаты мыши относительно canvas
        const canvasXY = this.getCanvasXY(e.clientX, e.clientY);

        // Сохранить для отладки
        this.lastMouseScreen = { x: canvasXY.x, y: canvasXY.y };
        this.lastMouseWorld = this.screenToWorld(canvasXY.x, canvasXY.y);

        // Проверить ховер (результат сохраняется в this.hoveredElement и this.hoverSide)
        const hit = this.getElementAt(canvasXY.x, canvasXY.y);

        // Обновить ховер и курсор
        if (hit && hit.hoverSide) {
            this.hoveredElement = hit;
            this.hoverSide = hit.hoverSide;
            this.canvas.style.cursor = 'pointer';
        } else if (hit) {
            this.hoveredElement = hit;
            this.hoverSide = null;
            this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'move';
        } else {
            this.hoveredElement = null;
            this.hoverSide = null;
            this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'grab';
        }

        // Обработка перетаскивания
        if (this.isDragging && this.draggedElement) {
            // КРИТИЧНЫЙ FIX: Перемещаем левый верхний угол ноды под курсор
            const currentWorld = this.screenToWorld(canvasXY.x, canvasXY.y);

            this.draggedElement.x = currentWorld.x;
            this.draggedElement.y = currentWorld.y;
            this.draggedElement.updatedAt = Date.now();

            console.log(`[Drag] Нода "${this.draggedElement.text}" moved to world(${currentWorld.x.toFixed(1)}, ${currentWorld.y.toFixed(1)})`);

            this.scheduleRedraw();
        }

        // Обработка панорамирования
        if (this.isPanning) {
            const dx = canvasXY.x - this.panStart.x;
            const dy = canvasXY.y - this.panStart.y;

            this.viewport.x += dx;
            this.viewport.y += dy;

            this.panStart = { x: canvasXY.x, y: canvasXY.y };

            this.scheduleRedraw();
        }
    }



    onMouseUp(e) {
        if (e.button === 0) { // Левая кнопка мыши
            if (this.isDragging && this.draggedElement) {
                console.log(`Node ${this.draggedElement.text} dropped at world(${this.draggedElement.x.toFixed(1)}, ${this.draggedElement.y.toFixed(1)})`);
                this.saveToStorage();
            }

            this.isDragging = false;
            this.isPanning = false;
            this.draggedElement = null;

            // Восстановить курсор
            const hit = this.getElementAt(this.lastMouseScreen.x, this.lastMouseScreen.y);
            if (hit && hit.hoverSide) {
                this.canvas.style.cursor = 'pointer';
            } else if (hit) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'grab';
            }
        }
    }


    // FIX: ИСПРАВИТЬ обработку wheel (zoom)
    onWheel(e) {
        e.preventDefault();
        e.stopPropagation();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Сохраняем мировую позицию под курсором ДО зума
        const worldBefore = this.screenToWorld(x, y);

        // Определяем направление и коэффициент
        const delta = e.deltaY;
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        const newScale = this.viewport.scale * zoomFactor;

        // Ограничиваем зум
        this.viewport.scale = Math.max(0.1, Math.min(5, newScale));

        // FIX: Вычисляем мировую позицию после зума через ту же точку
        // Новая формула: корректируем viewport так, чтобы worldBefore осталась под курсором
        this.viewport.x = x - worldBefore.x * this.viewport.scale;
        this.viewport.y = y - worldBefore.y * this.viewport.scale;

        // Принудительная перерисовка
        this.scheduleRedraw();
        this.updateStats();

        // Отладочная информация
        if (this.debugCoords) {
            console.log(`Zoom: factor=${zoomFactor}, scale=${this.viewport.scale.toFixed(2)}, delta=${delta}`);
        }
    }


    onContextMenu(e) {
        // КРИТИЧНЫЙ FIX: предотвращение на всех уровнях
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Для старых браузеров
        if (e.cancelable) e.preventDefault();
        e.returnValue = false;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        console.log(`Context menu at: screen(${x}, ${y})`);

        const hit = this.getElementAt(x, y);

        if (hit && hit.element) {
            this.showNodeContextMenu(x, y, hit.element);
        } else {
            this.showCanvasContextMenu(x, y);
        }

        return false;
    }

    // ===== NODE MANAGEMENT =====

    // ===== ИСПРАВЛЕННЫЙ createNodeAt =====
    createNodeAt(clientX, clientY, text = 'New node', parentId = null) {
        const canvasXY = this.getCanvasXY(clientX, clientY);

        // КРИТИЧНЫЙ FIX: Преобразование canvas -> world по новой формуле
        const worldX = canvasXY.x - this.viewport.x;
        const worldY = canvasXY.y - this.viewport.y;

        console.log(`[Miro] Создание ноды (FIX координатной системы):`);
        console.log(`  Canvas клик: (${canvasXY.x}, ${canvasXY.y})`);
        console.log(`  Viewport смещение: (${this.viewport.x}, ${this.viewport.y})`);
        console.log(`  Мировые координаты клика: (${worldX}, ${worldY})`);

        const id = this.nextId++;
        const node = {
            id,
            type: 'node',
            x: worldX,      // Левый верхний угол под курсором
            y: worldY,
            width: this.NODE_WIDTH,
            height: this.NODE_HEIGHT,
            text: text || `Node ${id}`,
            color: this.getNodeColor(parentId),
            parentId,
            childrenIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.elements.set(id, node);

        // Проверка: экранные координаты должны быть теми же, где кликнули!
        const screenPos = this.worldToScreen(node.x, node.y);
        console.log(`  Экранные координаты ноды: (${screenPos.x}, ${screenPos.y})`);
        console.log(`  Ожидаемые: те же как клик canvas (${canvasXY.x}, ${canvasXY.y})`);

        // Проверка совпадения
        const diffX = Math.abs(screenPos.x - canvasXY.x);
        const diffY = Math.abs(screenPos.y - canvasXY.y);
        console.log(`  Разница: (${diffX}, ${diffY})`);

        if (parentId) {
            const parent = this.elements.get(parentId);
            if (parent) parent.childrenIds.push(id);
        }

        this.saveToStorage();
        this.scheduleRedraw();
        this.updateStats();

        return id;
    }



    createChildNode(parentId, side = 'right') {
        const parent = this.elements.get(parentId);
        if (!parent) return null;

        const offsetX = side === 'right' ? this.CHILD_OFFSET_X : -this.CHILD_OFFSET_X;

        const id = this.nextId++;
        const node = {
            id,
            type: 'node',
            x: parent.x + offsetX,
            y: parent.y + (parent.childrenIds.length * this.CHILD_OFFSET_Y),
            width: this.NODE_WIDTH,
            height: this.NODE_HEIGHT,
            text: `Child ${id}`,
            color: this.getNodeColor(parentId),
            parentId,
            childrenIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.elements.set(id, node);
        parent.childrenIds.push(id);

        return id;
    }

    getNodeColor(parentId) {
        if (!parentId) return '#3b82f6'; // Blue for root

        const colors = [
            '#10b981', // Green
            '#f59e0b', // Orange
            '#ef4444', // Red
            '#8b5cf6', // Purple
            '#ec4899'  // Pink
        ];

        const parent = this.elements.get(parentId);
        if (!parent) return colors[0];

        return colors[parent.childrenIds.length % colors.length];
    }

    moveChildrenWithParent(parentId, dx, dy) {
        const parent = this.elements.get(parentId);
        if (!parent) return;

        const moveRecursive = (nodeId) => {
            const node = this.elements.get(nodeId);
            if (!node) return;

            node.x += dx;
            node.y += dy;
            node.updatedAt = Date.now();

            for (const childId of node.childrenIds) {
                moveRecursive(childId);
            }
        };

        for (const childId of parent.childrenIds) {
            moveRecursive(childId);
        }
    }

    // ===== CONTEXT MENUS =====

    // FIX: ИСПРАВИТЬ контекстное меню
    showCanvasContextMenu(x, y) {
        const menu = document.getElementById('miroContextMenu');
        if (!menu) return;

        // Очистить меню
        menu.innerHTML = '';

        // Вычислить мировые координаты для отладки
        const worldPos = this.screenToWorld(x, y);

        menu.innerHTML = `
            <div>
        <div class="px-4 py-2 font-semibold text-gray-700 border-b bg-gray-50">
            Canvas Menu
        </div>
        <button data-action="test-center-click" 
                class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
            <span class="text-lg">🎯</span> Test: Create at exact center
        </button>
        <button data-action="create-node" 
                class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
            <span class="text-lg">＋</span> Create node here
        </button>
        <button data-action="reset-vars" 
                class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
            <span class="text-lg">🔄</span> Reset viewport to (0,0,1)
        </button>
        <div class="divider"></div>
        <button data-action="debug-coords" 
                class="w-full text-left px-4 py-2 hover:bg-gray-100 text-xs text-gray-500">
            🐛 Debug coordinates: ${this.debugCoords ? 'ON' : 'OFF'}
        </button>

        <button data-action="test-center-node" 
                class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
            <span class="text-lg">🧪</span> Test: Create node at exact center
        </button>

        <button data-action="test-coord-system" 
        class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
    <span class="text-lg">📊</span> Test: Debug coordinate system
</button>
    </div>
        `;

        // Позиционировать меню
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        menu.querySelector('[data-action="test-center-node"]').onclick = (e) => {
            e.stopPropagation();

            // Создать ноду точно в центре экрана (0,0 мировых)
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;

            const worldPos = this.screenToWorld(centerX, centerY);
            console.log(`TEST: Центр экрана в мировых координатах: (${worldPos.x}, ${worldPos.y})`);

            const id = this.nextId++;
            const node = {
                id,
                type: 'node',
                x: 0,      // точно в центре (0,0)
                y: 0,      // точно в центре (0,0)
                width: this.NODE_WIDTH,
                height: this.NODE_HEIGHT,
                text: `CENTER TEST ${id}`,
                color: '#ff0000',
                parentId: null,
                childrenIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            this.elements.set(id, node);
            this.saveToStorage();
            this.draw();

            const screenPos = this.worldToScreen(0, 0);
            console.log(`TEST: Экранные координаты ноды в центре: (${screenPos.x}, ${screenPos.y})`);

            menu.classList.add('hidden');
        };

        // Новая тестовая кнопка
        menu.querySelector('[data-action="test-center-click"]').onclick = (e) => {
            e.stopPropagation();
            // Создать ноду точно в центре экрана
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;

            // Имитируем клик в точный центр
            this.lastMouseScreen = { x: centerX, y: centerY };

            const worldPos = this.screenToWorld(centerX, centerY);
            console.log(`ТЕСТ: Создание в точном центре:`);
            console.log(`Canvas: (${centerX}, ${centerY})`);
            console.log(`Viewport: (${this.viewport.x}, ${this.viewport.y})`);
            console.log(`World: (${worldPos.x}, ${worldPos.y})`);

            const id = this.nextId++;
            const node = {
                id,
                type: 'node',
                x: -this.NODE_WIDTH / 2, // гарантированно в (0,0)
                y: -this.NODE_HEIGHT / 2,
                width: this.NODE_WIDTH,
                height: this.NODE_HEIGHT,
                text: `CENTER ${id}`,
                color: '#ff0000', // Красная для теста
                parentId: null,
                childrenIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            this.elements.set(id, node);
            this.saveToStorage();
            this.draw();
            menu.classList.add('hidden');
        };

        // Reset vars button
        menu.querySelector('[data-action="reset-vars"]').onclick = (e) => {
            e.stopPropagation();
            this.viewport = { x: 0, y: 0, scale: 1 };
            this.scheduleRedraw();
            console.log(`Viewport сброшен к (0,0,1)`);
            menu.classList.add('hidden');
        };

        // Обработчики
        setTimeout(() => {
            menu.querySelector('[data-action="create-node"]').onclick = (e) => {
                e.stopPropagation();
                const text = prompt('Node text:', 'New idea');
                if (text !== null && text.trim()) {
                    this.createNodeAt(x, y, text.trim());
                }
                menu.classList.add('hidden');
            };

            menu.querySelector('[data-action="center-view"]').onclick = (e) => {
                e.stopPropagation();
                this.centerView();
                menu.classList.add('hidden');
            };

            menu.querySelector('[data-action="reset-zoom"]').onclick = (e) => {
                e.stopPropagation();
                this.viewport.scale = 1;
                this.scheduleRedraw();
                this.updateStats();
                menu.classList.add('hidden');
            };

            menu.querySelector('[data-action="debug-coords"]').onclick = (e) => {
                e.stopPropagation();
                this.debugCoords = !this.debugCoords;
                console.log(`Debug coordinates: ${this.debugCoords ? 'ON' : 'OFF'}`);
                menu.classList.add('hidden');
            };
        }, 0);

        // Закрыть меню при клике снаружи
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('contextmenu', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('contextmenu', closeMenu);
        }, 10);
    }

    showNodeContextMenu(x, y, node) {
        const menu = document.getElementById('miroContextMenu');
        if (!menu) return;

        menu.innerHTML = `
        <div class="w-[220px] py-2">
            <div class="px-4 py-2 font-semibold text-gray-700 border-b">Node: "${node.text.substring(0, 20)}"</div>
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100" data-action="edit-text">✏️ Edit text</button>
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100" data-action="add-child-left">⬅️ Add left</button>
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100" data-action="add-child-right">➡️ Add right</button>
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600" data-action="delete-node">🗑️ Delete</button>
            ${node.knowledgeId ? `<button class="w-full text-left px-4 py-2 hover:bg-gray-100 text-blue-600" data-action="view-knowledge">🧠 View Knowledge</button>` : ''}
        </div>
    `;

        // КРИТИЧНО: позиционирование относительно canvas контейнера
        const container = this.canvas.parentElement;
        const containerRect = container.getBoundingClientRect();

        menu.style.left = `${x + containerRect.left}px`;
        menu.style.top = `${y + containerRect.top}px`;
        menu.style.position = 'fixed';
        menu.classList.remove('hidden');

        // Handlers
        menu.querySelector('[data-action="edit-text"]').onclick = () => {
            const text = prompt('New text:', node.text);
            if (text !== null && text.trim()) {
                node.text = text.trim();
                node.updatedAt = Date.now();
                this.saveToStorage();
                this.draw();
            }
            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="add-child-left"]').onclick = () => {
            this.createChildNode(node.id, 'left');
            this.saveToStorage();
            this.draw();
            menu.classList.add('hidden');
        };
        menu.querySelector('[data-action="test-coord-system"]').onclick = (e) => {
            e.stopPropagation();

            console.log('=== TEST COORDINATE SYSTEM ===');
            console.log(`Canvas: ${this.canvas.width}x${this.canvas.height}`);
            console.log(`Viewport: (${this.viewport.x}, ${this.viewport.y}), scale=${this.viewport.scale}`);

            // Тест 1: Центр canvas
            const centerCanvas = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            const centerWorld = this.screenToWorld(centerCanvas.x, centerCanvas.y);
            const centerScreen = this.worldToScreen(centerWorld.x, centerWorld.y);

            console.log(`Test 1: Центр canvas`);
            console.log(`  Canvas: (${centerCanvas.x}, ${centerCanvas.y})`);
            console.log(`  World: (${centerWorld.x}, ${centerWorld.y})`);
            console.log(`  Screen обратно: (${centerScreen.x}, ${centerScreen.y})`);
            console.log(`  Diff: (${centerScreen.x - centerCanvas.x}, ${centerScreen.y - centerCanvas.y})`);

            // Тест 2: Клик в (0, 0) мировых
            const zeroCanvas = this.worldToScreen(0, 0);
            console.log(`Test 2: Мировые (0,0) на canvas`);
            console.log(`  Canvas: (${zeroCanvas.x}, ${zeroCanvas.y})`);

            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="add-child-right"]').onclick = () => {
            this.createChildNode(node.id, 'right');
            this.saveToStorage();
            this.draw();
            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="delete-node"]').onclick = () => {
            if (confirm(`Delete node "${node.text}" and all children?`)) {
                this.deleteNodeRecursive(node.id);
                this.saveToStorage();
                this.draw();
            }
            menu.classList.add('hidden');
        };

        if (node.knowledgeId) {
            menu.querySelector('[data-action="view-knowledge"]').onclick = () => {
                UI.switchView('view-knowledge-avatar');
                menu.classList.add('hidden');
            };
        }

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('contextmenu', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
            document.addEventListener('contextmenu', closeMenu);
        }, 10);
    }

    deleteNodeRecursive(nodeId) {
        const node = this.elements.get(nodeId);
        if (!node) return;

        // Delete children recursively
        for (const childId of node.childrenIds) {
            this.deleteNodeRecursive(childId);
        }

        // Remove from parent
        if (node.parentId) {
            const parent = this.elements.get(node.parentId);
            if (parent) {
                parent.childrenIds = parent.childrenIds.filter(id => id !== nodeId);
            }
        }

        this.elements.delete(nodeId);
    }

    // ===== STORAGE =====

    saveToStorage() {
        const data = {
            elements: Array.from(this.elements.entries()),
            nextId: this.nextId,
            viewport: this.viewport,
            version: '1.0',
            savedAt: Date.now()
        };

        localStorage.setItem('miroBoard', JSON.stringify(data));
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem('miroBoard');
            if (!raw) {
                console.log('[Miro] No saved board, using defaults');
                return;
            }

            const data = JSON.parse(raw);
            if (!data || !data.elements) {
                console.warn('[Miro] Invalid board data, using defaults');
                return;
            }

            this.elements = new Map(data.elements);
            this.nextId = data.nextId || 1;

            // FIX: Валидация viewport
            if (data.viewport &&
                typeof data.viewport.x === 'number' &&
                typeof data.viewport.y === 'number' &&
                typeof data.viewport.scale === 'number') {
                this.viewport = data.viewport;
                console.log(`[Miro] Загружен старый viewport, сохранен как новый: (${this.viewport.x}, ${this.viewport.y})`);
            } else {
                console.log('[Miro] Invalid viewport, using defaults');
                this.viewport = { x: 0, y: 0, scale: 1 };
            }

            console.log(`[Miro] Loaded ${this.elements.size} elements`);

        } catch (e) {
            console.error('[Miro] Storage load error', e);
            // При ошибке используем безопасные значения по умолчанию
            this.elements.clear();
            this.nextId = 1;
            this.viewport = { x: 0, y: 0, scale: 1 };
        }
    }


    /**
 * Экстренный сброс всех проблем с координатами
 */
    emergencyReset() {
        console.log('[Miro] EMERGENCY RESET - полный сброс состояния');

        // 1. Останавливаем анимацию
        this.stopAnimation();

        // 2. Сбрасываем viewport
        if (this.canvas) {
            this.viewport = {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                scale: 1
            };
        } else {
            this.viewport = { x: 0, y: 0, scale: 1 };
        }
        this._viewportSynced = true;

        // 3. Сбрасываем состояние интеракции
        this.isDragging = false;
        this.isPanning = false;
        this.draggedElement = null;
        this.hoveredElement = null;
        this.hoverSide = null;

        // 4. Очищаем canvas
        if (this.canvas && this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 5. Перезапускаем анимацию
        this.startAnimation();

        // 6. Принудительная перерисовка
        setTimeout(() => {
            this.scheduleRedraw();
            this.updateStats();
        }, 50);

        console.log('[Miro] Emergency reset complete');
    }

    // ===== PUBLIC METHODS =====

    clearBoard() {
        if (!confirm('Clear entire board? This cannot be undone.')) return;

        this.elements.clear();
        this.nextId = 1;
        this.viewport = { x: 0, y: 0, scale: 1 };
        this.saveToStorage();
        this.draw();

        UI.showNotification('Board cleared');
    }

    exportJSON() {
        const data = {
            elements: Array.from(this.elements.values()),
            viewport: this.viewport,
            exportedAt: Date.now(),
            version: '1.0'
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `miro-board_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        UI.showNotification('Board exported to JSON');
    }

    /**
     * Deinitialize (when tab is hidden)
     */
    deinit() {
        this.stopAnimation();
        this.removeEventListeners();
        console.log('MiroController: Deinitialized');
    }




    // Add to MiroController class after existing methods

    /**
     * Import JSON data into the board
     */
    importJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (!data.elements || !Array.isArray(data.elements)) {
                throw new Error('Invalid Miro board format');
            }

            // Clear existing board
            this.elements.clear();

            // Import elements
            data.elements.forEach(element => {
                this.elements.set(element.id, element);
            });

            // Update nextId
            if (data.nextId) this.nextId = data.nextId;

            // Restore viewport if available
            if (data.viewport) {
                this.viewport = data.viewport;
            }

            this.saveToStorage();
            this.draw();

            return { success: true, count: this.elements.size };
        } catch (error) {
            console.error('MiroController: Import error', error);
            return { success: false, error: error.message };
        }
    }


    /**
 * Деинициализация (когда вьюха скрывается)
 */
    deinit() {
        console.log('MiroController: Deinitializing...');

        // 1. Остановить анимацию
        this.stopAnimation();

        // 2. Удалить все обработчики
        this.removeEventListeners();

        // 3. Очистить canvas
        if (this.canvas) {
            this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 4. Сбросить состояние
        this.isDragging = false;
        this.isPanning = false;
        this.draggedElement = null;
        this.hoveredElement = null;
        this.hoverSide = null;

        console.log('MiroController: Deinitialized');
    }

    /**
     * Add knowledge node from knowledge unit
     */
    addKnowledgeNode(knowledgeUnit, position = null) {
        if (!knowledgeUnit || !knowledgeUnit.id) return null;

        const worldPos = position || {
            x: Math.random() * 1000 - 500,
            y: Math.random() * 800 - 400
        };

        const id = this.nextId++;

        const node = {
            id,
            type: 'knowledge-node',
            x: worldPos.x,
            y: worldPos.y,
            width: this.NODE_WIDTH,
            height: this.NODE_HEIGHT,
            text: knowledgeUnit.title,
            description: knowledgeUnit.description,
            color: this.getKnowledgeNodeColor(knowledgeUnit.type),
            knowledgeId: knowledgeUnit.id,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.elements.set(id, node);
        this.saveToStorage();
        this.draw();

        return id;
    }

    /**
     * Get color based on knowledge type
     */
    getKnowledgeNodeColor(type) {
        const colors = {
            'concept': '#3b82f6',    // Blue
            'fact': '#10b981',       // Green
            'procedure': '#f59e0b',  // Orange
            'default': '#8b5cf6'     // Purple
        };

        return colors[type] || colors.default;
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const nodeCount = Array.from(this.elements.values())
            .filter(el => el.type === 'node' || el.type === 'knowledge-node').length;

        const linkCount = Array.from(this.elements.values())
            .filter(el => el.type === 'node' || el.type === 'knowledge-node')
            .filter(el => el.parentId).length;

        // Update UI elements
        const nodeEl = document.getElementById('miroNodeCount');
        const linkEl = document.getElementById('miroLinkCount');
        const zoomEl = document.getElementById('miroZoomLevel');
        const posEl = document.getElementById('miroViewportPos');

        if (nodeEl) nodeEl.textContent = nodeCount;
        if (linkEl) linkEl.textContent = linkCount;
        if (zoomEl) zoomEl.textContent = `${Math.round(this.viewport.scale * 100)}%`;
        if (posEl) posEl.textContent = `${Math.round(this.viewport.x)},${Math.round(this.viewport.y)}`;
    }

    // ===== ПРОСТОЙ centerView =====
    /**
 * Центрирует viewport на мировых координатах (0,0)
 */
    centerView() {
        if (!this.canvas) return;

        // КРИТИЧНЫЙ FIX: Viewport должен быть в центре canvas
        this.viewport.x = this.canvas.width / 2;
        this.viewport.y = this.canvas.height / 2;
        this.viewport.scale = 1;

        console.log(`🎯 Centered viewport: canvas смещение (${this.viewport.x}, ${this.viewport.y})`);
        console.log(`  Мировые (0,0) будут в центре canvas`);

        this.scheduleRedraw();
        this.updateStats();
    }



    /**
     * Show edit dialog for node
     */
    showEditDialog(node) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';

        modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 class="text-lg font-bold mb-4">Edit Node</h3>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Text</label>
                    <input type="text" id="editNodeText" 
                           class="w-full border rounded-lg p-2"
                           value="${node.text || ''}">
                </div>
                
                ${node.description ? `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea id="editNodeDesc" 
                              class="w-full border rounded-lg p-2 h-24"
                              placeholder="Optional description">${node.description || ''}</textarea>
                </div>` : ''}
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <div class="flex gap-2 flex-wrap">
                        ${['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => `
                            <button class="w-8 h-8 rounded-full border-2 ${node.color === color ? 'border-black' : 'border-transparent'}"
                                    style="background-color: ${color}"
                                    onclick="this.closest('.fixed').querySelector('#editNodeColor').value = '${color}'; this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('border-black')); this.classList.add('border-black')">
                            </button>
                        `).join('')}
                        <input type="hidden" id="editNodeColor" value="${node.color || '#3b82f6'}">
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end gap-2 mt-6">
                <button onclick="this.closest('.fixed').remove()"
                        class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Cancel
                </button>
                <button id="saveNodeEdit"
                        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                    Save
                </button>
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        // Save handler
        modal.querySelector('#saveNodeEdit').onclick = () => {
            const text = modal.querySelector('#editNodeText').value.trim();
            const desc = modal.querySelector('#editNodeDesc')?.value.trim();
            const color = modal.querySelector('#editNodeColor').value;

            if (text) {
                node.text = text;
                if (desc !== undefined) node.description = desc;
                node.color = color;
                node.updatedAt = Date.now();

                this.saveToStorage();
                this.draw();
                this.updateStats();
            }

            modal.remove();
        };

        // Close on click outside
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    /**
     * Enhanced context menu with more options
     */
    showCanvasContextMenu(x, y) {
        const menu = document.getElementById('miroContextMenu');
        if (!menu) return;

        menu.innerHTML = `
        <div class="w-[220px] py-2">
            <div class="px-4 py-2 font-semibold text-gray-700 border-b">Board Actions</div>
            
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2" data-action="create-node">
                <span class="text-lg">＋</span> Create node
            </button>
            
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2" data-action="center-view">
                <span class="text-lg">🎯</span> Center view
            </button>
            
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2" data-action="reset-zoom">
                <span class="text-lg">🔍</span> Reset zoom
            </button>
            
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2" data-action="add-knowledge">
                <span class="text-lg">🧠</span> Add from Knowledge
            </button>
            
            <div class="border-t my-2"></div>
            
            <button class="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-600" data-action="show-help">
                📚 Help & Shortcuts
            </button>
        </div>
    `;

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Handlers
        menu.querySelector('[data-action="create-node"]').onclick = () => {
            const text = prompt('Node text:', 'New idea');
            if (text !== null) {
                this.createNodeAt(x, y, text);
                this.saveToStorage();
                this.draw();
                this.updateStats();
            }
            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="center-view"]').onclick = () => {
            this.centerView();
            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="reset-zoom"]').onclick = () => {
            this.viewport.scale = 1;
            this.draw();
            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="add-knowledge"]').onclick = () => {
            this.showKnowledgeSelector(x, y);
            menu.classList.add('hidden');
        };

        menu.querySelector('[data-action="show-help"]').onclick = () => {
            this.showHelpModal();
            menu.classList.add('hidden');
        };

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }



    /**
 * Show knowledge selector modal
 */
    showKnowledgeSelector(x, y) {
        const knowledgeUnits = Store.data.cognitive.knowledgeUnits || [];

        if (knowledgeUnits.length === 0) {
            UI.showNotification('No knowledge units found. Try AI analysis first.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';

        modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
            <h3 class="text-lg font-bold mb-4">Add Knowledge to Canvas</h3>
            
            <div class="flex-1 overflow-y-auto mb-4">
                <div class="space-y-2">
                    ${knowledgeUnits.map((unit, index) => `
                        <div class="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                             onclick="this.querySelector('input').checked = !this.querySelector('input').checked">
                            <input type="checkbox" id="knowledge_${index}" class="w-4 h-4">
                            <div class="flex-1">
                                <div class="font-medium">${unit.title}</div>
                                <div class="text-sm text-gray-500 truncate">${unit.description || 'No description'}</div>
                                <div class="text-xs text-gray-400 mt-1">Type: ${unit.type} | Topic: ${unit.topic || 'N/A'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-500" id="selectedCount">0 selected</span>
                <div class="flex gap-2">
                    <button onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                        Cancel
                    </button>
                    <button id="addSelectedKnowledge"
                            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Add Selected
                    </button>
                </div>
            </div>
        </div>
    `;

        document.body.appendChild(modal);

        // Update selected count
        const updateCount = () => {
            const count = modal.querySelectorAll('input:checked').length;
            modal.querySelector('#selectedCount').textContent = `${count} selected`;
        };

        modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.onchange = updateCount;
        });

        // Add selected handler
        modal.querySelector('#addSelectedKnowledge').onclick = () => {
            const selected = knowledgeUnits.filter((_, index) =>
                modal.querySelector(`#knowledge_${index}`)?.checked
            );

            if (selected.length === 0) {
                UI.showNotification('Please select at least one knowledge unit');
                return;
            }

            // Add to canvas in a grid pattern
            selected.forEach((unit, index) => {
                const col = index % 3;
                const row = Math.floor(index / 3);

                const worldPos = this.screenToWorld(x + col * 220, y + row * 160);
                this.addKnowledgeNode(unit, worldPos);
            });

            UI.showNotification(`Added ${selected.length} knowledge nodes to canvas`);
            modal.remove();
        };

        // Close on click outside
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }


    /**
 * Получает координаты мыши относительно canvas элемента
 */
    getCanvasXY(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
}
