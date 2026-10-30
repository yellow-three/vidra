import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './MainLayout';
import LegalNotice from './LegalNotice';
import SetupScreen from '../features/setup/SetupScreen';
import QueuePage from '../features/queue/QueuePage';
import HistoryPage from '../features/history/HistoryPage';
import SettingsPage from '../features/settings/SettingsPage';
import ConvertPage from '../features/convert/ConvertPage';
import SubscriptionsPage from '../features/subscriptions/SubscriptionsPage';
import { startApp } from '../features/queue/bootstrap';
import { detectLanguage, setLanguage } from '../i18n';
import { useSettings } from '../features/settings/queries';

/** Ayarlardaki dil secimini uygular; ayarlar gelene kadar sistem dili kullanilir. */
function useLanguageSetting() {
  const language = useSettings().data?.language;
  useEffect(() => {
    setLanguage(language);
    document.documentElement.lang = language ?? detectLanguage();
  }, [language]);
}

export default function App() {
  useEffect(startApp, []);
  useLanguageSetting();

  return (
    <BrowserRouter>
      <LegalNotice />
      <SetupScreen />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<QueuePage />} />
          <Route path="/downloads" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/convert" element={<ConvertPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
