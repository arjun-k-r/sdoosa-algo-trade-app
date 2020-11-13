const RSI = require('technicalindicators').RSI;

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate();
        const results = this.results;
        this.last = results[results.length - 1];
    }
    overBrought(last = this.last) {
        return last >= 80;
    }
    overSold(last = this.last) {
        return last <= 20;
    }
    chanceOfTrendReversal(uptrend, last) {
        return uptrend ? this.overSold(last) : this.overBrought(last);
    }
    isTrendReversalHappendInRecent() {
        const results = this.results;
        return results
            .slice(Math.max(results.length - 3, 0))
            .map(o => this.chanceOfTrendReversal(uptrend, o))
            .includes(true);
    }
    longMomentum(last = this.last) {
        return last >= 60;
    }
    shortMomentum(last = this.last) {
        return last <= 40;
    }
    confirmMomentum(uptrend) {
        return uptrend ? this.longMomentum() : this.shortMomentum();
    }
    calculate(candles = this.candles) {
        const inputRSI = {
            period: 8
        };
        inputRSI.values = candles.map(c => c.close);
        return RSI.calculate(inputRSI);
    }
};