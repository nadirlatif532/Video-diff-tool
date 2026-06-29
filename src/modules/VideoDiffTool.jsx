import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import fixWebmDuration from 'fix-webm-duration';
import { Upload, Video, Play, Pause, Download, LayoutTemplate, SplitSquareHorizontal, X } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { Tooltip, SliderInput } from '../components/ui';
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
  const [exportQuality, setExportQuality] = useState('720p');

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
      instance.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });
      // toBlobURL fetches from our local server (same-origin, always allowed),
      // then wraps the file in a blob: URL. The FFmpeg module worker then
      // does import(blobURL) which works because the ESM build has export default.
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await instance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
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
      const isH = stackMode === 'horizontal';
      const dur1 = v1.end - v1.start;
      const dur2 = v2.end - v2.start;
      const totalDuration = Math.max(dur1, dur2);

      // DIAGNOSTIC — open DevTools (F12) > Console to verify these values
      console.log('[Export] v1:', { start: v1.start, end: v1.end, dur: dur1 });
      console.log('[Export] v2:', { start: v2.start, end: v2.end, dur: dur2 });
      console.log('[Export] totalDuration:', totalDuration);

      // Canvas pane dimensions:
      // Horizontal: each pane is portrait (w x h), side by side → total = 2w x h
      // Vertical: each pane is landscape (w x h), stacked → total = w x 2h
      let paneW, paneH;
      if (exportQuality === '1080p')     { paneW = 1920; paneH = 1080; }
      else if (exportQuality === '720p') { paneW = 1280; paneH = 720;  }
      else                               { paneW = 960;  paneH = 540;  }

      const canvasW = isH ? paneW : paneW;
      const canvasH = isH ? paneH : paneH;  // each pane IS the full frame
      // For hstack: split width in half per pane; for vstack: split height in half per pane
      const halfW = isH ? Math.floor(paneW / 2) : paneW;
      const halfH = isH ? paneH : Math.floor(paneH / 2);

      // Create hidden video elements — must wait for metadata before seeking
      const makeVideo = (url, start) => new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.onerror = () => reject(new Error('Video failed to load'));
        vid.onloadedmetadata = () => {
          if (start <= 0) {
            resolve(vid);
          } else {
            vid.onseeked = () => resolve(vid);
            vid.currentTime = start;
          }
        };
        vid.src = url;
        vid.load();
      });

      const [vid1, vid2] = await Promise.all([
        makeVideo(v1.url, v1.start),
        makeVideo(v2.url, v2.start),
      ]);

      // Attach to DOM — browsers throttle/stop detached media elements after a few seconds
      const hiddenStyle = 'position:fixed;opacity:0;width:1px;height:1px;top:-9999px;left:-9999px;pointer-events:none;';
      vid1.style.cssText = hiddenStyle;
      vid2.style.cssText = hiddenStyle;
      document.body.appendChild(vid1);
      document.body.appendChild(vid2);

      // Off-screen canvas
      const canvas = document.createElement('canvas');
      canvas.width  = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      // Draw a video frame into a pane using object-fit: contain logic
      const containDraw = (vid, paneX, paneY, pW, pH) => {
        const vw = vid.videoWidth  || pW;
        const vh = vid.videoHeight || pH;
        const scale = Math.min(pW / vw, pH / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = paneX + (pW - dw) / 2;
        const dy = paneY + (pH - dh) / 2;
        ctx.drawImage(vid, dx, dy, dw, dh);
      };

      const drawBoth = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasW, canvasH);
        if (isH) {
          containDraw(vid1, 0,     0, halfW, halfH);
          containDraw(vid2, halfW, 0, halfW, halfH);
        } else {
          containDraw(vid1, 0, 0,     halfW, halfH);
          containDraw(vid2, 0, halfH, halfW, halfH);
        }
      };

      // Prefer native MP4 (Chrome 130+), fall back to WebM
      const nativeMp4 = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')
                     || MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
                     || MediaRecorder.isTypeSupported('video/mp4');
      const mimeType = nativeMp4
        ? (['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)))
        : (['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm');
      console.log('[Export] mimeType:', mimeType, '| nativeMp4:', nativeMp4);

      const recorder = new MediaRecorder(canvas.captureStream(30), {
        mimeType,
        videoBitsPerSecond: exportQuality === '1080p' ? 12_000_000
                          : exportQuality === '720p'  ?  6_000_000
                                                      :  3_000_000,
      });

      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      // Draw first frame before starting recorder
      drawBoth();

      recorder.start(100);
      await Promise.all([vid1.play(), vid2.play()]);

      let rafId;
      let v1done = false;
      let v2done = false;
      let lastLogSec = -1;

      // Fallback: mark done if video ends naturally (file shorter than end point)
      vid1.addEventListener('ended', () => { console.log('[Export] vid1 ended naturally at', vid1.currentTime); v1done = true; });
      vid2.addEventListener('ended', () => { console.log('[Export] vid2 ended naturally at', vid2.currentTime); v2done = true; });

      await new Promise((resolve) => {
        const drawFrame = () => {
          const ct1 = vid1.currentTime;
          const ct2 = vid2.currentTime;

          // Log every second so we can see currentTime progressing
          const logSec = Math.floor(Math.max(ct1, ct2));
          if (logSec !== lastLogSec) {
            console.log(`[Export] t=${logSec}s  vid1.ct=${ct1.toFixed(2)} v1.end=${v1.end}  vid2.ct=${ct2.toFixed(2)} v2.end=${v2.end}  v1done=${v1done} v2done=${v2done}`);
            lastLogSec = logSec;
          }

          // Track each clip by its actual playback position, not wall clock
          if (!v1done && ct1 >= v1.end) {
            vid1.pause();
            v1done = true;
            console.log('[Export] vid1 done at', ct1);
          }
          if (!v2done && ct2 >= v2.end) {
            vid2.pause();
            v2done = true;
            console.log('[Export] vid2 done at', ct2);
          }

          // Progress based on the clip that has more left to play
          const elapsed1 = v1done ? dur1 : ct1 - v1.start;
          const elapsed2 = v2done ? dur2 : ct2 - v2.start;
          const progress = Math.max(elapsed1 / dur1, elapsed2 / dur2);
          setProgress(Math.min(100, Math.round(progress * 100)));

          drawBoth();

          if (v1done && v2done) {
            recorder.stop();
          } else {
            rafId = requestAnimationFrame(drawFrame);
          }
        };
        rafId = requestAnimationFrame(drawFrame);
        recorder.onstop = resolve;
      });

      cancelAnimationFrame(rafId);
      document.body.removeChild(vid1);
      document.body.removeChild(vid2);

      const rawBlob = new Blob(chunks, { type: mimeType });

      let finalBlob;
      if (nativeMp4) {
        // Browser recorded natively as MP4 — use directly
        finalBlob = rawBlob;
      } else {
        // Recorded as WebM — remux to MP4 via FFmpeg stream copy (no re-encode, fast)
        if (!ffmpeg || !ffmpeg.loaded) throw new Error('FFmpeg not ready for remux');
        await ffmpeg.writeFile('recorded.webm', new Uint8Array(await rawBlob.arrayBuffer()));
        const ret = await ffmpeg.exec(['-i', 'recorded.webm', '-c', 'copy', 'output.mp4']);
        if (ret !== 0) {
          // Fallback: use the WebM with fixed duration if remux fails
          console.warn('[Export] remux failed, falling back to fixed WebM');
          finalBlob = await fixWebmDuration(rawBlob, totalDuration * 1000, { logger: false });
        } else {
          const data = await ffmpeg.readFile('output.mp4');
          finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
          await ffmpeg.deleteFile('recorded.webm');
          await ffmpeg.deleteFile('output.mp4');
        }
      }

      const url = URL.createObjectURL(finalBlob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `diff_${stackMode}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

    } catch (e) {
      console.error(e);
      alert('Export failed: ' + e.message);
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
          <label><Tooltip label="Trim Timeline" text="Use the sliders to define the start and end points of the video. This is useful for synchronizing the two videos." /> ({v.duration.toFixed(1)}s)</label>
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
          <label><Tooltip label="Pan X" text="Move the focal point horizontally. Useful if the two cameras aren't perfectly aligned." /></label>
          <SliderInput value={v.offsetX} onChange={val => updateFn({ offsetX: val })} min={0} max={100} step={1} />
        </div>

        <div className="control-group">
          <label><Tooltip label="Pan Y" text="Move the focal point vertically." /></label>
          <SliderInput value={v.offsetY} onChange={val => updateFn({ offsetY: val })} min={0} max={100} step={1} />
        </div>
      </div>
    );
  };

  if (!ready) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <Video className="spin" style={{ width: 48, height: 48, color: 'var(--accent)', marginBottom: '1rem' }} />
          <h2>Loading FFmpeg Core...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Video Diff Tool</h1>
        <p className="subtitle" style={{ margin: 0 }}>Sync, frame, and export two videos side-by-side.</p>
      </div>

      {/* Preview — full width, prominent */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className={`stack-btn ${stackMode === 'horizontal' ? 'active' : ''}`} onClick={() => setStackMode('horizontal')}>
              Horizontal Stack
            </button>
            <button className={`stack-btn ${stackMode === 'vertical' ? 'active' : ''}`} onClick={() => setStackMode('vertical')}>
              Vertical Stack
            </button>
          </div>
          {(v1.file && v2.file) && (
            <button className="btn primary" style={{ padding: '7px 18px' }} onClick={togglePlaySync}>
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              {isPlaying ? 'Pause Sync' : 'Play Sync'}
            </button>
          )}
        </div>

        <div className={`video-preview-container ${stackMode === 'vertical' ? 'vertical-stack' : ''}`}
          style={{ height: stackMode === 'vertical' ? '60vh' : '45vh' }}>
          <div className={`video-half ${stackMode === 'vertical' ? 'vertical' : ''}`}>
            {v1.url
              ? <>
                  <video ref={v1Ref} src={v1.url} className="video-element"
                    style={{ objectFit: 'contain', objectPosition: `${v1.offsetX}% ${v1.offsetY}%` }} muted />
                  <div className="video-overlay-info" ref={v1TimeRef}>00:00.00 | Frame 0</div>
                </>
              : <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                  <Upload size={28} />
                  <span style={{ fontSize: '0.9rem' }}>Upload Video 1 below</span>
                </div>
            }
          </div>
          <div className={`video-half ${stackMode === 'vertical' ? 'vertical' : ''}`}
            style={{ borderLeft: stackMode === 'horizontal' ? '1px solid var(--border)' : 'none', borderTop: stackMode === 'vertical' ? '1px solid var(--border)' : 'none' }}>
            {v2.url
              ? <>
                  <video ref={v2Ref} src={v2.url} className="video-element"
                    style={{ objectFit: 'contain', objectPosition: `${v2.offsetX}% ${v2.offsetY}%` }} muted />
                  <div className="video-overlay-info" ref={v2TimeRef}>00:00.00 | Frame 0</div>
                </>
              : <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                  <Upload size={28} />
                  <span style={{ fontSize: '0.9rem' }}>Upload Video 2 below</span>
                </div>
            }
          </div>
        </div>
      </div>

      {/* Video controls — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {!v1.file ? (
          <label className="dropzone">
            <Upload size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Upload Video 1</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click or drag to load</p>
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 1)} />
          </label>
        ) : renderVideoControls(1)}

        {!v2.file ? (
          <label className="dropzone">
            <Upload size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Upload Video 2</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click or drag to load</p>
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => handleFileChange(e, 2)} />
          </label>
        ) : renderVideoControls(2)}
      </div>

      {/* Export bar — full width at bottom */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Export Quality
          </label>
          <select value={exportQuality} onChange={e => setExportQuality(e.target.value)}
            style={{ background: 'var(--shadow-grey-800)', border: '1px solid var(--border)', maxWidth: '180px' }}>
            <option value="1080p">1080p — High Quality</option>
            <option value="720p">720p — Balanced</option>
            <option value="540p">540p — Draft</option>
          </select>
          <div style={{ flex: 1 }}>
            {processing && (
              <div className="progress-bar-bg" style={{ margin: 0 }}>
                <div className="progress-bar-fill" style={{ transform: `scaleX(${progress / 100})` }} />
              </div>
            )}
          </div>
          <button className="btn primary"
            disabled={!v1.file || !v2.file || processing} onClick={doExport}
            style={{ whiteSpace: 'nowrap', padding: '10px 24px' }}>
            <Download size={16} />
            {processing ? `Exporting… ${progress}%` : 'Export MP4'}
          </button>
        </div>
      </div>

    </div>
  );
}
