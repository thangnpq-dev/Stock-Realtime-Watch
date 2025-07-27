import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faTimes } from '@fortawesome/free-solid-svg-icons';

const StockItem = ({ 
  stock, 
  isFavorite, 
  onToggleFavorite, 
  onRemove, 
  fromFavoritesOnly = false 
}) => {
  // Xác định trạng thái của cổ phiếu (tăng, giảm, kịch trần, sàn...)
  const determineChangeClass = () => {
    if (!stock) return 'unchanged';
    
    // Nếu không có thay đổi hoặc stock.change trống
    if (!stock.change || stock.change === "") {
      return 'reference';
    }

    const change = parseFloat(stock.change);
    const percentValue = parseFloat(stock.percentChange?.replace('%', '') || "0");
    
    if (change > 0) {
      // Kịch trần (>= 6.7%)
      if (percentValue >= 6.7) {
        return 'ceiling';
      }
      return 'up';
    } else if (change < 0) {
      // Kịch sàn (<= -6.7%)
      if (percentValue <= -6.7) {
        return 'floor';
      }
      return 'down';
    } else if (change === 0 || Math.abs(change) < 0.01) {
      return 'reference';
    }
    
    return 'unchanged';
  };

  const changeClass = determineChangeClass();
  const changeSign = stock && parseFloat(stock.change) > 0 ? '+' : '';
  const changeText = stock && stock.change 
    ? `${changeSign}${stock.change} (${stock.percentChange})`
    : '+0.00 (0.00%)';
    
  const price = stock?.price || '--.--';
  const code = stock?.code || '';

  return (
    <div className={`stock-item ${changeClass}`} data-code={code}>
      <div className="stock-code">{code}</div>
      <div className="stock-data">
        <span className="price">{price}</span>
        <span className={`change ${changeClass}`}>{changeText}</span>
      </div>
      <div className="stock-actions">
        <button 
          className={`action-btn ${fromFavoritesOnly ? 'unfavorite-btn' : isFavorite ? 'favorite-btn active' : 'favorite-btn'}`}
          onClick={() => onToggleFavorite(code, fromFavoritesOnly)}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <FontAwesomeIcon icon={faStar} />
        </button>
        <button 
          className="action-btn remove-btn" 
          onClick={() => onRemove(code, fromFavoritesOnly)}
          title="Remove"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    </div>
  );
};

export default StockItem;
