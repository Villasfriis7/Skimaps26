import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import MapScreen from './screens/MapScreen';
import POIListScreen from './screens/POIListScreen';
import POIDetailScreen from './screens/POIDetailScreen';
import { colors } from './styles/styles';

const Stack = createNativeStackNavigator();

// Fælles udseende for header på tværs af skærme (undtagen Home, som har sin egen).
const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

// Sætter navigationen op med fire skærme. Home er startskærmen.
export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{ title: 'Kort' }}
        />
        <Stack.Screen
          name="POIList"
          component={POIListScreen}
          options={{ title: 'Cafeer & Restauranter' }}
        />
        <Stack.Screen
          name="POIDetail"
          component={POIDetailScreen}
          // Titlen sættes dynamisk til stedets navn ud fra route.params.
          options={({ route }) => ({ title: route.params.poi.name })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
