const path = require('path');
require('dotenv').config();
const dayjs = require('dayjs');
const browserService = require('./services/browserService');
const stockService = require('./services/stockService');
const { logMessage } = require('./utils/log');

// Danh sách mã cổ phiếu mặc định
const DEFAULT_STOCK_CODES = ['VHM', 'VNM', 'FPT', 'MWG', 'HPG', 'VCB', 'VIC'];

// Thời gian delay giữa các lần crawl (mặc định 5 phút)
const CRAWL_INTERVAL = parseInt(process.env.CRAWL_INTERVAL || '5') * 1000;

// Biến để theo dõi trạng thái khởi tạo browser
let isInitialized = false;

/**
 * Khởi tạo browser cho crawler
 * @returns {Promise<boolean>} - true nếu khởi tạo thành công
 */
async function initializeBrowser() {
  try {
    // Nếu chưa khởi tạo, thực hiện khởi tạo browser
    if (!isInitialized) {
      await logMessage('CRAWLER', 'INFO', 'Khởi tạo browser lần đầu');
      // Đảm bảo browser được kết nối
      await browserService.ensureBrowserConnected();
      isInitialized = true;
      return true;
    } else {
      // Nếu đã khởi tạo, chỉ cần refresh page
      // await browserService.refreshPage();
      return true;
    }
  } catch (error) {
    await logMessage('CRAWLER', 'ERROR', `Lỗi khởi tạo browser: ${error.message}`);
    isInitialized = false;
    return false;
  }
}

/**
 * Crawl dữ liệu cổ phiếu theo định kỳ
 */
async function crawlStockData() {
  try {
    // Khởi tạo browser
    const browserReady = await initializeBrowser();
    if (!browserReady) {
      await logMessage('CRAWLER', 'ERROR', 'Không thể khởi tạo browser, thử lại sau');
      return;
    }
    
    // Lấy tất cả mã cổ phiếu hiện có trên trang web
    await logMessage('CRAWLER', 'INFO', 'Bắt đầu lấy tất cả mã cổ phiếu hiện có');
    
    const stockCodes = await stockService.getAllStockCodes();
    
    if (stockCodes.length === 0) {
      // Nếu không tìm thấy mã cổ phiếu nào, sử dụng danh sách mặc định
      const stockCodesStr = process.env.STOCK_CODES || DEFAULT_STOCK_CODES.join(',');
      const fallbackStockCodes = stockCodesStr.split(',').map(code => code.trim());
      
      await logMessage('CRAWLER', 'INFO', `Không tìm thấy mã cổ phiếu nào, sử dụng danh sách mặc định: ${fallbackStockCodes.join(', ')}`);
      
      // Lấy dữ liệu và lưu vào file JSON
      const filePath = await stockService.fetchAndSaveStockData(fallbackStockCodes);
      
      await logMessage('CRAWLER', 'INFO', `Đã lưu dữ liệu vào: ${filePath}`);
    } else {
      await logMessage('CRAWLER', 'INFO', `Đã tìm thấy ${stockCodes.length} mã cổ phiếu: ${stockCodes.join(', ')}`);
      
      // Lấy dữ liệu và lưu vào file JSON
      const filePath = await stockService.fetchAndSaveStockData(stockCodes);
      
      await logMessage('CRAWLER', 'INFO', `Đã lưu dữ liệu vào: ${filePath}`);
    }
    
    await logMessage('CRAWLER', 'INFO', `Lần quét tiếp theo sau ${CRAWL_INTERVAL/1000} giây`);
  } catch (error) {
    await logMessage('CRAWLER', 'ERROR', `Lỗi trong quá trình quét: ${error.message}`);
    // Reset trạng thái khởi tạo browser nếu có lỗi
    isInitialized = false;
  }
}

/**
 * Định kỳ chạy crawl dữ liệu
 */
async function scheduleStockDataCrawling() {
  try {
    // Kiểm tra xem có phải đang trong thời gian giao dịch không (thứ 2-6, 8:30-15:30)
    const now = dayjs();
    const dayOfWeek = now.day(); // 0 = Chủ nhật, 1-5 = Thứ 2-6, 6 = Thứ 7
    const hour = now.hour();
    const minute = now.minute();
    const currentTimeInMinutes = hour * 60 + minute;
    const marketOpenTime = 8 * 60 + 30;  // 8:30 AM = 510 phút
    const marketCloseTime = 15 * 60 + 30; // 3:30 PM = 930 phút
    
    const isMarketOpen = dayOfWeek >= 1 && dayOfWeek <= 5 && // Thứ 2 đến thứ 6
                         currentTimeInMinutes >= marketOpenTime && 
                         currentTimeInMinutes <= marketCloseTime;
    
    if (isMarketOpen) {
      // Thực hiện crawl nếu trong thời gian giao dịch
      await crawlStockData();
      await logMessage('CRAWLER', 'INFO', `Crawled data during market hours at ${now.format('HH:mm:ss')}`);
    } else {
      await logMessage('CRAWLER', 'INFO', `Skipped crawling - outside market hours at ${now.format('HH:mm:ss')}`, false);
    }
    
    // Lên lịch crawl tiếp theo
    setTimeout(scheduleStockDataCrawling, CRAWL_INTERVAL);
  } catch (error) {
    await logMessage('CRAWLER', 'ERROR', `Error in scheduled crawling: ${error.message}`);
    
    // Nếu có lỗi, thử lại sau 1 phút
    await logMessage('CRAWLER', 'INFO', 'Retrying in 60 seconds...');
    setTimeout(scheduleStockDataCrawling, 60000);
  }
}

/**
 * Khởi động ứng dụng crawler
 */
async function startCrawler() {
  try {
    // Khởi tạo browser service
    await browserService.initialize();
    console.log('Browser service initialized successfully');
    
    // Thiết lập xử lý khi đóng ứng dụng
    process.on('SIGINT', async () => {
      await logMessage('CRAWLER', 'INFO', 'Shutting down crawler...');
      await browserService.cleanup();
      process.exit(0);
    });
    
    // Bắt đầu crawl theo lịch
    await scheduleStockDataCrawling();
    
    console.log(`Crawler started successfully. Data will be updated every ${CRAWL_INTERVAL/1000} seconds.`);
  } catch (error) {
    console.error('Error starting crawler:', error);
    process.exit(1);
  }
}

// Khởi động crawler
startCrawler();
