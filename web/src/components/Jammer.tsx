import { useState, useEffect, useCallback, useRef } from 'react';
import { useNuiEvent } from '../hooks/useNuiEvent';
import { fetchNui } from '../utils/fetchNui';
import { debugData } from '../utils/debugData';
import { playSfx } from '../utils/sfx';
import mg from './Minigame.module.scss';
import styles from './Jammer.module.scss';
import { useT } from '../utils/locales';

// uncomment this code below to use in dev mode on browser

// debugData([
//     {
//         action: 'setVisibleJammer',
//         data: true
//     }
// ]);

// debugData([
//     {
//         action: 'startJammer',
//         data: {
//             difficulty: 'hard',
//             timeLimit: 25000
//         }
//     }
// ]);

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface JammerConfig {
    difficulty: Difficulty;
    timeLimit: number;
}

const difficultySettings: Record<Difficulty, { tolerance: number; amplitudeTolerance: number; noiseLevel: number }> = {
    easy: { tolerance: 10, amplitudeTolerance: 12, noiseLevel: 0.15 },
    medium: { tolerance: 7, amplitudeTolerance: 9, noiseLevel: 0.25 },
    hard: { tolerance: 5, amplitudeTolerance: 6, noiseLevel: 0.35 },
    expert: { tolerance: 3, amplitudeTolerance: 4, noiseLevel: 0.45 }
};

const difficultyColors: Record<Difficulty, string> = {
    easy: '#4ade80',
    medium: '#fbbf24',
    hard: '#fb923c',
    expert: '#f87171'
};

const failMessages: Record<string, string> = {
    timeout: 'jammer_timeout',
    cancelled: 'attempt_cancelled'
};

const DIAL_REM = 3.8;

interface DialProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    label: string;
    color: string;
    disabled?: boolean;
    isMatched?: boolean;
}

const Dial: React.FC<DialProps> = ({ value, onChange, min, max, label, color, disabled, isMatched }) => {
    const dialRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startAngle = useRef(0);
    const startValue = useRef(0);

    const valueToAngle = (val: number) => {
        const normalized = (val - min) / (max - min);
        return normalized * 270 - 135;
    };

    const angleToValue = (angle: number) => {
        const normalized = (angle + 135) / 270;
        return Math.max(min, Math.min(max, normalized * (max - min) + min));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        isDragging.current = true;
        const rect = dialRef.current?.getBoundingClientRect();
        if (rect) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            startAngle.current = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
            startValue.current = value;
        }
        e.preventDefault();

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (!isDragging.current || !dialRef.current) return;
            const rect = dialRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
            const angleDiff = currentAngle - startAngle.current;
            const newAngle = valueToAngle(startValue.current) + angleDiff;
            const clampedAngle = Math.max(-135, Math.min(135, newAngle));
            onChange(angleToValue(clampedAngle));
            playSfx('tick');
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const angle = valueToAngle(value);
    // const mainColor = isMatched ? '#4ade80' : color;

    return (
        <div className={styles.dialBlock}>
            <span className={styles.dialName}>{label}</span>
            <div
                ref={dialRef}
                onMouseDown={handleMouseDown}
                className={styles.dialFace}
                style={{
                    width: `${DIAL_REM}rem`,
                    height: `${DIAL_REM}rem`,
                    cursor: disabled ? 'not-allowed' : 'grab',
                    borderColor: '#27272a'
                }}
            >
                {[...Array(11)].map((_, i) => {
                    const markerAngle = -135 + (i * 27);
                    const isActive = markerAngle <= angle;
                    return (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                width: '0.1rem',
                                height: i % 2 === 0 ? '0.4rem' : '0.25rem',
                                background: isActive ? color : '#3f3f46',
                                left: '50%',
                                top: '0.2rem',
                                transformOrigin: `50% ${DIAL_REM / 2 - 0.2}rem`,
                                transform: `translateX(-50%) rotate(${markerAngle}deg)`,
                                borderRadius: '0.05rem',
                                transition: 'background 0.1s ease'
                            }}
                        />
                    );
                })}
                <div
                    style={{
                        position: 'absolute',
                        width: '0.16rem',
                        height: '1.05rem',
                        background: color,
                        left: '50%',
                        top: '0.42rem',
                        transformOrigin: `50% ${DIAL_REM / 2 - 0.42}rem`,
                        transform: `translateX(-50%) rotate(${angle}deg)`,
                        borderRadius: '0.1rem',
                        transition: 'transform 0.05s ease-out'
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        width: '0.6rem',
                        height: '0.6rem',
                        borderRadius: '50%',
                        background: '#18181b',
                        border: `0.0625rem solid ${color}`,
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                    }}
                />
            </div>
            <span className={styles.dialValue}>{value.toFixed(1)}</span>
        </div>
    );
};

const Jammer: React.FC = () => {
    const t = useT();
    const [isVisible, setVisible] = useState(false);
    const [targetFrequency, setTargetFrequency] = useState(50);
    const [targetAmplitude, setTargetAmplitude] = useState(50);
    const [currentFrequency, setCurrentFrequency] = useState(25);
    const [currentAmplitude, setCurrentAmplitude] = useState(25);
    const [lockProgress, setLockProgress] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(30000);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'success' | 'failed'>('idle');
    const [config, setConfig] = useState<JammerConfig>({ difficulty: 'medium', timeLimit: 30000 });
    const [failReason, setFailReason] = useState('cancelled');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const targetCanvasRef = useRef<HTMLCanvasElement>(null);
    const timerRef = useRef<number>();
    const animationRef = useRef<number>();
    const offsetRef = useRef(0);
    const lockIntervalRef = useRef<number>();

    const initializeGame = useCallback(() => {
        setTargetFrequency(Math.random() * 60 + 20);
        setTargetAmplitude(Math.random() * 60 + 20);
        setCurrentFrequency(Math.random() * 100);
        setCurrentAmplitude(Math.random() * 100);
        setLockProgress(0);
    }, []);

    useNuiEvent<boolean>('setVisibleJammer', (visible) => {
        setVisible(visible);
        if (!visible) {
            setGameState('idle');
            if (timerRef.current) clearInterval(timerRef.current);
        }
    });

    useNuiEvent<JammerConfig>('startJammer', (data) => {
        setConfig(data);
        setTimeRemaining(data.timeLimit);
        initializeGame();
        setGameState('playing');
        setVisible(true);
    });

    useEffect(() => {
        if (gameState !== 'playing') return;

        timerRef.current = window.setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 100) {
                    setGameState('failed');
                    setFailReason('timeout');
                    playSfx('fail');
                    fetchNui('jammerResult', { success: false, reason: 'timeout' });
                    return 0;
                }
                return prev - 100;
            });
        }, 100);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState]);

    const settings = difficultySettings[config.difficulty];
    const freqMatched = Math.abs(currentFrequency - targetFrequency) <= settings.tolerance;
    const ampMatched = Math.abs(currentAmplitude - targetAmplitude) <= settings.amplitudeTolerance;
    const bothMatched = freqMatched && ampMatched;

    useEffect(() => {
        if (gameState !== 'playing') {
            if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
            return;
        }

        lockIntervalRef.current = window.setInterval(() => {
            setLockProgress((prev) => {
                if (bothMatched) {
                    const newProgress = prev + 2;
                    if (newProgress >= 100) {
                        setGameState('success');
                        playSfx('success');
                        fetchNui('jammerResult', { success: true });
                        if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
                        return 100;
                    }
                    if (prev < 50 && newProgress >= 50) {
                        playSfx('connect');
                    }
                    return newProgress;
                } else {
                    return Math.max(0, prev - 1.5);
                }
            });
        }, 50);

        return () => {
            if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
        };
    }, [gameState, bothMatched]);

    useEffect(() => {
        if (!canvasRef.current || !targetCanvasRef.current) return;

        const canvas = canvasRef.current;
        const targetCanvas = targetCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const targetCtx = targetCanvas.getContext('2d');
        if (!ctx || !targetCtx) return;

        const s = difficultySettings[config.difficulty];

        const draw = () => {
            ctx.fillStyle = '#0a0a0d';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            targetCtx.fillStyle = '#0a0a0d';
            targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

            const centerY = canvas.height / 2;
            const targetCenterY = targetCanvas.height / 2;

            // grid
            ctx.strokeStyle = 'rgba(129, 140, 248, 0.06)';
            ctx.lineWidth = 1;
            targetCtx.strokeStyle = 'rgba(74, 222, 128, 0.06)';
            targetCtx.lineWidth = 1;

            for (let y = 0; y < canvas.height; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
                targetCtx.beginPath();
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(targetCanvas.width, y);
                targetCtx.stroke();
            }
            for (let x = 0; x < canvas.width; x += 16) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
                targetCtx.beginPath();
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, targetCanvas.height);
                targetCtx.stroke();
            }

            // center line
            ctx.strokeStyle = 'rgba(129, 140, 248, 0.15)';
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(canvas.width, centerY);
            ctx.stroke();
            targetCtx.strokeStyle = 'rgba(74, 222, 128, 0.15)';
            targetCtx.beginPath();
            targetCtx.moveTo(0, targetCenterY);
            targetCtx.lineTo(targetCanvas.width, targetCenterY);
            targetCtx.stroke();

            // current signal waveform
            const freq = currentFrequency / 15;
            const amp = (currentAmplitude / 100) * (canvas.height * 0.4);

            ctx.beginPath();
            ctx.strokeStyle = bothMatched ? 'rgba(74, 222, 128, 0.9)' : 'rgba(129, 140, 248, 0.85)';
            ctx.lineWidth = 1.5;

            for (let x = 0; x < canvas.width; x++) {
                const noise = (Math.random() - 0.5) * s.noiseLevel * 30;
                const y = centerY + Math.sin((x + offsetRef.current) * freq * 0.03) * amp + noise;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // target signal waveform
            const targetFreq = targetFrequency / 15;
            const targetAmp = (targetAmplitude / 100) * (targetCanvas.height * 0.4);

            targetCtx.beginPath();
            targetCtx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
            targetCtx.lineWidth = 1.5;

            for (let x = 0; x < targetCanvas.width; x++) {
                const y = targetCenterY + Math.sin((x + offsetRef.current) * targetFreq * 0.03) * targetAmp;
                if (x === 0) targetCtx.moveTo(x, y);
                else targetCtx.lineTo(x, y);
            }
            targetCtx.stroke();

            offsetRef.current += 0.5;
            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [currentFrequency, currentAmplitude, targetFrequency, targetAmplitude, bothMatched, config.difficulty]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;

            const step = 1.2;

            if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                e.preventDefault();
                setCurrentFrequency((prev) => Math.max(0, prev - step));
                playSfx('tick');
            } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                e.preventDefault();
                setCurrentFrequency((prev) => Math.min(100, prev + step));
                playSfx('tick');
            } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
                e.preventDefault();
                setCurrentAmplitude((prev) => Math.min(100, prev + step));
                playSfx('tick');
            } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                e.preventDefault();
                setCurrentAmplitude((prev) => Math.max(0, prev - step));
                playSfx('tick');
            } else if (e.code === 'Escape') {
                e.preventDefault();
                setGameState('failed');
                setFailReason('cancelled');
                fetchNui('jammerResult', { success: false, reason: 'cancelled' });
                fetchNui('hideFrame', { name: 'setVisibleJammer' });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState]);

    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
        };
    }, []);

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const tenths = Math.floor((ms % 1000) / 100);
        return `${seconds}.${tenths}s`;
    };

    if (!isVisible) return null;

    const timePct = config.timeLimit > 0 ? (timeRemaining / config.timeLimit) * 100 : 0;

    return (
        <div className={mg.container}>
            <div className={mg.overlay} />
            <div className={mg.panel} style={{ width: '24rem' }}>
                <div className={mg.head}>
                    <span className={mg.badge}>{t('jammer')}</span>
                    <span className={mg.diff} style={{ color: difficultyColors[config.difficulty] }}>
                        {t(config.difficulty)}
                    </span>
                </div>

                <div className={mg.card}>
                    <div className={styles.layout}>
                        <div className={styles.scopes}>
                            <div className={styles.scopeBlock}>
                                <span className={styles.scopeLabel}>{t('target')}</span>
                                <div className={styles.scope} style={{ borderColor: 'rgba(74, 222, 128, 0.25)' }}>
                                    <canvas ref={targetCanvasRef} width={300} height={62} className={styles.waveformCanvas} />
                                </div>
                            </div>
                            <div className={styles.scopeBlock}>
                                <span className={styles.scopeLabel}>{t('your_signal')}</span>
                                <div
                                    className={styles.scope}
                                    style={{ borderColor: bothMatched ? 'rgba(74, 222, 128, 0.5)' : 'rgba(99, 102, 241, 0.3)' }}
                                >
                                    <canvas ref={canvasRef} width={300} height={62} className={styles.waveformCanvas} />
                                </div>
                            </div>
                        </div>

                        <div className={styles.dials}>
                            <Dial
                                value={currentFrequency}
                                onChange={setCurrentFrequency}
                                min={0}
                                max={100}
                                label="Freq"
                                color="#818cf8"
                                disabled={gameState !== 'playing'}
                                isMatched={freqMatched}
                            />
                            <Dial
                                value={currentAmplitude}
                                onChange={setCurrentAmplitude}
                                min={0}
                                max={100}
                                label="Amp"
                                color="#fbbf24"
                                disabled={gameState !== 'playing'}
                                isMatched={ampMatched}
                            />
                        </div>
                    </div>
                </div>

                <div className={mg.bars}>
                    <div className={mg.barRow}>
                        <div className={mg.barHead}>
                            <span className={mg.barLabel}>{t('time')}</span>
                            <span className={`${mg.barValue} ${timeRemaining < 5000 ? mg.danger : ''}`}>
                                {formatTime(timeRemaining)}
                            </span>
                        </div>
                        <div className={mg.bar}>
                            <div
                                className={mg.barFill}
                                style={{
                                    width: `${timePct}%`,
                                    background: timeRemaining < 5000 ? '#ef4444' : '#6366f1'
                                }}
                            />
                        </div>
                    </div>
                    <div className={mg.barRow}>
                        <div className={mg.barHead}>
                            <span className={mg.barLabel}>{t('signal_lock')}</span>
                            <span className={mg.barValue}>{Math.round(lockProgress)}%</span>
                        </div>
                        <div className={mg.bar}>
                            <div
                                className={mg.barFill}
                                style={{
                                    width: `${lockProgress}%`,
                                    background: lockProgress >= 50 ? '#22c55e' : '#6366f1'
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className={mg.hints}>
                    <span className={mg.hint}><span className={mg.hintKey}>{t('freq_keys')}</span> {t('freq')}</span>
                    <span className={mg.hint}><span className={mg.hintKey}>{t('amp_keys')}</span> {t('amp')}</span>
                    <span className={mg.hint}><span className={mg.hintKey}>{t('cancel_key')}</span> {t('cancel')}</span>
                </div>

                {gameState === 'success' && (
                    <div className={mg.resultOverlay}>
                        <div className={mg.resultCard}>
                            <div className={`${mg.resultTitle} ${mg.ok}`}>{t('signal_locked')}</div>
                            <div className={mg.resultSub}>{t('jammer_successfully_configured')}</div>
                        </div>
                    </div>
                )}

                {gameState === 'failed' && (
                    <div className={mg.resultOverlay}>
                        <div className={mg.resultCard}>
                            <div className={`${mg.resultTitle} ${mg.bad}`}>{t('signal_lost')}</div>
                            <div className={mg.resultSub}>{t(failMessages[failReason])}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Jammer;
