import {
    isSideWayMarket,
    getAvgCandleSize
} from '../utils/utils.js';

import ZigZag from "./ZigZag.js";

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
        this.zigzag = new ZigZag(candles, 1);
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
    isSqueze(n = 0.0125) {
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
        const diff = lastBand.upper - lastBand.middle;
        if (lastBand.upper < cmp)
            return true;
        if (this.isResistance())
            return (lastBand.upper - cmp) <= diff / 3;
        return false;
    }
    inContactLowerBand(cmp = this.lastCandle.low, lastBand = this.last) {
        const diff = lastBand.middle - lastBand.lower;
        if (lastBand.lower > cmp)
            return true;
        if (this.isSupport())
            return (cmp - lastBand.lower) <= diff / 3;
        return false;
    }
    inContactMiddleBand(cmp = this.lastCandle.close, lastBand = this.last) {
        const diff = lastBand.middle < cmp ? lastBand.upper - lastBand.middle : lastBand.middle - lastBand.lower;
        return Math.abs(lastBand.middle - cmp) <= diff / 3;
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
    isSupport(key = "lower") {
        const candles = this.candles;
        const x = candles[candles.length - 1].low - this.results[this.results.length - 1][key];
        const y = candles[candles.length - 2].low - this.results[this.results.length - 2][key];
        const z = candles[candles.length - 3].low - this.results[this.results.length - 3][key];
        // console.log(candles[candles.length - 1].low, this.results[this.results.length - 1][key]);
        // console.log(candles[candles.length - 2].low, this.results[this.results.length - 2][key]);
        // console.log(candles[candles.length - 3].low, this.results[this.results.length - 3][key]);
        // console.log(x, y, z);
        if (isSideWayMarket(candles, 3)) {
            return Math.min(x, y, z) === x;
        }
        return x < y && y < z;

    }
    isResistance(key = "upper") {
        const candles = this.candles;
        const x = candles[candles.length - 1].high - this.results[this.results.length - 1][key];
        const y = candles[candles.length - 2].high - this.results[this.results.length - 2][key];
        const z = candles[candles.length - 3].high - this.results[this.results.length - 3][key];
        // console.log(candles[candles.length - 1].high, this.results[this.results.length - 1][key]);
        // console.log(andles[candles.length - 2].high, this.results[this.results.length - 2][key]);
        // console.log(candles[candles.length - 3].high, this.results[this.results.length - 3][key]);
        // console.log(x, y, z);
        if (isSideWayMarket(candles, 3)) {
            return Math.min(x, y, z) === x;
        }
        return x < y && y < z;
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
    inReversal(uptrend, cap = true) {
        const candles = this.candles;
        // console.log(this.lastCandle.date.toLocaleString(), cap);
        if (cap) {
            if (this.doubleTouchingCandle(uptrend)) {
                return false;
            }
            const avgCandleSize = getAvgCandleSize(candles);
            const maxCandleSize = avgCandleSize * 1.5;
            if (maxCandleSize < Math.abs(this.lastCandle.open - this.lastCandle.close)) {
                return false;
            }
        }
        // range breakout
        if (!isSideWayMarket(candles, 4)) {
            if (isSideWayMarket(candles.slice(0, candles.length - 1), 4)) {
                return this.inContact(uptrend);
            }
        }
        const lastNBreakPoints = this.zigzag.lastNBreakPoints(2);
        const lastPoints = [this.secondLastCandle.low, this.secondLastCandle.high, uptrend ? this.lastCandle.low : this.lastCandle.high];
        const includes = !!lastNBreakPoints.filter(b => lastPoints.includes(b)).length;
        // console.log(lastNBreakPoints, lastPoints, includes);
        return includes && this.inContact(uptrend);
    }
};






