const fs = require('fs');
const path = require('path');
const { logMessage } = require('./log');
const ftpService = require('../services/ftpService');

/**
 * Đảm bảo thư mục tồn tại, nếu không thì tạo mới
 * @param {string} dirPath - Đường dẫn thư mục
 * @returns {Promise<void>}
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Lưu dữ liệu cổ phiếu vào file JSON
 * @param {Array} data - Dữ liệu cổ phiếu
 * @param {string} filename - Tên file
 * @returns {Promise<string>} - Đường dẫn đến file đã lưu
 */
async function saveStockData(data, filename = null) {
  try {
    // Đường dẫn thư mục data
    const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'));
    
    // Đảm bảo thư mục tồn tại
    await ensureDirectoryExists(dataDir);
    
    // Tạo tên file nếu không có
    if (!filename) {
      filename = `stock-data-${new Date().toISOString().replace(/:/g, '-')}.json`;
    }
    
    // Đường dẫn đầy đủ đến file
    const filePath = path.join(dataDir, filename);
    
    // Thêm timestamp vào dữ liệu
    const dataWithTimestamp = {
      timestamp: new Date().toISOString(),
      data: data
    };
    
    // Ghi file
    await fs.promises.writeFile(filePath, JSON.stringify(dataWithTimestamp, null, 2));
    
    await logMessage('FILE', 'INFO', `Đã lưu dữ liệu vào file: ${filePath}`);
    return filePath;
  } catch (error) {
    await logMessage('FILE', 'ERROR', `Lỗi khi lưu dữ liệu: ${error.message}`);
    throw error;
  }
}

/**
 * Lưu dữ liệu cổ phiếu vào file JSON cố định
 * @param {Array} data - Dữ liệu cổ phiếu
 * @returns {Promise<string>} - Đường dẫn đến file đã lưu
 */
async function saveLatestStockData(data) {
  try {
    // Lưu file vào ổ cứng local
    const filePath = await saveStockData(data, 'latest-stock-data.json');
    
    // Upload file lên FTP server nếu có cấu hình
    if (process.env.FTP_HOST) {
      // Sử dụng Promise.resolve để bắt đầu một chuỗi then mới
      Promise.resolve().then(async () => {
        try {
          const success = await ftpService.uploadJsonData(filePath);
          if (success) {
            await logMessage('FILE', 'INFO', 'Dữ liệu đã được upload lên FTP server');
          }
        } catch (error) {
          await logMessage('FILE', 'ERROR', `Lỗi FTP upload: ${error.message}`);
        }
      });
    }
    
    return filePath;
  } catch (error) {
    await logMessage('FILE', 'ERROR', `Lỗi khi lưu dữ liệu mới nhất: ${error.message}`);
    throw error;
  }
}

module.exports = {
  ensureDirectoryExists,
  saveStockData,
  saveLatestStockData
};
