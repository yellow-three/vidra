import { QueryClient } from '@tanstack/react-query';

// Veriler yerel (Tauri backend / SQLite); ag tekrar denemeleri ve pencere odaginda yenileme gereksiz.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
  },
});
