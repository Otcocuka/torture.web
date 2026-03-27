/**
 * Генератор примера исследовательских данных для демонстрации экспорта.
 * Запуск: node generate_research_data.js
 * Результат: research_export_sample.json
 */

const fs = require('fs');

// Начальная точка: 4 недели назад
const START_TIME = Date.now() - 28 * 24 * 60 * 60 * 1000;
const END_TIME = Date.now();

// Симуляция 5 знаний
const knowledgeUnits = [
    { id: 'unit_001', title: 'Кривая забывания', type: 'concept', topic: 'Память', category: 'Психология' },
    { id: 'unit_002', title: 'Метод Pomodoro', type: 'fact', topic: 'Продуктивность', category: 'Тайм-менеджмент' },
    { id: 'unit_003', title: 'Интервальное повторение', type: 'procedure', topic: 'SRS', category: 'Обучение' },
    { id: 'unit_004', title: 'Когнитивная нагрузка', type: 'concept', topic: 'Нагрузка', category: 'Психология' },
    { id: 'unit_005', title: 'Активное воспроизведение', type: 'procedure', topic: 'Retrieval', category: 'Обучение' },
];

const userKnowledgeStates = knowledgeUnits.map((u, i) => ({
    id: `uk_${u.id}`,
    unitId: u.id,
    status: i < 2 ? 'learned' : 'active',
    level: 0.3 + Math.random() * 0.5,
    history: [],
    lastUpdated: END_TIME,
    nextReview: END_TIME + (1 + Math.random() * 7) * 86400000,
    easeFactor: 2.5,
    lastReviewInterval: [1, 3, 7, 14][Math.floor(Math.random() * 4)]
}));

// Генерация событий
const events = [];
const habitIds = ['habit_001', 'habit_002', 'habit_003'];

function randomTime(start, end) {
    return start + Math.random() * (end - start);
}

function addEvent(timestamp, type, data) {
    events.push({ timestamp: Math.floor(timestamp), type, data: JSON.stringify(data) });
}

// 1. Сессии чтения (20 событий, по ~1 в день с пропусками)
for (let d = 0; d < 28; d++) {
    if (Math.random() < 0.7) { // 70% дней с чтением
        const ts = START_TIME + d * 86400000 + (8 + Math.random() * 4) * 3600000; // 8-12 часов дня
        addEvent(ts, 'read_session', {
            duration: Math.floor(600 + Math.random() * 1800), // 10-40 мин
            wordsCount: Math.floor(1500 + Math.random() * 5000),
            fileId: 1743000000000
        });
    }
}

// 2. Квизы (50 событий — по ~2 в день)
for (let d = 0; d < 28; d++) {
    const quizzesPerDay = Math.random() < 0.3 ? 3 : Math.random() < 0.6 ? 2 : 1;
    for (let q = 0; q < quizzesPerDay; q++) {
        const ts = START_TIME + d * 86400000 + (9 + Math.random() * 10) * 3600000;
        const unit = knowledgeUnits[Math.floor(Math.random() * knowledgeUnits.length)];
        // Оценка улучшается со временем (learning curve)
        const dayProgress = d / 28;
        const baseScore = 30 + dayProgress * 50; // от 30% до 80%
        const score = Math.min(100, Math.max(0, Math.floor(baseScore + (Math.random() - 0.3) * 30)));
        addEvent(ts, 'quiz', { knowledgeId: unit.id, score, timeSpent: Math.floor(30 + Math.random() * 120) });
    }
}

// 3. Pomodoro (40 событий)
for (let d = 0; d < 28; d++) {
    if (Math.random() < 0.75) {
        const ts = START_TIME + d * 86400000 + (9 + Math.random() * 3) * 3600000;
        const phase = Math.random() < 0.7 ? 'work' : 'break';
        addEvent(ts, 'pomodoro', { phase, duration: phase === 'work' ? 1500 : (Math.random() < 0.25 ? 900 : 300) });
    }
}

// 4. Привычки (60 событий)
for (let d = 0; d < 28; d++) {
    if (Math.random() < 0.8) {
        const ts = START_TIME + d * 86400000 + 8 * 3600000;
        const habitId = habitIds[Math.floor(Math.random() * habitIds.length)];
        addEvent(ts, 'habit', { habitId });
    }
}

// 5. Добавление знаний (15 событий — больше в начале)
for (let i = 0; i < 15; i++) {
    const ts = START_TIME + (i / 15) * 14 * 86400000 + Math.random() * 86400000;
    addEvent(ts, 'knowledge_added', {
        source: ['Reader: ML Textbook', 'Фрагмент: Python Guide', 'Reader: Data Science'][Math.floor(Math.random() * 3)],
        unitsCount: Math.floor(1 + Math.random() * 3)
    });
}

// 6. Spaced repetition события (30)
for (let i = 0; i < 30; i++) {
    const ts = START_TIME + (7 + Math.random() * 21) * 86400000;
    const unit = knowledgeUnits[Math.floor(Math.random() * knowledgeUnits.length)];
    const intervals = [1, 3, 7, 14, 28];
    addEvent(ts, 'spaced_repetition', {
        unitId: unit.id,
        intervalDays: intervals[Math.floor(Math.random() * intervals.length)],
        step: Math.floor(Math.random() * 5),
        performance: Math.random() > 0.25
    });
}

// Сортировка по времени
events.sort((a, b) => a.timestamp - b.timestamp);

// Обновляем состояния на основе квизов
events.filter(e => e.type === 'quiz').forEach(e => {
    const d = JSON.parse(e.data);
    const state = userKnowledgeStates.find(s => s.unitId === d.knowledgeId);
    if (state) {
        const delta = (d.score - 50) / 250;
        state.level = Math.max(0, Math.min(1, state.level + delta));
        state.history.push({ action: 'quiz', timestamp: e.timestamp, performance: d.score >= 50 });
        if (state.level >= 0.999) state.status = 'mastered';
        else if (state.level >= 0.7) state.status = 'learned';
        else state.status = 'active';
    }
});

const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    events: events,
    snapshot: {
        knowledgeUnits: knowledgeUnits.map(u => ({
            ...u,
            description: `Описание: ${u.title}`,
            sourceBlockIds: ['sb_demo'],
            confidence: 0.85
        })),
        userKnowledgeStates: userKnowledgeStates
    }
};

fs.writeFileSync('research_export_sample.json', JSON.stringify(exportData, null, 2));
console.log(`✅ Сгенерировано ${events.length} событий`);
console.log(`📊 Типы: quiz=${events.filter(e=>e.type==='quiz').length}, read_session=${events.filter(e=>e.type==='read_session').length}, pomodoro=${events.filter(e=>e.type==='pomodoro').length}, habit=${events.filter(e=>e.type==='habit').length}, knowledge_added=${events.filter(e=>e.type==='knowledge_added').length}, spaced_repetition=${events.filter(e=>e.type==='spaced_repetition').length}`);
console.log(`💾 Файл: research_export_sample.json`);