import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Upload, Plus, Trash2, Download, RefreshCw, Film, Clock, ChevronLeft, ChevronRight, Target, Flag, Activity, Zap, Layers, Calculator, Scissors, Gauge, Volume2, VolumeX } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Tooltip, SliderInput } from '../components/ui';
import '../index.css';

const PHASE_TYPES = {
  'Telegraph': { color: '#eab308', label: 'Telegraph / Glow' },
  'Anticipation': { color: '#f97316', label: 'Anticipation (Wind-up)' },
  'Impact': { color: '#ef4444', label: 'Impact (Active Strike)' },
  'Recovery': { color: '#22c55e', label: 'Recovery (Follow-through)' },
  'Cancel Window': { color: '#3b82f6', label: 'Cancel Window / Branch' },
  'Custom': { color: '#a855f7', label: 'Custom Phase' }
};

const MASTER_SPEEDS = [0.25, 0.5, 1.0, 1.5, 2.0];

export default function AnimRetimeTool() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [targetFps, setTargetFps] = useState(60);
  const [masterSpeed, setMasterSpeed] = useState(1.0);
  
  // Video Trim Range (Start time & End time in seconds)
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(2.0);

  // Initial Notifies setup with exact labels: Start, Anticipation, Impact, Recovery
  const [notifies, setNotifies] = useState([
    { id: '1', frame: 0, multiplier: 1.0, phase: 'Telegraph', label: 'Start' },
    { id: '2', frame: 12, multiplier: 1.6, phase: 'Anticipation', label: 'Anticipation' },
    { id: '3', frame: 32, multiplier: 0.35, phase: 'Impact', label: 'Impact' },
    { id: '4', frame: 44, multiplier: 1.25, phase: 'Recovery', label: 'Recovery' }
  ]);
  const [selectedNotifyId, setSelectedNotifyId] = useState('2');

  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  
  const notifiesRef = useRef(notifies);
  useEffect(() => { notifiesRef.current = notifies; }, [notifies]);

  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  useEffect(() => { trimStartRef.current = trimStart; trimEndRef.current = trimEnd; }, [trimStart, trimEnd]);

  const masterSpeedRef = useRef(masterSpeed);
  useEffect(() => { masterSpeedRef.current = masterSpeed; }, [masterSpeed]);

  const frameTime = 1 / targetFps;
  const clipDuration = Math.max(0.1, trimEnd - trimStart);
  
  // Frame mapping within trim range
  const startRawFrame = Math.round(trimStart * targetFps);
  const endRawFrameMax = Math.round(trimEnd * targetFps);
  const currentRawFrame = Math.round(currentTime * targetFps);
  const totalRawFrames = Math.max(1, endRawFrameMax - startRawFrame);

  // Handle Video Upload & Duration Init
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const handleVideoMetadata = (e) => {
    const dur = e.target.duration;
    setVideoDuration(dur);
    setTrimStart(0);
    setTrimEnd(Number(dur.toFixed(2)));
  };

  // Add Notify at current playhead frame
  const addNotifyAtCurrentFrame = () => {
    const frame = currentRawFrame;
    if (notifies.some(n => n.frame === frame)) return;

    const newNotify = {
      id: Date.now().toString(),
      frame: frame,
      multiplier: 1.0,
      phase: 'Anticipation',
      label: `Notify @ F#${frame}`
    };
    setNotifies(prev => [...prev, newNotify].sort((a, b) => a.frame - b.frame));
    setSelectedNotifyId(newNotify.id);
  };

  const removeNotify = (id) => {
    if (notifies.length <= 1) {
      alert("You must keep at least one starting notify at Frame 0.");
      return;
    }
    setNotifies(prev => prev.filter(n => n.id !== id));
    if (selectedNotifyId === id) setSelectedNotifyId(null);
  };

  const updateNotify = (id, key, value) => {
    setNotifies(prev => prev.map(n => n.id === id ? { ...n, [key]: value } : n).sort((a, b) => a.frame - b.frame));
  };

  // Live Simulation: Dynamic Play Rate Shift Loop within Trim Window using Master Speed Factor
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isPlaying) return;

    let animId = null;

    const checkPlaybackSpeed = () => {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        
        // Loop within trim window
        if (t >= trimEndRef.current || t < trimStartRef.current) {
          videoRef.current.currentTime = trimStartRef.current;
        } else {
          setCurrentTime(t);
        }

        const curFrame = Math.round(t * targetFps);

        // Find active section notify
        const sorted = [...notifiesRef.current].sort((a, b) => a.frame - b.frame);
        let activeNotify = sorted[0];
        for (let i = 0; i < sorted.length; i++) {
          if (curFrame >= sorted[i].frame) {
            activeNotify = sorted[i];
          } else {
            break;
          }
        }

        const targetRate = activeNotify ? (activeNotify.multiplier * masterSpeedRef.current) : masterSpeedRef.current;
        if (Math.abs(videoRef.current.playbackRate - targetRate) > 0.01) {
          videoRef.current.playbackRate = targetRate;
        }
      }
      animId = requestAnimationFrame(checkPlaybackSpeed);
    };

    animId = requestAnimationFrame(checkPlaybackSpeed);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [videoUrl, isPlaying, targetFps]);

  const handleSeek = (newTime) => {
    const clamped = Math.max(trimStart, Math.min(trimEnd, newTime));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  const stepFrame = (delta) => {
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    const targetTime = currentTime + (delta * frameTime);
    handleSeek(targetTime);
  };

  // Calculate Sections & Retimed Frame Breakdown
  const calculateBreakdown = useCallback(() => {
    const sorted = [...notifies].sort((a, b) => a.frame - b.frame);
    const sections = [];
    let totalRetimedScreenFrames = 0;
    let totalRetimedSeconds = 0;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const nextFrame = (i < sorted.length - 1) ? sorted[i + 1].frame : endRawFrameMax;
      const rawSpan = Math.max(0, nextFrame - current.frame);
      
      // Effective screen frames = Raw Frames / Multiplier
      const screenFrames = rawSpan > 0 ? (rawSpan / Math.max(0.01, current.multiplier)) : 0;
      const durationSec = screenFrames / targetFps;

      sections.push({
        id: current.id,
        label: current.label,
        phase: current.phase,
        startFrame: current.frame,
        endFrame: nextFrame,
        rawSpan,
        multiplier: current.multiplier,
        screenFrames: Math.round(screenFrames * 10) / 10,
        durationMs: Math.round(durationSec * 1000),
        durationSec: Number(durationSec.toFixed(3)),
        startScreenTime: Number(totalRetimedSeconds.toFixed(3)),
        endScreenTime: Number((totalRetimedSeconds + durationSec).toFixed(3))
      });

      totalRetimedScreenFrames += screenFrames;
      totalRetimedSeconds += durationSec;
    }

    return {
      sections,
      totalRawFrames,
      totalRetimedScreenFrames: Math.round(totalRetimedScreenFrames),
      totalRetimedSeconds: Number(totalRetimedSeconds.toFixed(3)),
      rawDurationSec: Number((totalRawFrames * frameTime).toFixed(3)),
      overallSpeedRatio: Number((totalRawFrames / Math.max(1, totalRetimedScreenFrames)).toFixed(2))
    };
  }, [notifies, endRawFrameMax, totalRawFrames, targetFps, frameTime]);

  const breakdownData = calculateBreakdown();
  const selectedNotify = notifies.find(n => n.id === selectedNotifyId);
  const selectedSection = breakdownData.sections.find(s => s.id === selectedNotifyId);

  // Active Section for Live HUD
  const activeSection = breakdownData.sections.find(s => currentRawFrame >= s.startFrame && currentRawFrame < s.endFrame) || breakdownData.sections[0];

  return (
    <div className="app-container" style={{ maxWidth: '1600px', margin: '0 auto', padding: '1rem 1.5rem' }}>
      
      {/* Header Panel */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Frame Counter & Animation Retiming Tool</h2>
          <p className="subtitle">Tune play rate multipliers across notifies and calculate real-time combat frame windows.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Target FPS Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target FPS:</span>
            {[15, 30, 60, 120].map(fps => (
              <button 
                key={fps}
                onClick={() => setTargetFps(fps)}
                style={{
                  background: targetFps === fps ? 'var(--primary)' : 'transparent',
                  color: targetFps === fps ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                {fps}
              </button>
            ))}
          </div>

          <label className="btn" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} /> Load Video File
            <input type="file" accept="video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Hero Video & Live HUD */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <div 
          style={{ 
            position: 'relative', 
            overflow: 'hidden', 
            maxHeight: '60vh', 
            aspectRatio: '16/9',
            margin: '0 auto',
            width: '100%',
            display: 'flex', 
            alignItems: 'center', 
            backgroundColor: 'var(--bg-main)',
            borderRadius: '0px',
            border: '2px solid var(--border)',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
          }}
        >
          {videoUrl ? (
            <video 
              ref={videoRef}
              src={videoUrl} 
              muted={isMuted}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onLoadedMetadata={handleVideoMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={() => {
                if (videoRef.current) {
                  if (isPlaying) videoRef.current.pause();
                  else videoRef.current.play();
                }
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 2rem' }}>
              <Film size={64} style={{ marginBottom: '1.5rem', opacity: 0.4 }} />
              <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)', fontWeight: '600' }}>No Video Loaded</p>
              <p style={{ fontSize: '0.95rem' }}>Upload an animation render to simulate live play rate speed shifts.</p>
            </div>
          )}

          {/* Active Phase Live HUD Badge */}
          {activeSection && (
            <div style={{
              position: 'absolute', top: '20px', left: '20px',
              backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
              border: `2px solid ${PHASE_TYPES[activeSection.phase]?.color || '#3b82f6'}`,
              color: '#fff', padding: '10px 20px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              zIndex: 20
            }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: PHASE_TYPES[activeSection.phase]?.color || '#3b82f6' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ACTIVE RETIMED PHASE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {activeSection.label} ({activeSection.multiplier}x Speed {masterSpeed !== 1.0 ? `@ ${masterSpeed}x Master` : ''})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Video Trim Window Controls (Slider + Direct Text Inputs) */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.95rem' }}>
              <Scissors size={18} style={{ color: 'var(--primary)' }} /> Video Trim Clip Window
            </span>

            {/* Direct Text Box Inputs for Trim Range */}
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trim Start (s):</label>
                <input 
                  type="number" 
                  step={0.01}
                  value={trimStart} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 0 && val < trimEnd) setTrimStart(val);
                  }}
                  style={{ width: '85px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', color: '#fff', fontSize: '0.9rem', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(F#{startRawFrame})</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trim End (s):</label>
                <input 
                  type="number" 
                  step={0.01}
                  value={trimEnd} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val > trimStart) setTrimEnd(val);
                  }}
                  style={{ width: '85px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', color: '#fff', fontSize: '0.9rem', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(F#{endRawFrameMax})</span>
              </div>
            </div>
          </div>

          {/* Slider Controls */}
          <div style={{ padding: '4px 8px' }}>
            <Slider 
              range 
              min={0} 
              max={videoDuration || 2.0} 
              step={frameTime} 
              value={[trimStart, trimEnd]} 
              onChange={val => {
                setTrimStart(val[0]);
                setTrimEnd(val[1]);
              }}
              trackStyle={[{ backgroundColor: '#10b981' }]}
              handleStyle={[{ backgroundColor: '#10b981', borderColor: '#fff' }, { backgroundColor: '#10b981', borderColor: '#fff' }]}
            />
          </div>
        </div>

        {/* Multiplier Track & Section Block Timeline */}
        <div style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            <div>
              Raw Frame: <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>#{currentRawFrame}</strong> / {endRawFrameMax}
            </div>
            <div>
              Retimed Screen Output: <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{breakdownData.totalRetimedScreenFrames} Frames</strong> ({breakdownData.totalRetimedSeconds}s)
            </div>
          </div>

          {/* Color-Coded Phase Blocks Bar */}
          <div style={{ position: 'relative', height: '36px', width: '100%', backgroundColor: '#0f172a', borderRadius: '8px', overflow: 'hidden', display: 'flex', border: '1px solid var(--border)' }}>
            {breakdownData.sections.map(sec => {
              const pctWidth = (sec.rawSpan / Math.max(1, totalRawFrames)) * 100;
              const isSelected = sec.id === selectedNotifyId;
              const color = PHASE_TYPES[sec.phase]?.color || '#3b82f6';
              return (
                <div 
                  key={sec.id}
                  onClick={() => setSelectedNotifyId(sec.id)}
                  style={{
                    width: `${pctWidth}%`,
                    height: '100%',
                    backgroundColor: color,
                    opacity: isSelected ? 0.95 : 0.65,
                    borderRight: '2px solid #000',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    padding: '0 4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: isSelected ? 'inset 0 0 12px rgba(255,255,255,0.6)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title={`${sec.label} (${sec.phase}) | ${sec.multiplier}x Speed | ${sec.screenFrames} Screen Frames`}
                >
                  {sec.label} ({sec.multiplier}x)
                </div>
              );
            })}
          </div>

          {/* Slider Scrubbing Track within Trim Window */}
          <div style={{ position: 'relative', padding: '10px 0' }} ref={timelineRef}>
            <Slider 
              min={trimStart} 
              max={trimEnd} 
              step={frameTime} 
              value={currentTime} 
              onChange={v => handleSeek(v)} 
              railStyle={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.1)' }}
              trackStyle={{ height: '8px', backgroundColor: 'var(--primary)' }}
              handleStyle={{ height: '20px', width: '20px', marginTop: '-6px', backgroundColor: '#fff', border: '3px solid var(--primary)', opacity: 1 }}
            />
          </div>

          {/* Redesigned Structured Control Deck (2 Clean Rows) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.4)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            
            {/* Row 1: Primary Actions & Master Speed Deck */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) videoRef.current.pause();
                      else videoRef.current.play();
                    }
                  }}
                  disabled={!videoUrl}
                  style={{ padding: '10px 24px', fontSize: '1rem' }}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />} {isPlaying ? 'Pause' : 'Play Simulation'}
                </button>

                <button 
                  className="btn btn-primary" 
                  onClick={addNotifyAtCurrentFrame}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', borderColor: '#10b981', padding: '10px 22px', fontSize: '0.95rem' }}
                >
                  <Plus size={18} /> Add AnimNotify at Frame #{currentRawFrame}
                </button>
              </div>

              {/* Master Playback Speed Selector Deck */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-main)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <Gauge size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Master Speed:</span>
                {MASTER_SPEEDS.map(spd => (
                  <button 
                    key={spd}
                    onClick={() => setMasterSpeed(spd)}
                    style={{
                      background: masterSpeed === spd ? 'var(--primary)' : 'transparent',
                      color: masterSpeed === spd ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Transport Stepping & Utilities */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '4px' }}>Frame Step:</span>
                <button className="btn" onClick={() => stepFrame(-1)} disabled={!videoUrl} style={{ padding: '6px 14px' }}>
                  <ChevronLeft size={16} /> -1 Frame
                </button>

                <button className="btn" onClick={() => stepFrame(1)} disabled={!videoUrl} style={{ padding: '6px 14px' }}>
                  +1 Frame <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button className="btn" onClick={() => handleSeek(trimStart)} disabled={!videoUrl} style={{ padding: '6px 14px' }}>
                  <RefreshCw size={15} /> Restart Clip
                </button>

                <button 
                  className="btn" 
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    if (videoRef.current) videoRef.current.muted = nextMuted;
                  }}
                  disabled={!videoUrl}
                  style={{ padding: '6px 14px' }}
                  title={isMuted ? "Unmute Video Audio" : "Mute Video Audio"}
                >
                  {isMuted ? <VolumeX size={16} style={{ color: '#ef4444' }} /> : <Volume2 size={16} />} 
                  {isMuted ? 'Muted' : 'Mute Audio'}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Grid: Retiming Breakdown Table & Selected Inspector Editor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Retiming Frame Breakdown Table */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Retimed Section Windows Breakdown</span>
            <span style={{ fontSize: '0.85rem', color: '#10b981' }}>Overall Ratio: {breakdownData.overallSpeedRatio}x Speed</span>
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>Phase Section</th>
                  <th style={{ padding: '10px' }}>Raw Frames</th>
                  <th style={{ padding: '10px' }}>Play Rate</th>
                  <th style={{ padding: '10px', color: '#10b981' }}>Screen Frames</th>
                  <th style={{ padding: '10px' }}>Duration</th>
                  <th style={{ padding: '10px' }}>Screen Window</th>
                </tr>
              </thead>
              <tbody>
                {breakdownData.sections.map(sec => {
                  const isSelected = sec.id === selectedNotifyId;
                  const color = PHASE_TYPES[sec.phase]?.color || '#3b82f6';
                  return (
                    <tr 
                      key={sec.id}
                      onClick={() => setSelectedNotifyId(sec.id)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />
                        {sec.label}
                      </td>
                      <td style={{ padding: '12px 10px' }}>F#{sec.startFrame} → F#{sec.endFrame} ({sec.rawSpan}f)</td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', color: 'var(--primary)' }}>{sec.multiplier}x</td>
                      <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#10b981' }}>{sec.screenFrames} frames</td>
                      <td style={{ padding: '12px 10px' }}>{sec.durationMs}ms ({sec.durationSec}s)</td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{sec.startScreenTime}s → {sec.endScreenTime}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inspector & Inverse Multiplier Calculator */}
        {selectedNotify && selectedSection ? (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', margin: 0 }}>
                Section Inspector
              </h3>
              <button className="icon-btn" onClick={() => removeNotify(selectedNotify.id)} style={{ color: '#ef4444' }} title="Delete Notify">
                <Trash2 size={18} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Section Label</label>
              <input 
                type="text" 
                value={selectedNotify.label} 
                onChange={e => updateNotify(selectedNotify.id, 'label', e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Combat Phase Type</label>
              <select 
                value={selectedNotify.phase} 
                onChange={e => updateNotify(selectedNotify.id, 'phase', e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                {Object.keys(PHASE_TYPES).map(p => <option key={p} value={p}>{PHASE_TYPES[p].label}</option>)}
              </select>
            </div>

            {/* Play Rate Multiplier Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Play Rate Multiplier</label>
                <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold' }}>{selectedNotify.multiplier}x</span>
              </div>
              <SliderInput 
                value={selectedNotify.multiplier} 
                onChange={v => updateNotify(selectedNotify.id, 'multiplier', Number(v.toFixed(2)))} 
                min={0.1} max={4.0} step={0.05} 
              />
            </div>

            {/* Inverse Multiplier Calculator Card */}
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '8px' }}>
                <Calculator size={18} /> Desired Screen Frame Target Calculator
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Enter your desired output screen frames for this section ({selectedSection.rawSpan} raw frames).
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="number" 
                  placeholder="Target Frames"
                  onChange={(e) => {
                    const targetFr = Number(e.target.value);
                    if (targetFr > 0 && selectedSection.rawSpan > 0) {
                      const computedMult = Number((selectedSection.rawSpan / targetFr).toFixed(2));
                      updateNotify(selectedNotify.id, 'multiplier', computedMult);
                    }
                  }}
                  style={{ width: '130px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', color: '#fff' }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Screen Frames @ {targetFps}fps</span>
              </div>
            </div>

          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1.5rem' }}>
            Select a section from the table or timeline to inspect.
          </div>
        )}

      </div>
    </div>
  );
}
