import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCog, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import StockItem from './StockItem';
import AddStockPanel from './AddStockPanel';
import SettingsPanel from './SettingsPanel';
import StockService from '../services/StockService';

const MinimalStockWatch = () => {
  // States
  const [stockCodes, setStockCodes] = useState([]);
  const [favoriteStocks, setFavoriteStocks] = useState([]);
  const [stockData, setStockData] = useState({ data: [] });
  const [activeTab, setActiveTab] = useState('all');
  const [addPanelVisible, setAddPanelVisible] = useState(false);
  const [settingsPanelVisible, setSettingsPanelVisible] = useState(false);
  const [socketConnected, setSocketConnected] = useState(true);
  const [countdown, setCountdown] = useState(5);
  
  // Refs
  const countdownTimerRef = useRef(null);
  const containerRef = useRef(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const socketRef = useRef(null);

  // Khởi tạo ứng dụng
  useEffect(() => {
    // Load dữ liệu từ localStorage
    const savedStocks = localStorage.getItem('minimalStockCodes');
    if (savedStocks) {
      setStockCodes(JSON.parse(savedStocks));
    }

    const savedFavorites = localStorage.getItem('minimalFavoriteStocks');
    if (savedFavorites) {
      setFavoriteStocks(JSON.parse(savedFavorites));
    }

    // Điều chỉnh vị trí container
    positionContainerInView();

    // Thêm event listener cho resize
    window.addEventListener('resize', positionContainerInView);

    return () => {
      window.removeEventListener('resize', positionContainerInView);
      // Dọn dẹp khi unmount
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      StockService.disconnect();
    };
  }, []);

  // Khởi tạo socket và fetch dữ liệu ban đầu
  useEffect(() => {
    if (stockCodes.length > 0) {
      fetchStockData();
      startCountdown();

      if (socketConnected) {
        initializeSocket();
      }
    }
  }, [stockCodes, socketConnected]);

  // Khởi tạo socket.io connection
  const initializeSocket = () => {
    if (socketRef.current) {
      StockService.disconnect();
    }

    socketRef.current = StockService.initializeSocket();
    
    // Gửi danh sách mã cổ phiếu
    if (stockCodes.length > 0) {
      StockService.watchStocks(stockCodes);
    }
    
    // Lắng nghe sự kiện nhận dữ liệu
    socketRef.current.on('stock-data', (data) => {
      setStockData(data);
      resetCountdown();
    });
    
    // Lắng nghe sự kiện lỗi
    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    return socketRef.current;
  };

  // Fetch dữ liệu từ API
  const fetchStockData = async () => {
    if (stockCodes.length === 0) return;
    
    const data = await StockService.fetchStockData(stockCodes);
    setStockData(data);
    resetCountdown();
  };

  // Lưu stockCodes vào localStorage
  const saveStockCodes = (codes) => {
    localStorage.setItem('minimalStockCodes', JSON.stringify(codes));
  };

  // Lưu favoriteStocks vào localStorage
  const saveFavoriteStocks = (favorites) => {
    localStorage.setItem('minimalFavoriteStocks', JSON.stringify(favorites));
  };

  // Thêm mã cổ phiếu mới
  const addStockCode = (code, isFavorite = false) => {
    code = code.trim().toUpperCase();
    if (!code) return;
    
    let updatedCodes = [...stockCodes];
    let updatedFavorites = [...favoriteStocks];
    
    // Kiểm tra mã đã tồn tại chưa
    if (!updatedCodes.includes(code)) {
      updatedCodes.push(code);
      setStockCodes(updatedCodes);
      saveStockCodes(updatedCodes);
      
      // Thêm vào favorites nếu được chọn
      if (isFavorite) {
        updatedFavorites.push(code);
        setFavoriteStocks(updatedFavorites);
        saveFavoriteStocks(updatedFavorites);
      }
      
      // Fetch dữ liệu ngay lập tức
      fetchStockData();
    } else if (isFavorite && !favoriteStocks.includes(code)) {
      // Nếu mã đã tồn tại nhưng cần thêm vào favorites
      updatedFavorites.push(code);
      setFavoriteStocks(updatedFavorites);
      saveFavoriteStocks(updatedFavorites);
    }
  };

  // Xóa mã cổ phiếu
  const removeStockCode = (code, fromFavoritesOnly = false) => {
    if (fromFavoritesOnly) {
      // Chỉ xóa khỏi favorites
      const updatedFavorites = favoriteStocks.filter(item => item !== code);
      setFavoriteStocks(updatedFavorites);
      saveFavoriteStocks(updatedFavorites);
    } else {
      // Xóa hoàn toàn
      const updatedCodes = stockCodes.filter(item => item !== code);
      setStockCodes(updatedCodes);
      saveStockCodes(updatedCodes);
      
      // Cũng xóa khỏi favorites nếu có
      if (favoriteStocks.includes(code)) {
        const updatedFavorites = favoriteStocks.filter(item => item !== code);
        setFavoriteStocks(updatedFavorites);
        saveFavoriteStocks(updatedFavorites);
      }
      
      // Nếu không còn mã nào, dừng countdown
      if (updatedCodes.length === 0) {
        stopCountdown();
      } else {
        // Cập nhật dữ liệu ngay lập tức
        fetchStockData();
      }
    }
  };

  // Toggle yêu thích
  const toggleFavorite = (code, fromFavoritesOnly = false) => {
    if (fromFavoritesOnly) {
      // Xóa khỏi favorites
      const updatedFavorites = favoriteStocks.filter(item => item !== code);
      setFavoriteStocks(updatedFavorites);
      saveFavoriteStocks(updatedFavorites);
    } else {
      if (!stockCodes.includes(code)) return;
      
      let updatedFavorites = [...favoriteStocks];
      
      if (favoriteStocks.includes(code)) {
        // Xóa khỏi favorites
        updatedFavorites = updatedFavorites.filter(item => item !== code);
      } else {
        // Thêm vào favorites
        updatedFavorites.push(code);
      }
      
      setFavoriteStocks(updatedFavorites);
      saveFavoriteStocks(updatedFavorites);
    }
  };

  // Reset countdown
  const resetCountdown = () => {
    setCountdown(5);
  };

  // Bắt đầu countdown
  const startCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
    
    setCountdown(5);
    
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Reset countdown
          if (!socketConnected) {
            fetchStockData();
          }
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Dừng countdown
  const stopCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  // Toggle socket connection
  const toggleSocketConnection = () => {
    if (socketConnected) {
      // Ngắt kết nối socket
      StockService.disconnect();
      socketRef.current = null;
    } else {
      // Kết nối lại socket
      if (stockCodes.length > 0) {
        initializeSocket();
      }
    }
    
    setSocketConnected(!socketConnected);
  };

  // Xử lý clear tất cả
  const handleClearAll = () => {
    if (stockCodes.length === 0) return;
    
    if (window.confirm('Are you sure you want to remove all stocks?')) {
      setStockCodes([]);
      setFavoriteStocks([]);
      saveStockCodes([]);
      saveFavoriteStocks([]);
      stopCountdown();
      setSettingsPanelVisible(false);
    }
  };

  // Xử lý clear favorites
  const handleClearFavorites = () => {
    if (favoriteStocks.length === 0) return;
    
    if (window.confirm('Are you sure you want to remove all favorite stocks?')) {
      setFavoriteStocks([]);
      saveFavoriteStocks([]);
      setSettingsPanelVisible(false);
    }
  };

  // Chuyển đến full view
  const handleGoToFullView = () => {
    window.location.href = '/';
  };

  // Cập nhật vị trí container trong viewport
  const positionContainerInView = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Nếu ra khỏi viewport, đặt lại vị trí
    if (rect.right > viewportWidth || rect.left < 0 || rect.bottom > viewportHeight || rect.top < 0) {
      containerRef.current.style.left = Math.max(0, (viewportWidth - rect.width) / 2) + 'px';
      containerRef.current.style.top = Math.max(0, (viewportHeight - rect.height) / 2) + 'px';
    }
  };

  // Mouse events cho việc kéo thả container
  const handleMouseDown = (e) => {
    // Chỉ cho phép kéo từ header hoặc vùng trống
    if (e.target === containerRef.current || 
        e.target.classList.contains('mini-line-header') || 
        e.target.classList.contains('mini-line-content') || 
        e.target.classList.contains('mini-line-footer')) {
      draggingRef.current = true;
      offsetRef.current = {
        x: e.clientX - containerRef.current.getBoundingClientRect().left,
        y: e.clientY - containerRef.current.getBoundingClientRect().top
      };
    }
  };

  // Xử lý mouseup - dừng kéo thả
  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  // Xử lý mousemove - cập nhật vị trí khi kéo
  const handleMouseMove = (e) => {
    if (!draggingRef.current) return;
    
    const newLeft = e.clientX - offsetRef.current.x;
    const newTop = e.clientY - offsetRef.current.y;
    
    // Giới hạn vị trí trong viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;
    
    const boundedLeft = Math.max(0, Math.min(newLeft, viewportWidth - containerWidth));
    const boundedTop = Math.max(0, Math.min(newTop, viewportHeight - containerHeight));
    
    containerRef.current.style.left = `${boundedLeft}px`;
    containerRef.current.style.top = `${boundedTop}px`;
  };

  // Thêm event listeners cho kéo thả
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Lọc dữ liệu cổ phiếu theo tab hiện tại
  const getStockDataForActiveTab = () => {
    if (!stockData || !stockData.data) return [];
    
    if (activeTab === 'favorite') {
      return stockData.data.filter(stock => 
        favoriteStocks.some(code => code.toUpperCase() === stock.code.toUpperCase())
      );
    }
    
    return stockData.data;
  };

  return (
    <>
      <div 
        className="mini-line-container"
        ref={containerRef}
        onMouseDown={handleMouseDown}
      >
        {/* Header with tabs and settings button */}
        <div className="mini-line-header">
          <div className="tab-menu">
            <button 
              className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button 
              className={`tab-button ${activeTab === 'favorite' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorite')}
            >
              Fav
            </button>
          </div>
          <div className="controls">
            <button 
              id="addStockBtn" 
              className="control-button" 
              title="Add Stock"
              onClick={() => {
                setAddPanelVisible(true);
                setSettingsPanelVisible(false);
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <button 
              id="settingsBtn" 
              className="control-button" 
              title="Settings"
              onClick={() => {
                setSettingsPanelVisible(true);
                setAddPanelVisible(false);
              }}
            >
              <FontAwesomeIcon icon={faCog} />
            </button>
          </div>
        </div>
        
        {/* Stock list content - vertical layout */}
        <div className="mini-line-content">
          <div className={`stocks-line ${activeTab !== 'all' ? 'hidden' : ''}`} id="allStocksLine">
            {stockCodes.length === 0 ? (
              <div className="empty-message">No stocks</div>
            ) : (
              stockData.data?.filter(stock => 
                stockCodes.some(code => stock.code.toUpperCase().includes(code.toUpperCase()))
              ).map(stock => (
                <StockItem 
                  key={stock.code}
                  stock={stock}
                  isFavorite={favoriteStocks.includes(stock.code)}
                  onToggleFavorite={toggleFavorite}
                  onRemove={removeStockCode}
                />
              ))
            )}
          </div>
          
          <div className={`stocks-line ${activeTab !== 'favorite' ? 'hidden' : ''}`} id="favoriteStocksLine">
            {favoriteStocks.length === 0 ? (
              <div className="empty-message">No favorites</div>
            ) : (
              stockData.data?.filter(stock => 
                favoriteStocks.some(code => stock.code.toUpperCase().includes(code.toUpperCase()))
              ).map(stock => (
                <StockItem 
                  key={stock.code}
                  stock={stock}
                  isFavorite={true}
                  onToggleFavorite={toggleFavorite}
                  onRemove={removeStockCode}
                  fromFavoritesOnly={true}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Footer with auto-update controls */}
        <div className="mini-line-footer">
          <div className="form-check form-switch">
            <input 
              className="form-check-input" 
              type="checkbox" 
              id="socketToggle" 
              checked={socketConnected}
              onChange={toggleSocketConnection}
            />
            <span className="status-text">Auto</span>
          </div>
          <div className="refresh-controls">
            <button 
              id="refreshBtn" 
              className="control-button refresh-button" 
              title="Refresh"
              onClick={fetchStockData}
            >
              <FontAwesomeIcon icon={faSyncAlt} />
            </button>
            <span className="mini-clock" id="refreshCountdown">
              {stockCodes.length === 0 ? '-' : countdown}
            </span>
          </div>
        </div>
        
        {/* Floating panels */}
        <AddStockPanel 
          isVisible={addPanelVisible}
          onClose={() => setAddPanelVisible(false)}
          onAddStock={addStockCode}
        />
        
        <SettingsPanel 
          isVisible={settingsPanelVisible}
          onClose={() => setSettingsPanelVisible(false)}
          onClearAll={handleClearAll}
          onClearFavorites={handleClearFavorites}
          onGoToFullView={handleGoToFullView}
        />
      </div>
    </>
  );
};

export default MinimalStockWatch;
