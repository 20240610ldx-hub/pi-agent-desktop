import React from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from '../hooks/useI18n';
import {SettingsPanel} from '../components/SettingsPanel';
import {THEME_INIT_SCRIPT} from '../lib/theme';

window.eval(THEME_INIT_SCRIPT);
document.documentElement.dataset.platform = 'windows';
createRoot(document.getElementById('root')).render(<I18nProvider>
  <div className="app-shell" style={{height:'100dvh'}}>
    <SettingsPanel cwd="D:/fixture" sessionId={null}
      initialSection={new URLSearchParams(location.search).get('section') || 'general'}
      onClose={()=>{}} onSessionReloaded={()=>{}} quoteSelectionEnabled
      onQuoteSelectionChange={()=>{}} soundEnabled={false} onSoundToggle={()=>{}}/>
  </div>
</I18nProvider>);
