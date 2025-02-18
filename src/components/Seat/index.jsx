import React from 'react';
import './styles.css';

const Seat = ({ id, isSelected, onSelect }) => {
  const seatClass = `theater__seat ${
    isSelected ? 'theater__seat--selected' : 'theater__seat--available'
  }`;

  return (
    <button 
      className={seatClass}
      onClick={() => onSelect(id)}
      aria-label={`Seat ${id} ${isSelected ? 'selected' : 'available'}`}
      title={`Seat ${id}`}
    >
      <span className="theater__seat-number">{id}</span>
    </button>
  );
};

export default Seat;