import React from 'react'
import SeatSelection from './components/SeatSelection'
import './styles.css'

const App = () => {
  return (
    <div className="theater">
      <header className="theater__header">
        <h1>PVC Badge Ceremony</h1>
      </header>
      
      <main className="theater__main">
        <div className="theater__screen">
          <div className="theater__screen-box">
            <p>STAGE</p>
          </div>
        </div>
        
        <SeatSelection />
        
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
      </main>
    </div>
  )
}

export default App