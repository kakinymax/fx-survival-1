import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { handleBack } from './navigation.js';

globalThis.FX_SURVIVAL_BUILD = Object.freeze({ kind: 'mobile-prototype' });
document.documentElement.classList.add('mobile-prototype');

// Android Back dismisses overlays or returns from statistics. It never walks
// through previous secret-order screens or changes game state.
if (Capacitor.isNativePlatform()) {
  await App.addListener('backButton', () => handleBack({ document, location, minimize: () => App.minimizeApp() }));
}

await import('../dist/app.js');
