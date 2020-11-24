/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import uuid from 'uuid/v4';

import BaseStrategy from './BaseStrategy.js';
import TradeManager from '../core/TradeManager.js';
import {
  // percentageChange,
  formatToInput,
  roundToValidPrice,
  calculateSharesWithRiskFactor,
  shouldPlaceTrade,
  isNear,
  isSideWayMarket,
  // getAvgCandleSize,
  // formatTimestampToString
} from '../utils/utils.js';

import MACD from "../indicators/MACD.js";
import SAR from "../indicators/SAR.js";
import ADX from "../indicators/ADX.js";
import BollingerBands from "../indicators/BollingerBands.js";
import RSI from "../indicators/RSI.js";
import Stochastic from "../indicators/Stochastic.js";
import VWAP from "../indicators/VWAP2.js";
import ZigZag from "../indicators/ZigZag.js";

import logger from '../logger/logger.js';
import { getConfig } from '../config.js';


const bearish = require('technicalindicators').bearish;
const bullish = require('technicalindicators').bullish;

const config = getConfig();


const markets = ["Trending", "Choppy"];
const momentums = ["RSI", "Stochastic"];
const volatility = ["Volatile", "Non-Volatile"];
const trendConfirmations = ["MACD", "VWAP"];

function consoleLog(...args) {
  if (config.sandboxTesting && !config.backTesting) {
    console.log.apply(null, args);
  }
}

class SARStrategy extends BaseStrategy {

  constructor() {
    super('SAR');
  }
  process() {
    logger.info(`${this.name}: process`);
    if (this.maxTradesReached) {
      return Promise.resolve();
    }
    consoleLog("process started");
    return this.fetchTraceCandlesHistory().then(() => {
      consoleLog("traced candle history");

      if (!config.sandboxTesting) {
        const now = new Date();
        if (now < this.strategyStartTime) {
          logger.info(`Stratery starting time is ${this.stratergyStartTime}`);
          return;
        }
      }
      try {
        _.each(this.findTopGainersAndLosers(), tradingSymbol => {
          const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
          if (data && data.traceCandles && data.traceCandles.length) {
            const traceCandles = data.traceCandles;
            const candles = data.candles;
            if (traceCandles && traceCandles.length && candles && candles.length) {
              this.findSupportAndResistance(tradingSymbol, candles, traceCandles, data);
            }
          }
        });
      } catch (err) {
        console.error("findSupportAndResistance", err);
      }
    });
  }
  findTopGainersAndLosers() {
    return this.stocks.map(tradingSymbol => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
      if (data && data.traceCandles && data.traceCandles.length) {
        const candles = data.candles;
        if (candles && candles.length) {
          const open = candles[0].open;
          const close = candles[candles.length - 1].close;
          const change = open - close;
          const pChange = (Math.abs(change) / close) * 100;
          return {
            tradingSymbol,
            change,
            pChange
          };
        }
      }
    }).filter(s => s).sort((a, b) => {
      return b.pChange - a.pChange;
    }).slice(0, 30).map(s => s.tradingSymbol);
  }
  backTesting() {
    return this.fetchTraceCandlesHistory().then(() => {
      _.each(this.findTopGainersAndLosers(), tradingSymbol => {
        const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
        if (data && data.traceCandles && data.traceCandles.length) {
          const traceCandles = data.traceCandles;
          const candles = data.candles;
          console.log(tradingSymbol);
          if (traceCandles && traceCandles.length && candles && candles.length) {
            for (let i = 0; i < candles.length; i++) {
              const sliced = candles.slice(0, i + 1);
              const lastCandle = sliced[sliced.length - 1];
              const newDate = new Date();
              newDate.setHours(lastCandle.date.getHours());
              newDate.setMinutes(lastCandle.date.getMinutes());
              newDate.setSeconds(lastCandle.date.getSeconds());
              if (newDate.getTime() > this.strategyStartTime.getTime())
                if (newDate.getTime() < this.strategyStopTime.getTime()) {
                  this.findSupportAndResistance(tradingSymbol, sliced, [].concat(data.traceCandlesPrevDays, sliced), data);
                }
            }
          }
        }
      });
      logger.info(`
          total trades : ${this.backTestSignalCount} 
          profit trades : ${this.backTestProfit} 
          loss trades : ${this.backTestLoss} 
          profit : ${this.profit} 
          `);
    });
  }
  findSupportAndResistance(tradingSymbol, candles, traceCandles, data) {
    consoleLog("=========================================================================================");
    const adx = new ADX(traceCandles);
    const vwap = new VWAP(candles);
    const lastCandle = candles[candles.length - 1];
    const sidewayMarket = isSideWayMarket(traceCandles);
    consoleLog(lastCandle.date.toLocaleDateString(), lastCandle.date.toLocaleTimeString());
    consoleLog(tradingSymbol, "@", lastCandle.close, markets[adx.isTrending() ? 0 : 1], adx.isUpTrend() ? "UP" : "DOWN");
    consoleLog("Sideway Market : ", sidewayMarket);
    const bullishCandle = lastCandle.close > lastCandle.open;
    consoleLog("BullishCandle : ", bullishCandle);
    const signalType = [];
    const bb = new BollingerBands(traceCandles);
    if (!sidewayMarket) {
      signalType.push(markets[0]);
      const chartPattern = adx.isUpTrend() ? this.bullish(traceCandles) : this.bearish(traceCandles);
      consoleLog("ChartPattern : ", chartPattern);
      if (chartPattern) {
        const macd = new MACD(traceCandles);
        const rsi = new RSI(traceCandles);
        let confirmMomentum = false;
        consoleLog("Volatility : ", bb.isVolatile());
        if (bb.isVolatile()) {
          signalType.push(volatility[0]);
          const strongMomentum = rsi.confirmMomentum(adx.isUpTrend(), true);
          consoleLog("RSI strong: ", strongMomentum);
          if (strongMomentum) {
            signalType.push(momentums[0]);
            consoleLog("VWAP isCrossOver :", vwap.isCrossOver());
            if (vwap.isCrossOver()) {
              signalType.push(trendConfirmations[1]);
              // !adx.isStrongTrend()
              const macdConfirm = adx.isUpTrend() ? macd.longMomentum() : macd.shortMomentum();
              consoleLog("MACD : ", macdConfirm);
              if (macdConfirm) {
                signalType.push(trendConfirmations[0]);
                if (adx.isTrending() && adx.isReversalStarted(false) && adx.isTrendLosing())
                  confirmMomentum = true;
                if (adx.isStrongTrendGrowing()) {
                  confirmMomentum = true;
                }
              }
            }
            else {
              consoleLog("isTrendGrowing : ", adx.isTrendGrowing());
              if (adx.isTrendGrowing()) {
                // console.log("VWAP Near :", vwap.isNear());
                // if (!vwap.isNear()) {
                confirmMomentum = true;
                // }
              }
            }
          }
        }

        // else {
        //   signalType.push(volatility[1]);
        //   consoleLog("isStrongTrendGrowing: ", adx.isStrongTrendGrowing());
        //   if (adx.isStrongTrendGrowing()) {
        //     consoleLog("adx uniqueCrossOver : ", adx.uniqueCrossOver(1));
        //     if (!adx.uniqueCrossOver(1)) {
        //       const rsiConfirm = rsi.confirmMomentum(adx.isUpTrend(), true);
        //       consoleLog("RSI : ", rsiConfirm);
        //       if (rsiConfirm) {
        //         signalType.push(momentums[0]);
        //         confirmMomentum = true;
        //       }
        //     }
        //   }
        // }

        if (confirmMomentum) {
          consoleLog(lastCandle.date.toLocaleDateString(), lastCandle.date.toLocaleTimeString());
          const touchedBB = bb.inContact(adx.isUpTrend());
          consoleLog("BolingerBand : ", touchedBB);
          if (touchedBB) {
            // const sar = new SAR(traceCandles);
            const zigzag = new ZigZag(traceCandles, 3);
            const zigzagResistance = adx.isUpTrend() ? zigzag.isNearResistance() : zigzag.isNearSupport();
            // const zigzagSupport = adx.isUpTrend() ? zigzag.isNearSupport(undefined, .2) : zigzag.isNearResistance(undefined, .2);
            // consoleLog("zigzagSupport : ", zigzagSupport);
            consoleLog("zigzagResistance : ", zigzagResistance);
            // if (zigzagSupport)
            if (!zigzagResistance) {
              // if (adx.isUpTrend() ? sar.isBreakOut() : sar.isBreakDown())
              this.generateTradeSignals(data, adx.isUpTrend(), lastCandle.close, signalType.join("/"), lastCandle, signalType.includes(momentums[0]) ? lastCandle.open : null);
            }
          }
        }
      }
    }
  }
  confirmRangeBreak(upTrend, traceCandles) {

    const sidewayMarket = isSideWayMarket(traceCandles, 3);
    consoleLog("Sideway Market : ", sidewayMarket);
    if (sidewayMarket) {
      const stochastic = new Stochastic(traceCandles);
      const confirmMomentum = stochastic.confirmMomentum(upTrend);
      consoleLog("Stochastic : ", confirmMomentum);
      if (confirmMomentum) {
        return true;
      }
    }
    return false;
  }
  bearish(traceCandles) {
    return bearish(formatToInput(traceCandles));
  }
  bullish(traceCandles) {
    return bullish(formatToInput(traceCandles));
  }
  findBreakPoint(candles, value, uptrend) {
    const sar = new SAR(candles);
    return sar.nextNearestLevel(uptrend, value);
  }
  confirmTrade(tradeSignal, liveQuote) {
    const NEAR = 0.1;
    const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradeSignal.tradingSymbol);
    if (!data || !data.traceCandles)
      return false;

    logger.info(this.getSignalDetails(tradeSignal));

    const tm = TradeManager.getInstance();

    consoleLog("Check near", tradeSignal.trigger, liveQuote.cmp, tradeSignal.isBuy);
    if (!isNear(tradeSignal.trigger, liveQuote.cmp, NEAR)) {
      if ((tradeSignal.isBuy && tradeSignal.trigger < liveQuote.cmp) || (!tradeSignal.isBuy && tradeSignal.trigger > liveQuote.cmp)) {
        tradeSignal.message = (tradeSignal.message || "") + " | Trigger already crossed, so disabling";
        tm.disableTradeSignal(tradeSignal);
        logger.info(`${tradeSignal.message} ${this.getSignalDetails(tradeSignal)}`);
        return false;
      }
    }

    // // if (!this.confirmWithVWAP(data, tradeSignal, liveQuote)) {
    // //   return false;
    // // }

    // if (tradeSignal.signalBy === signalTypes[2]) {
    //   consoleLog("Check Stochastic");
    //   const stochastic = new Stochastic(data.traceCandles);
    //   if (!stochastic.confirmMomentum(tradeSignal.isBuy)) {
    //     tradeSignal.message = (tradeSignal.message || "") + " | Momentum lost,so disabling";
    //     tm.disableTradeSignal(tradeSignal);
    //     logger.info(`${tradeSignal.message} ${this.getSignalDetails(tradeSignal)}`);
    //     return false;
    //   }
    // }

    // if (tradeSignal.signalBy === signalTypes[2]) {
    //   const sar = new SAR(data.traceCandles);
    //   if (tradeSignal.isBuy) {
    //     if (!sar.isBreakOut(liveQuote.cmp)) {
    //       logger.info(`Wait for breakout ${sar.breakOutPoint(liveQuote.cmp)}`);
    //       return false;
    //     }
    //   } else {
    //     if (!sar.isBreakDown(liveQuote.cmp)) {
    //       logger.info(`Wait for breakdown ${sar.breakDownPoint(liveQuote.cmp)}`);
    //       return false;
    //     }
    //   }
    // }
    return true;
  };
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
  backTestLog(ts1, data, longPosition, price, signalBy, lastCandle) {
    const traceCandles = data.traceCandles;
    let i = traceCandles.findIndex(c => c.date === lastCandle.date) + 1;
    let result = false;

    for (i; i < traceCandles.length; i++) {
      const candle = traceCandles[i];

      if (ts1.isBuy) {
        if (candle.high >= ts1.target) {
          result = true;
          break;
        }
        if (candle.low <= ts1.stopLoss) {
          result = false;
          break;
        }
      } else {
        if (candle.high >= ts1.stopLoss) {
          result = false;
          break;
        }
        if (candle.low <= ts1.target) {
          result = true;
          break;
        }
      }
    }
    let p, l;
    if (result) {
      this.backTestProfit = this.backTestProfit + 1;
      p = (ts1.quantity * Math.abs(ts1.target - ts1.trigger));
      this.profit = this.profit + p;
    } else {
      this.backTestLoss = this.backTestLoss + 1;
      l = (ts1.quantity * Math.abs(ts1.stopLoss - ts1.trigger));
      this.profit = this.profit - l;
    }
    this.backTestSignalCount = this.backTestSignalCount + 1;
    logger.info(`
        ${this.name}: ${data.tradingSymbol} ${longPosition ? "LONG" : "SHORT"} 
         @ ${ts1.trigger} : ${result ? "PROFIT" : "LOSS"}
         Target :  ${ts1.target}
         SL : ${ts1.stopLoss}
         profit : ${p}
         loss :${l}
         quantity : ${ts1.quantity}
        ${lastCandle.date.toLocaleDateString()} ${lastCandle.date.toLocaleTimeString()}
        ${signalBy}
        `);
  }
  generateTradeSignals(data, longPosition, price, signalBy, lastCandle, stopLoss) {
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
      const ts1 = this.createTradeSignal(data, longPosition, price, broker, signalBy, lastCandle, stopLoss);
      if (config.backTesting) {
        this.backTestLog(ts1, data, longPosition, price, signalBy, lastCandle);
      } else {
        logger.info(`${this.name}: ${data.tradingSymbol} ${longPosition ? "LONG" : "SHORT"} trade signal generated for ${broker} @ ${ts1.trigger}`);
        data[signalType][broker] = ts1;
        tm.addTradeSignal(ts1);
      }
    });
    data.isTradeSignalGenerated = true;
  }

  createTradeSignal(data, longPosition, price, broker, signalBy, lastCandle, stopLoss) {
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
      const sl = roundToValidPrice(price - price * SL_PERCENTAGE / 100);
      ts1.stopLoss = stopLoss ? Math.max(stopLoss, sl) : sl;
      ts1.target = roundToValidPrice(price + price * TARGET_PERCENTAGE / 100);
    } else {
      const sl = roundToValidPrice(price + price * SL_PERCENTAGE / 100);
      ts1.stopLoss = stopLoss ? Math.min(stopLoss, sl) : sl;
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
    ts1.signalBy = signalBy;

    ts1.message = (ts1.message || "") + `${lastCandle.date.toLocaleDateString()} ${lastCandle.date.toLocaleTimeString()}`;

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
