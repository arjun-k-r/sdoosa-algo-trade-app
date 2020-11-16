

import {
    formatToInput,
} from '../utils/utils.js';

const CrossUp = require('technicalindicators').CrossUp;
const CrossDown = require('technicalindicators').CrossDown;
const ADX = require('technicalindicators').ADX;

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate();
        const results = this.results;
        this.last = results[results.length - 1];
    }
    isUpTrend(last = this.last) {
        return last.mdi < last.pdi;
    }
    isTrending(last = this.last) {
        return last.adx > 25;
    }
    isStrongTrend(last = this.last) {
        return last.adx > 50;
    }
    isVeryStrongTrend(last = this.last) {
        return last.adx > 75;
    }
    crossOverInput() {
        const results = this.results;
        const uptrend = this.isUpTrend();
        const a = uptrend ? "pdi" : "mdi", b = uptrend ? "mdi" : "pdi";
        return results.reduce((acc, o) => {
            acc.lineA.push(o[a]);
            acc.lineB.push(o[b]);
            return acc;
        }, { lineA: [], lineB: [] });
    }
    crossOvers(last = this.last) {
        const uptrend = this.isUpTrend();
        const crossOverInput = this.crossOverInput();
        return uptrend ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    }
    nCrossOvers(n = 3) {
        const crossOvers = this.crossOvers();
        return crossOvers.slice(Math.max(crossOvers.length - n, 0));
    }
    uniqueCrossOver(n) {
        return this.nCrossOvers(n).filter(c => c).length === 1;
    }
    calculate(candles = this.candles) {
        const formattedInput = formatToInput(candles);
        formattedInput.period = 8;
        return ADX.calculate(formattedInput);
    }
};