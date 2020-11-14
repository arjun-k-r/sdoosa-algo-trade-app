

import {
    formatToInput,
    getAvgCandleSize
} from '../utils/utils.js';

const VWAP = require('technicalindicators').VWAP;

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate();
        const results = this.results;
        this.last = results[results.length - 1];
        this.lastCandle = candles[candles.length - 1];
    }
    isUpTrend(cmp = this.lastCandle.close) {
        // console.log(this.last, cmp);
        return this.last < cmp;
    }
    calculate(candles = this.candles) {
        const input = formatToInput(candles);
        return VWAP.calculate(input);
    }
    isNear(cmp = this.lastCandle.close, avg = getAvgCandleSize(this.candles)) {
        return Math.abs(this.last - cmp) < avg;
    }

    crossOverInput() {
        const results = this.results;
        const candles = this.candles;
        const lineA = [];
        const lineB = [];
        for (let i = 1; i < results.length - 1; i++) {
            lineA.push(results[results.length - i]);
            lineB.push(candles[candles.length - i]);
        }
        return { lineA, lineB };
    }

    crossOvers() {
        const uptrend = this.isUpTrend();
        const crossOverInput = this.crossOverInput();
        return uptrend ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    }

    nCrossOvers(n = 2) {
        const crossOvers = this.crossOvers();
        return crossOvers.slice(Math.max(crossOvers.length - n, 0));
    }

    uniqueCrossOver(n) {
        return this.nCrossOvers(n).filter(c => c).length === 1;
    }

    isCrossed() {
        const lastCandle = this.lastCandle;
        const last = this.last;
        return this.isUpTrend() ? lastCandle.open < last && last < lastCandle.close : lastCandle.open > last && last > lastCandle.close;
    }
};