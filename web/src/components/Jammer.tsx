import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Text, Progress, Transition, Paper, Group, Badge,
    Kbd, Divider, ThemeIcon, Flex, Stack
} from '@mantine/core';
import {
    IconAntenna, IconWifi, IconWifiOff, IconClock
} from '@tabler/icons-react';
import { useNuiEvent } from '../hooks/useNuiEvent';
import { fetchNui } from '../utils/fetchNui';
import { debugData } from '../utils/debugData';
import styles from './Jammer.module.scss';

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
//             timeLimit: 120000
//         }
//     }
// ]);

interface JammerConfig {
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    timeLimit: number;
}

const difficultySettings = {
    easy: { tolerance: 10, amplitudeTolerance: 12, noiseLevel: 0.15 },
    medium: { tolerance: 7, amplitudeTolerance: 9, noiseLevel: 0.25 },
    hard: { tolerance: 5, amplitudeTolerance: 6, noiseLevel: 0.35 },
    expert: { tolerance: 3, amplitudeTolerance: 4, noiseLevel: 0.45 }
};

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

const playSound = (type: 'tune' | 'lock' | 'success' | 'fail') => {
    const now = audioContext.currentTime;

    switch (type) {
        case 'tune': {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600 + Math.random() * 300, now);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.03);
            break;
        }
        case 'lock': {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.setValueAtTime(1500, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        }
        case 'success': {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523, now);
            osc.frequency.setValueAtTime(659, now + 0.1);
            osc.frequency.setValueAtTime(784, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            break;
        }
        case 'fail': {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        }
    }
};

// Circular Dial Component
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
        return normalized * 270 - 135; // -135 to 135 degrees
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
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !dialRef.current) return;
            const rect = dialRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
            const angleDiff = currentAngle - startAngle.current;
            const newAngle = valueToAngle(startValue.current) + angleDiff;
            const clampedAngle = Math.max(-135, Math.min(135, newAngle));
            onChange(angleToValue(clampedAngle));
            playSound('tune');
        };

        const handleMouseUp = () => {
            isDragging.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onChange, min, max, value]);

    const angle = valueToAngle(value);
    const glowColor = `rgba(${color === 'cyan' ? '0, 200, 255' : '255, 150, 50'}, 0.4)`;
    const mainColor = color === 'cyan' ? '#00c8ff' : '#ff9632';

    return (
        <Flex direction="column" align="center" gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>{label}</Text>
            <Box
                ref={dialRef}
                onMouseDown={handleMouseDown}
                style={{
                    width: '4.5rem',
                    height: '4.5rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg, #1a1a1f 0%, #0a0a0d 100%)',
                    border: '0.125rem solid rgba(255, 255, 255, 0.1)',
                    boxShadow: `inset 0 0.125rem 0.5rem rgba(0, 0, 0, 0.5), 0 0 1rem ${glowColor}`,
                    position: 'relative',
                    cursor: disabled ? 'not-allowed' : 'grab',
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease'
                }}
            >
                {[...Array(11)].map((_, i) => {
                    const markerAngle = -135 + (i * 27);
                    const isActive = markerAngle <= angle;
                    return (
                        <Box
                            key={i}
                            style={{
                                position: 'absolute',
                                width: '0.125rem',
                                height: i % 2 === 0 ? '0.5rem' : '0.3rem',
                                background: isActive ? mainColor : 'rgba(255, 255, 255, 0.2)',
                                left: '50%',
                                top: '0.25rem',
                                transformOrigin: `50% ${4.5 / 2 - 0.25}rem`,
                                transform: `translateX(-50%) rotate(${markerAngle}deg)`,
                                borderRadius: '0.0625rem',
                                transition: 'background 0.1s ease'
                            }}
                        />
                    );
                })}
                <Box
                    style={{
                        position: 'absolute',
                        width: '0.1875rem',
                        height: '1.25rem',
                        background: `linear-gradient(180deg, ${mainColor} 0%, transparent 100%)`,
                        left: '50%',
                        top: '0.5rem',
                        transformOrigin: `50% ${4.5 / 2 - 0.5}rem`,
                        transform: `translateX(-50%) rotate(${angle}deg)`,
                        borderRadius: '0.125rem',
                        boxShadow: `0 0 0.5rem ${mainColor}`,
                        transition: 'transform 0.05s ease-out'
                    }}
                />
                {/* Center dot */}
                <Box
                    style={{
                        position: 'absolute',
                        width: '0.75rem',
                        height: '0.75rem',
                        borderRadius: '50%',
                        background: 'linear-gradient(145deg, #2a2a2f 0%, #1a1a1f 100%)',
                        border: `0.0625rem solid ${mainColor}`,
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        boxShadow: `0 0 0.375rem ${glowColor}`
                    }}
                />
            </Box>
            <Text size="xs" c={isMatched ? 'teal' : 'white'} ff="monospace" fw={600}>
                {value.toFixed(1)}
            </Text>
        </Flex>
    );
};

const Jammer: React.FC = () => {
    const [isVisible, setVisible] = useState(false);
    const [targetFrequency, setTargetFrequency] = useState(50);
    const [targetAmplitude, setTargetAmplitude] = useState(50);
    const [currentFrequency, setCurrentFrequency] = useState(25);
    const [currentAmplitude, setCurrentAmplitude] = useState(25);
    const [lockProgress, setLockProgress] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(30000);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'success' | 'failed'>('idle');
    const [config, setConfig] = useState<JammerConfig>({ difficulty: 'medium', timeLimit: 30000 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const targetCanvasRef = useRef<HTMLCanvasElement>(null);
    const timerRef = useRef<number>();
    const animationRef = useRef<number>();
    const offsetRef = useRef(0);

    const initializeGame = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
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
        initializeGame(data.difficulty);
        setGameState('playing');
        setVisible(true);
    });

    // Timer
    useEffect(() => {
        if (gameState === 'playing' && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining((prev) => {
                    if (prev <= 100) {
                        setGameState('failed');
                        playSound('fail');
                        fetchNui('jammerResult', { success: false, reason: 'timeout' });
                        return 0;
                    }
                    return prev - 100;
                });
            }, 100);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState]);

    // Check if both frequency and amplitude are matched
    const settings = difficultySettings[config.difficulty];
    const freqMatched = Math.abs(currentFrequency - targetFrequency) <= settings.tolerance;
    const ampMatched = Math.abs(currentAmplitude - targetAmplitude) <= settings.amplitudeTolerance;
    const bothMatched = freqMatched && ampMatched;

    // Lock progress - runs on interval to continuously update
    const lockIntervalRef = useRef<number>();
    
    useEffect(() => {
        if (gameState !== 'playing') {
            if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
            return;
        }

        lockIntervalRef.current = setInterval(() => {
            setLockProgress((prev) => {
                if (bothMatched) {
                    const newProgress = prev + 2;
                    if (newProgress >= 100) {
                        setGameState('success');
                        playSound('success');
                        fetchNui('jammerResult', { success: true });
                        if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
                        return 100;
                    }
                    if (prev < 50 && newProgress >= 50) {
                        playSound('lock');
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

    // Draw waveforms
    useEffect(() => {
        if (!canvasRef.current || !targetCanvasRef.current) return;

        const canvas = canvasRef.current;
        const targetCanvas = targetCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const targetCtx = targetCanvas.getContext('2d');
        if (!ctx || !targetCtx) return;

        const settings = difficultySettings[config.difficulty];

        const draw = () => {
            // Clear canvases
            ctx.fillStyle = 'rgba(8, 10, 12, 1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            targetCtx.fillStyle = 'rgba(8, 10, 12, 1)';
            targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

            const centerY = canvas.height / 2;
            const targetCenterY = targetCanvas.height / 2;

            // Draw subtle grid
            ctx.strokeStyle = 'rgba(74, 158, 255, 0.06)';
            ctx.lineWidth = 1;
            targetCtx.strokeStyle = 'rgba(0, 255, 136, 0.06)';
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

            // Center line
            ctx.strokeStyle = 'rgba(74, 158, 255, 0.15)';
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            ctx.lineTo(canvas.width, centerY);
            ctx.stroke();
            targetCtx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
            targetCtx.beginPath();
            targetCtx.moveTo(0, targetCenterY);
            targetCtx.lineTo(targetCanvas.width, targetCenterY);
            targetCtx.stroke();

            // Current signal waveform
            const freq = currentFrequency / 15;
            const amp = (currentAmplitude / 100) * (canvas.height * 0.4);

            ctx.beginPath();
            ctx.strokeStyle = bothMatched ? 'rgba(0, 255, 136, 0.9)' : 'rgba(74, 158, 255, 0.85)';
            ctx.lineWidth = 1.5;

            for (let x = 0; x < canvas.width; x++) {
                const noise = (Math.random() - 0.5) * settings.noiseLevel * 30;
                const y = centerY + Math.sin((x + offsetRef.current) * freq * 0.03) * amp + noise;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Target signal waveform
            const targetFreq = targetFrequency / 15;
            const targetAmp = (targetAmplitude / 100) * (targetCanvas.height * 0.4);

            targetCtx.beginPath();
            targetCtx.strokeStyle = 'rgba(0, 255, 136, 0.85)';
            targetCtx.lineWidth = 1.5;

            for (let x = 0; x < targetCanvas.width; x++) {
                const y = targetCenterY + Math.sin((x + offsetRef.current) * targetFreq * 0.03) * targetAmp;
                if (x === 0) targetCtx.moveTo(x, y);
                else targetCtx.lineTo(x, y);
            }
            targetCtx.stroke();

            // Slower animation speed
            offsetRef.current += 0.5;
            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [currentFrequency, currentAmplitude, targetFrequency, targetAmplitude, bothMatched, config.difficulty]);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;

            const step = 1.2;

            if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
                e.preventDefault();
                setCurrentFrequency((prev) => Math.max(0, prev - step));
                playSound('tune');
            } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
                e.preventDefault();
                setCurrentFrequency((prev) => Math.min(100, prev + step));
                playSound('tune');
            } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
                e.preventDefault();
                setCurrentAmplitude((prev) => Math.min(100, prev + step));
                playSound('tune');
            } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                e.preventDefault();
                setCurrentAmplitude((prev) => Math.max(0, prev - step));
                playSound('tune');
            } else if (e.code === 'Escape') {
                e.preventDefault();
                setGameState('failed');
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
        };
    }, []);

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const tenths = Math.floor((ms % 1000) / 100);
        return `${seconds}.${tenths}s`;
    };

    const getDifficultyColor = () => {
        switch (config.difficulty) {
            case 'easy': return 'green';
            case 'medium': return 'yellow';
            case 'hard': return 'orange';
            case 'expert': return 'red';
            default: return 'gray';
        }
    };

    if (!isVisible) return null;

    return (
        <Transition mounted={isVisible} transition="fade" duration={300}>
            {(transitionStyles) => (
                <Box className={styles.jammerContainer} style={transitionStyles}>
                    <Box className={styles.overlay} />
                    <Paper
                        shadow="xl"
                        radius="lg"
                        p="1.75rem"
                        className={styles.jammerUI}
                        style={{
                            background: 'linear-gradient(180deg, rgba(20, 22, 25, 0.9) 0%, rgba(8, 9, 11, 0.88) 100%)',
                            border: '0.0625rem solid rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        {/* Header */}
                        <Group align='center' justify="space-between" mb="md">
                            <Flex align={'center'} gap="sm">
                                <ThemeIcon size="lg" variant="light" color="cyan" radius="md">
                                    <IconAntenna size="1.25rem" />
                                </ThemeIcon>
                                <Text fw={700} size="lg" tt="uppercase">
                                    Signal Jammer
                                </Text>
                            </Flex>
                            <Badge
                                size="lg"
                                variant="light"
                                color={getDifficultyColor()}
                                leftSection={<IconWifi size="0.875rem" stroke={1.75} />}
                            >
                                {config.difficulty.toUpperCase()}
                            </Badge>
                        </Group>

                        <Divider mb="md" color="dark.5" />

                        {/* Stats bar */}
                        <Flex w={'100%'} gap={'xs'} mb="lg">
                            <Paper w={'50%'} p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <Flex direction="column" justify="space-between">
                                    <Flex gap=".375rem" align="center">
                                        <IconClock size="0.875rem" style={{ opacity: 0.6 }} />
                                        <Text size="xs" c="dimmed" tt="uppercase">Time</Text>
                                    </Flex>
                                    <Text
                                        size="md"
                                        fw={700}
                                        mt=".25rem"
                                        c={timeRemaining < 5000 ? 'red' : 'white'}
                                        style={{
                                            animation: timeRemaining < 5000 ? 'pulse 0.5s ease-in-out infinite' : 'none'
                                        }}
                                    >
                                        {formatTime(timeRemaining)}
                                    </Text>
                                </Flex>
                            </Paper>

                            <Paper
                                w={'50%'}
                                p="sm"
                                radius="md"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: lockProgress >= 50 ? '0.0625rem solid rgba(0, 255, 136, 0.5)' : 'none'
                                }}
                            >
                                <Flex direction={'column'} justify={'space-between'} h={'100%'}>
                                    <Flex gap=".375rem" align="center">
                                        <IconWifi size="0.875rem" style={{ opacity: 0.6 }} />
                                        <Text size="xs" c="dimmed" tt="uppercase">Signal Lock</Text>
                                    </Flex>
                                    <Progress
                                        value={lockProgress}
                                        color={lockProgress >= 80 ? 'teal' : lockProgress >= 50 ? 'green' : 'blue'}
                                        size="lg"
                                        radius="md"
                                        mt=".25rem"
                                        animated={lockProgress > 0 && lockProgress < 100}
                                    />
                                </Flex>
                            </Paper>
                        </Flex>

                        {/* Main content */}
                        <Paper
                            radius="md"
                            p="md"
                            style={{
                                background: 'linear-gradient(180deg, rgba(28, 30, 35, 0.8) 0%, rgba(19, 21, 25, 0.79) 100%)',
                                border: '0.0625rem solid rgba(255, 255, 255, 0.05)',
                            }}
                        >
                            <Flex gap="lg" align="stretch">
                                {/* Waveform displays */}
                                <Stack gap="sm" style={{ flex: 1 }}>
                                    {/* Target Signal */}
                                    <Box>
                                        <Group gap="xs" mb="xs">
                                            <Box
                                                style={{
                                                    width: '0.375rem',
                                                    height: '0.375rem',
                                                    borderRadius: '50%',
                                                    background: '#00ff88',
                                                    boxShadow: '0 0 0.375rem rgba(0, 255, 136, 0.6)'
                                                }}
                                            />
                                            <Text size="xs" c="dimmed" tt="uppercase">Target</Text>
                                        </Group>
                                        <Paper
                                            radius="sm"
                                            style={{
                                                background: 'rgba(0, 0, 0, 0.6)',
                                                border: '0.0625rem solid rgba(0, 255, 136, 0.2)',
                                                overflow: 'hidden',
                                                height: '5rem'
                                            }}
                                        >
                                            <canvas
                                                ref={targetCanvasRef}
                                                width={350}
                                                height={80}
                                                className={styles.waveformCanvas}
                                            />
                                        </Paper>
                                    </Box>

                                    {/* Current Signal */}
                                    <Box>
                                        <Group gap="xs" mb="xs">
                                            <Box
                                                style={{
                                                    width: '0.375rem',
                                                    height: '0.375rem',
                                                    borderRadius: '50%',
                                                    background: bothMatched ? '#00ff88' : '#4a9eff',
                                                    boxShadow: `0 0 0.375rem ${bothMatched ? 'rgba(0, 255, 136, 0.6)' : 'rgba(74, 158, 255, 0.6)'}`
                                                }}
                                            />
                                            <Text size="xs" c="dimmed" tt="uppercase">Your Signal</Text>
                                        </Group>
                                        <Paper
                                            radius="sm"
                                            style={{
                                                background: 'rgba(0, 0, 0, 0.6)',
                                                border: `0.0625rem solid ${bothMatched ? 'rgba(0, 255, 136, 0.4)' : 'rgba(74, 158, 255, 0.2)'}`,
                                                overflow: 'hidden',
                                                height: '5rem'
                                            }}
                                        >
                                            <canvas
                                                ref={canvasRef}
                                                width={350}
                                                height={80}
                                                className={styles.waveformCanvas}
                                            />
                                        </Paper>
                                    </Box>
                                </Stack>

                                <Flex direction="column" gap="md" align="center" justify="center" style={{ minWidth: '10rem' }}>
                                    <Dial
                                        value={currentFrequency}
                                        onChange={setCurrentFrequency}
                                        min={0}
                                        max={100}
                                        label="Frequency"
                                        color="cyan"
                                        disabled={gameState !== 'playing'}
                                        isMatched={freqMatched}
                                    />
                                    <Dial
                                        value={currentAmplitude}
                                        onChange={setCurrentAmplitude}
                                        min={0}
                                        max={100}
                                        label="Amplitude"
                                        color="orange"
                                        disabled={gameState !== 'playing'}
                                        isMatched={ampMatched}
                                    />
                                </Flex>
                            </Flex>
                        </Paper>

                        <Divider my="md" color="dark.5" />

                        <Group justify="center" gap="lg">
                            <Group gap="xs">
                                <Kbd>A</Kbd>
                                <Kbd>D</Kbd>
                                <Text size="xs" c="dimmed">Frequency</Text>
                            </Group>
                            <Group gap="xs">
                                <Kbd>W</Kbd>
                                <Kbd>S</Kbd>
                                <Text size="xs" c="dimmed">Amplitude</Text>
                            </Group>
                            <Group gap="xs">
                                <Kbd>ESC</Kbd>
                                <Text size="xs" c="dimmed">Cancel</Text>
                            </Group>
                        </Group>

                        {gameState === 'success' && (
                            <Box className={styles.resultOverlay}>
                                <Paper
                                    p="xl"
                                    radius="lg"
                                    style={{
                                        background: 'rgba(0, 255, 136, 0.1)',
                                        border: '0.125rem solid rgba(0, 255, 136, 0.3)',
                                        textAlign: 'center'
                                    }}
                                >
                                    <ThemeIcon size="3.75rem" radius="xl" color="teal" variant="light" mb="md">
                                        <IconWifi size="1.875rem" />
                                    </ThemeIcon>
                                    <Text size="xl" fw={800} c="teal" style={{ letterSpacing: '0.25rem' }}>
                                        SIGNAL LOCKED
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">Jammer successfully configured</Text>
                                </Paper>
                            </Box>
                        )}

                        {gameState === 'failed' && (
                            <Box className={styles.resultOverlay}>
                                <Paper
                                    p="xl"
                                    radius="lg"
                                    style={{
                                        background: 'rgba(255, 68, 68, 0.1)',
                                        border: '0.125rem solid rgba(255, 68, 68, 0.3)',
                                        textAlign: 'center'
                                    }}
                                >
                                    <ThemeIcon size="3.75rem" radius="xl" color="red" variant="light" mb="md">
                                        <IconWifiOff size="1.875rem" />
                                    </ThemeIcon>
                                    <Text size="xl" fw={800} c="red" style={{ letterSpacing: '0.25rem' }}>
                                        SIGNAL LOST
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        {timeRemaining <= 0 ? 'Time ran out' : 'Attempt cancelled'}
                                    </Text>
                                </Paper>
                            </Box>
                        )}
                    </Paper>
                </Box>
            )}
        </Transition>
    );
};

export default Jammer;
