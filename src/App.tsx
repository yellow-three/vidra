import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import Home from './pages/Home';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Convert from './pages/Convert';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/convert" element={<Convert />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
