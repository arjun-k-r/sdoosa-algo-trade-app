import {
    formatToTrendWaysInput,
} from '../utils/utils.js';


const tw = require("trendyways");

module.exports = class {
    constructor(candles) {
        this.candles = candles;
        this.results = this.calculate();
        const results = this.results;
        this.last = results[results.length - 1];
    }
    calculate(candles = this.candles) {
        const formattedInput = formatToTrendWaysInput(candles);
        return tw.floorPivots(formattedInput);
    }
};