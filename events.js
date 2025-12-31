// Audio Engine - exact copy
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playBeep() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start();
        oscillator.stop(this.ctx.currentTime + 0.15);
    }
};