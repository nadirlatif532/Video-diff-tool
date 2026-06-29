import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Upload, Plus, Trash2, Download, RefreshCw, Film, Clock, ChevronLeft, ChevronRight, Target, Move, Flag } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Tooltip, SliderInput } from '../components/ui';
import '../index.css';

export default function HitStopTool() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetFps, setTargetFps] = useState(30);
  
  // Array of markers: { id, timestamp (sec), duration (ms), label }
  const [markers, setMarkers] = useState([
    { id: '1', timestamp: 1.2, duration: 180, label: 'Sword Impact' },
    { id: '2', timestamp: 2.5, duration: 120, label: 'Second Strike' }
  ]);
  const [selectedMarkerId, setSelectedMarkerId] = useState('1');
  const [draggingMarkerId, setDraggingMarkerId] = useState(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');

  // Live simulation state
  const [activeFreezeMarker, setActiveFreezeMarker] = useState(null);

  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  
  const markersRef = useRef(markers);
  useEffect(() => { markersRef.current = markers; }, [markers]);

  const isFreezingRef = useRef(false);
  const activeFreezeIdRef = useRef(null);

  const frameTime = 1 / targetFps;
  const currentFrameNum = Math.round(currentTime * targetFps);
  const totalFramesNum = Math.round(videoDuration * targetFps);

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCurrentTime(0);
      setIsPlaying(false);
      isFreezingRef.current = false;
      activeFreezeIdRef.current = null;
    }
  };

  // Add Marker at current video playback timestamp
  const addMarkerAtCurrentTime = () => {
    const time = videoRef.current ? videoRef.current.currentTime : currentTime;
    const newMarker = {
      id: Date.now().toString(),
      timestamp: Number(time.toFixed(3)),
      duration: 150, // default 150ms hold
      label: `Freeze #${markers.length + 1}`
    };
    setMarkers(prev => [...prev, newMarker].sort((a, b) => a.timestamp - b.timestamp));
    setSelectedMarkerId(newMarker.id);
  };

  const removeMarker = (id) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  };

  const updateMarker = (id, key, value) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, [key]: value } : m).sort((a, b) => a.timestamp - b.timestamp));
  };

  const nudgeMarkerFrame = (id, deltaFrames) => {
    const m = markers.find(item => item.id === id);
    if (!m) return;
    const currentF = Math.round(m.timestamp * targetFps);
    const newF = Math.max(0, currentF + deltaFrames);
    const newTime = Number((newF / targetFps).toFixed(3));
    updateMarker(id, 'timestamp', newTime);
    handleSeek(newTime);
  };

  const snapMarkerToCurrentTime = (id) => {
    const time = videoRef.current ? videoRef.current.currentTime : currentTime;
    updateMarker(id, 'timestamp', Number(time.toFixed(3)));
  };

  // High-Frequency Precise Playback Detection Loop via requestAnimationFrame
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !isPlaying) return;

    let animId = null;
    let freezeTimeout = null;

    const checkFrame = () => {
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setCurrentTime(t);

        if (!isFreezingRef.current) {
          // Find if playhead reached a marker timestamp frame
          const matched = markersRef.current.find(m => {
            if (m.id === activeFreezeIdRef.current) return false;
            const diff = t - m.timestamp;
            return diff >= -0.015 && diff <= (frameTime * 1.2);
          });

          if (matched) {
            isFreezingRef.current = true;
            activeFreezeIdRef.current = matched.id;
            setActiveFreezeMarker(matched);

            // Hold video on exact frame
            videoRef.current.playbackRate = 0;

            freezeTimeout = setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.playbackRate = 1.0;
              }
              isFreezingRef.current = false;
              setActiveFreezeMarker(null);
            }, matched.duration);
          }
        }
      }
      animId = requestAnimationFrame(checkFrame);
    };

    animId = requestAnimationFrame(checkFrame);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (freezeTimeout) clearTimeout(freezeTimeout);
    };
  }, [videoUrl, isPlaying, frameTime]);

  // Reset passed markers when scrubbed back or restarted
  const handleSeek = (newTime) => {
    const clamped = Math.max(0, Math.min(videoDuration || 100, newTime));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      videoRef.current.playbackRate = 1.0;
    }
    setCurrentTime(clamped);
    activeFreezeIdRef.current = null;
    isFreezingRef.current = false;
    setActiveFreezeMarker(null);
  };

  const stepFrame = (delta) => {
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    const targetTime = currentTime + (delta * frameTime);
    handleSeek(targetTime);
  };

  // Drag Marker Pin logic over timeline
  const handleTimelinePointerDown = (e, markerId) => {
    e.stopPropagation();
    setSelectedMarkerId(markerId);
    setDraggingMarkerId(markerId);
    e.target.setPointerCapture(e.pointerId);
  };

  const handleTimelinePointerMove = (e) => {
    if (!draggingMarkerId || !timelineRef.current || !videoDuration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = x / rect.width;
    const newTime = Number((pct * videoDuration).toFixed(3));
    updateMarker(draggingMarkerId, 'timestamp', newTime);
    handleSeek(newTime);
  };

  const handleTimelinePointerUp = (e) => {
    if (draggingMarkerId) {
      try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
      setDraggingMarkerId(null);
    }
  };

  // Render Video + Export Baked Freeze Frames using Canvas & MediaRecorder
  const exportVideoWithBakedFreezes = async () => {
    if (!videoRef.current || !videoUrl) {
      alert("Please load a video first before exporting.");
      return;
    }

    const video = videoRef.current;
    video.pause();
    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText('Preparing video renderer...');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(targetFps);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') 
      ? 'video/mp4' 
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');
    
    const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 });
    const chunks = [];

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    
    const exportPromise = new Promise(resolve => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hitstop_simulated_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        resolve();
      };
    });

    mediaRecorder.start();

    const totalVideoSec = video.duration;
    let currentSimTime = 0;
    const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);

    setExportStatusText('Rendering video frames with baked freezes...');

    for (currentSimTime = 0; currentSimTime <= totalVideoSec; currentSimTime += frameTime) {
      video.currentTime = currentSimTime;
      
      await new Promise(res => {
        const onSeek = () => {
          video.removeEventListener('seeked', onSeek);
          res();
        };
        video.addEventListener('seeked', onSeek);
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const hitMarker = sortedMarkers.find(m => Math.abs(currentSimTime - m.timestamp) < (frameTime / 2));
      
      if (hitMarker) {
        const extraHoldFrames = Math.round((hitMarker.duration / 1000) * targetFps);
        for (let f = 0; f < extraHoldFrames; f++) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          await new Promise(r => setTimeout(r, 10));
        }
      }

      const pct = Math.min(99, Math.round((currentSimTime / totalVideoSec) * 100));
      setExportProgress(pct);
    }

    setExportStatusText('Finalizing exported video clip...');
    mediaRecorder.stop();
    await exportPromise;
    
    setIsExporting(false);
    setExportProgress(100);
    alert("Export complete! Video downloaded with exact freeze frame holds intact.");
  };

  const selectedMarker = markers.find(m => m.id === selectedMarkerId);

  return (
    <div className="app-container" style={{ maxWidth: '1600px', margin: '0 auto', padding: '1rem 1.5rem' }}>
      
      {/* Header Panel */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Hit-Stop & Freeze Frame Studio</h2>
          <p className="subtitle">High-precision frame timeline editing & hold exports for action combat design.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Target FPS Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-main)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target FPS:</span>
            {[24, 30, 60].map(fps => (
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

          <button className="btn btn-primary" onClick={exportVideoWithBakedFreezes} disabled={isExporting || !videoUrl}>
            <Download size={18} /> {isExporting ? `Exporting (${exportProgress}%)` : 'Export Video with Stops'}
          </button>
        </div>
      </div>

      {/* Hero Video Viewport Section (Expanded Size) */}
      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        <div 
          style={{ 
            position: 'relative', 
            overflow: 'hidden', 
            maxHeight: '68vh', 
            aspectRatio: '16/9',
            margin: '0 auto',
            width: '100%',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#030508',
            borderRadius: '12px',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
          }}
        >
          {videoUrl ? (
            <video 
              ref={videoRef}
              src={videoUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
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
              <p style={{ fontSize: '0.95rem' }}>Upload a combat video clip to expand the workspace and begin editing frame holds.</p>
            </div>
          )}

          {/* Active Freeze Banner */}
          {activeFreezeMarker && (
            <div style={{
              position: 'absolute', top: '24px', left: '24px',
              backgroundColor: 'rgba(239, 68, 68, 0.95)', color: '#fff',
              padding: '10px 22px', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.05rem',
              display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 25px rgba(239,68,68,0.8)',
              zIndex: 20
            }}>
              <Clock size={20} /> HOLDING FRAME: {activeFreezeMarker.duration}ms ({activeFreezeMarker.label})
            </div>
          )}
        </div>

        {/* Large Promenade Timeline Control Bar */}
        <div style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
            <div>
              Playhead Time: <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{currentTime.toFixed(3)}s</strong> 
              <span style={{ margin: '0 10px', opacity: 0.4 }}>|</span> 
              Exact Frame: <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>#{currentFrameNum}</strong> / {totalFramesNum}
            </div>
            <div>
              Video Duration: <strong style={{ color: 'var(--text-main)' }}>{videoDuration.toFixed(2)}s</strong> ({targetFps} FPS)
            </div>
          </div>

          {/* Large Clickable Timeline Track */}
          <div style={{ position: 'relative', padding: '24px 0 16px 0' }} ref={timelineRef}>
            
            <Slider 
              min={0} 
              max={videoDuration || 100} 
              step={frameTime} 
              value={currentTime} 
              onChange={v => handleSeek(v)} 
              railStyle={{ height: '10px', backgroundColor: 'rgba(255,255,255,0.1)' }}
              trackStyle={{ height: '10px', backgroundColor: 'var(--primary)' }}
              handleStyle={{ height: '22px', width: '22px', marginTop: '-6px', backgroundColor: '#fff', border: '3px solid var(--primary)', opacity: 1 }}
            />

            {/* Prominent Easily-Clickable Marker Badges over Timeline */}
            {videoDuration > 0 && markers.map(m => {
              const pct = (m.timestamp / videoDuration) * 100;
              const isSelected = m.id === selectedMarkerId;
              const markerFrame = Math.round(m.timestamp * targetFps);
              return (
                <div 
                  key={m.id}
                  onPointerDown={(e) => handleTimelinePointerDown(e, m.id)}
                  onPointerMove={handleTimelinePointerMove}
                  onPointerUp={handleTimelinePointerUp}
                  title={`Frame #${markerFrame} (${m.duration}ms) - Drag or Click`}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top: '-18px',
                    transform: 'translateX(-50%)',
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: isSelected ? 15 : 10,
                    touchAction: 'none'
                  }}
                >
                  {/* Highly Visible Marker Badge Pill */}
                  <div style={{
                    backgroundColor: isSelected ? '#ef4444' : '#f59e0b',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    boxShadow: isSelected ? '0 0 12px rgba(239,68,68,0.9)' : '0 2px 6px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    border: '1.5px solid #fff'
                  }}>
                    <Flag size={11} /> F#{markerFrame} ({m.duration}ms)
                  </div>
                  <div style={{ width: '3px', height: '24px', backgroundColor: isSelected ? '#ef4444' : '#f59e0b', marginTop: '2px' }} />
                </div>
              );
            })}
          </div>

          {/* Playback & Frame Stepping Controls Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.5rem' }}>
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
                {isPlaying ? <Pause size={20} /> : <Play size={20} />} {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button 
                className="btn" 
                onClick={() => stepFrame(-1)}
                disabled={!videoUrl}
                title="Step Backward 1 Frame"
                style={{ padding: '10px 16px', fontSize: '0.95rem' }}
              >
                <ChevronLeft size={18} /> -1 Frame
              </button>

              <button 
                className="btn" 
                onClick={() => stepFrame(1)}
                disabled={!videoUrl}
                title="Step Forward 1 Frame"
                style={{ padding: '10px 16px', fontSize: '0.95rem' }}
              >
                +1 Frame <ChevronRight size={18} />
              </button>
              
              <button 
                className="btn" 
                onClick={() => handleSeek(0)}
                disabled={!videoUrl}
                style={{ padding: '10px 16px' }}
              >
                <RefreshCw size={18} /> Restart
              </button>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={addMarkerAtCurrentTime}
              disabled={!videoUrl}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '1.05rem', backgroundColor: '#10b981', borderColor: '#10b981' }}
            >
              <Plus size={20} /> Add Freeze Marker at Frame {currentFrameNum}
            </button>
          </div>

        </div>

      </div>

      {/* Bottom Grid: Marker List & Inspector Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Drawer: Markers List */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Timeline Freeze Markers ({markers.length})</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Click to select and seek</span>
          </h3>

          {markers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', padding: '2rem 0' }}>
              No freeze markers placed yet. Pause or play the video and click "Add Freeze Marker".
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '6px' }}>
              {markers.map(m => {
                const isSelected = m.id === selectedMarkerId;
                const mFrame = Math.round(m.timestamp * targetFps);
                return (
                  <div 
                    key={m.id}
                    onClick={() => {
                      setSelectedMarkerId(m.id);
                      handleSeek(m.timestamp);
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Frame <strong style={{ color: 'var(--text-main)' }}>#{mFrame}</strong> ({m.timestamp.toFixed(3)}s) | Hold Duration: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{m.duration}ms</span>
                      </div>
                    </div>

                    <button 
                      className="icon-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMarker(m.id);
                      }}
                      style={{ color: '#ef4444', padding: '8px' }}
                      title="Delete Marker"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Drawer: Selected Marker Inspector Editor */}
        {selectedMarker ? (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', margin: 0 }}>
                Marker Inspector Settings
              </h3>
              <button 
                className="btn" 
                onClick={() => snapMarkerToCurrentTime(selectedMarker.id)}
                style={{ fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Snap marker position to current playhead frame"
              >
                <Target size={16} /> Snap to Frame #{currentFrameNum}
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Marker Label</label>
              <input 
                type="text" 
                value={selectedMarker.label} 
                onChange={e => updateMarker(selectedMarker.id, 'label', e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontSize: '1rem' }}
              />
            </div>

            {/* Marker Frame Repositioning & Nudging */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Marker Frame Position</label>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 'bold' }}>
                  Frame #{Math.round(selectedMarker.timestamp * targetFps)} ({selectedMarker.timestamp.toFixed(3)}s)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '8px' }}>
                <button className="btn" style={{ flex: 1, padding: '10px' }} onClick={() => nudgeMarkerFrame(selectedMarker.id, -1)}>
                  <ChevronLeft size={18} /> -1 Frame
                </button>
                <button className="btn" style={{ flex: 1, padding: '10px' }} onClick={() => nudgeMarkerFrame(selectedMarker.id, 1)}>
                  +1 Frame <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Freeze Hold Duration */}
            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Freeze Hold Duration (ms)</label>
              <SliderInput 
                value={selectedMarker.duration} 
                onChange={v => updateMarker(selectedMarker.id, 'duration', Math.round(v))} 
                min={20} max={1000} step={10} 
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Exact hold: <strong style={{ color: '#ef4444' }}>{Math.round((selectedMarker.duration / 1000) * targetFps)} frames</strong> @ {targetFps}fps
              </span>
            </div>

          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1.5rem' }}>
            Select a marker to edit its frame position and hold duration.
          </div>
        )}

      </div>
    </div>
  );
}
