
import fs from 'fs-extra';
import path from 'path';

const APP_STORAGE_PATH = path.resolve(__dirname, '..');
let config = null, users = null, strategies = null, holidays = null, samples = null;

export const getAppStoragePath = () => {
  return APP_STORAGE_PATH;
};

export const getConfig = () => {

  if (config) {
    return config;
  }

  const configJsonFilePath = [APP_STORAGE_PATH, 'config', 'config.json'].join(path.sep);
  try {
    config = fs.readJsonSync(configJsonFilePath);
  } catch (err) {
    console.error(`Unable to load config from file ${configJsonFilePath}. Error: `, err);
    process.exit(1);
  }
  return config;
};

export const getUsers = () => {

  if (users) {
    return users;
  }

  const usersJsonFilePath = [APP_STORAGE_PATH, 'config', 'users.json'].join(path.sep);
  try {
    users = fs.readJsonSync(usersJsonFilePath);
  } catch (err) {
    console.error(`Unable to load users from file ${usersJsonFilePath}. Error: `, err);
    process.exit(1);
  }
  return users;
};

export const getStrategies = () => {

  if (strategies) {
    return strategies;
  }

  const strategiesJsonFilePath = [APP_STORAGE_PATH, 'config', 'strategies.json'].join(path.sep);
  try {
    strategies = fs.readJsonSync(strategiesJsonFilePath);
  } catch (err) {
    console.error(`Unable to load strategies from file ${strategiesJsonFilePath}. Error: `, err);
    process.exit(1);
  }
  return strategies;
};

export const getHolidays = () => {

  if (holidays) {
    return holidays;
  }

  const holidaysJsonFilePath = [APP_STORAGE_PATH, 'config', 'holidays.json'].join(path.sep);
  try {
    holidays = fs.readJsonSync(holidaysJsonFilePath);
    console.log('Holidays => ', holidays);
  } catch (err) {
    console.error(`Unable to load holidays from file ${holidaysJsonFilePath}. Error: `, err);
    process.exit(1);
  }
  return holidays;
};


export const getSamples = () => {

  if (samples) {
    return samples;
  }

  const samplesJsonFilePath = [APP_STORAGE_PATH, 'config', 'samples.json'].join(path.sep);
  try {
    samples = fs.readJsonSync(samplesJsonFilePath);
  } catch (err) {
    console.error(`Unable to load config from file ${configJsonFilePath}. Error: `, err);
    process.exit(1);
  }
  return samples;
};