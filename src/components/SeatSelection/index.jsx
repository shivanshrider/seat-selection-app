import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Seat from '../Seat';
import SeatSummary from '../SeatSummary';
import './styles.css';

// Get the URL from environment variables
const SOCKET_URL = 'https://pvc-badge-ceremony.onrender.com';

const userId = Math.random().toString(36).substr(2, 9); // Generate random user ID (use actual auth in production)

const SeatSelection = () => {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [socket, setSocket] = useState(null);
  
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
    console.log('Attempting to connect to:', SOCKET_URL);
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: false,  // Changed to false
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnectionStatus('connected');
      setSocket(newSocket);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      setConnectionStatus('error');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    // Handle initial seat status
    newSocket.on('initializeSeats', ({ selectedSeats, occupiedSeats }) => {
      setSelectedSeats(selectedSeats);
      setOccupiedSeats(occupiedSeats);
      setLoading(false);
    });

    // Handle real-time updates
    newSocket.on('seatUpdated', ({ seatId, status, userId: updatedBy }) => {
      if (status === 'selected') {
        setOccupiedSeats(prev => [...prev, seatId]);
      } else if (status === 'available') {
        setOccupiedSeats(prev => prev.filter(id => id !== seatId));
        setSelectedSeats(prev => prev.filter(id => id !== seatId));
      }
    });

    // Handle errors
    newSocket.on('seatError', ({ seatId, message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    // Handle booking confirmation
    newSocket.on('bookingConfirmed', ({ seats }) => {
      console.log('Booking confirmed for seats:', seats);
      // Handle successful booking (e.g., show confirmation message, redirect)
    });

    // Handle booking errors
    newSocket.on('bookingError', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      if (newSocket) {
        console.log('Cleaning up socket connection');
        newSocket.close();
      }
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
      {connectionStatus === 'error' ? (
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