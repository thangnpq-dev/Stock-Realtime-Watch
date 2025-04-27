const os = require('os');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { logMessage } = require('./log');
require('dotenv').config();

const browserInstances = new Map();
const launchQueue = [];
let isLaunching = false;

async function isBrowserAlive(userDataDir) {
  if (browserInstances.has(userDataDir)) {
    const browser = browserInstances.get(userDataDir);
    try {
      if (!browser.isConnected()) {
        throw new Error('Browser is not connected');
      }
      // Additional check: try to get pages
      await browser.pages();
      return true;
    } catch (error) {
      console.log(`Browser for ${userDataDir} is not alive:`, error.message);
      browserInstances.delete(userDataDir);
      return false;
    }
  }
  return false;
}

async function openCustomBrowser(userDataDir) {
  // First, check if the browser is alive
  if (await isBrowserAlive(userDataDir)) {
    return browserInstances.get(userDataDir);
  }

  // If not alive, remove any existing instance and proceed with launching a new one
  if (browserInstances.size > 0) {
    browserInstances.delete(userDataDir);
  }

  await delay(1000);

  return new Promise((resolve, reject) => {
    launchQueue.push({ userDataDir, resolve, reject });
    if (!isLaunching) {
      processLaunchQueue();
    }
  });
}

async function processLaunchQueue() {
  if (launchQueue.length === 0) {
    isLaunching = false;
    return;
  }

  isLaunching = true;
  const { userDataDir, resolve, reject } = launchQueue.shift();

  try {
    if (!await isBrowserAlive(userDataDir)) {
      const chromeExecutablePath = getChromeExecutablePath();
      await logMessage('VERIFY', 'INFO', `Chrome executable path: ${chromeExecutablePath}`);

      const browser = await puppeteer.launch({
        headless: false,
        executablePath: chromeExecutablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          `--user-data-dir=${userDataDir}`,
          '--start-maximized',
          // '--disable-notifications',
          // '--window-size=1920,1080'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation']
      });

      browserInstances.set(userDataDir, browser);

      browser.on('disconnected', () => {
        console.log(`Browser for ${userDataDir} disconnected`);
        browserInstances.delete(userDataDir);
      });

      resolve(browser);
    }
    else {
      resolve(browserInstances.get(userDataDir));
    }
  } catch (error) {
    console.error(`Error launching browser for ${userDataDir}:`, error);
    reject(error);
  }

  // Add a small delay before processing the next launch request
  await new Promise(resolve => setTimeout(resolve, 1000));
  processLaunchQueue();
}

function getChromeExecutablePath() {
  switch (os.platform()) {
    case 'win32':
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'linux':
      return '/usr/bin/google-chrome-stable';
    default:
      throw new Error('Unsupported platform');
  }
}

function getUserDataDir(email) {
  const baseDir = process.env.USER_DATA_DIR || path.join(os.homedir(), '.chrome-automation');
  return path.join(baseDir, email.split('@')[0]);
}

async function checkExistingUserDir(userDataDir) {
  // Check if the userDataDir is accessible
  try {
    if (fs.existsSync(userDataDir)) {
      await logMessage('VERIFY', 'INFO', `User data directory is accessible: ${userDataDir}`);
    }
    else {
      throw new Error(`User data directory is not accessible: ${userDataDir}`);
    }
  } catch (error) {
    await logMessage('VERIFY', 'ERROR', `User data directory is not accessible: ${userDataDir}. Error: ${error.message}`);
    throw new Error(`User data directory is not accessible: ${userDataDir}`);
  }
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

module.exports = {
  getChromeExecutablePath,
  getUserDataDir,
  delay,
  openCustomBrowser,
  isBrowserAlive,
  checkExistingUserDir,
};
