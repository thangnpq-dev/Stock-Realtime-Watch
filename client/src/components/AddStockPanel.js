import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const AddStockPanel = ({ isVisible, onClose, onAddStock }) => {
  const [stockCode, setStockCode] = useState('');
  const [addToFavorite, setAddToFavorite] = useState(false);
  const inputRef = useRef(null);

  // Focus input when panel becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (stockCode.trim()) {
      onAddStock(stockCode.trim(), addToFavorite);
      setStockCode('');
      setAddToFavorite(false);
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="panel" id="addStockPanel">
      <div className="panel-header">
        <h5>Add Stock</h5>
        <button className="close-button" onClick={onClose} aria-label="Close">
          <FontAwesomeIcon icon={faTimes} size="sm" />
        </button>
      </div>
      <div className="panel-body">
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Enter stock code"
            value={stockCode}
            onChange={(e) => setStockCode(e.target.value.toUpperCase())}
            ref={inputRef}
            autoComplete="off"
          />
          <div className="form-check mt-2">
            <input 
              className="form-check-input" 
              type="checkbox" 
              id="addToFavorite"
              checked={addToFavorite}
              onChange={(e) => setAddToFavorite(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="addToFavorite">
              Add to favorites
            </label>
          </div>
          <button type="submit" className="btn-primary mt-2">Add</button>
        </form>
      </div>
    </div>
  );
};

export default AddStockPanel;
