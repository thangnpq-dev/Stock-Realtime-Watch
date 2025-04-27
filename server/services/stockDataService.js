const fs = require('fs');
const path = require('path');

class StockDataService {
  constructor() {
    // Đường dẫn đến file JSON chứa dữ liệu cổ phiếu
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
    this.latestDataFile = path.join(this.dataDir, 'latest-stock-data.json');
    this._lastLoggedMinute = null;
  }

  /**
   * Đọc dữ liệu cổ phiếu từ file JSON
   * @returns {Promise<Object>} Dữ liệu cổ phiếu
   */
  async getStockData() {
    try {
      // Kiểm tra xem file có tồn tại không
      if (!fs.existsSync(this.latestDataFile)) {
        // Chỉ log một lần mỗi phút để tránh spam console
        const now = new Date();
        const minutes = now.getMinutes();
        if (minutes !== this._lastLoggedMinute) {
          console.log(`Không tìm thấy file dữ liệu: ${this.latestDataFile}`);
          this._lastLoggedMinute = minutes;
        }
        
        return {
          timestamp: new Date().toISOString(),
          data: [],
          status: 'no_data',
          message: 'Chưa có dữ liệu cổ phiếu. Vui lòng chờ crawler hoạt động.'
        };
      }

      // Đọc dữ liệu từ file
      const fileContent = await fs.promises.readFile(this.latestDataFile, 'utf8');
      const stockData = JSON.parse(fileContent);

      // Kiểm tra xem dữ liệu có cũ không
      const dataTimestamp = new Date(stockData.timestamp);
      const now = new Date();
      const diffMinutes = (now - dataTimestamp) / (1000 * 60);
      
      // Nếu dữ liệu cũ hơn 15 phút, thêm cảnh báo
      if (diffMinutes > 15) {
        stockData.warning = `Dữ liệu đã cũ (${Math.floor(diffMinutes)} phút trước)`;
        stockData.status = 'outdated';
      } else {
        stockData.status = 'ok';
      }

      return stockData;
    } catch (error) {
      console.error(`Lỗi đọc dữ liệu: ${error.message}`);
      return {
        timestamp: new Date().toISOString(),
        data: [],
        status: 'error',
        message: `Lỗi đọc dữ liệu: ${error.message}`
      };
    }
  }

  /**
   * Lọc dữ liệu cổ phiếu theo mã
   * @param {Array<string>} stockCodes Mảng mã cổ phiếu cần lọc
   * @returns {Promise<Object>} Dữ liệu cổ phiếu đã lọc
   */
  async getFilteredStockData(stockCodes) {
    try {
      const stockData = await this.getStockData();
      
      // Nếu không có mã cổ phiếu cụ thể, trả về tất cả
      if (!stockCodes || stockCodes.length === 0) {
        return stockData;
      }
      
      // Lọc dữ liệu theo các mã cổ phiếu
      const filteredData = stockData.data.filter(item => 
        stockCodes.some(code => code.toUpperCase() === item.code.toUpperCase())
      );
      
      // Trả về kết quả với các thuộc tính gốc
      return {
        ...stockData,
        data: filteredData
      };
    } catch (error) {
      console.error(`Lỗi khi lọc dữ liệu: ${error.message}`);
      return {
        timestamp: new Date().toISOString(),
        data: [],
        status: 'error',
        message: `Lỗi khi lọc dữ liệu: ${error.message}`
      };
    }
  }
}

module.exports = new StockDataService();
