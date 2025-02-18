import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Seat from '../Seat';
import './styles.css';

const socket = io('http://YOUR_LOCAL_IP:3001');
const userId = Math.random().toString(36).substr(2, 9);

const SeatSelection = () => {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Update front section layout with optimized spacing
  const frontSection = [
    { row: 'A', seats: 23, offset: 0 },
    { row: 'B', seats: 24, offset: 0.3 },
    { row: 'C', seats: 25, offset: 0.6 },
    { row: 'D', seats: 26, offset: 0.9 },
    { row: 'E', seats: 25, offset: 0.6 },
    { row: 'F', seats: 16, offset: 0 }
  ];

  // Update main section configuration for aligned rows
  const mainSection = Array.from({ length: 14 }, (_, i) => ({
    row: i + 1,
    leftSide: i < 13 ? { prefix: 'L', seats: 6 } : null,  // L1-L13
    middle: { 
      row: i + 15,  // Rows 15-28
      seats: i % 2 === 0 ? 15 : 16  // Alternate between 15 and 16
    },
    rightSide: i < 13 ? { prefix: 'R', seats: 6 } : null  // R1-R13
  }));

  // Constants for seat counts
  const FRONT_SECTION_TOTAL = 139;
  const MAIN_SECTION_SIDE_TOTAL = 13 * (6 + 6); // 13 rows × (6 left + 6 right)
  const MAIN_SECTION_MIDDLE_TOTAL = 7 * 15 + 7 * 16; // 7 rows of 15 + 7 rows of 16
  const MAIN_SECTION_TOTAL = MAIN_SECTION_SIDE_TOTAL + MAIN_SECTION_MIDDLE_TOTAL;
  const TOTAL_SEATS = FRONT_SECTION_TOTAL + MAIN_SECTION_TOTAL;

  useEffect(() => {
    // Add connection event handlers
    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setLoading(false);
    });

    socket.on('initializeSeats', (data) => {
      console.log('Received initial seat data:', data);
      setSelectedSeats(data.selectedSeats);
      setOccupiedSeats(data.occupiedSeats);
      setLoading(false);
    });

    socket.on('seatUpdated', (data) => {
      console.log('Received seat update:', data);
      setSelectedSeats(data.selectedSeats);
      setOccupiedSeats(data.occupiedSeats);
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('initializeSeats');
      socket.off('seatUpdated');
    };
  }, []);

  const handleSeatSelect = useCallback((seatId) => {
    socket.emit('selectSeat', { seatId, userId });
  }, []);

  const renderSeat = (seatId) => (
    <Seat
      key={seatId}
      id={seatId}
      isSelected={selectedSeats.includes(seatId)}
      isOccupied={occupiedSeats.includes(seatId)}
      onSelect={handleSeatSelect}
    />
  );

  // Optimize offset calculation
  const calculateOffset = (baseOffset) => {
    const baseSize = 12; // Reduced base offset size
    return `${baseOffset * baseSize}px`;
  };

  return (
    <div className="theater__seating">
      <h1 className="theater__title">PVC Badge Ceremony</h1>
      
      <div className="theater__counter-section">
        <div className="theater__counter-card">
          <div className="theater__counter-value">{TOTAL_SEATS}</div>
          <div className="theater__counter-label">Total Seats</div>
        </div>
        <div className="theater__counter-card">
          <div className="theater__counter-value">{TOTAL_SEATS - occupiedSeats.length}</div>
          <div className="theater__counter-label">Available</div>
        </div>
        <div className="theater__counter-card">
          <div className="theater__counter-value">{selectedSeats.length}</div>
          <div className="theater__counter-label">Selected</div>
        </div>
        <div className="theater__counter-card">
          <div className="theater__counter-value">{occupiedSeats.length}</div>
          <div className="theater__counter-label">Occupied</div>
        </div>
      </div>

      <div className="theater__stage-container">
        <div className="theater__stage">STAGE</div>
      </div>

      {loading ? (
        <div className="theater__loading">
          <div className="theater__loading-spinner"></div>
          <div className="theater__loading-text">Loading seating arrangement...</div>
        </div>
      ) : (
        <>
          {/* Front Section */}
          <div className="theater__section">
            <h2 className="theater__section-title">Front Section</h2>
            <div className="theater__grid">
              {frontSection.map(row => (
                <div key={row.row} className="theater__row">
                  <div className="theater__row-label">{row.row}</div>
                  <div 
                    className="theater__seats-container"
                    style={{ 
                      paddingLeft: calculateOffset(row.offset),
                      transform: `translateX(-${calculateOffset(row.offset/2)})`
                    }}
                  >
                    {Array.from({ length: row.seats }, (_, i) => 
                      renderSeat(`${row.row}${i + 1}`)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Section */}
          <div className="theater__section">
            <h2 className="theater__section-title">Main Section</h2>
            <div className="theater__grid">
              {mainSection.map((row, index) => (
                <div key={index} className="theater__combined-row">
                  {/* Left Side */}
                  {row.leftSide && (
                    <div className="theater__side-section left">
                      <div className="theater__row-label">{`L${index + 1}`}</div>
                      <div className="theater__seats-container">
                        {Array.from({ length: row.leftSide.seats }, (_, i) =>
                          renderSeat(`L${index + 1}-${i + 1}`)
                        )}
                      </div>
                    </div>
                  )}

                  {/* Middle */}
                  <div className="theater__middle-section">
                    <div className="theater__row-label">{row.middle.row}</div>
                    <div className="theater__seats-container">
                      {Array.from({ length: row.middle.seats }, (_, i) =>
                        renderSeat(`${row.middle.row}-${i + 1}`)
                      )}
                    </div>
                  </div>

                  {/* Right Side */}
                  {row.rightSide && (
                    <div className="theater__side-section right">
                      <div className="theater__row-label">{`R${index + 1}`}</div>
                      <div className="theater__seats-container">
                        {Array.from({ length: row.rightSide.seats }, (_, i) =>
                          renderSeat(`R${index + 1}-${i + 1}`)
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      <div className="theater__legend">
        <div className="theater__legend-item">
          <div className="theater__seat theater__seat--available"></div>
          <span>Available</span>
        </div>
        <div className="theater__legend-item">
          <div className="theater__seat theater__seat--selected"></div>
          <span>Selected</span>
        </div>
        <div className="theater__legend-item">
          <div className="theater__seat theater__seat--occupied"></div>
          <span>Occupied</span>
        </div>
      </div>
    </div>
  );
};

export default SeatSelection; 