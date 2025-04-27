const fs = require('fs');
const path = require('path');

// Add this function if it doesn't exist
async function logMessage(source, level, message, islogToTxt = true) {
  try {
    const logEntry = `[${new Date().toISOString()}] [${source}] [${level}] ${message}\n`;
    console.log(logEntry);
    if (islogToTxt) {
      await logToTxt(logEntry);
    }
  }
  catch (ex) {
    console.error(ex);
  }
}

//Add log to txt
async function logToTxt(logEntry) {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Generate filename based on current date
    const now = new Date();
    const filename = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}.txt`;
    const filePath = path.join(logsDir, filename);

    // Append log entry to file
    fs.appendFileSync(filePath, logEntry);
  }
  catch (ex) {
    console.error('Error writing to log file:', ex);
  }
}

module.exports = {
  logMessage,
  logToTxt,
};
