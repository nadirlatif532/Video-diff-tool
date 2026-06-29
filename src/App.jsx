import { useState } from 'react';
import { Menu, Settings, Swords, Activity, HelpCircle, X } from 'lucide-react';
import VideoDiffTool from './modules/VideoDiffTool';
import ScreenShakeTool from './modules/ScreenShakeTool';
import './index.css';

const TUTORIALS = {
  'video-diff': {
    title: 'Video Diff Tool Tutorial',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
        <p><strong style={{ color: 'var(--text-main)' }}>1. Load Videos:</strong> Drop a base video and an iteration video into the two slots.</p>
        <p><strong style={{ color: 'var(--text-main)' }}>2. Sync Timelines:</strong> Use the green trim sliders to set the exact start frame for each video so they play perfectly in sync.</p>
        <p><strong style={{ color: 'var(--text-main)' }}>3. Frame Subject:</strong> Use Pan X/Y to keep the combat subject centered if the cameras differ.</p>
        <p><strong style={{ color: 'var(--text-main)' }}>4. Export:</strong> Hit Export Horizontal or Vertical to stitch them into a single MP4 for easy sharing.</p>
      </div>
    )
  },
  'screenshake': {
    title: 'Screenshake Synth Tutorial',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
        <p><strong style={{ color: 'var(--text-main)' }}>1. Load Preset:</strong> Start with a preset like "Heavy Melee Impact" instead of building from zero.</p>
        <p><strong style={{ color: 'var(--text-main)' }}>2. Live Loop:</strong> Pause your background video on the impact frame and hit "Enable Live Loop". The screen will shake continuously.</p>
        <p><strong style={{ color: 'var(--text-main)' }}>3. Master Graph:</strong> Select an axis (like Pitch) and drag your mouse directly on the graph (Up/Down for Amplitude, Left/Right for Frequency).</p>
        <p><strong style={{ color: 'var(--text-main)' }}>4. Solo & Mute:</strong> Use the [Solo] and [Mute] buttons to isolate exactly what one specific axis feels like, or to hide an axis.</p>
      </div>
    )
  }
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeModule, setActiveModule] = useState('screenshake');
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu size={24} />
          </button>
          {sidebarOpen && <h2>Combat Toolkit</h2>}
        </div>
        
        <nav style={{ flex: 1, padding: '16px 0' }}>
          <button 
            className={`nav-item ${activeModule === 'video-diff' ? 'active' : ''}`}
            onClick={() => setActiveModule('video-diff')}
          >
            <Swords size={20} />
            {sidebarOpen && <span>Video Diff Tool</span>}
          </button>
          
          <button 
            className={`nav-item ${activeModule === 'screenshake' ? 'active' : ''}`}
            onClick={() => setActiveModule('screenshake')}
          >
            <Activity size={20} />
            {sidebarOpen && <span>Screenshake Synth</span>}
          </button>
          
          <button 
            className={`nav-item ${activeModule === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveModule('settings')}
          >
            <Settings size={20} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </nav>
      </aside>

      <main className="main-content">
        <div style={{ position: 'absolute', top: '24px', right: '40px', zIndex: 100 }}>
          {TUTORIALS[activeModule] && (
            <button className="btn" onClick={() => setShowTutorial(true)}>
              <HelpCircle size={18} /> Tutorial
            </button>
          )}
        </div>

        {showTutorial && TUTORIALS[activeModule] && (
          <div className="modal-overlay" onClick={() => setShowTutorial(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <button className="icon-btn modal-close" onClick={() => setShowTutorial(false)}><X size={24} /></button>
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>{TUTORIALS[activeModule].title}</h2>
              {TUTORIALS[activeModule].content}
            </div>
          </div>
        )}

        {activeModule === 'video-diff' && <VideoDiffTool />}
        {activeModule === 'screenshake' && <ScreenShakeTool />}
        {activeModule === 'settings' && (
          <div className="app-container">
            <div className="glass-panel">
              <h2>Settings</h2>
              <p className="subtitle">Module settings will go here.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
