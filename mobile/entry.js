import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { handleBack } from './navigation.js';
import { createLocalRepository } from './local-records.js';
import { createLocalApi } from './local-api.js';
import { installMobileViewport } from './viewport.js';
import { installHeaderGestures } from './header-gestures.js';

globalThis.FX_SURVIVAL_BUILD = Object.freeze({ kind: 'mobile-local',
  apiFetch: createLocalApi({ repository: createLocalRepository() }) });
document.documentElement.classList.add('mobile-prototype');
installMobileViewport(window, document.documentElement);
installHeaderGestures(document.querySelector('body > header'));

// Android Back dismisses overlays or returns from statistics. It never walks
// through previous secret-order screens or changes game state.
if (Capacitor.isNativePlatform()) {
  await App.addListener('backButton', () => handleBack({ document, location, minimize: () => App.minimizeApp() }));
}

await import('../dist/app.js');
