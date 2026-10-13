import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Optional camera scanner. It never blocks anything: if the camera fails,
// the caller's manual serial entry keeps working.
export default function Scanner({ onScan }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  // useId() is stable and unique per component instance, so the viewport id
  // survives the React 18 StrictMode remount without a random suffix.
  const elementId = useRef(`qr-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`);

  useEffect(() => {
    if (!active) return undefined;
    const scanner = new Html5Qrcode(elementId.current);
    let startPromise;
    try {
      startPromise = scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          setActive(false);
          onScanRef.current(text);
        },
        () => {}
      );
    } catch {
      startPromise = Promise.reject(new Error('camera'));
    }
    startPromise.catch(() => {
      setError('Camera is not available. Type the serial in the box above instead.');
      setActive(false);
    });

    return () => {
      startPromise
        .then(() => scanner.stop())
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, [active]);

  return (
    <div className="scanner-box">
      {!active ? (
        <button
          type="button"
          className="btn secondary block"
          onClick={() => {
            setError('');
            setActive(true);
          }}
        >
          Scan QR with camera
        </button>
      ) : (
        <>
          <button type="button" className="btn secondary block" onClick={() => setActive(false)}>
            Stop camera
          </button>
          <div id={elementId.current} className="scanner-view" />
        </>
      )}
      {error && <p className="notice" role="alert">{error}</p>}
    </div>
  );
}
