import axios from 'axios';
import { io } from 'socket.io-client';

class StockService {
  constructor() {
    this.socket = null;
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5011';
  }

  /**
   * Khởi tạo kết nối socket.io
   * @returns {Socket} Socket.io instance
   */
  initializeSocket() {
    // Đóng kết nối cũ nếu có
    if (this.socket) {
      this.socket.disconnect();
      this.socket.off();
    }

    // Tạo kết nối mới
    this.socket = io(this.baseURL, { forceNew: true });
    return this.socket;
  }

  /**
   * Đăng ký theo dõi danh sách mã cổ phiếu
   * @param {Array<string>} stockCodes Danh sách mã cổ phiếu
   */
  watchStocks(stockCodes) {
    if (!this.socket) {
      this.initializeSocket();
    }

    if (stockCodes && stockCodes.length > 0) {
      this.socket.emit('watch-stocks', stockCodes);
    }
  }

  /**
   * Ngắt kết nối socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Lấy dữ liệu cổ phiếu qua API
   * @param {Array<string>} stockCodes Danh sách mã cổ phiếu
   * @returns {Promise<Object>} Dữ liệu cổ phiếu
   */
  async fetchStockData(stockCodes) {
    if (!stockCodes || stockCodes.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        data: [],
        status: 'no_data'
      };
    }

    try {
      const response = await axios.post(`${this.baseURL}/api/stock-data`, { stockCodes });
      return response.data;
    } catch (error) {
      console.error('Error fetching stock data:', error);
      return {
        timestamp: new Date().toISOString(),
        data: [],
        status: 'error',
        message: error.message
      };
    }
  }
}

// Export một instance để sử dụng trong toàn ứng dụng
export default new StockService();
