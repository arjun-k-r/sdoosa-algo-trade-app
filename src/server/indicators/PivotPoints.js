import {
    formatToTrendWaysInput,
} from '../utils/utils.js';


const tw = require("trendyways");

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate();
        const results = this.results;
        this.lastCandle = candles[candles.length - 1];
        this.last = results[results.length - 1];
    }
    calculate(candles = this.candles) {
        const formattedInput = formatToTrendWaysInput(candles);
        const results = tw.floorPivots(formattedInput);
        return results.map(result => {
            result.floor.cr = (result.h + result.l) / 2;
            result.floor.cs = (result.floor.pl - result.floor.cr) + result.floor.pl;
            result.floor.width = (Math.abs(result.floor.cr - result.floor.cs) / result.floor.pl) * 100;
            return result.floor;
        });
    }
    isTrending() {
        return this.last.width < .5;
    }
    isStrongTrending() {
        return this.last.width < .25;
    }
};