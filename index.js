// This file is the entry point for Expo
// Electron uses electron/main.js instead
import { registerRootComponent } from 'expo';
import App from './src/app/index';
import { registerWidgets } from './src/widgets';

// Registrar widgets nativos de Android
registerWidgets();

registerRootComponent(App);
