const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import services
const stockDataService = require('./services/stockDataService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Cấu hình Express
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Main UI route
app.get('/', (req, res) => {
  res.render('index', { error: null, stockData: null });
});

// Minimal UI route
app.get('/minimal', (req, res) => {
  res.render('minimal');
});

// API endpoint để nhận danh sách mã cổ phiếu và trả về dữ liệu
app.post('/api/stock-data', async (req, res) => {
  try {
    const { stockCodes } = req.body;
    
    if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid stock codes' });
    }
    
    // Lấy dữ liệu cổ phiếu từ file JSON
    const stockData = await stockDataService.getFilteredStockData(stockCodes);
    
    return res.json(stockData);
  } catch (error) {
    console.error('Error in /api/stock-data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO connections
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Client gửi danh sách mã cổ phiếu cần theo dõi
  socket.on('watch-stocks', async (stockCodes) => {
    if (!stockCodes || !Array.isArray(stockCodes)) {
      socket.emit('error', { message: 'Invalid stock codes' });
      return;
    }
    
    // Lưu danh sách mã cổ phiếu vào socket
    socket.stockCodes = stockCodes;
    
    // Gửi dữ liệu ban đầu
    const initialData = await stockDataService.getFilteredStockData(stockCodes);
    socket.emit('stock-data', initialData);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Polling interval (5 giây)
const POLLING_INTERVAL = 5000;

// Hàm gửi dữ liệu cổ phiếu cập nhật cho tất cả clients
async function broadcastStockData() {
  try {
    // Lấy danh sách clients đang kết nối
    const connectedClients = Array.from(io.sockets.sockets).map(socket => socket[1]);
    
    // Nếu không có client nào kết nối, thoát
    if (connectedClients.length === 0) {
      return;
    }
    
    // Tạo danh sách tất cả mã cổ phiếu cần lấy dữ liệu
    const allStockCodes = new Set();
    connectedClients.forEach(client => {
      if (client.stockCodes && Array.isArray(client.stockCodes)) {
        client.stockCodes.forEach(code => allStockCodes.add(code));
      }
    });
    
    // Nếu không có mã cổ phiếu nào, thoát
    if (allStockCodes.size === 0) {
      return;
    }
    
    // Lấy dữ liệu cổ phiếu từ file JSON
    const stockData = await stockDataService.getStockData();
    
    // Gửi dữ liệu cho từng client dựa trên danh sách mã cổ phiếu của họ
    connectedClients.forEach(client => {
      if (client.stockCodes && Array.isArray(client.stockCodes)) {
        const filteredData = {
          ...stockData,
          data: stockData.data.filter(item => 
            client.stockCodes.some(code => code.toUpperCase() === item.code.toUpperCase())
          )
        };
        
        client.emit('stock-data', filteredData);
      }
    });
  } catch (error) {
    console.error('Error broadcasting stock data:', error);
  }
}

// Đặt định kỳ gửi dữ liệu cổ phiếu
setInterval(broadcastStockData, POLLING_INTERVAL);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Khởi động server
const startServer = async () => {
  try {
    const PORT = process.env.PORT || 5011;
    server.listen(PORT, () => {
      console.log(`Server đang chạy trên port ${PORT}`);
    });
  } catch (error) {
    console.error('Lỗi khởi động server:', error);
    process.exit(1);
  }
};

startServer();
