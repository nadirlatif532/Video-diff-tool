import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Upload, Video, Play, Pause, Download, LayoutTemplate, SplitSquareHorizontal, X } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import '../index.css';

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '00:00.00';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
};

export default function VideoDiffTool() {
  const [ffmpeg, setFfmpeg] = useState(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [stackMode, setStackMode] = useState('horizontal'); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingV1, setPlayingV1] = useState(false);
  const [playingV2, setPlayingV2] = useState(false);

  const [v1, setV1] = useState({ file: null, url: '', start: 0, end: 5, offsetX: 50, offsetY: 50, duration: 0 });
  const [v2, setV2] = useState({ file: null, url: '', start: 0, end: 5, offsetX: 50, offsetY: 50, duration: 0 });

  const v1Ref = useRef(null);
  const v2Ref = useRef(null);
  const v1TimeRef = useRef(null);
  const v2TimeRef = useRef(null);

  useEffect(() => {
    const loadFfmpeg = async () => {
      const instance = new FFmpeg();
      instance.on('progress', ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });
      await instance.load();
      setFfmpeg(instance);
      setReady(true);
    };
    loadFfmpeg().catch(console.error);
  }, []);

  const handleFileChange = (e, videoNum) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    
    const tempVid = document.createElement('video');
    tempVid.src = url;
    tempVid.onloadedmetadata = () => {
      const state = { file, url, start: 0, end: Math.min(10, tempVid.duration), offsetX: 50, offsetY: 50, duration: tempVid.duration };
      if (videoNum === 1) setV1(state);
      else setV2(state);
    };
  };

  const togglePlaySync = () => {
    if (!v1Ref.current || !v2Ref.current) return;
    
    if (isPlaying) {
      v1Ref.current.pause();
      v2Ref.current.pause();
      setIsPlaying(false);
    } else {
      setPlayingV1(false);
      setPlayingV2(false);
      v1Ref.current.currentTime = v1.start;
      v2Ref.current.currentTime = v2.start;
      v1Ref.current.play();
      v2Ref.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlayIndividual = (num) => {
    const isV1 = num === 1;
    const ref = isV1 ? v1Ref.current : v2Ref.current;
    const isPlayingInd = isV1 ? playingV1 : playingV2;
    const setPlayingInd = isV1 ? setPlayingV1 : setPlayingV2;
    const state = isV1 ? v1 : v2;

    if (!ref) return;

    if (isPlaying) {
      v1Ref.current.pause();
      v2Ref.current.pause();
      setIsPlaying(false);
    }

    if (isPlayingInd) {
      ref.pause();
      setPlayingInd(false);
    } else {
      // Pause the other if playing
      if (isV1 && playingV2 && v2Ref.current) { v2Ref.current.pause(); setPlayingV2(false); }
      if (!isV1 && playingV1 && v1Ref.current) { v1Ref.current.pause(); setPlayingV1(false); }

      ref.currentTime = state.start;
      ref.play();
      setPlayingInd(true);
    }
  };

  // Playback bounds checker & timestamp updater
  useEffect(() => {
    const interval = setInterval(() => {
      if (v1Ref.current) {
        const t1 = v1Ref.current.currentTime;
        if (v1TimeRef.current) v1TimeRef.current.innerText = `${formatTime(t1)} | Frame ${Math.round(t1 * 30)}`;
        if ((isPlaying || playingV1) && t1 >= v1.end) {
          v1Ref.current.pause();
          if (playingV1) setPlayingV1(false);
        }
      }
      if (v2Ref.current) {
        const t2 = v2Ref.current.currentTime;
        if (v2TimeRef.current) v2TimeRef.current.innerText = `${formatTime(t2)} | Frame ${Math.round(t2 * 30)}`;
        if ((isPlaying || playingV2) && t2 >= v2.end) {
          v2Ref.current.pause();
          if (playingV2) setPlayingV2(false);
        }
      }
      
      if (isPlaying) {
        const v1Done = !v1Ref.current || v1Ref.current.paused;
        const v2Done = !v2Ref.current || v2Ref.current.paused;
        if (v1Done && v2Done) {
          setIsPlaying(false);
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, playingV1, playingV2, v1.end, v2.end]);

  const updateV1 = (updates) => setV1(prev => ({ ...prev, ...updates }));
  const updateV2 = (updates) => setV2(prev => ({ ...prev, ...updates }));

  const doExport = async () => {
    if (!v1.file || !v2.file) return;
    setProcessing(true);
    setProgress(0);

    try {
      await ffmpeg.writeFile('v1.mp4', await fetchFile(v1.file));
      await ffmpeg.writeFile('v2.mp4', await fetchFile(v2.file));

      const isH = stackMode === 'horizontal';
      const w = isH ? 960 : 1080;
      const h = isH ? 1080 : 960;

      const crop1 = `crop=${w}:${h}:(in_w-${w})*${v1.offsetX}/100:(in_h-${h})*${v1.offsetY}/100`;
      const crop2 = `crop=${w}:${h}:(in_w-${w})*${v2.offsetX}/100:(in_h-${h})*${v2.offsetY}/100`;

      const filter = `
        [0:v]trim=start=${v1.start}:end=${v1.end},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=increase,${crop1}[vid1];
        [1:v]trim=start=${v2.start}:end=${v2.end},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=increase,${crop2}[vid2];
        [vid1][vid2]${isH ? 'hstack' : 'vstack'}=inputs=2[outv]
      `.trim().replace(/\n/g, '');

      const aFilter = `
        [0:a]atrim=start=${v1.start}:end=${v1.end},asetpts=PTS-STARTPTS[aud1];
        [1:a]atrim=start=${v2.start}:end=${v2.end},asetpts=PTS-STARTPTS[aud2];
        [aud1][aud2]amix=inputs=2:duration=longest[outa]
      `.trim().replace(/\n/g, '');

      await ffmpeg.exec([
        '-i', 'v1.mp4',
        '-i', 'v2.mp4',
        '-filter_complex', `${filter};${aFilter}`,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `diff_${stackMode}.mp4`;
      a.click();

    } catch (e) {
      console.error(e);
      alert('Error processing video. Check console.');
    } finally {
      setProcessing(false);
    }
  };

  const renderVideoControls = (num) => {
    const v = num === 1 ? v1 : v2;
    const updateFn = num === 1 ? updateV1 : updateV2;
    const isPlayingInd = num === 1 ? playingV1 : playingV2;
    const vRef = num === 1 ? v1Ref : v2Ref;
    
    const setV = num === 1 ? setV1 : setV2;

    const unloadFn = () => {
      setV({ file: null, url: '', start: 0, end: 5, offsetX: 50, offsetY: 50, duration: 0 });
    };
    
    return (
      <div className="glass-panel control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Video {num} Controls</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="icon-btn" 
              onClick={unloadFn}
              title={`Unload Video ${num}`}
            >
              <X size={18} />
            </button>
            <button 
              className="btn" 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} 
              onClick={() => togglePlayIndividual(num)}
              title={`Play Video ${num} individually`}
            >
              {isPlayingInd ? <Pause size={14} /> : <Play size={14} />} 
              {isPlayingInd ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <label>Trim Timeline ({v.duration.toFixed(1)}s)</label>
          <div style={{ padding: '0 8px', marginTop: '8px', marginBottom: '8px' }}>
            <Slider
              range
              min={0}
              max={v.duration}
              step={0.01}
              value={[v.start, v.end]}
              onChange={(val) => {
                const [start, end] = val;
                // Seek to whichever thumb was moved
                if (vRef.current) {
                  if (start !== v.start) {
                    vRef.current.currentTime = start;
                  } else if (end !== v.end) {
                    vRef.current.currentTime = end;
                  }
                }
                updateFn({ start, end });
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>{v.start.toFixed(2)}s</span>
            <span>{v.end.toFixed(2)}s</span>
          </div>
        </div>

        <div className="control-group">
          <label>Pan X ({v.offsetX}%)</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={v.offsetX} 
            onChange={e => updateFn({ offsetX: parseInt(e.target.value) })} 
          />
        </div>

        <div className="control-group">
          <label>Pan Y ({v.offsetY}%)</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={v.offsetY} 
            onChange={e => updateFn({ offsetY: parseInt(e.target.value) })} 
          />
        </div>
      </div>
    );
  };

  if (!ready) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <Video className="spin" style={{ width: 48, height: 48, color: 'var(--accent-color)', marginBottom: '1rem' }} />
          <h2>Loading FFmpeg Core...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div>
        <h1>Video Diff Tool</h1>
        <p className="subtitle">Sync, frame, and combine two videos side-by-side entirely in your browser.</p>
      </div>

      <div className="workspace">
        {!v1.file ? (
          <label className="dropzone">
            <Upload />
            <div>
              <h3>Upload Video 1</h3>
              <p>Click or drag to load</p>
            </div>
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 1)} />
          </label>
        ) : (
          renderVideoControls(1)
        )}

        {!v2.file ? (
          <label className="dropzone">
            <Upload />
            <div>
              <h3>Upload Video 2</h3>
              <p>Click or drag to load</p>
            </div>
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 2)} />
          </label>
        ) : (
          renderVideoControls(2)
        )}
      </div>

      {(v1.file || v2.file) && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Preview & Sync</h3>
            <button className="btn primary" onClick={togglePlaySync}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />} 
              {isPlaying ? 'Pause Synced Preview' : 'Play Synced Preview'}
            </button>
          </div>
          
          <div className={`video-preview-container ${stackMode === 'vertical' ? 'vertical-stack' : ''}`}>
            
            <div className="stack-toggle-overlay">
              <button 
                className={`stack-btn ${stackMode === 'horizontal' ? 'active' : ''}`}
                onClick={() => setStackMode('horizontal')}
                title="Horizontal Stack"
              >
                <LayoutTemplate size={16} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <button 
                className={`stack-btn ${stackMode === 'vertical' ? 'active' : ''}`}
                onClick={() => setStackMode('vertical')}
                title="Vertical Stack"
              >
                <SplitSquareHorizontal size={16} />
              </button>
            </div>

            <div className={`video-half ${stackMode === 'vertical' ? 'vertical' : ''}`}>
              {v1.url && (
                <>
                  <video 
                    ref={v1Ref} 
                    src={v1.url} 
                    className="video-element"
                    style={{ 
                      objectFit: 'cover', 
                      objectPosition: `${v1.offsetX}% ${v1.offsetY}%` 
                    }} 
                    muted 
                  />
                  <div className="video-overlay-info" ref={v1TimeRef}>00:00.00 | Frame 0</div>
                </>
              )}
            </div>
            <div className={`video-half ${stackMode === 'vertical' ? 'vertical' : ''}`} style={{ borderLeft: stackMode === 'horizontal' ? '1px solid var(--panel-border)' : 'none', borderTop: stackMode === 'vertical' ? '1px solid var(--panel-border)' : 'none' }}>
              {v2.url && (
                <>
                  <video 
                    ref={v2Ref} 
                    src={v2.url} 
                    className="video-element"
                    style={{ 
                      objectFit: 'cover', 
                      objectPosition: `${v2.offsetX}% ${v2.offsetY}%` 
                    }} 
                    muted 
                  />
                  <div className="video-overlay-info" ref={v2TimeRef}>00:00.00 | Frame 0</div>
                </>
              )}
            </div>
          </div>

          <div className="actions-bar" style={{ justifyContent: 'flex-end' }}>

            <button 
              className="btn primary" 
              disabled={!v1.file || !v2.file || processing}
              onClick={doExport}
            >
              <Download size={18} />
              {processing ? `Exporting (${progress}%)` : 'Export Video'}
            </button>
          </div>

          {processing && (
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-text">Processing frames... This may take a moment.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

