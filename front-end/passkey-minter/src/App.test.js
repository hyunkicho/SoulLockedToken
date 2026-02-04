// src/App.js
import React from 'react';
import PasskeyFullTest from './passkeyFullTest'; // ✅ 새로운 컴포넌트 import
import './App.css';

function App() {
  return (
      <div className="App">
        <header className="App-header">
          <PasskeyFullTest /> {/* ✅ 이것만 남깁니다 */}
        </header>
      </div>
  );
}

export default App;