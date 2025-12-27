import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Text, Progress, Transition, Paper, Group, Badge,
    RingProgress, Center, Kbd, Divider, ThemeIcon, Flex, Stack
} from '@mantine/core';
import {
    IconLock, IconLockOpen, IconClock, IconTool, IconCheck, IconX
} from '@tabler/icons-react';
import { useNuiEvent } from '../hooks/useNuiEvent';
import { fetchNui } from '../utils/fetchNui';
import { debugData } from '../utils/debugData';
import styles from './Lockpick.module.scss';

// debugData([
//     {
//         action: 'setVisibleLockpick',
//         data: true
//     }
// ]);

// debugData([
//     {
//         action: 'startLockpick',
//         data: {
//             difficulty: 'hard', // easy, medium, hard, expert
//             pins: 6,
//             timeLimit: 300000
//         }
//     }
// ]);

interface Pin {
    id: number;
    targetPosition: number;
    currentPosition: number;
    isSet: boolean;
    tolerance: number;
}

interface LockpickConfig {
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    pins: number;
    timeLimit: number;
}

const difficultySettings = {
    easy: { tolerance: 15, shakeIntensity: 0, speedMultiplier: 1 },
    medium: { tolerance: 10, shakeIntensity: 1, speedMultiplier: 1.2 },
    hard: { tolerance: 6, shakeIntensity: 2, speedMultiplier: 1.5 },
    expert: { tolerance: 4, shakeIntensity: 3, speedMultiplier: 2 }
};

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
const playSound = (type: 'pinSet' | 'pinFail' | 'success' | 'fail' | 'click') => {
    const now = audioContext.currentTime;

    switch (type) {
        case 'pinSet': {
            const bufferSize = audioContext.sampleRate * 0.08;
            const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
            }

            const noiseSource = audioContext.createBufferSource();
            noiseSource.buffer = noiseBuffer;

            const highPass = audioContext.createBiquadFilter();
            highPass.type = 'highpass';
            highPass.frequency.setValueAtTime(2000, now);
            highPass.Q.setValueAtTime(5, now);

            const bandPass = audioContext.createBiquadFilter();
            bandPass.type = 'bandpass';
            bandPass.frequency.setValueAtTime(4000, now);
            bandPass.Q.setValueAtTime(15, now);

            const clickOsc = audioContext.createOscillator();
            clickOsc.type = 'square';
            clickOsc.frequency.setValueAtTime(3000, now);
            clickOsc.frequency.exponentialRampToValueAtTime(800, now + 0.02);

            const clickGain = audioContext.createGain();
            clickGain.gain.setValueAtTime(0.4, now);
            clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

            const noiseGain = audioContext.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            noiseSource.connect(highPass);
            highPass.connect(bandPass);
            bandPass.connect(noiseGain);
            noiseGain.connect(audioContext.destination);

            clickOsc.connect(clickGain);
            clickGain.connect(audioContext.destination);

            noiseSource.start(now);
            noiseSource.stop(now + 0.08);
            clickOsc.start(now);
            clickOsc.stop(now + 0.03);
            break;
        }

        case 'pinFail': {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            oscillator.start(now);
            oscillator.stop(now + 0.15);
            break;
        }

        case 'success': {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523, now);
            oscillator.frequency.setValueAtTime(659, now + 0.1);
            oscillator.frequency.setValueAtTime(784, now + 0.2);
            oscillator.frequency.setValueAtTime(1047, now + 0.3);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.setValueAtTime(0.3, now + 0.35);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
            break;
        }

        case 'fail': {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.3);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
            break;
        }

        case 'click': {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(1500, now);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
            oscillator.start(now);
            oscillator.stop(now + 0.02);
            break;
        }
    }
};

const Lockpick: React.FC = () => {
    const [isVisible, setVisible] = useState(false);
    const [pins, setPins] = useState<Pin[]>([]);
    const [currentPinIndex, setCurrentPinIndex] = useState(0);
    const [pickPosition, setPickPosition] = useState(50);
    const [tensionApplied, setTensionApplied] = useState(false);
    const [pickHealth, setPickHealth] = useState(100);
    const [timeRemaining, setTimeRemaining] = useState(30000);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'success' | 'failed'>('idle');
    const [config, setConfig] = useState<LockpickConfig>({ difficulty: 'medium', pins: 4, timeLimit: 30000 });
    const [feedback, setFeedback] = useState<'none' | 'cold' | 'warm' | 'hot' | 'perfect'>('none');
    const [shake, setShake] = useState(0);
    const [lockRotation, setLockRotation] = useState(0);

    const animationRef = useRef<number>();
    const timerRef = useRef<number>();
    const moveDirectionRef = useRef<'up' | 'down' | null>(null);
    const moveIntervalRef = useRef<number>();

    const initializePins = useCallback((pinCount: number, difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
        const settings = difficultySettings[difficulty];
        const newPins: Pin[] = [];

        for (let i = 0; i < pinCount; i++) {
            newPins.push({
                id: i,
                targetPosition: Math.random() * 60 + 20,
                currentPosition: 100,
                isSet: false,
                tolerance: settings.tolerance
            });
        }

        setPins(newPins);
        setCurrentPinIndex(0);
        setPickPosition(50);
        setPickHealth(100);
        setTensionApplied(false);
        setFeedback('none');
        setLockRotation(0);
    }, []);

    useNuiEvent<boolean>('setVisibleLockpick', (visible) => {
        setVisible(visible);
        if (!visible) {
            setGameState('idle');
            if (timerRef.current) clearInterval(timerRef.current);
        }
    });

    useNuiEvent<LockpickConfig>('startLockpick', (data) => {
        setConfig(data);
        setTimeRemaining(data.timeLimit);
        initializePins(data.pins, data.difficulty);
        setGameState('playing');
        setVisible(true);
    });

    useEffect(() => {
        if (gameState === 'playing' && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining((prev) => {
                    if (prev <= 100) {
                        setGameState('failed');
                        fetchNui('lockpickResult', { success: false, reason: 'timeout' });
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

    const calculateFeedback = useCallback((position: number, targetPosition: number, tolerance: number): 'cold' | 'warm' | 'hot' | 'perfect' => {
        const distance = Math.abs(position - targetPosition);

        if (distance <= tolerance / 2) return 'perfect';
        if (distance <= tolerance) return 'hot';
        if (distance <= tolerance * 2) return 'warm';
        return 'cold';
    }, []);

    // Move pick up/down
    const movePick = useCallback((direction: 'up' | 'down') => {
        if (gameState !== 'playing') return;

        const settings = difficultySettings[config.difficulty];
        const speed = 2 * settings.speedMultiplier;

        setPickPosition((prev) => {
            const newPos = direction === 'up'
                ? Math.max(0, prev - speed)
                : Math.min(100, prev + speed);

            const currentPin = pins[currentPinIndex];
            if (currentPin) {
                setFeedback(calculateFeedback(newPos, currentPin.targetPosition, currentPin.tolerance));
            }

            return newPos;
        });
    }, [gameState, config.difficulty, pins, currentPinIndex, calculateFeedback]);

    // Apply tension (try to set pin)
    const applyTension = useCallback(() => {
        if (gameState !== 'playing' || currentPinIndex >= pins.length) return;

        setTensionApplied(true);
        const currentPin = pins[currentPinIndex];
        const distance = Math.abs(pickPosition - currentPin.targetPosition);
        const settings = difficultySettings[config.difficulty];

        if (distance <= currentPin.tolerance / 2) {
            playSound('pinSet');

            setPins((prev) => prev.map((pin, idx) =>
                idx === currentPinIndex ? { ...pin, isSet: true, currentPosition: pickPosition } : pin
            ));

            setLockRotation((prev) => prev + (90 / pins.length));

            if (currentPinIndex + 1 >= pins.length) {
                setTimeout(() => playSound('success'), 100);
                setGameState('success');
                setLockRotation(90);
                fetchNui('lockpickResult', { success: true });
            } else {
                setCurrentPinIndex((prev) => prev + 1);
                setPickPosition(50);
                setFeedback('none');
            }
        } else {
            playSound('pinFail');
            setShake(settings.shakeIntensity);
            setPickHealth((prev) => {
                const damage = Math.min(15, distance / 2);
                const newHealth = prev - damage;

                if (newHealth <= 0) {
                    playSound('fail');
                    setGameState('failed');
                    fetchNui('lockpickResult', { success: false, reason: 'broken' });
                    return 0;
                }
                return newHealth;
            });

            if (currentPinIndex > 0) {
                setPins((prev) => prev.map((pin, idx) =>
                    idx === currentPinIndex - 1 ? { ...pin, isSet: false, currentPosition: 100 } : pin
                ));
                setCurrentPinIndex((prev) => prev - 1);
                setLockRotation((prev) => Math.max(0, prev - (90 / pins.length)));
            }
            setPickPosition(50);
            setFeedback('none');

            setTimeout(() => setShake(0), 200);
        }
    }, [gameState, currentPinIndex, pins, pickPosition, config.difficulty]);

    const releaseTension = useCallback(() => {
        setTensionApplied(false);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;

            if (e.code === 'KeyW' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (!moveDirectionRef.current) {
                    moveDirectionRef.current = 'up';
                    movePick('up');
                    moveIntervalRef.current = setInterval(() => movePick('up'), 50);
                }
            } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
                e.preventDefault();
                if (!moveDirectionRef.current) {
                    moveDirectionRef.current = 'down';
                    movePick('down');
                    moveIntervalRef.current = setInterval(() => movePick('down'), 50);
                }
            } else if (e.code === 'Space') {
                e.preventDefault();
                applyTension();
            } else if (e.code === 'Escape') {
                e.preventDefault();
                setGameState('failed');
                fetchNui('lockpickResult', { success: false, reason: 'cancelled' });
                fetchNui('hideFrame', { name: 'setVisibleLockpick' });
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') {
                moveDirectionRef.current = null;
                if (moveIntervalRef.current) {
                    clearInterval(moveIntervalRef.current);
                    moveIntervalRef.current = undefined;
                }
            } else if (e.code === 'Space') {
                releaseTension();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
        };
    }, [gameState, movePick, applyTension, releaseTension]);

    useEffect(() => {
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
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
                <Box className={styles.lockpickContainer} style={transitionStyles}>
                    <Box className={styles.overlay} />
                    <Paper
                        shadow="xl"
                        radius="lg"
                        p="1.75rem"
                        className={styles.lockpickUI}
                        style={{
                            background: 'linear-gradient(180deg, rgba(20, 22, 25, 0.9) 0%, rgba(8, 9, 11, 0.88) 100%)',
                            border: '0.0625rem solid rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        <Group align='center' justify="space-between" mb="md">
                            <Flex align={'center'} gap="sm">
                                <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                                    <IconLock size={20} />
                                </ThemeIcon>
                                <Text fw={700} size="lg" tt="uppercase" >
                                    Lock Picking
                                </Text>
                            </Flex>
                            <Badge
                                size="lg"
                                variant="light"
                                color={getDifficultyColor()}
                                leftSection={<IconTool size={14} stroke={1.75} />}
                            >
                                {config.difficulty.toUpperCase()}
                            </Badge>
                        </Group>

                        <Divider mb="md" color="dark.5" />

                        {/* Stats bar */}
                        <Flex w={'100%'} gap={'xs'} mb="lg">
                            <Paper w={'50%'} p="sm" radius="md" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <Flex direction={'column'} justify={'space-between'}>
                                    <Flex gap=".375rem" align={'center'}>
                                        <IconClock size="0.875rem" style={{ opacity: 0.6 }} />
                                        <Text size="xs" c="dimmed" tt="uppercase">Time</Text>
                                    </Flex>
                                    <Text
                                        size="md"
                                        fw={700}
                                        mt={'.25rem'}
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
                                    border: pickHealth < 30 ? '0.0625rem solid rgba(255, 0, 0, 0.5)' : 'none'
                                }}>
                                <Flex direction={'column'} justify={'space-between'} h={'100%'}>
                                    <Flex gap=".375rem" align={'center'}>
                                        <IconTool size="0.875rem" style={{ opacity: 0.6 }} />
                                        <Text size="xs" c="dimmed" tt="uppercase">Durability</Text>
                                    </Flex>
                                    <Progress
                                        value={pickHealth}
                                        color={pickHealth > 50 ? 'teal' : pickHealth > 25 ? 'yellow' : 'red'}
                                        size="lg"
                                        radius="md"
                                        mb={'.2rem'}
                                    />
                                </Flex>
                            </Paper>
                        </Flex>

                        <Paper
                            radius="md"
                            p="md"
                            style={{
                                background: 'linear-gradient(180deg, rgba(28, 30, 35, 0.8) 0%, rgba(19, 21, 25, 0.79) 100%)',
                                border: '0.0625rem solid rgba(255, 255, 255, 0.05)',
                                transform: `translateX(${shake * 0.0625}rem)`,
                                transition: 'transform 0.1s ease-out',
                                minHeight: '18.75rem'
                            }}
                        >
                            <Group align="stretch" gap="lg" wrap="nowrap" h="16.25rem">
                                <Stack align="center" justify="center" style={{ width: '7.5rem' }}>
                                    <RingProgress
                                        size={100}
                                        thickness={8}
                                        roundCaps
                                        sections={[{ value: (lockRotation / 90) * 100, color: 'teal' }]}
                                        label={
                                            <Center>
                                                <ThemeIcon
                                                    size="3.75rem"
                                                    radius="xl"
                                                    variant="light"
                                                    color={lockRotation >= 90 ? 'teal' : 'dark'}
                                                    style={{
                                                        transform: `rotate(${lockRotation}deg)`,
                                                        transition: 'transform 0.3s ease'
                                                    }}
                                                >
                                                    {lockRotation >= 90 ? (
                                                        <IconLockOpen size="1.875rem" />
                                                    ) : (
                                                        <IconLock size="1.875rem" />
                                                    )}
                                                </ThemeIcon>
                                            </Center>
                                        }
                                    />
                                    <Text size="xs" c="dimmed" ta="center">
                                        {Math.round((lockRotation / 90) * 100)}% Unlocked
                                    </Text>
                                </Stack>

                                <Flex align="center" style={{ flex: 1, position: 'relative' }}>
                                    <Group gap={0} justify="center" align="flex-start" h="12.5rem" wrap="nowrap">
                                        <Box
                                            style={{
                                                width: '1.5rem',
                                                height: '100%',
                                                position: 'relative',
                                                marginRight: '0.5rem'
                                            }}
                                        >
                                            <Box
                                                style={{
                                                    position: 'absolute',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    width: '0.25rem',
                                                    height: '100%',
                                                    background: 'linear-gradient(180deg, #555 0%, #333 100%)',
                                                    borderRadius: '0.125rem'
                                                }}
                                            />
                                            <Box
                                                style={{
                                                    position: 'absolute',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    top: `${pickPosition}%`,
                                                    marginTop: '-0.9375rem',
                                                    width: '0.5rem',
                                                    height: '1.875rem',
                                                    background: '#4a9eff',
                                                    borderRadius: '0.25rem',
                                                    boxShadow: '0 0 0.9375rem rgba(74, 158, 255, 0.6)',
                                                    transition: 'top 0.08s linear'
                                                }}
                                            />
                                            <Box
                                                style={{
                                                    position: 'absolute',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    bottom: '-0.625rem',
                                                    width: '0.75rem',
                                                    height: '1.875rem',
                                                    background: 'linear-gradient(180deg, #666 0%, #444 100%)',
                                                    borderRadius: '0.25rem',
                                                    border: '0.0625rem solid rgba(255,255,255,0.1)'
                                                }}
                                            />
                                        </Box>

                                        {pins.map((pin, index) => {
                                            const isCurrentPin = index === currentPinIndex;
                                            const isInGoodPosition = isCurrentPin && feedback === 'perfect';

                                            return (
                                                <Box
                                                    key={pin.id}
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        opacity: isCurrentPin ? 1 : 0.5,
                                                        transform: isCurrentPin ? 'scale(1.05)' : 'scale(1)',
                                                        transition: 'all 0.2s ease',
                                                        marginLeft: index > 0 ? '0.75rem' : 0
                                                    }}
                                                >
                                                    <Paper
                                                        radius="sm"
                                                        style={{
                                                            width: '2.75rem',
                                                            height: '10rem',
                                                            background: 'linear-gradient(180deg, #1a1a1f 0%, #0f0f12 100%)',
                                                            border: isCurrentPin
                                                                ? isInGoodPosition
                                                                    ? '0.125rem solid rgba(0, 255, 136, 0.5)'
                                                                    : '0.125rem solid rgba(74, 158, 255, 0.5)'
                                                                : '0.0625rem solid rgba(255, 255, 255, 0.1)',
                                                            boxShadow: isCurrentPin
                                                                ? isInGoodPosition
                                                                    ? '0 0 0.9375rem rgba(0, 255, 136, 0.25)'
                                                                    : '0 0 1.25rem rgba(74, 158, 255, 0.2)'
                                                                : 'none',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            animation: isInGoodPosition ? 'pinShake 0.1s ease-in-out infinite' : 'none'
                                                        }}
                                                    >
                                                        <Box
                                                            style={{
                                                                position: 'absolute',
                                                                left: '0.25rem',
                                                                right: '0.25rem',
                                                                height: '2.1875rem',
                                                                top: `${pin.isSet ? pin.currentPosition : (isCurrentPin ? pickPosition : 100)}%`,
                                                                transform: 'translateY(-50%)',
                                                                background: pin.isSet
                                                                    ? 'linear-gradient(180deg, #00cc6a 0%, #009950 100%)'
                                                                    : isInGoodPosition
                                                                        ? 'linear-gradient(180deg, #5a5a5a 0%, #00aa55 100%)'
                                                                        : 'linear-gradient(180deg, #666 0%, #444 100%)',
                                                                borderRadius: '0.25rem',
                                                                boxShadow: pin.isSet
                                                                    ? '0 0 0.9375rem rgba(0, 255, 136, 0.4)'
                                                                    : isInGoodPosition
                                                                        ? '0 0 0.625rem rgba(0, 255, 136, 0.3)'
                                                                        : 'inset 0 0.125rem 0.25rem rgba(255, 255, 255, 0.1)',
                                                                transition: 'top 0.08s linear, background 0.15s ease, box-shadow 0.15s ease'
                                                            }}
                                                        />
                                                    </Paper>

                                                    <ThemeIcon
                                                        size="sm"
                                                        radius="xl"
                                                        mt={'.25rem'}
                                                        variant={pin.isSet ? 'filled' : 'light'}
                                                        color={pin.isSet ? 'teal' : isCurrentPin ? 'blue' : 'dark'}
                                                    >
                                                        {pin.isSet ? <IconCheck size={12} /> : <Text size="xs">{index + 1}</Text>}
                                                    </ThemeIcon>
                                                </Box>
                                            )
                                        })}
                                    </Group>
                                </Flex>
                            </Group>
                        </Paper>

                        <Group justify="center" gap="xs" mt="md">
                            {pins.map((pin, index) => (
                                <Box
                                    key={pin.id}
                                    style={{
                                        width: '0.75rem',
                                        height: '0.75rem',
                                        borderRadius: '50%',
                                        background: pin.isSet
                                            ? '#00ff88'
                                            : index === currentPinIndex
                                                ? 'transparent'
                                                : 'rgba(255,255,255,0.1)',
                                        border: index === currentPinIndex
                                            ? '0.125rem solid #4a9eff'
                                            : '0.0625rem solid rgba(255,255,255,0.2)',
                                        boxShadow: pin.isSet
                                            ? '0 0 0.625rem rgba(0, 255, 136, 0.5)'
                                            : index === currentPinIndex
                                                ? '0 0 0.625rem rgba(74, 158, 255, 0.5)'
                                                : 'none',
                                        animation: index === currentPinIndex ? 'pulse 1s ease-in-out infinite' : 'none'
                                    }}
                                />
                            ))}
                        </Group>

                        <Divider my="md" color="dark.5" />

                        <Group justify="center" gap="lg">
                            <Group gap="xs">
                                <Kbd>W</Kbd>
                                <Kbd>S</Kbd>
                                <Text size="xs" c="dimmed">Move Pick</Text>
                            </Group>
                            <Group gap="xs">
                                <Kbd>SPACE</Kbd>
                                <Text size="xs" c="dimmed">Set Pin</Text>
                            </Group>
                            <Group gap="xs">
                                <Kbd>ESC</Kbd>
                                <Text size="xs" c="dimmed">Cancel</Text>
                            </Group>
                        </Group>

                        {/* Game state overlays */}
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
                                        <IconLockOpen size="1.875rem" />
                                    </ThemeIcon>
                                    <Text size="xl" fw={800} c="teal" style={{ letterSpacing: '0.25rem' }}>
                                        UNLOCKED
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">Lock successfully picked</Text>
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
                                        <IconX size="1.875rem" />
                                    </ThemeIcon>
                                    <Text size="xl" fw={800} c="red" style={{ letterSpacing: '0.25rem' }}>
                                        FAILED
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        {pickHealth <= 0 ? 'Lockpick broken' : timeRemaining <= 0 ? 'Time ran out' : 'Attempt cancelled'}
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

export default Lockpick;