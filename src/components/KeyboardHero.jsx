import React, { useEffect, useRef, useState } from 'react';
import * as I from 'lucide-react';
import { CinematicKeyboard, supportsWebGL } from '../scene/cinematic.js';
import { CHAPTERS, DURATION } from '../scene/config.js';

const POSTER = '/storyboard/hero-poster.jpg';

const chapterAt = (t) => {
  let name = CHAPTERS[0].name;
  let index = 0;
  CHAPTERS.forEach((c, i) => {
    if (t >= c.t) {
      name = c.name;
      index = i;
    }
  });
  return { name, index };
};

export default function KeyboardHero() {
  const hostRef = useRef(null);
  const barRef = useRef(null);
  const chapterRef = useRef(null);
  const engineRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [rec, setRec] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    if (!supportsWebGL()) {
      setFallback(true);
      return undefined;
    }

    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let engine;
    try {
      engine = new CinematicKeyboard(host, {
        onTime: (t) => {
          if (barRef.current) barRef.current.style.width = `${(t / DURATION) * 100}%`;
          if (chapterRef.current) {
            const { name } = chapterAt(t);
            if (chapterRef.current.textContent !== name) chapterRef.current.textContent = name;
          }
        },
      });
    } catch (err) {
      console.warn('WebGL scene failed', err);
      setFallback(true);
      return undefined;
    }

    engineRef.current = engine;
    if (import.meta.env.DEV) window.__kbEngine = engine; // أداة معاينة أثناء التطوير
    setReady(true);

    if (reduced) {
      engine.seek(21.4); // لقطة البطل الثابتة
      engine.pause();
      setPlaying(false);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const toggle = () => {
    const e = engineRef.current;
    if (!e) return;
    setPlaying(e.toggle());
  };

  const jump = (i) => {
    const e = engineRef.current;
    if (!e) return;
    e.seek(CHAPTERS[i].t + 0.05);
    e.play();
    setPlaying(true);
  };

  const record = () => {
    const e = engineRef.current;
    if (!e || rec !== null) return;
    const ok = e.startRecording(
      (p) => setRec(p),
      () => setRec(null)
    );
    if (!ok) setRec(null);
  };

  const scrub = (ev) => {
    const e = engineRef.current;
    if (!e) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    e.seek(x * DURATION);
  };

  return (
    <div className={`kbScene${ready ? ' isReady' : ''}`}>
      {fallback ? (
        <div className="kbFallback" style={{ backgroundImage: `url(${POSTER})` }} />
      ) : (
        <div className="kbCanvas" ref={hostRef} />
      )}
      <div className="kbScrim" />
      <div className="kbVignette" />

      {!fallback && (
        <div className="kbControls" dir="rtl">
          <button className="kbPlay" onClick={toggle} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}>
            {playing ? <I.Pause /> : <I.Play />}
          </button>

          <div className="kbTrack">
            <div className="kbMeta">
              <span className="kbDot" />
              <b ref={chapterRef}>{CHAPTERS[0].name}</b>
              <small>مشهد سينمائي ٣D — لوحة مفاتيح وردية</small>
            </div>
            <div className="kbBar" onClick={scrub} role="presentation">
              <i ref={barRef} />
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.name}
                  className="kbMark"
                  style={{ insetInlineStart: `${(c.t / DURATION) * 100}%` }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    jump(i);
                  }}
                  title={c.name}
                  aria-label={c.name}
                />
              ))}
            </div>
          </div>

          <button
            className={`kbRec${rec !== null ? ' active' : ''}`}
            onClick={record}
            title="تسجيل المشهد كفيديو WebM"
          >
            {rec !== null ? (
              <>
                <span className="kbRecRing" style={{ '--p': rec }} />
                {Math.round(rec * 100)}٪
              </>
            ) : (
              <>
                <I.Video /> <span>تصدير فيديو</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
