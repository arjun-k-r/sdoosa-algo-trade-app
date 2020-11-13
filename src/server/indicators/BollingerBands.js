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
        return ((lastBand.upper - lastBand.lower) / getAvgCandleSize(this.candles)) / 100;
    }
    isSqueze(...args) {
        const bandWidth = this.bandWidth.apply(this, args);
        // console.log(bandWidth, getAvgCandleSize(this.candles));
        return bandWidth < .02;
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
        let x = this.bandWidth() * 3.14159 * .02;
        // console.log(x);
        return Math.max(cmp * x, .05);
    }
    inContactUpperBand(cmp = this.lastCandle.high, lastBand = this.last) {
        if (lastBand.upper < cmp)
            return true;
        if (this.isResistance())
            return (lastBand.upper - cmp) <= this.near(cmp);
        return false;
    }
    inContactLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        if (lastBand.lower > cmp)
            return true;
        if (this.isSupport())
            return (cmp - lastBand.lower) <= this.near(cmp);
        return false;
    }
    inContactMiddleBand(cmp = this.lastCandle.close, lastBand = this.last) {
        // console.log(lastBand.middle, cmp, this.near(cmp));
        return Math.abs(lastBand.middle - cmp) <= this.near(cmp);
    }
    inContactMiddleUpperBand(cmp = this.lastCandle.high, lastBand = this.last) {
        if (lastBand.middle <= cmp)
            return true;
        if (this.isResistance("middle"))
            return this.inContactMiddleBand(cmp);
        return false;
    }
    inContactMiddleLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        if (lastBand.middle >= cmp)
            return true;
        if (this.isSupport("middle"))
            return this.inContactMiddleBand(cmp);
        return false;
    }
    inContact(uptrend, cmp) {
        return uptrend ? this.inContactMiddleLowerBand(cmp) : this.inContactMiddleUpperBand(cmp);
    }
    inContactLowerUpper(uptrend, cmp) {
        return uptrend ? this.inContactLowerBand(cmp) : this.inContactUpperBand(cmp);
    }
    isSupport(key = "lower") {
        const candles = this.candles;

        const x = candles[candles.length - 1].low - this.results[this.results.length - 1][key];
        const y = candles[candles.length - 2].low - this.results[this.results.length - 2][key];
        const z = candles[candles.length - 3].low - this.results[this.results.length - 3][key];

        return x < y && y < z;
    }
    isResistance(key = "upper") {
        const candles = this.candles;

        const x = candles[candles.length - 1].high - this.results[this.results.length - 1][key];
        const y = candles[candles.length - 2].high - this.results[this.results.length - 2][key];
        const z = candles[candles.length - 3].high - this.results[this.results.length - 3][key];

        return x < y && y < z;
    }
};