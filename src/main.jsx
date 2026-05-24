// © 2026 Rudraksh Singh Tomar. All rights reserved.
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

const loading = document.getElementById('loading');
if (loading) loading.style.display = 'none';
createRoot(document.getElementById('root')).render(<App />);
