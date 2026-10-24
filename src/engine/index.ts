import { DesktopEngine } from './desktop';
import type { DownloadEngine } from './types';

// Android motoru (Kotlin plugin) eklenince platforma gore secilecek.
export const engine: DownloadEngine = new DesktopEngine();

export type * from './types';
