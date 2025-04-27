const browserService = require('./browserService');
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');
const { logMessage } = require('../utils/log');
const { saveLatestStockData } = require('../utils/fileUtils');

class StockService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isPageReady = false;
  }

  /**
   * Thiết lập browser instance từ browserService
   * @param {Object} browser - Browser instance từ puppeteer
   */
  setBrowser(browser) {
    this.browser = browser;
  }

  /**
   * Thiết lập trang đã mở sẵn
   * @param {Object} page - Page instance từ puppeteer
   */
  setPage(page) {
    this.page = page;
    this.isPageReady = !!page; // set true nếu page không null
    if (this.isPageReady) {
      logMessage('STOCK', 'INFO', 'Page reference set successfully in StockService');
    }
  }

  /**
   * Đảm bảo page hợp lệ trước khi thực hiện các tác vụ
   * @returns {Promise<boolean>} - true nếu page hợp lệ
   */
  async ensureValidPage() {
    try {
      // Kiểm tra nếu browser đã bị disconnect
      await browserService.ensureBrowserConnected();
      
      // Kiểm tra ngày trong file JSON so với ngày hiện tại
      try {
        const jsonFilePath = path.join(__dirname, '../data/latest-stock-data.json');
        const fileExists = await fs.stat(jsonFilePath).then(() => true).catch(() => false);
        
        if (fileExists) {
          const jsonData = JSON.parse(await fs.readFile(jsonFilePath, 'utf8'));
          const fileDate = dayjs(jsonData.timestamp).format('YYYY-MM-DD');
          const currentDate = dayjs().format('YYYY-MM-DD');
          
          if (fileDate !== currentDate) {
            await logMessage('STOCK', 'INFO', `Date mismatch detected: ${fileDate} vs current ${currentDate}. Refreshing page...`);
            
            // Đóng page hiện tại nếu có
            if (this.page) {
              try {
                // Đặt this.page = null trước để tránh các tác vụ khác sử dụng trong quá trình đóng
                const tempPage = this.page;
                this.page = null;
                this.isPageReady = false;
                
                // Refresh toàn bộ page từ browserService
                await browserService.refreshPage();
                await logMessage('STOCK', 'INFO', 'Page has been refreshed due to date change');
              } catch (closeError) {
                await logMessage('STOCK', 'ERROR', `Error closing page: ${closeError.message}`);
              }
            }
          }
        }
      } catch (jsonError) {
        await logMessage('STOCK', 'ERROR', `Error checking JSON timestamp: ${jsonError.message}`);
      }
      
      // Nếu không có page, lấy từ browserService
      if (!this.page) {
        this.page = browserService.getPage();
        this.isPageReady = !!this.page;
        if (this.isPageReady) {
          await logMessage('STOCK', 'INFO', 'Retrieved page reference from browserService');
        }
      }
      
      // Kiểm tra page còn hoạt động không
      if (this.page) {
        try {
          await this.page.evaluate(() => true);
          this.isPageReady = true;
          return true;
        } catch (error) {
          await logMessage('STOCK', 'ERROR', `Page validation failed: ${error.message}`);
          this.isPageReady = false;
          this.page = null;
          
          // Thử làm mới page từ browserService
          await browserService.refreshPage();
          this.page = browserService.getPage();
          this.isPageReady = !!this.page;
          
          return this.isPageReady;
        }
      }
      
      return false;
    } catch (error) {
      await logMessage('STOCK', 'ERROR', `Error in ensureValidPage: ${error.message}`);
      this.isPageReady = false;
      return false;
    }
  }

  /**
   * Lấy thông tin cổ phiếu từ DOM của trang đã mở sẵn
   * @param {Array<string>} stockCodes - Mảng mã cổ phiếu cần truy vấn
   * @returns {Promise<Array>} - Dữ liệu cổ phiếu theo mã
   */
  async getStockData(stockCodes) {
    try {
      // Đảm bảo page hợp lệ trước khi thực hiện truy vấn
      const isPageValid = await this.ensureValidPage();
      
      // Nếu page không hợp lệ, trả về dữ liệu giả
      if (!isPageValid) {
        await logMessage('STOCK', 'ERROR', 'No valid page available after recovery attempt');
        return this.generatePlaceholderData(stockCodes, 'Trang web không khả dụng');
      }

      // Kết quả trả về
      const results = [];

      // Truy vấn DOM để lấy dữ liệu cho mỗi mã cổ phiếu
      for (const stockCode of stockCodes) {
        try {
          const stockData = await this.page.evaluate((code) => {
            // Tìm thông tin cổ phiếu theo mã
            const rows = document.querySelectorAll('table tbody tr');
            
            for (const row of rows) {
              const cells = row.querySelectorAll('td');
              // Chỉ tiếp tục nếu có ít nhất 1 td có class 'short-symbol'
              const hasShortSymbol = Array.from(cells).some(td => td.classList.contains('short-symbol'));
              if (cells.length > 0 && hasShortSymbol) {
                const stockCode = cells[0].innerText.trim();
                
                if (stockCode === code) {
                  // Lấy thông tin giá hiện tại, thay đổi, phần trăm thay đổi
                  const price = cells[10].innerText.trim(); // Giá hiện tại
                  const change = cells[12].innerText; // Thay đổi
                  const percentChange = cells[13].innerText; // % thay đổi
                  
                  return {
                    code: stockCode,
                    price: price,
                    change: change,
                    percentChange: percentChange,
                    timestamp: new Date().toLocaleTimeString()
                  };
                }
              }
            }
            
            return null; // Không tìm thấy mã cổ phiếu
          }, stockCode.toUpperCase());

          if (stockData) {
            results.push(stockData);
          } else {
            results.push({
              code: stockCode,
              price: 'N/A',
              change: 'N/A',
              percentChange: 'N/A',
              timestamp: new Date().toLocaleTimeString(),
              error: 'Không tìm thấy dữ liệu'
            });
          }
        } catch (error) {
          await logMessage('STOCK', 'ERROR', `Error fetching data for ${stockCode}: ${error.message}`);
          
          // Nếu lỗi là do page invalid, thử khôi phục page và thử lại
          if (error.message.includes('Target closed') || error.message.includes('Session closed') || 
              error.message.includes('browser has disconnected') || error.message.includes('Requesting main frame too early')) {
            
            await logMessage('STOCK', 'INFO', 'Browser/page disconnected during stock query, attempting recovery...');
            
            // Thử làm mới page
            const recovered = await this.ensureValidPage();
            if (recovered) {
              await logMessage('STOCK', 'INFO', 'Recovery successful, retrying query');
              // Nếu là lỗi kết nối, chỉ thêm lỗi cho mã cổ phiếu hiện tại
              results.push({
                code: stockCode,
                price: 'N/A',
                change: 'N/A',
                percentChange: 'N/A',
                timestamp: new Date().toLocaleTimeString(),
                error: 'Đang kết nối lại'
              });
            } else {
              // Kết thúc, trả về kết quả với lỗi
              return this.generatePlaceholderData(stockCodes, 'Mất kết nối tới trang web');
            }
          } else {
            // Lỗi khác, thêm vào kết quả
            results.push({
              code: stockCode,
              price: 'N/A',
              change: 'N/A',
              percentChange: 'N/A',
              timestamp: new Date().toLocaleTimeString(),
              error: 'Lỗi khi truy vấn dữ liệu'
            });
          }
        }
      }

      return results;
    } catch (error) {
      await logMessage('STOCK', 'ERROR', `Error in getStockData: ${error.message}`);
      return this.generatePlaceholderData(stockCodes, 'Lỗi hệ thống');
    }
  }

  /**
   * Lấy tất cả mã cổ phiếu hiện có trên trang web
   * @returns {Promise<Array<string>>} - Mảng các mã cổ phiếu
   */
  async getAllStockCodes() {
    try {
      // Đảm bảo page hợp lệ trước khi thực hiện truy vấn
      const isPageValid = await this.ensureValidPage();
      
      if (!isPageValid) {
        await logMessage('STOCK', 'ERROR', 'Không thể lấy danh sách mã cổ phiếu - trang web không khả dụng');
        return [];
      }

      // Truy vấn DOM để lấy tất cả mã cổ phiếu
      const allStockCodes = await this.page.evaluate(() => {
        // Tìm tất cả mã cổ phiếu trong bảng
        const codes = [];
        const rows = document.querySelectorAll('table tbody tr');
        
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          // Chỉ tiếp tục nếu có ít nhất 1 td có class 'short-symbol'
          const hasShortSymbol = Array.from(cells).some(td => td.classList.contains('short-symbol'));
          if (cells.length > 0 && hasShortSymbol) {
            const stockCode = cells[0].innerText.trim();
            if (stockCode) {
              codes.push(stockCode);
            }
          }
        }
        
        return codes;
      });

      await logMessage('STOCK', 'INFO', `Tìm thấy ${allStockCodes.length} mã cổ phiếu từ trang web`);
      return allStockCodes;
    } catch (error) {
      await logMessage('STOCK', 'ERROR', `Lỗi khi lấy danh sách mã cổ phiếu: ${error.message}`);
      return [];
    }
  }

  /**
   * Lấy dữ liệu cổ phiếu và lưu vào file JSON
   * @param {Array<string>} stockCodes - Mảng mã cổ phiếu cần truy vấn
   * @returns {Promise<string>} - Đường dẫn tới file JSON đã lưu
   */
  async fetchAndSaveStockData(stockCodes) {
    try {
      // Lấy dữ liệu cổ phiếu
      const stockData = await this.getStockData(stockCodes);
      
      // Lưu dữ liệu vào file JSON
      const filePath = await saveLatestStockData(stockData);
      
      await logMessage('STOCK', 'INFO', `Saved stock data to ${filePath}`);
      
      return filePath;
    } catch (error) {
      await logMessage('STOCK', 'ERROR', `Error in fetchAndSaveStockData: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tạo dữ liệu giả khi không thể truy cập trang web
   * @param {Array<string>} stockCodes - Danh sách mã cổ phiếu
   * @param {string} errorMessage - Thông báo lỗi
   * @returns {Array} - Dữ liệu giả
   */
  generatePlaceholderData(stockCodes, errorMessage) {
    return stockCodes.map(code => ({
      code,
      price: 'N/A',
      change: 'N/A',
      percentChange: 'N/A',
      timestamp: new Date().toLocaleTimeString(),
      error: errorMessage || 'Không thể kết nối đến máy chủ'
    }));
  }
}

module.exports = new StockService();
