import {
    getAvgCandleSize
} from '../utils/utils.js';

const BollingerBands = require('technicalindicators').BollingerBands;

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate(candles);
        const results = this.results;
        this.last = results[results.length - 1];
        this.lastCandle = candles[candles.length - 1];
    }
    bandWidth(lastBand = this.last, lastCandle = this.lastCandle) {
        return lastBand.upper - lastBand.lower;
    }
    isSqueze(...args) {
        const bandWidth = this.bandWidth.apply(this, args);
        // console.log(bandWidth, getAvgCandleSize(this.candles));
        return bandWidth < 1.5 * getAvgCandleSize(this.candles);
    }
    isVolatile(...args) {
        return !this.isSqueze.apply(this, args);
    }
    calculate(candles = this.candles) {
        const period = 14;
        const input = {
            period: period,
            values: candles.map(candle => candle.close),
            stdDev: 2
        };
        return BollingerBands.calculate(input);
    }
    near(cmp) {
        return Math.max(cmp * .003, .05);
    }
    inContactUpperBand(cmp = this.lastCandle.high, lastBand = this.last) {
        return lastBand.upper < cmp || (lastBand.upper - cmp) <= this.near(cmp);
    }
    inContactLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        return lastBand.lower > cmp || (cmp - lastBand.lower) <= this.near(cmp);
    }
    inContactMiddleBand(cmp = this.lastCandle.close, lastBand = this.last) {
        return Math.abs(lastBand.middle - cmp) <= this.near(cmp);
    }
    inContactMiddleUpperBand(cmp = this.lastCandle.high, lastBand = this.last) {
        return lastBand.middle < cmp || (lastBand.middle - cmp) <= this.near(cmp);
    }
    inContactMiddleLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        return lastBand.middle > cmp || (cmp - lastBand.middle) <= this.near(cmp);
    }
    inContact(uptrend, cmp) {
        return uptrend ? this.inContactMiddleLowerBand(cmp) : this.inContactMiddleUpperBand(cmp);
    }
    inContactLowerUpper(uptrend, cmp) {
        return uptrend ? this.inContactLowerBand(cmp) : this.inContactUpperBand(cmp);
    }
};