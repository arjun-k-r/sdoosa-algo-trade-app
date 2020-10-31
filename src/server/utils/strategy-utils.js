
import VWAPStrategy from '../strategies/VWAPStrategy.js';
import SARStrategy from '../strategies/SARStrategy.js';
import logger from '../logger/logger.js';

export const getStrategyInstance = (strategy) => {

  switch (strategy) {
    case 'SAR':
      return SARStrategy;
    case 'VWAP':
      return VWAPStrategy;
    default:
      logger.error(`getStrategyInstance: no instance found for strategy ${strategy}`);
  }

  return null;
};
