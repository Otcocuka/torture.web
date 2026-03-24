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

        this.state.isRunning = false; // Остановить, пока пользователь не нажмет Start
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
    async processFile(fileId, onProgress) {
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
        });

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
        try {
            const systemPrompt = `Ты — система оценки знаний.
Вопрос: "${correctUnit.questionText}"
Контекст знания (правильный ответ): "${correctUnit.description}"
Ответ пользователя: "${userAnswer}"
Оцени, насколько ответ пользователя близок к правильному контексту.
Ответь строго одним словом: "correct" или "incorrect".`;

            const response = await fetch(window.appConfig.DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.appConfig.DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: window.appConfig.DEEPSEEK_MODEL,
                    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Оцени ответ." }],
                    max_tokens: 50,
                    temperature: 0.1
                })
            });

            const data = await response.json();
            const resultText = data.choices[0].message.content.toLowerCase().trim();
            if (resultText.startsWith('correct')) return true;
            if (resultText.startsWith('incorrect')) return false;
            return false;

        } catch (e) {
            console.warn("Ошибка проверки ответа:", e);
            return false;
        }
    },

    getCurrentQuestion() {
        if (!this.currentQuiz || this.currentQuestionIndex >= this.currentQuiz.questions.length) return null;
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
    }
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