
module.exports = class ZigZag {
    constructor(candles, deviation = 2) {
        this.candles = candles;
        this.deviation = deviation;
        this.results = this.calculate();
        const results = this.results;
        this.last = results[results.length - 1];
        this.lastCandle = candles[candles.length - 1];

    }
    breakPoints() {
        return [...this.results];
    }
    lastNBreakPoints(n = 2) {
        const breakPoints = this.breakPoints();
        return breakPoints.slice(breakPoints.length - n);
    }
    sortedBreakPoints() {
        return this.breakPoints().sort((a, b) => a - b);
    }
    isNearSupport(cmp = this.lastCandle.close, per = .8) {
        const c = cmp * per / 100;
        return this.sortedBreakPoints().filter(r => r <= cmp && r + c >= cmp).length;
    }
    isNearResistance(cmp = this.lastCandle.close, per = .8) {
        const c = cmp * per / 100;
        return this.sortedBreakPoints().filter(r => r >= cmp && r - c <= cmp).length;
    }
    calculate(candles = this.candles, deviation = this.deviation) {
        const res = zigzag({ xData: candles, yData: candles }, { lowIndex: "low", highIndex: "high", deviation });
        return res.yData;
    }
};

function zigzag(series, params) {
    var lowIndex = params.lowIndex, highIndex = params.highIndex, deviation = params.deviation / 100, deviations = {
        'low': 1 + deviation,
        'high': 1 - deviation
    }, xVal = series.xData, yVal = series.yData, yValLen = yVal ? yVal.length : 0, zigzag = [], xData = [], yData = [], i, j, zigzagPoint, firstZigzagLow, firstZigzagHigh, directionUp, zigzagLen, exitLoop = false, yIndex = false;
    // Exit if not enught points or no low or high values
    if (!xVal || xVal.length <= 1 ||
        (yValLen &&
            (typeof yVal[0][lowIndex] === 'undefined' ||
                typeof yVal[0][highIndex] === 'undefined'))) {
        return;
    }
    // Set first zigzag point candidate
    firstZigzagLow = yVal[0][lowIndex];
    firstZigzagHigh = yVal[0][highIndex];
    // Search for a second zigzag point candidate,
    // this will also set first zigzag point
    for (i = 1; i < yValLen; i++) {
        // requried change to go down
        if (yVal[i][lowIndex] <= firstZigzagHigh * deviations.high) {
            zigzag.push([xVal[0], firstZigzagHigh]);
            // second zigzag point candidate
            zigzagPoint = [xVal[i], yVal[i][lowIndex]];
            // next line will be going up
            directionUp = true;
            exitLoop = true;
            // requried change to go up
        }
        else if (yVal[i][highIndex] >= firstZigzagLow * deviations.low) {
            zigzag.push([xVal[0], firstZigzagLow]);
            // second zigzag point candidate
            zigzagPoint = [xVal[i], yVal[i][highIndex]];
            // next line will be going down
            directionUp = false;
            exitLoop = true;
        }
        if (exitLoop) {
            xData.push(zigzag[0][0]);
            yData.push(zigzag[0][1]);
            j = i++;
            i = yValLen;
        }
    }
    // Search for next zigzags
    for (i = j; i < yValLen; i++) {
        if (directionUp) { // next line up
            // lower when going down -> change zigzag candidate
            if (yVal[i][lowIndex] <= zigzagPoint[1]) {
                zigzagPoint = [xVal[i], yVal[i][lowIndex]];
            }
            // requried change to go down -> new zigzagpoint and
            // direction change
            if (yVal[i][highIndex] >=
                zigzagPoint[1] * deviations.low) {
                yIndex = highIndex;
            }
        }
        else { // next line down
            // higher when going up -> change zigzag candidate
            if (yVal[i][highIndex] >= zigzagPoint[1]) {
                zigzagPoint = [xVal[i], yVal[i][highIndex]];
            }
            // requried change to go down -> new zigzagpoint and
            // direction change
            if (yVal[i][lowIndex] <=
                zigzagPoint[1] * deviations.high) {
                yIndex = lowIndex;
            }
        }
        if (yIndex !== false) { // new zigzag point and direction change
            zigzag.push(zigzagPoint);
            xData.push(zigzagPoint[0]);
            yData.push(zigzagPoint[1]);
            zigzagPoint = [xVal[i], yVal[i][yIndex]];
            directionUp = !directionUp;
            yIndex = false;
        }
    }
    zigzagLen = zigzag.length;
    // no zigzag for last point
    if (zigzagLen !== 0 &&
        zigzag[zigzagLen - 1][0] < xVal[yValLen - 1]) {
        // set last point from zigzag candidate
        zigzag.push(zigzagPoint);
        xData.push(zigzagPoint[0]);
        yData.push(zigzagPoint[1]);
    }
    return {
        values: zigzag,
        xData: xData,
        yData: yData
    };
};
