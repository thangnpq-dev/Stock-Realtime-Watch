const { openCustomBrowser, getUserDataDir, checkExistingUserDir } = require('../utils/browser');
const { logMessage } = require('../utils/log');
require('dotenv').config();

class BrowserService {
  constructor() {
    this.browser = null;
    this.email = process.env.USER_DATA || 'default.user@example.com';
    this.page = null; // Lưu tham chiếu đến page instance
    this.isReconnecting = false;
  }

  /**
   * Lấy page instance hiện tại
   * @returns {Object} page instance
   */
  getPage() {
    return this.page;
  }

  /**
   * Đảm bảo browser đã được kết nối
   * Nếu browser bị disconnect, sẽ khởi tạo lại
   */
  async ensureBrowserConnected() {
    if (this.isReconnecting) {
      await logMessage('BROWSER', 'INFO', 'Đang thực hiện kết nối lại browser, vui lòng chờ...');
      while (this.isReconnecting) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }

    try {
      // Kiểm tra nếu browser không tồn tại hoặc bị disconnect
      if (!this.browser || !this.browser.isConnected()) {
        this.isReconnecting = true;
        await logMessage('BROWSER', 'INFO', 'Browser chưa kết nối, đang khởi tạo browser mới');
        
        // Đóng browser cũ nếu còn tồn tại
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (e) {
            // Bỏ qua lỗi nếu không đóng được browser cũ
          }
        }
        
        // Khởi tạo browser mới
        await this.initialize();
      }
    } catch (error) {
      await logMessage('BROWSER', 'ERROR', `Lỗi khi kiểm tra/kết nối browser: ${error.message}`);
      throw error;
    } finally {
      this.isReconnecting = false;
    }
  }

  async initialize() {
    try {
      // Nếu đang reconnect, reset trạng thái
      this.browser = null;
      this.page = null;
      
      // Lấy thư mục user data dựa trên email
      const userDataDir = getUserDataDir(this.email);
      
      // Kiểm tra thư mục user data có tồn tại không
      await checkExistingUserDir(userDataDir);
      
      // Mở browser instance
      this.browser = await openCustomBrowser(userDataDir);
      
      // Lắng nghe sự kiện disconnect từ browser
      this.browser.on('disconnected', async () => {
        await logMessage('BROWSER', 'ERROR', 'Browser bị ngắt kết nối, sẽ tự tạo lại khi có request mới');
        this.browser = null;
        this.page = null;
      });
      
      await logMessage('BROWSER', 'INFO', `Khởi tạo browser thành công cho user: ${this.email}`);
      // Thiết lập trang ban đầu cho browser
      await this.setupPage();
      return this.browser;
    } catch (error) {
      await logMessage('BROWSER', 'ERROR', `Lỗi khởi tạo browser: ${error.message}`);
      this.browser = null;
      this.page = null;
      throw error;
    }
  }

  /**
   * Thiết lập trang và thực hiện các thao tác cơ bản
   */
  async setupPage() {
    try {
      // Đảm bảo browser đã được kết nối trước khi setup page
      if (!this.browser || !this.browser.isConnected()) {
        await logMessage('BROWSER', 'INFO', 'Browser chưa kết nối khi setupPage, đang kết nối lại...');
        await this.ensureBrowserConnected();
        return;
      }
      
      if (this.page) {
        // Kiểm tra nếu page đã tồn tại và còn hợp lệ
        try {
          // Kiểm tra page còn hoạt động không
          await this.page.evaluate(() => true);
          await logMessage('BROWSER', 'INFO', 'Page hiện tại còn hoạt động, tiếp tục sử dụng');
          return;
        } catch (error) {
          await logMessage('BROWSER', 'INFO', `Page cũ không còn hợp lệ, tạo mới: ${error.message}`);
          this.page = null;
        }
      }
      
      // Mở một trang mới
      this.page = await this.browser.newPage();
      await logMessage('BROWSER', 'INFO', 'Đã mở trang mới thành công');
      
      // Truy cập vào trang mong muốn
      await this.page.goto(process.env.PAGE, { waitUntil: 'networkidle2' });
      await logMessage('BROWSER', 'INFO', `Đã truy cập: ${process.env.PAGE}`);
      
      // Kéo xuống cuối trang
      await this.page.evaluate(async () => {
        await new Promise(resolve => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if(totalHeight >= scrollHeight){
              clearInterval(timer);
              resolve();
            }
          }, 50);
        });
      });
      await logMessage('BROWSER', 'INFO', 'Đã kéo xuống cuối trang');
      
      // Kéo lên đầu trang
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await logMessage('BROWSER', 'INFO', 'Đã kéo lên đầu trang');
      
    } catch (error) {
      await logMessage('BROWSER', 'ERROR', `Lỗi trong setupPage: ${error.message}`);
      this.page = null;
      throw error;
    }
  }

  /**
   * Làm mới trang nếu cần thiết
   */
  async refreshPage() {
    try {
      // Đảm bảo browser đã được kết nối trước khi refresh
      await this.ensureBrowserConnected();
      
      if (!this.page) {
        await this.setupPage();
        return;
      }
      
      try {
        await this.page.reload({ waitUntil: 'networkidle2' });
        await logMessage('BROWSER', 'INFO', 'Đã làm mới trang thành công');
        
        // Kéo lên đầu trang sau khi làm mới
        await this.page.evaluate(() => {
          window.scrollTo(0, 0);
        });
      } catch (error) {
        await logMessage('BROWSER', 'ERROR', `Lỗi khi reload trang: ${error.message}`);
        // Thử tạo page mới nếu refresh thất bại
        this.page = null;
        await this.setupPage();
      }
    } catch (error) {
      await logMessage('BROWSER', 'ERROR', `Lỗi khi làm mới trang: ${error.message}`);
      // Thử tạo page mới nếu refresh thất bại
      this.page = null;
      await this.setupPage();
    }
  }

  /**
   * Đóng browser và page khi không cần thiết
   */
  async cleanup() {
    try {
      if (this.browser) {
        if (this.page) {
          try {
            await this.page.close();
          } catch (err) {
            // Bỏ qua lỗi đóng page
          }
          this.page = null;
        }
        
        await this.browser.close();
        this.browser = null;
        await logMessage('BROWSER', 'INFO', 'Đã đóng browser thành công');
      }
    } catch (error) {
      await logMessage('BROWSER', 'ERROR', `Lỗi khi đóng browser: ${error.message}`);
    }
  }
}

module.exports = new BrowserService();
