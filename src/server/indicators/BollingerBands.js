import {
    // isSideWayMarket,
    getAvgCandleSize
} from '../utils/utils.js';


const BollingerBands = require('technicalindicators').BollingerBands;

const near = .003;


module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate(candles);
        const results = this.results;
        this.last = results[results.length - 1];
        this.lastCandle = candles[candles.length - 1];
        this.secondLastCandle = candles[candles.length - 2];
    }
    bandWidth(lastBand = this.last, lastCandle = this.lastCandle) {
        return ((lastBand.upper - lastBand.lower) / lastBand.middle);
        // return ((lastBand.upper - lastBand.lower) / getAvgCandleSize(this.candles)) / 100;
    }
    volatility(lastBand = this.last) {
        return lastBand.upper - lastBand.lower;
    }
    isVolatilityLow() {
        return (this.volatility() / 2) < getAvgCandleSize(this.candles);
    }
    isSqueze(n = 0.015) {
        const bandWidth = this.bandWidth();
        // console.log(bandWidth, getAvgCandleSize(this.candles));
        return bandWidth <= n;
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

    inContactUpperBand(cmp = this.lastCandle.high, lastBand = this.last) {
        // const diff = lastBand.upper - lastBand.middle;
        if (lastBand.upper < cmp)
            return !this.isResistance();
        if (this.isResistance())
            return true;
        return false;
    }
    inContactLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        // const diff = lastBand.middle - lastBand.lower;
        if (lastBand.lower > cmp)
            return !this.isSupport();
        if (this.isSupport())
            return true;
        return false;
    }
    inContactMiddleBand(cmp = this.lastCandle.close, lastBand = this.last) {
        const diff = lastBand.middle < cmp ? lastBand.upper - lastBand.middle : lastBand.middle - lastBand.lower;
        return Math.abs(lastBand.middle - cmp) <= diff / 3;
    }
    inContactMiddleUpperBand(cmp = this.lastCandle.high, lastBand = this.last) {
        if (lastBand.middle <= cmp) {
            if (this.inContactUpperBand(cmp, lastBand))
                return true;
            return false;
        }
        if (this.isResistance("middle"))
            return this.inContactMiddleBand(cmp);
        return false;
    }
    inContactMiddleLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        if (lastBand.middle >= cmp) {
            if (this.inContactLowerBand(cmp, lastBand))
                return true;
            return false;
        }
        if (this.isSupport("middle"))
            return this.inContactMiddleBand(cmp);
        return false;
    }
    isSupport(key = "lower",) {
        return this.isArrow(key, "low");
    }
    isResistance(key = "upper") {
        return this.isArrow(key, "high");
    }
    isArrow(key = "upper", candleKey = "high") {
        const candles = this.candles;
        const x = candles[candles.length - 1][candleKey] - this.results[this.results.length - 1][key];
        const y = candles[candles.length - 2][candleKey] - this.results[this.results.length - 2][key];
        const z = candles[candles.length - 3][candleKey] - this.results[this.results.length - 3][key];

        const a = candles[candles.length - 1]["close"] - this.results[this.results.length - 1][key];


        if (a > z) {
            return false;
        }
        if (x > y) {
            return false;
        }
        if (y > z) {
            return false;
        }
        return true;
    }

    doubleTouchingCandle(uptrend, lastBand = this.last, lastCandle = this.lastCandle) {
        if (uptrend) {
            // if (lastBand.middle >= lastCandle.open || ((lastBand.middle + (lastBand.middle * near)) >= lastCandle.open)) {
            if (lastBand.upper <= lastCandle.close || ((lastBand.upper - (lastBand.upper * near)) <= lastCandle.close)) {
                return true;
            }
            // }
        } else {
            // if (lastBand.middle <= lastCandle.open || ((lastBand.middle - (lastBand.middle * near)) <= lastCandle.open)) {
            if (lastBand.lower >= lastCandle.close || ((lastBand.lower + (lastBand.lower * near)) >= lastCandle.close)) {
                return true;
            }
            // }
        }
        return false;
    }
    inContactLowerUpper(uptrend, cmp) {
        return uptrend ? this.inContactLowerBand(cmp) : this.inContactUpperBand(cmp);
    }
    inContact(uptrend, cmp) {
        return uptrend ? this.inContactMiddleLowerBand(cmp) : this.inContactMiddleUpperBand(cmp);
    }
};






