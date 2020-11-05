/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import uuid from 'uuid/v4';

import BaseStrategy from './BaseStrategy.js';
import TradeManager from '../core/TradeManager.js';
import {
  // percentageChange,
  roundToValidPrice,
  calculateSharesWithRiskFactor,
  shouldPlaceTrade,
  isNear,
  formatToInput
  // formatTimestampToString
} from '../utils/utils.js';
// import SAR from '../indicators/SAR.js';
import SAR from "../indicators/SAR.js";
import logger from '../logger/logger.js';
import { getConfig } from '../config.js';

const BollingerBands = require('technicalindicators').BollingerBands;
const VWAP = require('technicalindicators').VWAP;
const RSI = require('technicalindicators').RSI;
const Stochastic = require('technicalindicators').Stochastic;
const CrossUp = require('technicalindicators').CrossUp;
const CrossDown = require('technicalindicators').CrossDown;

const config = getConfig();

class SARStrategy extends BaseStrategy {

  constructor() {
    super('SAR');
  }

  process() {
    logger.info(`${this.name}: process`);
    if (this.maxTradesReached) {
      return Promise.resolve();
    }

    return this.fetchTraceCandlesHistory().then(() => {
      if (!config.sandboxTesting) {
        const now = new Date();
        if (now < this.strategyStartTime) {
          return;
        }
      }
      return this.findSupportAndResistance();
    })
      .catch(console.error);
  }

  findSupportAndResistance() {
    _.each(this.stocks, tradingSymbol => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
      if (data && data.traceCandles && data.traceCandles.length) {
        const candles = data.candles || data.traceCandles;
        const uptrend = this.confirmUptrendWithVWAP(candles);
        const result = this.checkForMomentumWithStochastic(data.traceCandles);
        console.log(data.tradingSymbol, uptrend ? "up" : "down", result);
        if (result.strongCrossOver && result.uptrend === uptrend) {
          const bp = this.findBreakPoint(data);
          const lastCandle = candles[candles.length - 1];
          logger.info(`${tradingSymbol} got stochastic crossover confirmation bp :${bp}`);
          if (bp) {
            this.generateTradeSignals(data, uptrend, bp);
          } else if (uptrend) {
            if ((Math.max(...data.traceCandles.map(c => c.high)) === lastCandle.high)) {
              this.generateTradeSignals(data, uptrend, lastCandle.high);
            }
          } else {
            if ((Math.min(...data.traceCandles.map(c => c.low)) === lastCandle.low)) {
              this.generateTradeSignals(data, uptrend, lastCandle.low);
            }
          }
        }
      }
    });
  }
  findBreakPoint(data, uptrend) {
    const lastCandle = data.traceCandles[data.traceCandles.length - 1];
    const sar = new SAR(data.traceCandles);
    const sarpoints = sar.calculate();
    const filteredPoints = sarpoints.map((sarpoint) => {
      const [s, r] = sarpoint;
      return uptrend ? r : s;
    }).filter(sarpoint => {
      if (isNear(sarpoint, lastCandle.close, .4, uptrend)) {
        return true;
      }
      return false;
    });
    const breakPoint = filteredPoints[uptrend ? (filteredPoints.length - 1) : 0];
    return breakPoint;
  }
  confirmTrade(tradeSignal, liveQuote) {
    const NEAR = 0.1;
    const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradeSignal.tradingSymbol);
    if (!data || !data.traceCandles)
      return false;
    if (!isNear(tradeSignal.trigger, liveQuote.cmp, NEAR)) {
      return false;
    }

    console.log(tradeSignal.tradingSymbol);

    // // if (!this.confirmWithVWAP(data, tradeSignal, liveQuote)) {
    // //   return false;
    // // }
    const tm = TradeManager.getInstance();
    console.log("Check Stochastic");
    const result = this.checkForMomentumWithStochastic(data.traceCandles);
    if (!result.strongCrossOver || tradeSignal.isBuy !== result.uptrend) {
      tm.disableTradeSignal(tradeSignal);
      logger.info(`Momentum lost, disabling ${this.getSignalDetails(tradeSignal)}`);
      return false;
    }

    // console.log("check bollinger");
    // if (!this.confirmWithBollingerBands(data, tradeSignal, liveQuote)) {
    //   return false;
    // }

    console.log("Check RSI");

    if (!this.confirmWithRSI(data.traceCandles, tradeSignal.isBuy)) {
      tm.disableTradeSignal(tradeSignal);
      logger.info(`RSI confirmation lost, disabling ${this.getSignalDetails(tradeSignal)}`);
      return false;
    }

    return true;
  };

  checkForMomentumWithStochastic(candles) {
    let period = 8;
    let signalPeriod = 3;
    const formattedInput = formatToInput(candles);
    let input = {
      high: formattedInput.high,
      low: formattedInput.low,
      close: formattedInput.close,
      period: period,
      signalPeriod: signalPeriod
    };
    const stochasticOutput = Stochastic.calculate(input);
    const crossOverInput = stochasticOutput.reduce((acc, o) => {
      acc.lineA.push(o.k);
      acc.lineB.push(o.d);
      return acc;
    }, { lineA: [], lineB: [] });
    const last = stochasticOutput[stochasticOutput.length - 1];
    const uptrend = last.k > last.d;

    const crossOvers = uptrend ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    const crossOver = crossOvers.slice(Math.max(crossOvers.length - 2, 0)).includes(true);
    const nCrossOvers = crossOvers.slice(Math.max(crossOvers.length - 5, 0));
    const uniqueCrossOver = nCrossOvers.filter(c => c).length === 1;
    const rsiConfirmation = this.confirmWithRSI(candles, uptrend);
    return {
      nCrossOvers,
      uptrend,
      crossOver,
      uniqueCrossOver,
      rsiConfirmation,
      strongCrossOver: uptrend ? last.d < 20 : last.d > 80 && crossOver && uniqueCrossOver && rsiConfirmation
    };
  }

  confirmWithBollingerBands(data, tradeSignal, liveQuote) {
    const period = 20;
    const traceCandles = data.traceCandles;
    const input = {
      period: period,
      values: traceCandles.map(candle => candle.close),
      stdDev: 2
    };

    const bollingerBands = BollingerBands.calculate(input);
    const crossOverInput = { lineA: [], lineB: [] };

    for (let i = 0; i < bollingerBands.length; i++) {
      crossOverInput.lineA.push(traceCandles[i].close);
      crossOverInput.lineB.push(bollingerBands[i].middle);
    }

    const crossOvers = tradeSignal.isBuy ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    const crossOver = crossOvers.slice(Math.max(crossOvers.length - 3, 0)).includes(true);

    if (!crossOver)
      return false;
    const lastCandle = traceCandles[traceCandles.length - 1];
    return tradeSignal.isBuy ? liveQuote.cmp >= lastCandle.close : liveQuote.cmp <= lastCandle.close;
  };

  confirmUptrendWithVWAP(candles) {
    const input = formatToInput(candles);
    const output = VWAP.calculate(input);
    const lastOutput = output[output.length - 1];
    const lastCandle = candles[candles.length - 1];
    return lastOutput < lastCandle.close;
  }

  confirmWithRSI(candles, isBuy) {
    const inputRSI = {
      period: 8
    };
    inputRSI.values = candles.map(c => c.volume);
    const output = RSI.calculate(inputRSI);
    const last = output[output.length - 1];
    return isBuy ? last < 80 : last > 20;
  }

  shouldPlaceTrade(tradeSignal, liveQuote) {
    if (super.shouldPlaceTrade(tradeSignal, liveQuote) === false) {
      return false;
    }
    const cmp = liveQuote.cmp;
    if (shouldPlaceTrade(tradeSignal, cmp) === false) {
      return false;
    }
    const tm = TradeManager.getInstance();
    if (tm.isTradeAlreadyPlaced(tradeSignal, this.getName())) {
      return false;
    }
    let isReverseTrade = false;
    const oppTradeSignal = tm.getOppositeTradeSignal(tradeSignal);
    if (oppTradeSignal && oppTradeSignal.isTriggered) {
      if (!oppTradeSignal.considerOppositeTrade) {
        return false;
      } else {
        isReverseTrade = true;
      }
    }
    if (isReverseTrade === false) {
      if (_.get(this.strategy, 'enableRiskManagement', false) === true) {
        const MAX_TRADES_PER_DAY = parseInt(_.get(this.strategy, 'withRiskManagement.maxTrades', 1));
        const numberOfTradesPlaced = tm.getNumberOfStocksTradesPlaced(this.getName());
        if (numberOfTradesPlaced >= MAX_TRADES_PER_DAY) {
          logger.info(`Disable , since max trade reached.`);
          tm.disableTradeSignal(tradeSignal);
          this.maxTradesReached = true;
          return false;
        }
      }
    }
    return this.confirmTrade(tradeSignal, liveQuote);
  }

  generateTradeSignals(data, longPosition, price) {
    const tm = TradeManager.getInstance();
    const brokers = _.get(this.strategy, 'brokers', []);
    if (!data.buyTradeSignal) {
      data.buyTradeSignal = {};
    }
    if (!data.sellTradeSignal) {
      data.sellTradeSignal = {};
    }
    const signalType = longPosition ? "buyTradeSignal" : "sellTradeSignal";
    _.each(brokers, broker => {
      const ts1 = this.createTradeSignal(data, longPosition, price, broker);
      logger.info(`${this.name}: ${data.tradingSymbol} ${longPosition ? "LONG" : "SHORT"} trade signal generated for ${broker} @ ${ts1.trigger}`);
      data[signalType][broker] = ts1;
      tm.addTradeSignal(ts1);
    });
    data.isTradeSignalGenerated = true;
  }

  createTradeSignal(data, longPosition, price, broker) {
    const lastCandle = data.traceCandles[data.traceCandles.length - 1];
    const tm = TradeManager.getInstance();

    const SL_PERCENTAGE = _.get(this.strategy, 'slPercentage', 0.2);
    const TARGET_PERCENTAGE = _.get(this.strategy, 'targetPercentage', .6);

    let enableRiskManagement = _.get(this.strategy, 'enableRiskManagement', false);

    let TOTAL_CAPITAL, CAPITAL_PER_TRADE, RISK_PERCENTAGE_PER_TRADE, MARGIN = 1;
    if (enableRiskManagement) {
      TOTAL_CAPITAL = parseInt(_.get(this.strategy, 'withRiskManagement.totalCapital', 1000));
      RISK_PERCENTAGE_PER_TRADE = parseFloat(_.get(this.strategy, 'withRiskManagement.riskPercentagePerTrade', 1.0));

    } else {
      CAPITAL_PER_TRADE = parseInt(_.get(this.strategy, 'withoutRiskManagement.capitalPerTrade', 1000));
      MARGIN = parseInt(_.get(this.strategy, 'withoutRiskManagement.margin', 1));
    }

    const ts1 = {};
    ts1.broker = broker;
    ts1.placeBracketOrder = false;
    ts1.placeCoverOrder = false;
    ts1.strategy = this.getName();
    ts1.tradingSymbol = data.tradingSymbol;
    ts1.isBuy = longPosition; // long signal
    ts1.trigger = price;
    if (ts1.isBuy) {
      ts1.stopLoss = roundToValidPrice(price - price * SL_PERCENTAGE / 100);
      ts1.target = roundToValidPrice(price + price * TARGET_PERCENTAGE / 100);
    } else {
      ts1.stopLoss = roundToValidPrice(price + price * SL_PERCENTAGE / 100);
      ts1.target = roundToValidPrice(price - price * TARGET_PERCENTAGE / 100);
    }

    if (enableRiskManagement) {
      ts1.quantity = calculateSharesWithRiskFactor(TOTAL_CAPITAL, ts1.trigger, ts1.stopLoss, RISK_PERCENTAGE_PER_TRADE);
    } else {
      ts1.quantity = parseInt((CAPITAL_PER_TRADE * MARGIN) / ts1.trigger);
    }

    ts1.considerOppositeTrade = false;
    ts1.timestamp = lastCandle.timestamp;
    ts1.tradeCutOffTime = this.strategyStopTimestamp;
    ts1.isTrailingSL = false;
    ts1.placeMarketOrderIfOrderNotFilled = false;
    ts1.changeEntryPriceIfOrderNotFilled = true;
    ts1.limitOrderBufferPercentage = 0.05;

    const oldts = tm.getTradeSignalOfSame(ts1);
    if (oldts) {
      ts1.correlationID = oldts.correlationID;
    } else {
      ts1.correlationID = uuid();
    }

    return ts1;
  }
}

module.exports = new SARStrategy(); // singleton class
