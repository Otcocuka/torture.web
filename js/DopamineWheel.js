export class DopamineWheel {
    constructor(canvasId = 'wheelCanvas') {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.spinButton = document.getElementById('spinButton');
        this.resultElement = document.getElementById('result');
        
        this.isSpinning = false;
        this.rotation = 0;
        this.selectedIndex = -1;
        
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = Math.min(this.centerX, this.centerY) - 20;
        
        this.activities = [
            { text: "Сделать 1 мин. зарядки", color: "hsl(197, 30%, 43%)" },
            { text: "Послушать любимую песню", color: "hsl(173, 58%, 39%)" },
            { text: "Обнять питомца/подушку", color: "hsl(43, 74%, 66%)" },
            { text: "Выпить стакан воды", color: "hsl(27, 87%, 67%)" },
            { text: "Сделать растяжку", color: "hsl(12, 76%, 61%)" },
            { text: "Глубоко подышать 1 мин.", color: "hsl(350, 60%, 52%)" },
            { text: "Вспомнить свой успех", color: "hsl(91, 43%, 54%)" },
            { text: "Понюхать что-то приятное", color: "hsl(140, 36%, 74%)" },
            { text: "Открыть окно", color: "hsl(220, 60%, 55%)" },
            { text: "Сделать мини-уборку", color: "hsl(280, 50%, 60%)" }
        ];

        this.drawWheel();
        this.addEventListeners();
    }

    drawWheel() {
        const sliceAngle = (2 * Math.PI) / this.activities.length;
        
        this.activities.forEach((activity, index) => {
            const startAngle = index * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.centerX, this.centerY);
            this.ctx.arc(this.centerX, this.centerY, this.radius, startAngle, endAngle);
            this.ctx.closePath();
            this.ctx.fillStyle = activity.color;
            this.ctx.fill();
            
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.save();
            this.ctx.translate(this.centerX, this.centerY);
            this.ctx.rotate(startAngle + sliceAngle / 2);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(activity.text, this.radius - 10, 4);
            this.ctx.restore();
        });
    }

    spin() {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.resultElement.textContent = "";
        this.spinButton.disabled = true;
        
        this.selectedIndex = Math.floor(Math.random() * this.activities.length);
        const sliceAngle = (2 * Math.PI) / this.activities.length;
        const extraRotation = 5 * 2 * Math.PI;
        const targetRotation = extraRotation - (this.selectedIndex * sliceAngle + sliceAngle / 2);
        
        const startRotation = this.rotation;
        const startTime = performance.now();
        const duration = 4000;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = (t) => 1 - Math.pow(1 - t, 3);
            this.rotation = startRotation + (targetRotation - startRotation) * easeOut(progress);
            
            this.redrawWheel();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.onSpinComplete();
            }
        };
        
        requestAnimationFrame(animate);
    }

    redrawWheel() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.rotation);
        this.ctx.translate(-this.centerX, -this.centerY);
        
        const sliceAngle = (2 * Math.PI) / this.activities.length;
        
        this.activities.forEach((activity, index) => {
            const startAngle = index * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.centerX, this.centerY);
            this.ctx.arc(this.centerX, this.centerY, this.radius, startAngle, endAngle);
            this.ctx.closePath();
            this.ctx.fillStyle = activity.color;
            this.ctx.fill();
            
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            this.ctx.save();
            this.ctx.translate(this.centerX, this.centerY);
            this.ctx.rotate(startAngle + sliceAngle / 2);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(activity.text, this.radius - 10, 4);
            this.ctx.restore();
        });
        
        this.ctx.restore();
    }

    onSpinComplete() {
        this.isSpinning = false;
        this.spinButton.disabled = false;
        
        const selectedActivity = this.activities[this.selectedIndex];
        this.resultElement.textContent = `🎉 ${selectedActivity.text}`;
        this.resultElement.className = "text-xl font-semibold text-indigo-600 min-h-[2.5rem] my-4 flex items-center justify-center";
        
        this.saveToHistory(selectedActivity.text);
    }

    saveToHistory(activity) {
        const history = JSON.parse(localStorage.getItem('dopamineWheelHistory')) || [];
        history.push({
            activity: activity,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('dopamineWheelHistory', JSON.stringify(history));
    }

    exportData() {
        return {
            activities: this.activities,
            history: JSON.parse(localStorage.getItem('dopamineWheelHistory')) || []
        };
    }

    addEventListeners() {
        this.spinButton.addEventListener('click', () => this.spin());
    }
}