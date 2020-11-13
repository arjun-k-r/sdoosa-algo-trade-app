

import {
    formatToInput,
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
        return this.last < cmp;
    }
    calculate(candles = this.candles) {
        const input = formatToInput(candles);
        return VWAP.calculate(input);
    }
    isCrossed() {
        const lastCandle = this.lastCandle;
        const last = this.last;
        return this.isUpTrend ? lastCandle.open < last && last < lastCandle.close : lastCandle.open > last && last > lastCandle.close;
    }
};