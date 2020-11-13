

import {
    formatToInput,
} from '../utils/utils.js';

const CrossUp = require('technicalindicators').CrossUp;
const CrossDown = require('technicalindicators').CrossDown;
const Stochastic = require('technicalindicators').Stochastic;

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
            acc.lineA.push(o.k);
            acc.lineB.push(o.d);
            return acc;
        }, { lineA: [], lineB: [] });
    }
    longMomentum(last = this.last) {
        return last.k > last.d;
    }
    shortMomentum(last = this.last) {
        return last.k < last.d;
    }
    crossOvers(last = this.last) {
        const uptrend = this.longMomentum();
        const crossOverInput = this.crossOverInput();
        return uptrend ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    }
    reversalStarted(last = this.last) {
        return Math.abs(last.k - last.d) > 3;
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
        return this.uniqueCrossOver() && this.reversalStarted() && (this.longMomentum() ? this.overSold() : this.overBrought());
    }
    confirmMomentum(uptrend) {
        // console.log(uptrend, this.overSold(), this.overBrought());
        return (uptrend ? this.longMomentum() : this.shortMomentum()) && this.strongCrossOver();
    }
    calculate(candles = this.candles) {
        let period = 8;
        let signalPeriod = 3;
        const formattedInput = formatToInput(candles);
        let input = {
            high: formattedInput.high,
            low: formattedInput.low,
            close: formattedInput.close,
            period: period,
            signalPeriod: signalPeriod
        };
        return Stochastic.calculate(input);
    }
};