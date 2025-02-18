import React from 'react';
import './styles.css';

const SeatSummary = ({ selectedSeats, totalSeats }) => {
  const availableSeats = totalSeats - selectedSeats.length;

  return (
    <div className="seat-summary">
      <div className="seat-summary__item">
        <div className="seat-summary__count available">{availableSeats}</div>
        <span>Available</span>
      </div>
      <div className="seat-summary__item">
        <div className="seat-summary__count selected">{selectedSeats.length}</div>
        <span>Selected</span>
      </div>
    </div>
  );
};

export default SeatSummary; 