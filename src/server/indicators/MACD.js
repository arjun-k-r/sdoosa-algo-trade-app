
const MACD = require('technicalindicators').MACD;

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate();
        const results = this.results;
        this.last = results[results.length - 1];
    }
    crossOverInput() {
        const results = this.results;
        return results.reduce((acc, o) => {
            acc.lineA.push(o.MACD);
            acc.lineB.push(o.signal);
            return acc;
        }, { lineA: [], lineB: [] });
    }
    longMomentum(last = this.last) {
        return last.MACD > last.signal;
    }
    shortMomentum(last = this.last) {
        return last.MACD < last.signal;
    }
    crossOvers(last = this.last) {
        const uptrend = this.longMomentum();
        const crossOverInput = this.crossOverInput();
        return uptrend ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    }
    reversalStarted(last = this.last) {
        return Math.abs(last.MACD - last.signal) > 3;
    }
    nCrossOvers(n = 3) {
        const crossOvers = this.crossOvers();
        return crossOvers.slice(Math.max(crossOvers.length - n, 0));
    }
    uniqueCrossOver(n) {
        return this.nCrossOvers(n).filter(c => c).length === 1;
    }
    overBrought(last = this.last) {
        return last.d >= 80;
    }
    overSold(last = this.last) {
        return last.d <= 20;
    }
    strongCrossOver() {
        return this.uniqueCrossOver() && this.reversalStarted();
    }
    confirmMomentum(uptrend) {
        return uptrend === this.longMomentum() && this.strongCrossOver();
    }
    calculate(candles = this.candles) {
        const macdInput = {
            values: candles.map(c => c.close),
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        };
        return MACD.calculate(macdInput);
    }
};