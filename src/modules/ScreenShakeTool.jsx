import { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Square, Upload, Repeat, HelpCircle, XCircle, Pause } from 'lucide-react';
import { createNoise2D } from 'simplex-noise';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import '../index.css';

const AXES = ['pitch', 'yaw', 'roll', 'locX', 'locY', 'locZ', 'fov'];
const AXIS_LABELS = {
  pitch: 'Pitch (Rot X)', yaw: 'Yaw (Rot Y)', roll: 'Roll (Rot Z)',
  locX: 'Loc X (Left/Right)', locY: 'Loc Y (Up/Down)', locZ: 'Loc Z (Fwd/Back)', fov: 'FOV'
};

const TOOLTIPS = {
  duration: 'Total time in seconds the shake effect lasts.',
  blendIn: 'Seconds it takes for the shake to reach full intensity.',
  blendOut: 'Seconds it takes for the shake to fade back to zero.',
  amplitude: 'Intensity / size of the movement on this axis.',
  frequency: 'Speed / tightness of the wave. Higher = faster shaking.',
  initialOffset: 'Starting point of the wave. Random prevents repetition.',
  waveform: 'Sine is smooth oscillation. Perlin is chaotic, jittery noise.',
  pitch: 'Tilts the camera up and down (nodding yes).',
  yaw: 'Tilts the camera left and right (shaking no).',
  roll: 'Spins the camera around its center (like a steering wheel).',
  locX: 'Moves the camera physically left and right.',
  locY: 'Moves the camera physically up and down.',
  locZ: 'Moves the camera physically forward and backward.',
  fov: 'Field of View zoom. Often feels similar to Loc Z.'
};

const DEFAULT_AXIS = { amplitude: 0, frequency: 0, initialOffset: 'Random', waveform: 'Sine Wave', mute: false, solo: false };

const PRESETS = {
  'Default Zero': {
    global: { duration: 1.0, blendIn: 0.1, blendOut: 0.2 },
    axes: {
      pitch: { ...DEFAULT_AXIS }, yaw: { ...DEFAULT_AXIS }, roll: { ...DEFAULT_AXIS },
      locX: { ...DEFAULT_AXIS }, locY: { ...DEFAULT_AXIS }, locZ: { ...DEFAULT_AXIS }, fov: { ...DEFAULT_AXIS }
    }
  },
  'Heavy Melee Impact': {
    global: { duration: 0.3, blendIn: 0.05, blendOut: 0.2 },
    axes: {
      ...AXES.reduce((acc, k) => ({ ...acc, [k]: { ...DEFAULT_AXIS } }), {}),
      pitch: { ...DEFAULT_AXIS, amplitude: 15, frequency: 30, waveform: 'Perlin Noise' },
      locY: { ...DEFAULT_AXIS, amplitude: 20, frequency: 40, waveform: 'Perlin Noise' }
    }
  },
  'Gun Recoil': {
    global: { duration: 0.25, blendIn: 0.02, blendOut: 0.2 },
    axes: {
      ...AXES.reduce((acc, k) => ({ ...acc, [k]: { ...DEFAULT_AXIS } }), {}),
      pitch: { ...DEFAULT_AXIS, amplitude: -10, frequency: 2, initialOffset: 'Zero', waveform: 'Sine Wave' },
      locZ: { ...DEFAULT_AXIS, amplitude: -5, frequency: 4, initialOffset: 'Zero', waveform: 'Sine Wave' }
    }
  },
  'Explosion (Distant)': {
    global: { duration: 2.0, blendIn: 0.3, blendOut: 1.5 },
    axes: {
      ...AXES.reduce((acc, k) => ({ ...acc, [k]: { ...DEFAULT_AXIS } }), {}),
      locY: { ...DEFAULT_AXIS, amplitude: 5, frequency: 15, waveform: 'Sine Wave' },
      fov: { ...DEFAULT_AXIS, amplitude: 2, frequency: 2, initialOffset: 'Zero', waveform: 'Sine Wave' }
    }
  },
  'Continuous Earthquake': {
    global: { duration: 5.0, blendIn: 1.0, blendOut: 1.0 },
    axes: {
      ...AXES.reduce((acc, k) => ({ ...acc, [k]: { ...DEFAULT_AXIS } }), {}),
      locX: { ...DEFAULT_AXIS, amplitude: 8, frequency: 25, waveform: 'Perlin Noise' },
      locY: { ...DEFAULT_AXIS, amplitude: 8, frequency: 20, waveform: 'Perlin Noise' },
      roll: { ...DEFAULT_AXIS, amplitude: 2, frequency: 15, waveform: 'Perlin Noise' }
    }
  }
};

const Tooltip = ({ label, text }) => (
  <span className="tooltip-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    {label} <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
    <span className="tooltip-content">{text}</span>
  </span>
);

const SliderInput = ({ value, onChange, min, max, step }) => (
  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
    <div style={{ flex: 1, padding: '0 8px' }}>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
    </div>
    <input 
      type="number" 
      step={step} 
      value={value} 
      onChange={e => onChange(Number(e.target.value))} 
      style={{ width: '90px', padding: '8px', fontSize: '1rem', boxShadow: 'none' }}
    />
  </div>
);

export default function ScreenShakeTool() {
  const noise2D = useMemo(() => createNoise2D(), []);
  
  const [videoUrl, setVideoUrl] = useState('');
  const [globalParams, setGlobalParams] = useState(PRESETS['Default Zero'].global);
  const [axes, setAxes] = useState(PRESETS['Default Zero'].axes);
  
  const [isLooping, setIsLooping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAxis, setActiveAxis] = useState('pitch');
  const [vuMeters, setVuMeters] = useState({ pitch: 0, yaw: 0, roll: 0, locX: 0, locY: 0, locZ: 0, fov: 0 });

  // Video State
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const videoRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const randomOffsetsRef = useRef({});
  const canvasRef = useRef(null);

  const axesRef = useRef(axes);
  const globalRef = useRef(globalParams);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => { axesRef.current = axes; }, [axes]);
  useEffect(() => { globalRef.current = globalParams; }, [globalParams]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateTime = () => setVideoTime(v.currentTime);
    const updateDuration = () => setVideoDuration(v.duration);
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);

    v.addEventListener('timeupdate', updateTime);
    v.addEventListener('loadedmetadata', updateDuration);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('timeupdate', updateTime);
      v.removeEventListener('loadedmetadata', updateDuration);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [videoUrl]);

  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const handleVideoSeek = (val) => {
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setVideoTime(val);
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) setVideoUrl(URL.createObjectURL(file));
  };

  const handlePreset = (e) => {
    const preset = PRESETS[e.target.value];
    if (preset) {
      setGlobalParams(preset.global);
      setAxes(preset.axes);
    }
  };

  const updateGlobal = (key, val) => setGlobalParams(p => ({ ...p, [key]: Number(val) }));
  const updateAxis = (axis, key, val) => {
    const numVal = (key === 'amplitude' || key === 'frequency') ? Number(val) : val;
    setAxes(p => ({ ...p, [axis]: { ...p[axis], [key]: numVal } }));
  };
  const toggleAxisBool = (axis, key) => setAxes(p => ({ ...p, [axis]: { ...p[axis], [key]: !p[axis][key] } }));
  const zeroAxis = (axis) => setAxes(p => ({ ...p, [axis]: { ...p[axis], amplitude: 0, frequency: 0 } }));

  const evaluateEnvelope = (t, duration, blendIn, blendOut) => {
    if (t < 0 || t > duration) return 0;
    if (t < blendIn && blendIn > 0) return t / blendIn;
    if (t > duration - blendOut && blendOut > 0) return (duration - t) / blendOut;
    return 1.0;
  };

  const triggerShake = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    AXES.forEach(ax => { randomOffsetsRef.current[ax] = Math.random() * 1000; });
    startTimeRef.current = performance.now() / 1000;
    setIsPlaying(true);
    
    const loop = (time) => {
      const currentAxes = axesRef.current;
      const currentGlobal = globalRef.current;
      const looping = isLoopingRef.current;
      const now = time / 1000;
      let t = now - startTimeRef.current;
      
      if (looping) {
        if (t > currentGlobal.duration && currentGlobal.duration > 0) {
          startTimeRef.current = now;
          t = 0;
        }
      } else if (t > currentGlobal.duration) {
        if (videoRef.current) videoRef.current.style.transform = `scale(1.1) translate(0,0) rotateX(0) rotateY(0) rotateZ(0)`;
        setVuMeters({ pitch: 0, yaw: 0, roll: 0, locX: 0, locY: 0, locZ: 0, fov: 0 });
        setIsPlaying(false);
        return;
      }

      const env = evaluateEnvelope(t, currentGlobal.duration, currentGlobal.blendIn, currentGlobal.blendOut);
      const anySolo = AXES.some(k => currentAxes[k].solo);
      
      const res = {};
      const newVu = {};
      
      AXES.forEach(ax => {
        const p = currentAxes[ax];
        let val = 0;
        if (!p.mute && !(anySolo && !p.solo)) {
          const offset = p.initialOffset === 'Random' ? (randomOffsetsRef.current[ax] || 0) : 0;
          const timeScaled = (t * p.frequency) + offset;
          let raw = p.waveform === 'Sine Wave' ? Math.sin(timeScaled * Math.PI * 2) : noise2D(timeScaled, offset);
          val = raw * p.amplitude * env;
        }
        res[ax] = val;
        const amp = Math.abs(p.amplitude);
        newVu[ax] = amp > 0 ? Math.min(1, Math.abs(val) / amp) : 0;
      });

      setVuMeters(newVu);

      if (videoRef.current) {
        const scaleZ = 1.1 + (res.locZ * 0.01) - (res.fov * 0.01);
        videoRef.current.style.transform = `scale(${Math.max(0.1, scaleZ)}) translate(${res.locX}px, ${res.locY}px) rotateX(${res.pitch}deg) rotateY(${res.yaw}deg) rotateZ(${res.roll}deg)`;
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
  };

  const stopShake = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (videoRef.current) videoRef.current.style.transform = `scale(1.1) translate(0,0) rotateX(0) rotateY(0) rotateZ(0)`;
    setVuMeters({ pitch: 0, yaw: 0, roll: 0, locX: 0, locY: 0, locZ: 0, fov: 0 });
    setIsPlaying(false);
  };

  useEffect(() => {
    if (isLooping && !isPlaying) triggerShake();
    else if (!isLooping && isPlaying) stopShake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLooping]);

  // Canvas Interactions
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const handleCanvasPointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    setIsDraggingCanvas(true);
    updateFromPointer(e);
  };
  const handleCanvasPointerMove = (e) => {
    if (!isDraggingCanvas) return;
    updateFromPointer(e);
  };
  const handleCanvasPointerUp = (e) => {
    e.target.releasePointerCapture(e.pointerId);
    setIsDraggingCanvas(false);
  };
  const updateFromPointer = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Frequency 0 to 50
    const fPct = Math.max(0, Math.min(1, x / rect.width));
    const newFreq = Math.round(fPct * 50 * 10) / 10;
    
    // Amplitude -30 to 30
    const aPct = 1 - Math.max(0, Math.min(1, y / rect.height));
    const newAmp = Math.round((aPct * 60 - 30) * 10) / 10;
    
    updateAxis(activeAxis, 'frequency', newFreq);
    updateAxis(activeAxis, 'amplitude', newAmp);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const axParams = axes[activeAxis];
    if (axParams.amplitude === 0 && axParams.frequency === 0) {
      ctx.strokeStyle = 'var(--border-light)';
      ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
      return;
    }

    const offset = axParams.initialOffset === 'Random' ? 100 : 0;
    const duration = globalParams.duration || 1;

    // Draw envelope guide
    ctx.strokeStyle = 'rgba(208, 119, 47, 0.2)'; /* sandy-clay-500 */
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const t = (x / w) * duration;
      const env = evaluateEnvelope(t, duration, globalParams.blendIn, globalParams.blendOut);
      const y = h/2 - env * (h/2 - 20);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const t = (x / w) * duration;
      const env = evaluateEnvelope(t, duration, globalParams.blendIn, globalParams.blendOut);
      const y = h/2 + env * (h/2 - 20);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw waveform
    ctx.strokeStyle = 'var(--sandy-clay-400)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const t = (x / w) * duration;
      const env = evaluateEnvelope(t, duration, globalParams.blendIn, globalParams.blendOut);
      const timeScaled = (t * axParams.frequency) + offset;
      let raw = axParams.waveform === 'Sine Wave' ? Math.sin(timeScaled * Math.PI * 2) : noise2D(timeScaled, offset);
      const val = raw * axParams.amplitude * env;
      
      const maxAmp = Math.max(10, Math.abs(axParams.amplitude));
      const y = h/2 - (val / maxAmp) * (h/2 - 20);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

  }, [axes, activeAxis, globalParams, noise2D]);

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      
      {/* Top Half: Video Preview */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '55vh', minHeight: '450px' }}>
        <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--shadow-grey-800)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '4px', letterSpacing: '1px' }}>Screenshake Preview</h2>
            <p className="subtitle" style={{ margin: 0, fontSize: '0.95rem' }}>Pause on the impact frame and hit trigger to feel the shake.</p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <button 
              className={`btn ${isLooping ? 'primary' : ''}`} 
              onClick={() => setIsLooping(!isLooping)}
              title="Continuously loop the shake while you tweak parameters"
              style={{ padding: '0.8rem 1.5rem' }}
            >
              <Repeat size={18} /> {isLooping ? 'Looping Live' : 'Enable Live Loop'}
            </button>
            {!isLooping && (
              <button className="btn primary" onClick={isPlaying ? stopShake : triggerShake} style={{ padding: '0.8rem 1.5rem' }}>
                {isPlaying ? <Square size={18} /> : <Play size={18} />}
                {isPlaying ? 'Stop' : 'Trigger Shake'}
              </button>
            )}
          </div>
        </div>
        
        <div className="video-preview-container" style={{ flex: 1, background: '#000', position: 'relative', overflow: 'hidden', border: 'none', borderRadius: '0' }}>
          {!videoUrl ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <label className="dropzone" style={{ width: '100%', maxWidth: '800px', padding: '4rem', border: '2px dashed var(--border)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '3rem', margin: 0, background: 'var(--bg-panel)', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s' }}>
                <Upload size={56} style={{ color: 'var(--text-muted)' }} />
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Load Gameplay Footage</h3>
                  <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Drag & drop to see shakes in context</p>
                </div>
                <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
              </label>
            </div>
          ) : (
            <video 
              ref={videoRef}
              src={videoUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.1)', willChange: 'transform' }} 
            />
          )}
          {videoUrl && <div className="video-overlay-info">PREVIEW OVER-SCAN: 1.1x</div>}
        </div>

        {/* Video Controls Footer */}
        {videoUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '16px 32px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border)' }}>
            <button className="icon-btn" onClick={toggleVideoPlay}>
              {videoPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div style={{ flex: 1 }}>
              <Slider 
                min={0} 
                max={videoDuration || 100} 
                step={0.01} 
                value={videoTime} 
                onChange={handleVideoSeek} 
              />
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text-muted)' }}>
              {videoTime.toFixed(2)} / {videoDuration.toFixed(2)}s
            </div>
            <button className="icon-btn" onClick={() => setVideoUrl('')} title="Remove Video">
              <XCircle size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Half: Control Panel Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>
        
        {/* Left Col: Global & Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel">
            <h3 style={{ marginBottom: '2rem' }}>Configuration</h3>
            <div className="control-group" style={{ marginBottom: '2.5rem' }}>
              <label>Load Preset</label>
              <select 
                onChange={handlePreset} 
                style={{ width: '100%' }}
              >
                <option value="">-- Choose Preset --</option>
                {Object.keys(PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <h3 style={{ marginBottom: '1.5rem' }}>Global Oscillation</h3>
            <div className="control-group" style={{ marginBottom: '2rem' }}>
              <label><Tooltip label="Duration" text={TOOLTIPS.duration} /></label>
              <SliderInput value={globalParams.duration} onChange={v => updateGlobal('duration', v)} min={0.1} max={10} step={0.1} />
            </div>
            <div className="control-group" style={{ marginBottom: '2rem' }}>
              <label><Tooltip label="Blend In Time" text={TOOLTIPS.blendIn} /></label>
              <SliderInput value={globalParams.blendIn} onChange={v => updateGlobal('blendIn', v)} min={0} max={5} step={0.05} />
            </div>
            <div className="control-group">
              <label><Tooltip label="Blend Out Time" text={TOOLTIPS.blendOut} /></label>
              <SliderInput value={globalParams.blendOut} onChange={v => updateGlobal('blendOut', v)} min={0} max={5} step={0.05} />
            </div>
          </div>
        </div>

        {/* Right Col: Axes Selection & Master Graph */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: '100%' }}>
            
            {/* Axis List */}
            <div style={{ background: 'var(--bg-panel-hover)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.1rem' }}>Oscillation Axes</h3>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {AXES.map(ax => (
                  <div 
                    key={ax} 
                    style={{ 
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      background: activeAxis === ax ? 'var(--bg-main)' : 'transparent',
                      borderLeft: `4px solid ${activeAxis === ax ? 'var(--accent)' : 'transparent'}`,
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => setActiveAxis(ax)}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: activeAxis === ax ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {AXIS_LABELS[ax].split(' ')[0]}
                      </div>
                      <div style={{ width: '50px', height: '6px', background: 'var(--shadow-grey-800)', marginTop: '8px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${vuMeters[ax] * 100}%`, background: 'var(--primary)', transition: 'width 0.05s linear' }} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={`stack-btn ${axes[ax].solo ? 'active' : ''}`} 
                        onClick={(e) => { e.stopPropagation(); toggleAxisBool(ax, 'solo'); }}
                        title="Solo this axis"
                      >Solo</button>
                      <button 
                        className={`stack-btn ${axes[ax].mute ? 'active' : ''}`} 
                        onClick={(e) => { e.stopPropagation(); toggleAxisBool(ax, 'mute'); }}
                        title="Mute this axis"
                      >Mute</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Axis Editor */}
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '3rem', background: 'var(--bg-panel)' }}>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: 'var(--accent)', fontSize: '1.3rem' }}>
                    <Tooltip label={AXIS_LABELS[activeAxis]} text={TOOLTIPS[activeAxis]} />
                  </h3>
                  <button className="icon-btn" style={{ fontSize: '0.9rem', padding: '6px 12px', border: '1px solid var(--border)' }} onClick={() => zeroAxis(activeAxis)}>
                    <Square size={14} style={{ marginRight: '6px' }} /> Zero Axis
                  </button>
                </div>

                <div style={{ position: 'relative', cursor: isDraggingCanvas ? 'grabbing' : 'grab' }}>
                  <canvas 
                    ref={canvasRef} 
                    width={600} 
                    height={180} 
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerUp}
                    onPointerLeave={handleCanvasPointerUp}
                    style={{ width: '100%', height: '180px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', touchAction: 'none' }}
                  />
                  <div style={{ position: 'absolute', bottom: '12px', right: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none', opacity: 0.6 }}>
                    Drag X: Freq, Y: Amp
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                <div className="control-group">
                  <label><Tooltip label="Amplitude" text={TOOLTIPS.amplitude} /></label>
                  <SliderInput value={axes[activeAxis].amplitude} onChange={v => updateAxis(activeAxis, 'amplitude', v)} min={-30} max={30} step={0.5} />
                </div>
                <div className="control-group">
                  <label><Tooltip label="Frequency" text={TOOLTIPS.frequency} /></label>
                  <SliderInput value={axes[activeAxis].frequency} onChange={v => updateAxis(activeAxis, 'frequency', v)} min={0} max={50} step={0.5} />
                </div>
                
                <div className="control-group">
                  <label><Tooltip label="Initial Offset" text={TOOLTIPS.initialOffset} /></label>
                  <select 
                    value={axes[activeAxis].initialOffset} 
                    onChange={e => updateAxis(activeAxis, 'initialOffset', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Random">Random</option>
                    <option value="Zero">Zero</option>
                  </select>
                </div>
                <div className="control-group">
                  <label><Tooltip label="Waveform" text={TOOLTIPS.waveform} /></label>
                  <select 
                    value={axes[activeAxis].waveform} 
                    onChange={e => updateAxis(activeAxis, 'waveform', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Sine Wave">Sine Wave</option>
                    <option value="Perlin Noise">Perlin Noise</option>
                  </select>
                </div>
              </div>
              
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
