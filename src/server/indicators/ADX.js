

import {
    formatToInput,
} from '../utils/utils.js';

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
        return last.adx > 20;
    }
    isStrongTrend(last = this.last) {
        return last.adx > 35;
    }
    calculate(candles = this.candles) {
        const formattedInput = formatToInput(candles);
        formattedInput.period = 14;
        return ADX.calculate(formattedInput);
    }
};