import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { handleBack } from './navigation.js';
import { createLocalRepository } from './local-records.js';
import { createLocalApi } from './local-api.js';
import { installMobileViewport } from './viewport.js';

globalThis.FX_SURVIVAL_BUILD = Object.freeze({ kind: 'mobile-local',
  apiFetch: createLocalApi({ repository: createLocalRepository() }) });
document.documentElement.classList.add('mobile-prototype');
installMobileViewport(window, document.documentElement);

// Android Back dismisses overlays or returns from statistics. It never walks
// through previous secret-order screens or changes game state.
if (Capacitor.isNativePlatform()) {
  await App.addListener('backButton', () => handleBack({ document, location, minimize: () => App.minimizeApp() }));
}

await import('../dist/app.js');
