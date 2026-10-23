'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, ShieldAlert, Loader2, Volume2, Pill, RotateCcw, Mic, X, ScanLine, Sparkles, MapPin, ExternalLink, IndianRupee, Store, Stethoscope, Navigation } from 'lucide-react';
import Tesseract from 'tesseract.js';

interface JanAushadhiData {
  genericName: string;
  brandPrice: number;
  janAushadhiPrice: number;
  savingsPercent: number;
  unit: string;
}

const VOICES = [
  { id: 'alice', name: 'Alice — Clear Educator (Female)' },
  { id: 'eric', name: 'Eric — Smooth Trustworthy (Male)' },
  { id: 'brian', name: 'Brian — Deep Comforting (Male)' },
  { id: 'matilda', name: 'Matilda — Professional (Female)' },
  { id: 'daniel', name: 'Daniel — Broadcaster (Male)' },
  { id: 'bill', name: 'Bill — Wise Mature (Male)' },
];

function CameraModal({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flipView, setFlipView] = useState(true);

  useEffect(() => {
    const startCamera = async () => {
      try {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          setError('Camera access is not supported on this browser or requires HTTPS. Please use "Upload Image" instead.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setReady(true);
          };
        }
      } catch (e: any) {
        if (e.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access in your browser settings, or use "Upload Image" instead.');
        } else if (e.name === 'NotFoundError') {
          setError('No camera found on this device. Please use "Upload Image" instead.');
        } else {
          setError(e.message || 'Could not access camera. Please use "Upload Image" instead.');
        }
      }
    };
    startCamera();
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    if (!videoRef.current || !ready) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `medicine-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      onCapture(file);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="camera-overlay">
      <button onClick={onClose} className="camera-close-btn" aria-label="Close camera">
        <X className="w-4 h-4" />
      </button>

      {error ? (
        <div className="camera-message">
          <p className="mb-4">⚠️ {error}</p>
          <button onClick={onClose} className="camera-btn">Close</button>
        </div>
      ) : (
        <div className="w-full max-w-2xl flex flex-col items-center gap-4">
          <p className="camera-copy mb-2">
            📷 Hold the medicine strip in front of the camera. Make sure the name is clearly visible.
          </p>
          <div className="camera-preview w-full relative">
            <video
              ref={videoRef}
              className="w-full h-auto max-h-[65vh] object-contain"
              style={{ transform: flipView ? 'scaleX(-1)' : 'none' }}
              playsInline muted
            />
            {!ready && (
              <div className="camera-loading">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-sm">Starting camera...</p>
              </div>
            )}
            {ready && <div className="camera-frame" />}
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <button onClick={onClose} className="camera-btn">Cancel</button>
            <button onClick={() => setFlipView(!flipView)} className="camera-btn">🔄 Flip View</button>
            <button
              onClick={capture}
              disabled={!ready}
              className="camera-capture-btn"
            >
              <Camera className="w-4 h-4" />
              Capture Photo
            </button>
          </div>
          <p className="camera-copy text-xs">
            {flipView ? 'View is un-mirrored (text reads correctly)' : 'View is mirrored — tap "Flip View" if text looks backwards'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');
  const [drugName, setDrugName] = useState<string>('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioMode, setAudioMode] = useState<'elevenlabs' | 'pollinations' | 'browser' | null>(null);
  const [voice, setVoice] = useState('alice');
  const [showCamera, setShowCamera] = useState(false);
  const [janAushadhi, setJanAushadhi] = useState<JanAushadhiData | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioUrl && audioRef.current && (audioMode === 'elevenlabs' || audioMode === 'pollinations')) {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [audioUrl, audioMode]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.getVoices();
  }, []);

  const reset = () => {
    setPreview(null); setOcrProgress(0); setOcrText(null); setVerdict(null);
    setError(null); setSource(''); setDrugName(''); setAudioUrl(null);
    setPlaying(false); setAudioMode(null); setJanAushadhi(null);
    if (audioRef.current) audioRef.current.pause();
    window.speechSynthesis.cancel();
  };

  const cleanTextForAudio = (text: string, maxLen = 4000) =>
    text.normalize('NFC')
      .replace(/[^\u0000-\u007F\u0900-\u097F\u2000-\u206F\s]/g, '')
      .replace(/\*\*/g, '').replace(/[_*]/g, '').replace(/^---$/gm, '')
      .replace(/^•\s*/gm, '').replace(/\t/g, ' ').replace(/\n{3,}/g, '\n\n')
      .trim().slice(0, maxLen);

  const processImage = async (selectedFile: File) => {
    setPreview(URL.createObjectURL(selectedFile));
    setOcrProgress(0); setOcrText(null); setVerdict(null); setError(null);
    setAudioUrl(null); setAudioMode(null); setLoading(true);
    try {
      const worker = await Tesseract.createWorker('eng+hin', 1, {
        logger: (m: any) => { if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100)); },
      });
      const { data: { text: extractedText } } = await worker.recognize(selectedFile);
      await worker.terminate();
      setOcrText(extractedText.trim());
      if (!extractedText.trim() || extractedText.trim().length < 5) {
        setError('No text detected. Please take a clearer photo with the medicine name visible.'); return;
      }
      const formData = new FormData();
      formData.append('type', 'text');
      formData.append('text', extractedText);
      const res = await fetch('/api/verify', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI lookup failed');
      setVerdict(data.verdict); setSource(data.source || ''); setDrugName(data.drugName || '');
      setJanAushadhi(data.janAushadhi || null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      processImage(f);
    }
    e.target.value = '';
  };

  const openNearbySearch = (type: 'jan_aushadhi' | 'chemist' | 'clinic') => {
    const queries = {
      jan_aushadhi: 'Pradhan Mantri Jan Aushadhi Kendra near me',
      chemist: '24 hour chemist medical store pharmacy near me',
      clinic: 'doctor clinic general physician hospital near me',
    };
    const query = queries[type];

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}/@${latitude},${longitude},14z`, '_blank');
        },
        () => {
          window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
        },
        { timeout: 6000 }
      );
    } else {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
    }
  };

  const handleCameraClick = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      setShowCamera(true);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const generateAudio = async () => {
    if (!verdict) return;
    setAudioLoading(true); setAudioUrl(null); setPlaying(false); setAudioMode(null); setError(null);
    const cleanText = cleanTextForAudio(verdict, 4000);
    if (!cleanText) { setError('No readable text to convert to audio'); setAudioLoading(false); return; }
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cleanText, voice }) });
      if (res.ok) { const blob = await res.blob(); if (blob.size > 100) { setAudioUrl(URL.createObjectURL(blob)); setAudioMode('elevenlabs'); setAudioLoading(false); return; } }
      throw new Error('ElevenLabs failed');
    } catch (e: any) { console.log('Trying Pollinations:', e.message); }
    try {
      const pt = cleanTextForAudio(verdict, 250);
      if (pt && pt.length > 10) {
        const pUrl = `https://text.pollinations.ai/${encodeURIComponent(pt)}?model=openai-audio&voice=alloy`;
        const tr = await fetch(pUrl);
        if (tr.ok && (tr.headers.get('content-type') || '').includes('audio')) {
          const blob = await tr.blob(); setAudioUrl(URL.createObjectURL(blob)); setAudioMode('pollinations'); setAudioLoading(false); return;
        }
      }
    } catch (e: any) { console.log('Trying browser TTS:', e.message); }
    try {
      const bt = cleanTextForAudio(verdict, 3000);
      const utterance = new SpeechSynthesisUtterance(bt);
      utterance.lang = 'hi-IN'; utterance.rate = 0.9;
      const vs = window.speechSynthesis.getVoices();
      const hv = vs.find(v => v.lang.startsWith('hi')); if (hv) utterance.voice = hv;
      utterance.onstart = () => setPlaying(true); utterance.onend = () => setPlaying(false);
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); setAudioMode('browser');
    } catch (e: any) { setError('All audio methods failed'); }
    setAudioLoading(false);
  };

  const replay = () => {
    if (audioMode === 'browser') { generateAudio(); return; }
    if (audioRef.current && audioUrl) { audioRef.current.currentTime = 0; audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  return (
    <main className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-mark">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h1>MediScan AI</h1>
            <p>Scan medicines → Get info in Hindi &amp; English</p>
          </div>
          <div className="header-badge">
            <span className="status-dot" />
            <span>AI Live</span>
          </div>
        </div>
      </header>

      <div className="app-content">
        {/* ── Warning ── */}
        <div className="notice-card rise-in">
          ⚠️ <b>Doctor's advice is essential.</b> This app provides reference information only. Always consult a qualified doctor before taking any medicine.
        </div>

        {/* ── Hero scan card ── */}
        <div className="scan-card rise-in">
          <div className="scan-eyebrow">
            <ScanLine className="w-3 h-3" />
            AI-POWERED MEDICINE SCANNER
          </div>
          <h2>Scan Your <span>Medicine</span></h2>
          <p className="scan-description">
            Take a photo or upload an image of any medicine strip. Get instant info — what it is, uses, dosage &amp; side effects in Hindi &amp; English.
          </p>

          {/* Native file & camera inputs */}
          <input
            id="medicine-file-upload"
            ref={uploadRef}
            type="file"
            accept="image/*"
            onChange={onFileSelected}
            style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
          />
          <input
            id="medicine-camera-capture"
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileSelected}
            style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
          />

          <div className="scan-actions">
            <button type="button" onClick={handleCameraClick} className="scan-btn">
              <div className="scan-btn-icon"><Camera className="w-5 h-5" /></div>
              <span className="scan-btn-label">Take Photo</span>
              <span className="scan-btn-sub">Use camera</span>
            </button>
            <label htmlFor="medicine-file-upload" className="scan-btn" style={{ cursor: 'pointer' }}>
              <div className="scan-btn-icon"><Upload className="w-5 h-5" /></div>
              <span className="scan-btn-label">Upload Image</span>
              <span className="scan-btn-sub">From gallery</span>
            </label>
          </div>

          {(preview || verdict) && (
            <div className="flex justify-center">
              <button onClick={reset} className="reset-btn">
                <RotateCcw className="w-3.5 h-3.5" />
                Scan Another Medicine
              </button>
            </div>
          )}
        </div>

        {/* ── Scanned image ── */}
        {preview && (
          <div className="glass-card rise-in p-4">
            <p className="result-card"><span className="section-label">📷 Scanned Image</span></p>
            <img src={preview} alt="Medicine scan" className="scanned-img mt-3" />
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="glass-card rise-in p-5">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>
                {ocrProgress < 100 ? `Reading text from image... ${ocrProgress}%` : 'Getting medicine info from FDA + AI...'}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${ocrProgress < 100 ? ocrProgress : 100}%` }} />
            </div>
          </div>
        )}

        {/* ── OCR text ── */}
        {ocrText && (
          <div className="glass-card rise-in p-4">
            <p className="section-label" style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>📝 Detected Text</p>
            <div className="ocr-text">{ocrText}</div>
          </div>
        )}

        {/* ── Verdict ── */}
        {verdict && (
          <div className="verdict-card rise-in">
            <div className="verdict-header">
              <div className="verdict-title">
                <div className="verdict-title-icon"><ShieldAlert className="w-4 h-4" /></div>
                Medicine Information
              </div>
              {source && <span className="source-badge">{source}</span>}
            </div>
            <div className="verdict-body">{verdict}</div>

            {/* ── Jan Aushadhi Savings & Kendra Locator ── */}
            {janAushadhi && (
              <div style={{ margin: '0 1.375rem 1.25rem', padding: '1.125rem', background: 'var(--panel-secondary)', border: '1px solid rgba(201, 243, 106, 0.25)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>🏛️</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        PM Jan Aushadhi Kendra Alternative
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                        Govt. Certified Generic Medicine
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#09130F', background: 'var(--lime)', padding: '0.25rem 0.65rem', borderRadius: '100px', letterSpacing: '0.04em' }}>
                    SAVE {janAushadhi.savingsPercent}%
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                  <span>Generic Salt:</span> <b style={{ color: 'var(--text)' }}>{janAushadhi.genericName}</b> <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>({janAushadhi.unit})</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div style={{ background: 'var(--panel)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Branded Market Price</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--orange)', textDecoration: 'line-through', marginTop: '0.2rem' }}>
                      ₹{janAushadhi.brandPrice}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(201, 243, 106, 0.1)', border: '1px solid rgba(201, 243, 106, 0.3)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--lime)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Jan Aushadhi Gov Price</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--lime)', marginTop: '0.2rem' }}>
                      ₹{janAushadhi.janAushadhiPrice}
                    </div>
                  </div>
                </div>

                {/* ── Live Healthcare Finder (GPS Enabled) ── */}
                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.6rem' }}>
                    <Navigation className="w-3.5 h-3.5 text-[#C9F36A]" />
                    <span>Find Near Your Live Location:</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {/* 1. Jan Aushadhi */}
                    <button
                      type="button"
                      onClick={() => openNearbySearch('jan_aushadhi')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '0.65rem 0.75rem',
                        background: 'rgba(201, 243, 106, 0.12)',
                        border: '1px solid rgba(201, 243, 106, 0.35)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '1rem' }}>🏛️</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--lime)' }}>Jan Aushadhi</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>Govt Generic (Save 80%)</div>
                    </button>

                    {/* 2. Private Chemist */}
                    <button
                      type="button"
                      onClick={() => openNearbySearch('chemist')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '0.65rem 0.75rem',
                        background: 'var(--panel)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.3rem' }}>
                        <Store className="w-4 h-4 text-[#93C7FF]" />
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>Private Chemist</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>24/7 Apollo & Local Store</div>
                    </button>

                    {/* 3. Doctor / Clinic */}
                    <button
                      type="button"
                      onClick={() => openNearbySearch('clinic')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '0.65rem 0.75rem',
                        background: 'var(--panel)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.3rem' }}>
                        <Stethoscope className="w-4 h-4 text-[#FF9B69]" />
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>Doctor / Clinic</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>GPs & Health Centres</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Audio panel ── */}
            <div style={{ padding: '0 1.375rem 1.375rem' }}>
              <div className="audio-panel">
                <div className="audio-panel-header">
                  <div className="audio-panel-title">
                    <Mic className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    सुनें (Listen)
                  </div>
                  {!audioUrl && audioMode !== 'browser' && (
                    <select value={voice} onChange={(e) => setVoice(e.target.value)} className="voice-select">
                      {VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                </div>

                {!audioUrl && audioMode !== 'browser' && (
                  <button onClick={generateAudio} disabled={audioLoading} className="listen-btn">
                    {audioLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> ऑडियो तैयार हो रहा है...</>
                    ) : (
                      <><Volume2 className="w-4 h-4" /> सुनें (Listen)</>
                    )}
                  </button>
                )}

                {(audioMode === 'elevenlabs' || audioMode === 'pollinations') && audioUrl && (
                  <div className="audio-player-wrap">
                    <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} autoPlay controls />
                    <button onClick={replay} className="replay-btn"><RotateCcw className="w-3.5 h-3.5" /> फिर से सुनें (Listen Again)</button>
                  </div>
                )}

                {audioMode === 'browser' && (
                  <div>
                    <div className="browser-tts-status">
                      {playing ? '🔊 चल रहा है... (Playing...)' : '✅ पूरा हुआ (Done)'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {playing
                        ? <button onClick={() => { window.speechSynthesis.cancel(); setPlaying(false); }} className="replay-btn">⏹ रोकें (Stop)</button>
                        : <button onClick={replay} className="replay-btn">🔄 फिर से (Replay)</button>
                      }
                      <button onClick={() => { setAudioMode(null); setPlaying(false); window.speechSynthesis.cancel(); }} className="replay-btn">✕ बंद करें</button>
                    </div>
                  </div>
                )}

                <p className="audio-caption">🎙️ Auto-fallback: ElevenLabs → Pollinations → Browser TTS</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && <div className="error-card rise-in">⚠️ {error}</div>}

        {/* ── Footer ── */}
        <footer className="app-footer">
          MediScan AI • Tesseract OCR + OpenFDA + Wikipedia + Pollinations AI + ElevenLabs TTS<br />
          <b>Always consult a qualified doctor before taking any medicine.</b>
        </footer>
      </div>

      {showCamera && (
        <CameraModal onCapture={(file) => { setShowCamera(false); processImage(file); }} onClose={() => setShowCamera(false)} />
      )}
    </main>
  );
}