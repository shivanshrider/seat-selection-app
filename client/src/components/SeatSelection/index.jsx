import React, { useState, useEffect, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import './styles.css';

// Create socket instance outside component to prevent multiple connections
const socket = io('https://seat-selection-app.onrender.com', {
  transports: ['websocket', 'polling'], // Allow fallback to polling
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

const SeatSelection = () => {
  const [selectedSeats, setSelectedSeats] = useState(new Set());
  const [occupiedSeats, setOccupiedSeats] = useState(new Map());

  const [lockedSeats, setLockedSeats] = useState(new Map()); // Store seat timers
  const [timeLeft, setTimeLeft] = useState(new Map());
  const [viewedSeats, setViewedSeats] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [userId, setUserId] = useState(() => {
    // Load from localStorage on initial render
    return localStorage.getItem('userId') || null;
  });

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
    // Save to localStorage whenever state changes
    localStorage.setItem('selectedSeats', JSON.stringify([...selectedSeats]));
  }, [selectedSeats]);

  useEffect(() => {
    // Save to localStorage whenever state changes
    localStorage.setItem('occupiedSeats', JSON.stringify([...occupiedSeats]));
  }, [occupiedSeats]);

  useEffect(() => {
    // Save userId to localStorage
    if (userId) {
      localStorage.setItem('userId', userId);
    }
  }, [userId]);

  useEffect(() => {
    function handleConnect() {
      console.log('Connected to server');
      setConnectionStatus('connected');
      setIsLoading(false);
    }

    function handleDisconnect() {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    }

    function handleReconnect() {
      console.log('Reconnecting...');
      setConnectionStatus('reconnecting');
    }

    function handleInitialSeats(seats) {
      console.log('Received initial seats:', seats);
      const occupied = new Map();
      Object.entries(seats).forEach(([seatId, data]) => {
        if (data.status === 'selected') {
          occupied.set(seatId, data.userId);
        }
      });
      setOccupiedSeats(occupied);
      localStorage.setItem('occupiedSeats', JSON.stringify([...occupied]));
      setIsLoading(false);
    }

    function handleSeatUpdate({ seatId, status, userId: seatUserId, timestamp }) {
      console.log(`Seat ${seatId} updated to ${status} by ${seatUserId}`);
      setLastUpdate(new Date().toLocaleTimeString());

      if (status === 'selected') {
        setSelectedSeats(prev => new Set([...prev, seatId]));
        setOccupiedSeats(prev => new Map(prev).set(seatId, seatUserId));

        // Handle timer if needed
        if (timestamp) {
          const endTime = timestamp + 60000;
          setLockedSeats(prev => new Map(prev).set(seatId, endTime));
          
          const timer = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, endTime - now);
            
            setTimeLeft(prev => new Map(prev).set(seatId, remaining));
            
            if (remaining <= 0) {
              clearInterval(timer);
            }
          }, 1000);
        }

        // Add visual feedback
        const seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (seatElement) {
          seatElement.classList.add('theater__seat--updating');
          setTimeout(() => {
            seatElement.classList.remove('theater__seat--updating');
          }, 500);
        }
      } else {
        setSelectedSeats(prev => {
          const newSet = new Set(prev);
          newSet.delete(seatId);
          return newSet;
        });
        setOccupiedSeats(prev => {
          const newOccupied = new Map(prev);
          newOccupied.delete(seatId);
          return newOccupied;
        });
        setLockedSeats(prev => {
          const newLocked = new Map(prev);
          newLocked.delete(seatId);
          return newLocked;
        });
        setTimeLeft(prev => {
          const newTime = new Map(prev);
          newTime.delete(seatId);
          return newTime;
        });
      }
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnect);
    socket.on('initializeSeats', handleInitialSeats);
    socket.on('seatUpdated', handleSeatUpdate);
    socket.on('seatError', ({ seatId, message }) => {
      alert(message);
      setSelectedSeats(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(seatId);
        return newSelected;
      });
    });

    // Add heartbeat response
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Add reconnection handlers
    socket.io.on('reconnect_attempt', () => {
      console.log('Attempting to reconnect...');
      setConnectionStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      console.log('Reconnected successfully!');
      setConnectionStatus('connected');
      // Request fresh data after reconnection
      socket.emit('requestInitialState');
    });

    socket.io.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      setConnectionStatus('error');
    });

    socket.io.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
      setConnectionStatus('failed');
    });

    socket.on('seatLocked', ({ seatId }) => {
      setLockedSeats(prev => new Map(prev).set(seatId, Date.now()));
      alert(`Seat ${seatId} has been locked`);
    });

    // Store user ID when connected
    socket.on('connect', () => {
      const newUserId = socket.id;
      setUserId(newUserId);
      localStorage.setItem('userId', newUserId);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnect);
      socket.off('initializeSeats', handleInitialSeats);
      socket.off('seatUpdated', handleSeatUpdate);
      socket.off('seatError');
      socket.off('seatLocked');
      socket.off("reconnect_attempt");
      socket.off("reconnect");
    };
  }, []);

  useEffect(() => {
    // Cleanup function when component unmounts
    return () => {
      const userSeats = Array.from(occupiedSeats.entries())
        .filter(([_, seatUserId]) => seatUserId === userId)
        .map(([seatId]) => seatId);

      // Release seats held by this user
      userSeats.forEach(seatId => {
        socket.emit('deselectSeat', seatId);
      });
    };
  }, [occupiedSeats, userId]);

  const handleSeatClick = (seatId) => {
    if (occupiedSeats.has(seatId) && occupiedSeats.get(seatId) !== userId) {
      return; // Seat is taken by someone else
    }

    const isSelected = selectedSeats.has(seatId);
    
    if (!isSelected) {
      // Selecting a seat
      socket.emit('updateSeat', {
        seatId,
        status: 'selected',
        userId,
        timestamp: Date.now(),
      });

      setSelectedSeats(prev => {
        const newSelected = new Set(prev);
        newSelected.add(seatId);
        return newSelected;
      });

      setOccupiedSeats(prev => {
        const newOccupied = new Map(prev);
        newOccupied.set(seatId, userId);
        return newOccupied;
      });
    } else {
      // Deselecting a seat
      socket.emit('updateSeat', {
        seatId,
        status: 'available',
        userId,
      });

      setSelectedSeats(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(seatId);
        return newSelected;
      });

      setOccupiedSeats(prev => {
        const newOccupied = new Map(prev);
        newOccupied.delete(seatId);
        return newOccupied;
      });
    }
  };

  const getSeatStatus = useCallback((seatId) => {
    const occupiedByUserId = occupiedSeats.get(seatId);
    if (occupiedByUserId) {
      return occupiedByUserId === userId ? 'selected' : 'occupied';
    }
    return 'available';
  }, [occupiedSeats, userId]);

  const renderSeat = (seatId) => {
    const status = getSeatStatus(seatId);
    const remaining = timeLeft.get(seatId);
    const isLocked = lockedSeats.has(seatId);
    
    return (
      <div className="theater__seat-container" key={seatId}>
        <button
          className={`theater__seat theater__seat--${status} 
            ${selectedSeats.has(seatId) ? 'theater__seat--selected' : ''}
            ${isLocked ? 'theater__seat--locked' : ''}
          `}
          onClick={() => handleSeatClick(seatId)}
          disabled={status === 'occupied' || isLocked}
          data-seat-id={seatId}
        >
          {seatId}
        </button>
        {remaining > 0 && (
          <div className="theater__seat-timer">
            {Math.ceil(remaining / 1000)}s
          </div>
        )}
      </div>
    );
  };

  // Optimize offset calculation
  const calculateOffset = (baseOffset) => {
    const baseSize = 12; // Reduced base offset size
    return `${baseOffset * baseSize}px`;
  };

  const renderFrontSection = () => {
    return (
      <div className="theater__section">
        <h2 className="theater__section-title">FRONT SECTION</h2>
        <div className="theater__grid">
          {frontSection.map(row => (
            <div key={row.row} className="theater__row">
              <span className="theater__row-label">{row.row}</span>
              <div className="theater__seats">
                {Array.from({ length: row.seats }, (_, i) => {
                  const seatId = `${row.row}${i + 1}`;
                  return renderSeat(seatId);
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMainSection = () => {
    // Define row configurations with both gap positions
    const mainSectionConfig = {
      'G': { total: 27, leftGap: 6, middleGap: 21 },
      'H': { total: 28, leftGap: 6, middleGap: 22 },
      'I': { total: 27, leftGap: 6, middleGap: 21 },
      'J': { total: 28, leftGap: 6, middleGap: 22 },
      'K': { total: 27, leftGap: 6, middleGap: 21 },
      'L': { total: 28, leftGap: 6, middleGap: 22 },
      'M': { total: 27, leftGap: 6, middleGap: 21 },
      'N': { total: 28, leftGap: 6, middleGap: 22 },
      'O': { total: 27, leftGap: 6, middleGap: 21 },
      'P': { total: 28, leftGap: 6, middleGap: 22 },
      'Q': { total: 27, leftGap: 6, middleGap: 21 },
      'R': { total: 28, leftGap: 6, middleGap: 22 },
      'S': { total: 27, leftGap: 6, middleGap: 21 },
      'T': { total: 16, leftGap: null, middleGap: null } // T row is centered
    };

    return (
      <div className="theater__section">
        <h2 className="theater__section-title">MAIN SECTION</h2>
        <div className="theater__grid">
          {Object.entries(mainSectionConfig).map(([row, config]) => (
            <div key={row} className="theater__row">
              <span className="theater__row-label">{row}</span>
              <div className="theater__seats">
                {/* First section (before first gap) */}
                {Array.from({ length: config.leftGap || 0 }, (_, i) => {
                  const seatNumber = i + 1;
                  const seatId = `${row}${seatNumber}`;
                  return renderSeat(seatId);
                })}

                {/* First gap (after 6 seats) */}
                {config.leftGap && <div className="theater__seat-gap" />}

                {/* Middle section (between gaps) */}
                {Array.from(
                  { length: config.middleGap ? config.middleGap - config.leftGap : config.total }, 
                  (_, i) => {
                    const seatNumber = (config.leftGap || 0) + i + 1;
                    const seatId = `${row}${seatNumber}`;
                    return renderSeat(seatId);
                  }
                )}

                {/* Second gap (after 21/22 seats) */}
                {config.middleGap && <div className="theater__seat-gap" />}

                {/* Last section */}
                {config.middleGap && Array.from(
                  { length: config.total - config.middleGap }, 
                  (_, i) => {
                    const seatNumber = config.middleGap + i + 1;
                    const seatId = `${row}${seatNumber}`;
                    return renderSeat(seatId);
                  }
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVIPSofas = () => {
    return (
      <div className="theater__vip-section">
        {[1, 2, 3].map(sofaNum => (
          <div key={`sofa-${sofaNum}`} className="theater__vip-sofa">
            <div className="theater__vip-label">Guest</div>
          </div>
        ))}
      </div>
    );
  };

  if (connectionStatus === 'disconnected') {
    return (
      <div className="theater__error">
        <h2>Connection Error</h2>
        <p>Disconnected from server. Please refresh the page.</p>
        <button onClick={() => window.location.reload()}>
          Retry Connection
        </button>
      </div>
    );
  }

  if (connectionStatus === 'reconnecting') {
    return (
      <div className="theater__loading">
        <div className="theater__loading-spinner"></div>
        <p>Reconnecting to server...</p>
      </div>
    );
  }

  return (
    <div className="theater__seating">
      <h1 className="theater__title">PVC BADGE CEREMONY - Seating Arrangement</h1>
      
      <div className="theater__status">
        <div className="theater__connection-status">
          {connectionStatus === 'connected' ? 
            <span className="status-connected">Connected</span> : 
            <span className="status-disconnected">Disconnected</span>
          }
        </div>
        {lastUpdate && <span className="last-update">Last update: {lastUpdate}</span>}
      </div>

      <div className="theater__counter-section">
        <div className="theater__counter-card">
          <div className="theater__counter-value">{TOTAL_SEATS}</div>
          <div className="theater__counter-label">TOTAL SEATS</div>
        </div>
        <div className="theater__counter-card">
          <div className="theater__counter-value">{TOTAL_SEATS - occupiedSeats.size}</div>
          <div className="theater__counter-label">AVAILABLE</div>
        </div>
        <div className="theater__counter-card">
          <div className="theater__counter-value">{selectedSeats.size}</div>
          <div className="theater__counter-label">SELECTED</div>
        </div>
        <div className="theater__counter-card">
          <div className="theater__counter-value">{occupiedSeats.size}</div>
          <div className="theater__counter-label">OCCUPIED</div>
        </div>
      </div>

      <div className="theater__stage-container">
        <div className="theater__stage">STAGE</div>
      </div>

      {renderVIPSofas()}

      {renderFrontSection()}
      {renderMainSection()}

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

      <footer className="theater__footer">
        <p className="theater__credit">
          Designed & Developed by{' '}
          <a 
            href="https://www.linkedin.com/in/shivansh-tiwari-48894924a/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="theater__credit-link"
          >
            Shivansh Tiwari
          </a>
        </p>
      </footer>
    </div>
  );
};

export default SeatSelection; 
