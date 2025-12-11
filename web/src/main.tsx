import React from 'react';
import ReactDOM from 'react-dom/client';
import { VisibilityProvider } from './providers/VisibilityProvider';
import { MantineProvider } from '@mantine/core';
import App from './components/App';
import '@mantine/core/styles.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider
      withCssVariables={true}
      forceColorScheme='dark'>
      <VisibilityProvider componentName='App'>
        <App />
      </VisibilityProvider>
    </MantineProvider>
  </React.StrictMode>,
);
