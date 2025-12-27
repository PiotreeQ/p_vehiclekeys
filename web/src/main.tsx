import React from 'react';
import ReactDOM from 'react-dom/client';
import { VisibilityProvider } from './providers/VisibilityProvider';
import { MantineProvider } from '@mantine/core';
import App from './components/App';
import Lockpick from './components/Lockpick';
import Jammer from './components/Jammer';
import Hotwire from './components/Hotwire';
import '@mantine/core/styles.css';
import './index.css';
import { isEnvBrowser } from './utils/misc';

const root = document.querySelector('body');

if (isEnvBrowser()) {
  // https://i.imgur.com/iPTAdYV.png - Night time img
  root!.style.backgroundImage = 'url("https://i.imgur.com/3pzRj9n.png")';
  root!.style.backgroundSize = 'cover';
  root!.style.backgroundRepeat = 'no-repeat';
  root!.style.backgroundPosition = 'center';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider
      withCssVariables={true}
      forceColorScheme='dark'>
      <VisibilityProvider componentName='App'>
        <App />
      </VisibilityProvider>
      <Lockpick />
      <Jammer />
      <Hotwire />
    </MantineProvider>
  </React.StrictMode>,
);
