import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Text, Progress, Transition, Paper, Group, Badge,
    Kbd, Divider, ThemeIcon, Flex, Stack
} from '@mantine/core';
import {
    IconBolt, IconClock, IconPlugConnected, IconPlugConnectedX
} from '@tabler/icons-react';
import { useNuiEvent } from '../hooks/useNuiEvent';
import { fetchNui } from '../utils/fetchNui';
import { debugData } from '../utils/debugData';
import styles from './Hotwire.module.scss';

debugData([
    {
        action: 'setVisibleHotwire',
        data: true
    }
]);

debugData([
    {
        action: 'startHotwire',
        data: {
            difficulty: 'expert',
            timeLimit: 30000
        }
    }
]);

interface HotwireConfig {
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    timeLimit: number;
}

interface Wire {
    id: number;
    color: string;
    colorName: string;
    side: 'left' | 'right';
    position: number;
    connected: boolean;
    matchId: number;
}

const difficultySettings = {
    easy: { pairs: 3, maxAttempts: 5, timePenalty: 1500 },
    medium: { pairs: 4, maxAttempts: 4, timePenalty: 2500 },
    hard: { pairs: 5, maxAttempts: 3, timePenalty: 3500 },
    expert: { pairs: 6, maxAttempts: 2, timePenalty: 5000 }
};

const wireColors = [
    { color: '#ff4444', name: 'Red' },
    { color: '#44ff44', name: 'Green' },
    { color: '#4488ff', name: 'Blue' },
    { color: '#ffff44', name: 'Yellow' },
    { color: '#ff44ff', name: 'Purple' },
    { color: '#44ffff', name: 'Cyan' },
    { color: '#ff8844', name: 'Orange' },
    { color: '#ffffff', name: 'White' }
];

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

const playSound = (type: 'select' | 'connect' | 'spark' | 'success' | 'fail') => {
    const now = audioContext.currentTime;

    switch (type) {
        case 'select': {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
        }
        case 'connect': {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(900, now + 0.05);
            osc.frequency.setValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        }
        case 'spark': {
            const noise = audioContext.createBufferSource();
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (buffer.length * 0.3));
            }
            noise.buffer = buffer;
            const gain = audioContext.createGain();
            noise.connect(gain);
            gain.connect(audioContext.destination);
            gain.gain.setValueAtTime(0.15, now);
            noise.start(now);
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

const Hotwire: React.FC = () => {
    const [isVisible, setVisible] = useState(false);
    const [leftWires, setLeftWires] = useState<Wire[]>([]);
    const [rightWires, setRightWires] = useState<Wire[]>([]);
    const [connectedPairs, setConnectedPairs] = useState(0);
    const [totalPairs, setTotalPairs] = useState(4);
    const [timeRemaining, setTimeRemaining] = useState(30000);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'success' | 'failed'>('idle');
    const [config, setConfig] = useState<HotwireConfig>({ difficulty: 'medium', timeLimit: 30000 });
    const [sparkWireId, setSparkWireId] = useState<number | null>(null);
    const [wrongAttempts, setWrongAttempts] = useState(0);
    const [maxAttempts, setMaxAttempts] = useState(4);
    
    // Drag state
    const [draggingWire, setDraggingWire] = useState<Wire | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [hoveredWire, setHoveredWire] = useState<Wire | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const wireRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const timerRef = useRef<number>();

    const shuffleArray = <T,>(array: T[]): T[] => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    const initializeGame = useCallback((difficulty: 'easy' | 'medium' | 'hard' | 'expert') => {
        const settings = difficultySettings[difficulty];
        const pairs = settings.pairs;
        setTotalPairs(pairs);
        setMaxAttempts(settings.maxAttempts);

        const selectedColors = shuffleArray(wireColors).slice(0, pairs);
        
        const left: Wire[] = selectedColors.map((c, i) => ({
            id: i,
            color: c.color,
            colorName: c.name,
            side: 'left' as const,
            position: i,
            connected: false,
            matchId: i
        }));

        const right: Wire[] = selectedColors.map((c, i) => ({
            id: i + pairs,
            color: c.color,
            colorName: c.name,
            side: 'right' as const,
            position: i,
            connected: false,
            matchId: i
        }));

        setLeftWires(shuffleArray(left));
        setRightWires(shuffleArray(right));
        setConnectedPairs(0);
        setWrongAttempts(0);
        setDraggingWire(null);
    }, []);

    useNuiEvent<boolean>('setVisibleHotwire', (visible) => {
        setVisible(visible);
        if (!visible) {
            setGameState('idle');
            if (timerRef.current) clearInterval(timerRef.current);
        }
    });

    useNuiEvent<HotwireConfig>('startHotwire', (data) => {
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
                        fetchNui('hotwireResult', { success: false, reason: 'timeout' });
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

    // Check win condition
    useEffect(() => {
        if (gameState === 'playing' && connectedPairs >= totalPairs) {
            setGameState('success');
            playSound('success');
            fetchNui('hotwireResult', { success: true });
        }
    }, [connectedPairs, totalPairs, gameState]);

    // Mouse move handler for drag line
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggingWire && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                });
            }
        };

        const handleMouseUp = () => {
            if (draggingWire && hoveredWire) {
                handleConnection(draggingWire, hoveredWire);
            }
            setDraggingWire(null);
            setHoveredWire(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingWire, hoveredWire]);

    const handleConnection = (sourceWire: Wire, targetWire: Wire) => {
        if (sourceWire.side === targetWire.side) return;
        if (sourceWire.connected || targetWire.connected) return;

        if (sourceWire.matchId === targetWire.matchId) {
            // Correct match!
            playSound('connect');
            
            setLeftWires(prev => prev.map(w => 
                w.matchId === sourceWire.matchId ? { ...w, connected: true } : w
            ));
            setRightWires(prev => prev.map(w => 
                w.matchId === sourceWire.matchId ? { ...w, connected: true } : w
            ));
            
            setConnectedPairs(prev => prev + 1);
        } else {
            // Wrong match - spark effect
            playSound('spark');
            setSparkWireId(targetWire.id);
            
            const newAttempts = wrongAttempts + 1;
            setWrongAttempts(newAttempts);
            
            if (newAttempts >= maxAttempts) {
                setTimeout(() => {
                    setGameState('failed');
                    playSound('fail');
                    fetchNui('hotwireResult', { success: false, reason: 'shorted' });
                }, 300);
            } else {
                const penalty = difficultySettings[config.difficulty].timePenalty;
                setTimeRemaining(prev => Math.max(0, prev - penalty));
            }
            
            setTimeout(() => {
                setSparkWireId(null);
            }, 300);
        }
    };

    const handleWireMouseDown = (wire: Wire, e: React.MouseEvent) => {
        if (gameState !== 'playing' || wire.connected) return;
        e.preventDefault();
        
        playSound('select');
        setDraggingWire(wire);
        
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setMousePos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    };

    const handleWireMouseEnter = (wire: Wire) => {
        if (draggingWire && !wire.connected && wire.side !== draggingWire.side) {
            setHoveredWire(wire);
        }
    };

    const handleWireMouseLeave = () => {
        setHoveredWire(null);
    };

    const getWireCenter = (wireId: number): { x: number; y: number } | null => {
        const el = wireRefs.current.get(wireId);
        if (!el || !containerRef.current) return null;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const wireRect = el.getBoundingClientRect();
        
        return {
            x: wireRect.left - containerRect.left + wireRect.width / 2,
            y: wireRect.top - containerRect.top + wireRect.height / 2
        };
    };

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;

            if (e.code === 'Escape') {
                e.preventDefault();
                setGameState('failed');
                fetchNui('hotwireResult', { success: false, reason: 'cancelled' });
                fetchNui('hideFrame', { name: 'setVisibleHotwire' });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState]);

    useEffect(() => {
        return () => {
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

    // Get connected pairs for drawing permanent lines
    const getConnectedLines = () => {
        const lines: { left: Wire; right: Wire }[] = [];
        leftWires.forEach(lw => {
            if (lw.connected) {
                const rw = rightWires.find(r => r.matchId === lw.matchId && r.connected);
                if (rw) lines.push({ left: lw, right: rw });
            }
        });
        return lines;
    };

    if (!isVisible) return null;

    const connectedLines = getConnectedLines();
    const dragSourcePos = draggingWire ? getWireCenter(draggingWire.id) : null;

    return (
        <Transition mounted={isVisible} transition="fade" duration={300}>
            {(transitionStyles) => (
                <Box className={styles.hotwireContainer} style={transitionStyles}>
                    <Box className={styles.overlay} />
                    <Paper
                        shadow="xl"
                        radius="lg"
                        p="1.75rem"
                        className={styles.hotwireUI}
                        style={{
                            background: 'linear-gradient(180deg, rgba(20, 22, 25, 0.95) 0%, rgba(8, 9, 11, 0.93) 100%)',
                            border: '0.0625rem solid rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        {/* Header */}
                        <Group align='center' justify="space-between" mb="md">
                            <Flex align={'center'} gap="sm">
                                <ThemeIcon size="lg" variant="light" color="yellow" radius="md">
                                    <IconBolt size="1.25rem" />
                                </ThemeIcon>
                                <Text fw={700} size="lg" tt="uppercase">
                                    Hotwire
                                </Text>
                            </Flex>
                            <Badge
                                size="lg"
                                variant="light"
                                color={getDifficultyColor()}
                                leftSection={<IconPlugConnected size="0.875rem" stroke={1.75} />}
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
                                    border: connectedPairs >= totalPairs - 1 ? '0.0625rem solid rgba(255, 200, 0, 0.5)' : 'none'
                                }}
                            >
                                <Flex direction={'column'} justify={'space-between'} h={'100%'}>
                                    <Flex gap=".375rem" align="center">
                                        <IconPlugConnected size="0.875rem" style={{ opacity: 0.6 }} />
                                        <Text size="xs" c="dimmed" tt="uppercase">Connected</Text>
                                    </Flex>
                                    <Progress
                                        value={(connectedPairs / totalPairs) * 100}
                                        color={connectedPairs >= totalPairs - 1 ? 'yellow' : 'orange'}
                                        size="lg"
                                        radius="md"
                                        mt=".25rem"
                                        animated={connectedPairs > 0 && connectedPairs < totalPairs}
                                    />
                                </Flex>
                            </Paper>
                        </Flex>

                        {/* Main content - Wire panels */}
                        <Paper
                            radius="md"
                            p="md"
                            ref={containerRef}
                            style={{
                                background: 'linear-gradient(180deg, rgba(28, 30, 35, 0.8) 0%, rgba(19, 21, 25, 0.79) 100%)',
                                border: '0.0625rem solid rgba(255, 255, 255, 0.05)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* SVG for connection lines */}
                            <svg
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 1
                                }}
                            >
                                {/* Connected wire lines */}
                                {connectedLines.map(({ left, right }) => {
                                    const leftPos = getWireCenter(left.id);
                                    const rightPos = getWireCenter(right.id);
                                    if (!leftPos || !rightPos) return null;
                                    
                                    return (
                                        <g key={`${left.id}-${right.id}`}>
                                            <line
                                                x1={leftPos.x}
                                                y1={leftPos.y}
                                                x2={rightPos.x}
                                                y2={rightPos.y}
                                                stroke={left.color}
                                                strokeWidth="3"
                                                opacity="0.8"
                                                filter="url(#glow)"
                                            />
                                        </g>
                                    );
                                })}
                                
                                {/* Dragging line */}
                                {draggingWire && dragSourcePos && (
                                    <line
                                        x1={dragSourcePos.x}
                                        y1={dragSourcePos.y}
                                        x2={mousePos.x}
                                        y2={mousePos.y}
                                        stroke={draggingWire.color}
                                        strokeWidth="3"
                                        strokeDasharray="8 4"
                                        opacity="0.9"
                                        filter="url(#glow)"
                                    />
                                )}
                                
                                {/* Glow filter */}
                                <defs>
                                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                        <feMerge>
                                            <feMergeNode in="coloredBlur"/>
                                            <feMergeNode in="SourceGraphic"/>
                                        </feMerge>
                                    </filter>
                                </defs>
                            </svg>

                            <Flex gap="xl" align="stretch" justify="center" style={{ position: 'relative', zIndex: 2 }}>
                                {/* Left wires */}
                                <Stack gap="xs" className={styles.wirePanel}>
                                    <Text size="xs" c="dimmed" ta="center" tt="uppercase" mb="xs">
                                        Panel A
                                    </Text>
                                    {leftWires.map((wire) => (
                                        <Box
                                            key={wire.id}
                                            ref={(el: HTMLDivElement | null) => {
                                                if (el) wireRefs.current.set(wire.id, el);
                                            }}
                                            onMouseDown={(e) => handleWireMouseDown(wire, e)}
                                            onMouseEnter={() => handleWireMouseEnter(wire)}
                                            onMouseLeave={handleWireMouseLeave}
                                            className={`${styles.wireButton} ${draggingWire?.id === wire.id ? styles.dragging : ''} ${wire.connected ? styles.connected : ''} ${sparkWireId === wire.id ? styles.spark : ''} ${hoveredWire?.id === wire.id ? styles.hovered : ''}`}
                                            style={{
                                                '--wire-color': wire.color,
                                                cursor: wire.connected ? 'not-allowed' : 'grab',
                                                opacity: wire.connected ? 0.5 : 1
                                            } as React.CSSProperties}
                                        >
                                            <Box className={styles.wireStrip} style={{ background: wire.color }} />
                                            <Text size="xs" c="dimmed" className={styles.wireLabel}>
                                                {wire.colorName}
                                            </Text>
                                            {wire.connected && (
                                                <IconPlugConnected size="1rem" className={styles.connectedIcon} />
                                            )}
                                        </Box>
                                    ))}
                                </Stack>

                                {/* Center connector visual */}
                                <Flex direction="column" align="center" justify="center" className={styles.connector}>
                                    <Box className={styles.connectorLine} />
                                    <ThemeIcon
                                        size="xl"
                                        radius="xl"
                                        variant="light"
                                        color={connectedPairs >= totalPairs ? 'green' : 'gray'}
                                        className={styles.connectorIcon}
                                    >
                                        <IconBolt size="1.5rem" />
                                    </ThemeIcon>
                                    <Box className={styles.connectorLine} />
                                </Flex>

                                {/* Right wires */}
                                <Stack gap="xs" className={styles.wirePanel}>
                                    <Text size="xs" c="dimmed" ta="center" tt="uppercase" mb="xs">
                                        Panel B
                                    </Text>
                                    {rightWires.map((wire) => (
                                        <Box
                                            key={wire.id}
                                            ref={(el: HTMLDivElement | null) => {
                                                if (el) wireRefs.current.set(wire.id, el);
                                            }}
                                            onMouseDown={(e) => handleWireMouseDown(wire, e)}
                                            onMouseEnter={() => handleWireMouseEnter(wire)}
                                            onMouseLeave={handleWireMouseLeave}
                                            className={`${styles.wireButton} ${draggingWire?.id === wire.id ? styles.dragging : ''} ${wire.connected ? styles.connected : ''} ${sparkWireId === wire.id ? styles.spark : ''} ${hoveredWire?.id === wire.id ? styles.hovered : ''}`}
                                            style={{
                                                '--wire-color': wire.color,
                                                cursor: wire.connected ? 'not-allowed' : 'grab',
                                                opacity: wire.connected ? 0.5 : 1
                                            } as React.CSSProperties}
                                        >
                                            <Box className={styles.wireStrip} style={{ background: wire.color }} />
                                            <Text size="xs" c="dimmed" className={styles.wireLabel}>
                                                {wire.colorName}
                                            </Text>
                                            {wire.connected && (
                                                <IconPlugConnected size="1rem" className={styles.connectedIcon} />
                                            )}
                                        </Box>
                                    ))}
                                </Stack>
                            </Flex>

                            {/* Status info */}
                            <Flex justify="center" mt="md" gap="lg" style={{ position: 'relative', zIndex: 2 }}>
                                <Text size="xs" c="dimmed">
                                    Pairs: <Text span c="white" fw={600}>{connectedPairs}/{totalPairs}</Text>
                                </Text>
                                <Text size="xs" c="dimmed">
                                    Attempts left: <Text span c={maxAttempts - wrongAttempts <= 1 ? 'red' : wrongAttempts > 0 ? 'yellow' : 'white'} fw={600}>{maxAttempts - wrongAttempts}</Text>
                                </Text>
                            </Flex>
                        </Paper>

                        <Divider my="md" color="dark.5" />

                        {/* Controls hint */}
                        <Group justify="center" gap="lg">
                            <Group gap="xs">
                                <Text size="xs" c="dimmed">Drag wires to connect matching colors</Text>
                            </Group>
                            <Group gap="xs">
                                <Kbd>ESC</Kbd>
                                <Text size="xs" c="dimmed">Cancel</Text>
                            </Group>
                        </Group>

                        {/* Success Overlay */}
                        {gameState === 'success' && (
                            <Box className={styles.resultOverlay}>
                                <Paper
                                    p="xl"
                                    radius="lg"
                                    style={{
                                        background: 'rgba(255, 200, 0, 0.1)',
                                        border: '0.125rem solid rgba(255, 200, 0, 0.3)',
                                        textAlign: 'center'
                                    }}
                                >
                                    <ThemeIcon size="3.75rem" radius="xl" color="yellow" variant="light" mb="md">
                                        <IconBolt size="1.875rem" />
                                    </ThemeIcon>
                                    <Text size="xl" fw={800} c="yellow" style={{ letterSpacing: '0.25rem' }}>
                                        ENGINE STARTED
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">Vehicle hotwired successfully</Text>
                                </Paper>
                            </Box>
                        )}

                        {/* Failed Overlay */}
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
                                        <IconPlugConnectedX size="1.875rem" />
                                    </ThemeIcon>
                                    <Text size="xl" fw={800} c="red" style={{ letterSpacing: '0.25rem' }}>
                                        SHORT CIRCUIT
                                    </Text>
                                    <Text size="sm" c="dimmed" mt="xs">
                                        {wrongAttempts >= maxAttempts ? 'Too many wrong connections!' : timeRemaining <= 0 ? 'Time ran out' : 'Attempt cancelled'}
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

export default Hotwire;
