import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ChatPage from './pages/ChatPage'; // 占位，后续实现

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/chat/:id" element={<ChatPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);
