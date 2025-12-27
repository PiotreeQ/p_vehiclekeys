import { useState, useRef } from 'react';
import {
    Box, Transition, Text, Paper, ActionIcon, Group, Stack, Tooltip, Badge, Flex, Divider
} from '@mantine/core';
import {
    IconLock,
    IconLockOpen,
    IconCarGarage,
    IconEngine,
    IconLighter,
    IconVolume,
    IconSearch,
    IconCar,
    IconChevronLeft,
    IconChevronRight
} from '@tabler/icons-react';
import classes from './App.module.scss';
import { debugData } from '../utils/debugData';
import { fetchNui } from '../utils/fetchNui';
import { useNuiEvent } from '../hooks/useNuiEvent';

debugData([
    {
        action: 'setVisibleApp',
        data: true
    }
]);

interface KeyAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    onClick: () => void;
}

const App: React.FC = () => {
    const [isVisible, setVisible] = useState(false);
    const [isLocked, setIsLocked] = useState(true);
    const [vehPlate, setVehPlate] = useState('NONE');
    const [currentPage, setCurrentPage] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [translateX, setTranslateX] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useNuiEvent<boolean>('setVisibleApp', setVisible);
    useNuiEvent<{ isLocked: boolean; plate: string }>('setData', (data) => {
        setIsLocked(data.isLocked);
        setVehPlate(data.plate);
    });

    const mainActions: KeyAction[] = [
        {
            id: 'lock',
            label: 'Lock',
            icon: <IconLock size={'1.5rem'} stroke={1.5} />,
            color: 'red',
            onClick: () => {
                setIsLocked(true);
                fetchNui('toggleLock', vehPlate);
            }
        },
        {
            id: 'trunk',
            label: 'Trunk',
            icon: <IconCarGarage size={'1.5rem'} stroke={1.5} />,
            color: 'blue',
            onClick: () => {
                fetchNui('toggleTrunk', vehPlate);
            }
        },
        {
            id: 'unlock',
            label: 'Unlock',
            icon: <IconLockOpen size={'1.5rem'} stroke={1.5} />,
            color: 'green',
            onClick: () => {
                setIsLocked(false);
                fetchNui('toggleLock', vehPlate);
            }
        },
    ];

    const additionalActions: KeyAction[][] = [
        [
            {
                id: 'engine',
                label: 'Engine',
                icon: <IconEngine size={'1rem'} />,
                color: 'cyan',
                onClick: () => {
                    fetchNui('toggleEngine', vehPlate);
                }
            },
            {
                id: 'lights',
                label: 'Lights',
                icon: <IconLighter size={'1rem'} />,
                color: 'yellow',
                onClick: () => {
                    fetchNui('toggleLights', vehPlate);
                }
            }
        ],
        [
            {
                id: 'horn',
                label: 'Horn',
                icon: <IconVolume size={'1rem'} />,
                color: 'pink',
                onClick: () => {
                    fetchNui('honkHorn', vehPlate);
                }
            },
            {
                id: 'find',
                label: 'Find',
                icon: <IconSearch size={'1rem'} />,
                color: 'grape',
                onClick: () => {
                    fetchNui('findVehicle', vehPlate);
                }
            }
        ]
    ];

    const totalPages = additionalActions.length;

    const handleDragStart = (clientX: number) => {
        setIsDragging(true);
        setStartX(clientX);
    };

    const handleDragMove = (clientX: number) => {
        if (!isDragging) return;
        const diff = clientX - startX;
        setTranslateX(diff);
    };

    const handleDragEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);

        const threshold = 50;
        if (translateX > threshold && currentPage > 0) {
            setCurrentPage(currentPage - 1);
        } else if (translateX < -threshold && currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
        }
        setTranslateX(0);
    };

    const handleMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX);
    const handleMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX);
    const handleMouseUp = () => handleDragEnd();
    const handleMouseLeave = () => handleDragEnd();

    const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX);
    const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX);
    const handleTouchEnd = () => handleDragEnd();

    return (
        <Transition
            mounted={isVisible}
            timingFunction='ease'
            duration={500}
            transition={'slide-up'}
        >
            {(styles) => (
                <Box style={styles} className={classes.appWrapper}>
                    <Paper className={classes.keyFob} p="lg" radius="xl" shadow="xs" withBorder>
                        <Flex justify="space-between" align={'center'} gap={'1rem'} mb="md">
                            {/* <IconCar size={24} className={classes.carIcon} /> */}
                            {/* <Text fw={600} size="lg" className={classes.title}>
                                Key
                            </Text> */}
                            <Flex align={'center'} gap={'.35rem'}>
                                <IconCar size={'1.325rem'} stroke={1.5} />
                            </Flex>
                            <Badge
                                color={isLocked ? 'red' : 'green'}
                                variant="dot"
                                size="sm"
                            >
                                {vehPlate}
                            </Badge>
                        </Flex>

                        <Paper mb={'xs'} withBorder radius={'lg'} style={{ overflow: 'hidden' }}>
                            <Flex direction={'column'}>
                                {mainActions.map((action, index) => (
                                    <>
                                        <Tooltip key={action.id} label={action.label}>
                                            <Paper className={classes.mainAction} p={'md'} py={'lg'}>
                                                <Flex align={'center'} justify={'center'}>{action.icon}</Flex>
                                            </Paper>
                                        </Tooltip>
                                        {index < mainActions.length - 1 && <Divider opacity={.75} />}
                                    </>
                                ))}
                            </Flex>
                        </Paper>

                        <Paper className={classes.swipeContainer} p="sm" radius="lg" withBorder>
                            <Group justify="space-between" align="center" mb="xs">
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="sm"
                                    onClick={() => currentPage > 0 && setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 0}
                                >
                                    <IconChevronLeft size={'1rem'} />
                                </ActionIcon>
                                <Text size="xs" c="dimmed">
                                    {currentPage + 1}/{totalPages}
                                </Text>
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="sm"
                                    onClick={() => currentPage < totalPages - 1 && setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages - 1}
                                >
                                    <IconChevronRight size={'1rem'} />
                                </ActionIcon>
                            </Group>

                            <Box
                                ref={containerRef}
                                className={classes.swipeArea}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseLeave}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                <Box
                                    className={classes.swipeContent}
                                    style={{
                                        transform: `translateX(calc(-${currentPage * 100}% + ${translateX}px))`,
                                        transition: isDragging ? 'none' : 'transform 0.3s ease'
                                    }}
                                >
                                    {additionalActions.map((page, pageIndex) => (
                                        <Group
                                            key={pageIndex}
                                            className={classes.swipePage}
                                            justify="center"
                                            gap="md"
                                        >
                                            {page.map((action) => (
                                                <Stack key={action.id} align="center" gap={4}>
                                                    <ActionIcon
                                                        className={classes.smallActionButton}
                                                        variant="light"
                                                        color={action.color}
                                                        size="lg"
                                                        radius="xl"
                                                        onClick={action.onClick}
                                                    >
                                                        {action.icon}
                                                    </ActionIcon>
                                                    <Text size="xs" c="dimmed">{action.label}</Text>
                                                </Stack>
                                            ))}
                                        </Group>
                                    ))}
                                </Box>
                            </Box>

                            <Group justify="center" gap={6} mt="xs">
                                {additionalActions.map((_, index) => (
                                    <Box
                                        key={index}
                                        className={`${classes.pageIndicator} ${index === currentPage ? classes.activeIndicator : ''}`}
                                        onClick={() => setCurrentPage(index)}
                                    />
                                ))}
                            </Group>
                        </Paper>
                    </Paper>
                </Box>
            )}
        </Transition>
    );
};

export default App;