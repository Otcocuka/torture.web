// spaced_repetition.js
const SpacedRepetition = {
    // Алгоритм 3 из ВКР
    calculateNextInterval(knowledgeItem, userState, previousInterval, performance) {
        // knowledgeItem: объект с easeFactor (можно хранить в userKnowledgeState)
        // userState: уровень 0..1
        // previousInterval: в днях
        // performance: true (верно) / false (неверно)
        let easeFactor = knowledgeItem.easeFactor || 2.5;
        let multiplier = 1.0;

        if (performance) {
            easeFactor = Math.max(1.3, easeFactor * 1.1);
            if (userState > 0.7) {
                multiplier = 1 + Math.log2(1 + userState);
            } else {
                multiplier = 1 + userState;
            }
        } else {
            easeFactor = Math.max(1.3, easeFactor * 0.8);
            multiplier = 0.5;
        }

        let newInterval = previousInterval * easeFactor * multiplier;
        newInterval = Math.max(1, Math.min(365, newInterval)); // в днях

        // Сохраняем новый easeFactor обратно в state
        return { newInterval, easeFactor };
    },

    // Получить список знаний, требующих повторения сегодня
    getDueUnits() {
        const now = Date.now();
        const due = Store.data.cognitive.userKnowledgeStates.filter(state => {
            if (state.nextReview && state.nextReview <= now) return true;
            return false;
        });
        return due.map(state => {
            const unit = Store.data.cognitive.knowledgeUnits.find(u => u.id === state.unitId);
            return { unit, state };
        });
    },

    // Планирование следующего повторения после квиза
    scheduleAfterQuiz(unitId, performance, currentLevel) {
        const state = Store.data.cognitive.userKnowledgeStates.find(s => s.unitId === unitId);
        if (!state) return;

        const previousInterval = state.lastReviewInterval || 1; // дни
        const { newInterval, easeFactor } = this.calculateNextInterval(
            { easeFactor: state.easeFactor || 2.5 },
            currentLevel,
            previousInterval,
            performance
        );

        state.easeFactor = easeFactor;
        state.lastReviewInterval = newInterval;
        state.nextReview = Date.now() + newInterval * 24 * 60 * 60 * 1000;
        state.lastUpdated = Date.now();
        Store.save();
    }
};