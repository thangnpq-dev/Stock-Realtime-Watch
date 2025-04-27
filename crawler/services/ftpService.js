const ftp = require('basic-ftp');
const fs = require('fs').promises;
const path = require('path');
const { logMessage } = require('../utils/log');
require('dotenv').config();

class FtpService {
  constructor() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = false; // Set to true for debugging
    
    // FTP connection details from .env
    this.host = process.env.FTP_HOST;
    this.port = process.env.FTP_PORT || 21;
    this.user = process.env.FTP_USER;
    this.password = process.env.FTP_PASSWORD;
    this.remoteDir = process.env.FTP_REMOTE_DIR || '';
    this.secure = process.env.FTP_SECURE;
    
    // Connection state tracking
    this.isConnecting = false;
    this.lastConnectionTime = 0;
    this.connectionTimeout = 60000; // 1 minute timeout
  }
  
  /**
   * Kết nối đến FTP server
   * @returns {Promise<boolean>} - true nếu kết nối thành công
   */
  async connect() {
    try {
      // Tránh kết nối đồng thời nhiều request
      if (this.isConnecting) {
        await logMessage('FTP', 'INFO', 'Xử lý kết nối FTP khác đang diễn ra, chờ kết nối...');
        // Chờ tối đa 10 giây cho kết nối hiện tại
        const maxWait = 10000;
        const startWait = Date.now();
        while (this.isConnecting && (Date.now() - startWait < maxWait)) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        // Nếu vẫn đang kết nối sau 10 giây, giả định kết nối thành công (chấp nhận rủi ro)
        if (this.isConnecting) {
          this.isConnecting = false;
          return true;
        }
        // Kiểm tra xem kết nối có thành công không
        if (!this.client.closed && (Date.now() - this.lastConnectionTime < this.connectionTimeout)) {
          return true;
        }
      }
      
      // Đánh dấu đang kết nối
      this.isConnecting = true;
      
      // Kiểm tra các thông tin cấu hình FTP
      if (!this.host || !this.user || !this.password) {
        await logMessage('FTP', 'ERROR', 'Missing FTP configuration in .env file');
        this.isConnecting = false;
        return false;
      }
      
      // Đóng kết nối cũ nếu có
      try {
        if (!this.client.closed) {
          await this.client.close();
        }
      } catch (closeError) {
        // Không quan tâm đến lỗi khi đóng
      }
      
      // Tạo client mới
      this.client = new ftp.Client();
      this.client.ftp.verbose = false;
      
      // Thiết lập các tùy chọn kết nối
      const secureOptions = this.secure ? { rejectUnauthorized: false } : false;
      
      // Kết nối đến FTP server
      await this.client.access({
        host: this.host,
        port: parseInt(this.port),
        user: this.user,
        password: this.password,
        secure: secureOptions,
      });
      
      // Cập nhật thời gian kết nối mới nhất
      this.lastConnectionTime = Date.now();
      this.isConnecting = false;
      
      await logMessage('FTP', 'INFO', `Connected to FTP server: ${this.host}`);
      return true;
    } catch (error) {
      await logMessage('FTP', 'ERROR', `FTP connection error: ${error.message}`);
      this.isConnecting = false;
      return false;
    }
  }
  
  /**
   * Upload file lên FTP server
   * @param {string} localFilePath - Đường dẫn tới file cần upload
   * @param {string} remoteFileName - Tên file trên server (mặc định là tên file gốc)
   * @returns {Promise<boolean>} - true nếu upload thành công
   */
  async uploadFile(localFilePath, remoteFileName = null) {
    try {
      // Kiểm tra file có tồn tại không
      await fs.access(localFilePath);
      
      // Lấy tên file nếu không được chỉ định
      if (!remoteFileName) {
        remoteFileName = path.basename(localFilePath);
      }
      
      // Đảm bảo đã kết nối đến FTP server
      // Không sử dụng currentDirectory cho kiểm tra kết nối, thay vào đó sử dụng thời gian kết nối
      if (this.client.closed || (Date.now() - this.lastConnectionTime > this.connectionTimeout)) {
        await logMessage('FTP', 'INFO', 'Refreshing FTP connection...');
        if (!await this.connect()) {
          return false;
        }
      }
      
      // Di chuyển đến thư mục đích trên server
      if (this.remoteDir && this.remoteDir !== '') {
        try {
          await this.client.ensureDir(this.remoteDir);
          await logMessage('FTP', 'INFO', `Changed to directory: ${this.remoteDir}`);
        } catch (dirError) {
          await logMessage('FTP', 'WARNING', `Could not change to directory ${this.remoteDir}: ${dirError.message}`);
          // Tạo thư mục nếu không tồn tại
          try {
            await this.client.ensureDir('/');
            const dirs = this.remoteDir.split('/').filter(Boolean);
            for (const dir of dirs) {
              try {
                await this.client.mkdir(dir);
              } catch (mkdirError) {
                // Bỏ qua lỗi nếu thư mục đã tồn tại
              }
              await this.client.cd(dir);
            }
            await logMessage('FTP', 'INFO', `Created and changed to directory: ${this.remoteDir}`);
          } catch (createDirError) {
            await logMessage('FTP', 'ERROR', `Failed to create directory structure: ${createDirError.message}`);
            return false;
          }
        }
      }
      
      // Upload file
      await this.client.uploadFrom(localFilePath, remoteFileName);
      // Cập nhật thời gian kết nối mới nhất sau khi upload thành công
      this.lastConnectionTime = Date.now();
      
      await logMessage('FTP', 'INFO', `Successfully uploaded ${localFilePath} to ${this.remoteDir || '/'}/${remoteFileName}`);
      
      return true;
    } catch (error) {
      await logMessage('FTP', 'ERROR', `Upload failed: ${error.message}`);
      // Khi có lỗi, đóng kết nối và cho phép upload lại
      this.client.close().catch(() => {}); // Bỏ qua lỗi khi đóng
      return false;
    }
  }
  
  /**
   * Upload JSON data lên FTP server
   * @param {string} jsonFilePath - Đường dẫn tới file JSON cần upload
   * @returns {Promise<boolean>} - true nếu upload thành công
   */
  async uploadJsonData(jsonFilePath) {
    try {
      // Kiểm tra file có tồn tại không
      const exists = await fs.stat(jsonFilePath).then(() => true).catch(() => false);
      if (!exists) {
        await logMessage('FTP', 'ERROR', `JSON file not found: ${jsonFilePath}`);
        return false;
      }
      
      // Upload file
      const result = await this.uploadFile(jsonFilePath);
      
      return result;
    } catch (error) {
      await logMessage('FTP', 'ERROR', `JSON upload failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Đóng kết nối FTP
   */
  async close() {
    try {
      this.client.close();
      await logMessage('FTP', 'INFO', 'FTP connection closed');
    } catch (error) {
      await logMessage('FTP', 'ERROR', `Error closing FTP connection: ${error.message}`);
    }
  }
}

module.exports = new FtpService();
