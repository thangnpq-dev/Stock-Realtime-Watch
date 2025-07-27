import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const SettingsPanel = ({ isVisible, onClose, onClearAll, onClearFavorites, onGoToFullView }) => {
  if (!isVisible) return null;

  return (
    <div className="panel" id="settingsPanel">
      <div className="panel-header">
        <h5>Settings</h5>
        <button className="close-button" onClick={onClose}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <div className="panel-body">
        <button className="btn-danger mb-2" onClick={onClearAll}>
          Clear All
        </button>
        <button className="btn-warning mb-2" onClick={onClearFavorites}>
          Clear Favorites
        </button>
        <button className="btn-secondary" onClick={onGoToFullView}>
          Full View
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
