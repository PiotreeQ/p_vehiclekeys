import {
    Box, Transition, Text, Title, Paper, Badge
} from '@mantine/core';
import classes from './App.module.scss';
import { debugData } from '../utils/debugData';

debugData([
    {
        action: 'setVisibleApp',
        data: true
    }
])

const App: React.FC = () => {
    return (
        <Transition
        mounted={true}
        timingFunction='ease'
        duration={1000}
        transition={'slide-up'}
        >{(styles) => (
            <Box style={styles} className={classes.appWrapper}>
                <Paper p={'md'} shadow='xs' withBorder>
                    <Title>Test Mantine Title</Title>
                    <Text ta={'center'}>Test Mantine Text</Text>
                </Paper>
            </Box>
        )}</Transition>
    )
}

export default App;