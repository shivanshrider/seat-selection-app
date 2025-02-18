import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Seat from '../Seat';
import SeatSummary from '../SeatSummary';
import './styles.css';

// Create socket connection with error handling
let socket;
try {
  socket = io('http://localhost:3001', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });
} catch (error) {
  console.error('Socket connection error:', error);
}

const userId = Math.random().toString(36).substr(2, 9); // Generate random user ID (use actual auth in production)

const SeatSelection = () => {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  // Define all rows together, but limit side sections to 13 rows
  const rowsData = Array.from({ length: 14 }, (_, rowIndex) => {
    const rowNum = rowIndex + 1;
    return {
      leftSide: rowNum <= 13 ? {
        row: `L${rowNum}`,
        seats: 6,
        format: (index) => `L${rowNum}-${index}`
      } : null,
      middle: {
        row: `${rowNum}`,
        seats: rowNum % 2 === 0 ? 16 : 15,
        format: (index) => `${rowNum}-${index}`
      },
      rightSide: rowNum <= 13 ? {
        row: `R${rowNum}`,
        seats: 6,
        format: (index) => `R${rowNum}-${index}`
      } : null
    };
  });

  const frontSection = [
    { row: 'A', seats: 23, format: (index) => `A${index}` },
    { row: 'B', seats: 24, format: (index) => `B${index}` },
    { row: 'C', seats: 25, format: (index) => `C${index}` },
    { row: 'D', seats: 26, format: (index) => `D${index}` },
    { row: 'E', seats: 25, format: (index) => `E${index}` },
    { row: 'F', seats: 16, format: (index) => `F${index}` },
  ];

  const totalSeats = frontSection.reduce((total, row) => total + row.seats, 0) +
    rowsData.reduce((total, row) => {
      return total + 
        (row.leftSide ? row.leftSide.seats : 0) + 
        row.middle.seats + 
        (row.rightSide ? row.rightSide.seats : 0);
    }, 0);

  // Initialize socket connection and event listeners
  useEffect(() => {
    if (!socket) {
      setConnectionError(true);
      setLoading(false);
      return;
    }

    // Handle connection events
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnectionError(false);
      // Request initial seat data
      socket.emit('getSeatStatus');
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError(true);
      setLoading(false);
    });

    // Handle initial seat status
    socket.on('initializeSeats', ({ selectedSeats, occupiedSeats }) => {
      setSelectedSeats(selectedSeats);
      setOccupiedSeats(occupiedSeats);
      setLoading(false);
    });

    // Handle real-time updates
    socket.on('seatUpdated', ({ selectedSeats, occupiedSeats }) => {
      setSelectedSeats(selectedSeats);
      setOccupiedSeats(occupiedSeats);
    });

    // Handle errors
    socket.on('seatError', ({ seatId, message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    // Handle booking confirmation
    socket.on('bookingConfirmed', ({ seats }) => {
      console.log('Booking confirmed for seats:', seats);
      // Handle successful booking (e.g., show confirmation message, redirect)
    });

    // Handle booking errors
    socket.on('bookingError', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('initializeSeats');
      socket.off('seatUpdated');
      socket.off('seatError');
      socket.off('bookingConfirmed');
      socket.off('bookingError');
    };
  }, []);

  const handleSeatSelect = useCallback((seatId) => {
    socket.emit('selectSeat', { seatId, userId });
  }, []);

  const handleConfirmBooking = useCallback(() => {
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat');
      return;
    }
    socket.emit('confirmSeats', { seats: selectedSeats, userId });
  }, [selectedSeats]);

  const renderRow = (rowData) => {
    const renderSeats = (section) => {
      if (!section) return null;
      return (
        <div className="theater__seats-container">
          {[...Array(section.seats)].map((_, index) => {
            const seatId = section.format(index + 1);
            return (
              <Seat
                key={seatId}
                id={seatId}
                isSelected={selectedSeats.includes(seatId)}
                onSelect={handleSeatSelect}
              />
            );
          })}
        </div>
      );
    };

    return (
      <div className="theater__combined-row" key={rowData.middle.row}>
        <div className="theater__side-section left">
          {rowData.leftSide && (
            <>
              <div className="theater__row-label">{rowData.leftSide.row}</div>
              {renderSeats(rowData.leftSide)}
            </>
          )}
        </div>
        <div className="theater__middle-section">
          <div className="theater__row-label">{rowData.middle.row}</div>
          {renderSeats(rowData.middle)}
        </div>
        <div className="theater__side-section right">
          {rowData.rightSide && (
            <>
              <div className="theater__row-label">{rowData.rightSide.row}</div>
              {renderSeats(rowData.rightSide)}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="theater__seating">
      {connectionError ? (
        <div className="theater__error">
          Unable to connect to server. Please refresh the page or try again later.
        </div>
      ) : loading ? (
        <div className="theater__loading">
          <div className="theater__loading-spinner"></div>
          <div className="theater__loading-text">Loading seating arrangement...</div>
        </div>
      ) : (
        <>
          <SeatSummary 
            selectedSeats={selectedSeats}
            occupiedSeats={occupiedSeats}
            totalSeats={totalSeats}
          />
          
          {error && (
            <div className="theater__error">
              {error}
            </div>
          )}

          <div className="theater__section">
            <h2 className="theater__section-title">Front Section</h2>
            <div className="theater__grid">
              {frontSection.map(row => (
                <div key={row.row} className="theater__row">
                  <div className="theater__row-label">{row.row}</div>
                  <div className="theater__seats-container">
                    {[...Array(row.seats)].map((_, index) => {
                      const seatId = row.format(index + 1);
                      return (
                        <Seat
                          key={seatId}
                          id={seatId}
                          isSelected={selectedSeats.includes(seatId)}
                          onSelect={handleSeatSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="theater__section">
            <h2 className="theater__section-title">Main Seating Area</h2>
            <div className="theater__grid">
              {rowsData.map(renderRow)}
            </div>
          </div>
          
          {selectedSeats.length > 0 && (
            <div className="theater__booking">
              <button 
                className="theater__confirm-button"
                onClick={handleConfirmBooking}
              >
                Confirm Booking
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SeatSelection;