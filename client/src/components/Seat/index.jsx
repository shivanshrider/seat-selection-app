import React from 'react';
import './styles.css';

const Seat = ({ id, isSelected, isOccupied, onSelect }) => {
  const handleClick = () => {
    if (!isOccupied) {
      onSelect(id);
    }
  };

  const className = `theater__seat ${
    isSelected ? 'theater__seat--selected' : 
    isOccupied ? 'theater__seat--occupied' : 
    'theater__seat--available'
  }`;

  return (
    <button 
      className={className}
      onClick={handleClick}
      disabled={isOccupied}
    >
      <span className="theater__seat-number">{id}</span>
    </button>
  );
};

export default Seat; 