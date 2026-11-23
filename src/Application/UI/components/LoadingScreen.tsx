import React, { useCallback, useEffect, useRef, useState } from 'react';
import eventBus from '../EventBus';

type LoadingProps = {};

/**
 * Landing page: a Fedora-style terminal that "boots" the portfolio.
 * It types a few commands, streams the real 3D asset loading as build
 * output, then waits for any key / click / tap to enter the computer.
 */

type Seg = { text: string; color?: string; bold?: boolean };
type Line = { id: number; segs: Seg[] };

const C = {
    bg: '#1d1d1d',
    fg: '#deddda',
    green: '#33d17a',
    blue: '#62a0ea',
    fedora: '#51a2da',
    yellow: '#f6d32d',
    red: '#ed333b',
    dim: '#9a9996',
    magenta: '#c061cb',
};

const USER = 'vaibhav';
const HOST = 'fedora';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LoadingScreen: React.FC<LoadingProps> = () => {
    const [lines, setLines] = useState<Line[]>([]);
    const [typing, setTyping] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [overlayOpacity, setLoadingOverlayOpacity] = useState(1);
    const [webGLError, setWebGLError] = useState(false);
    const [mobileWarning, setMobileWarning] = useState(
        window.innerWidth < 768
    );

    const loadedRef = useRef<string[]>([]);
    const progressRef = useRef(0);
    const totalRef = useRef(0);
    const startedRef = useRef(false);
    const idRef = useRef(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const cwdRef = useRef('~');

    useEffect(() => {
        const onResize = () => setMobileWarning(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Collect real resource-loading events from the 3D app
    useEffect(() => {
        eventBus.on('loadedSource', (data) => {
            progressRef.current = data.progress;
            totalRef.current = data.toLoad;
            loadedRef.current.push(data.sourceName);
        });
    }, []);

    // keep the terminal scrolled to the bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines, typing, ready]);

    const start = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        setLoadingOverlayOpacity(0);
        eventBus.dispatch('loadingScreenDone', {});
        const ui = document.getElementById('ui');
        if (ui) {
            ui.style.pointerEvents = 'none';
        }
    }, []);

    // "Press any key" -> enter
    useEffect(() => {
        if (!ready) return;
        const go = () => start();
        window.addEventListener('keydown', go);
        window.addEventListener('mousedown', go);
        window.addEventListener('touchstart', go);
        return () => {
            window.removeEventListener('keydown', go);
            window.removeEventListener('mousedown', go);
            window.removeEventListener('touchstart', go);
        };
    }, [ready, start]);

    // The terminal script
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('debug')) {
            start();
            return;
        }
        if (!detectWebGLContext()) {
            setWebGLError(true);
            return;
        }

        let cancelled = false;

        const push = (...segs: Seg[]) => {
            if (cancelled) return;
            idRef.current += 1;
            const line = { id: idRef.current, segs };
            setLines((prev) => [...prev, line]);
        };
        const out = async (segs: Seg[] | string, delay = 35) => {
            push(...(typeof segs === 'string' ? [{ text: segs }] : segs));
            await sleep(delay);
        };
        const cmd = async (text: string, pause = 350) => {
            await sleep(pause);
            for (let i = 0; i <= text.length; i++) {
                if (cancelled) return;
                setTyping(text.slice(0, i));
                await sleep(Math.random() * 45 + 25);
            }
            await sleep(180);
            setTyping(null);
            push(...prompt(cwdRef.current), { text: text });
        };

        const run = async () => {
            await out([{ text: `Last login: ${lastLogin()} on tty2`, color: C.dim }], 300);

            // --- clone
            await cmd('git clone https://github.com/lizpy/portfolio.git && cd portfolio');
            await out("Cloning into 'portfolio'...", 120);
            await out('remote: Enumerating objects: 2026, done.', 60);
            await out('remote: Counting objects: 100% (2026/2026), done.', 60);
            await out('Receiving objects: 100% (2026/2026), 13.37 MiB | 8.35 MiB/s, done.', 60);
            await out('Resolving deltas: 100% (1403/1403), done.', 200);
            cwdRef.current = '~/portfolio';

            // --- build: stream the REAL asset loading
            await cmd('npm run build:3d');
            await out([{ text: '> vaibhav-portfolio@1.0.0 build:3d', color: C.dim }], 40);
            await out([{ text: '> three --load ./static --render desk.glb', color: C.dim }], 200);
            let printed = 0;
            const t0 = performance.now();
            while (!cancelled) {
                const all = loadedRef.current;
                if (printed < all.length) {
                    const name = all[printed];
                    printed++;
                    const pct = Math.round(
                        (printed / Math.max(totalRef.current, all.length)) * 100
                    );
                    await out(
                        [
                            { text: '  loaded ', color: C.dim },
                            { text: pad(name, 26), color: C.blue },
                            { text: `... ${pct}%`, color: C.dim },
                        ],
                        25
                    );
                } else if (progressRef.current >= 1) {
                    break;
                } else {
                    await sleep(80);
                }
            }
            const secs = ((performance.now() - t0) / 1000 + 0.42).toFixed(2);
            await out([
                { text: 'webpack compiled ', color: C.fg },
                { text: 'successfully', color: C.green, bold: true },
                { text: ` in ${secs}s`, color: C.fg },
            ], 250);

            if (!cancelled) setReady(true);
        };

        run();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            style={Object.assign({}, styles.overlay, {
                opacity: overlayOpacity,
                transform: `scale(${overlayOpacity === 0 ? 1.1 : 1})`,
            })}
        >
            {!webGLError ? (
                <div style={styles.terminal} ref={scrollRef}>
                    {lines.map((line) => (
                        <div key={line.id} style={styles.line}>
                            {line.segs.map((s, i) => (
                                <span
                                    key={i}
                                    style={{
                                        color: s.color || C.fg,
                                        fontWeight: s.bold ? 700 : 400,
                                    }}
                                >
                                    {s.text}
                                </span>
                            ))}
                        </div>
                    ))}
                    {typing !== null && (
                        <div style={styles.line}>
                            {prompt(cwdRef.current).map((s, i) => (
                                <span
                                    key={i}
                                    style={{
                                        color: s.color,
                                        fontWeight: s.bold ? 700 : 400,
                                    }}
                                >
                                    {s.text}
                                </span>
                            ))}
                            <span style={{ color: C.fg }}>{typing}</span>
                            <span style={styles.cursor} />
                        </div>
                    )}
                    {ready && (
                        <>
                            {mobileWarning && (
                                <div style={Object.assign({}, styles.line, { marginTop: 16 })}>
                                    <span style={{ color: C.yellow, fontWeight: 700 }}>
                                        WARNING: this experience is best viewed on a desktop or laptop.
                                    </span>
                                </div>
                            )}
                            <div style={Object.assign({}, styles.line, { marginTop: 16 })}>
                                <span style={{ color: C.fg }}>
                                    Press any key to continue...
                                </span>
                                <span
                                    className="terminal-cursor"
                                    style={styles.cursor}
                                />
                            </div>
                        </>
                    )}
                    {typing === null && !ready && (
                        <div style={styles.line}>
                            <span className="terminal-cursor" style={styles.cursor} />
                        </div>
                    )}
                </div>
            ) : (
                <div style={styles.terminal}>
                    <div style={styles.line}>
                        {prompt().map((s, i) => (
                            <span key={i} style={{ color: s.color, fontWeight: 700 }}>
                                {s.text}
                            </span>
                        ))}
                        <span>./launch --showcase</span>
                    </div>
                    <div style={styles.line}>
                        <span style={{ color: C.red, fontWeight: 700 }}>
                            error:
                        </span>
                        <span> no WebGL context detected</span>
                    </div>
                    <div style={styles.line}>
                        WebGL is required to run this site. Please enable it or
                        switch to a browser which supports WebGL.
                    </div>
                </div>
            )}
        </div>
    );
};

const prompt = (cwd = '~/portfolio'): Seg[] => [
    { text: `${USER}@${HOST}`, color: C.green, bold: true },
    { text: ':', color: C.fg, bold: true },
    { text: cwd, color: C.green, bold: true },
    { text: '$ ', color: C.fg, bold: true },
];

const pad = (s: string, n: number) =>
    s.length >= n ? s + ' ' : s + '\xa0'.repeat(n - s.length);

const lastLogin = () => {
    const d = new Date(Date.now() - 1000 * 60 * 60 * 7);
    return d.toString().split(' GMT')[0];
};

const detectWebGLContext = () => {
    const canvas = document.createElement('canvas');
    const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!(gl && gl instanceof WebGLRenderingContext);
};

const styles: StyleSheetCSS = {
    overlay: {
        backgroundColor: C.bg,
        width: '100%',
        height: '100%',
        display: 'flex',
        transition: 'opacity 0.2s, transform 0.2s',
        transitionTimingFunction: 'ease-in-out',
        boxSizing: 'border-box',
    },
    terminal: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '12px 14px',
        fontFamily:
            "'Adwaita Mono', 'Source Code Pro', 'DejaVu Sans Mono', 'Liberation Mono', monospace",
        fontSize: 15,
        lineHeight: 1.45,
        letterSpacing: 0,
        color: C.fg,
        textAlign: 'left',
    },
    line: {
        display: 'block',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        minHeight: '1.45em',
    },
    cursor: {
        display: 'inline-block',
        width: '0.6em',
        height: '1.1em',
        verticalAlign: 'text-bottom',
        backgroundColor: C.fg,
    },
};

export default LoadingScreen;
