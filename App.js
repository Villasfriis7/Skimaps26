import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ExploreScreen from './screens/ExploreScreen';
import MapScreen from './screens/MapScreen';
import FriendsScreen from './screens/FriendsScreen';
import PartnersScreen from './screens/PartnersScreen';
import ProfileScreen from './screens/ProfileScreen';
import POIDetailScreen from './screens/POIDetailScreen';
import WeatherDetailScreen from './screens/WeatherDetailScreen';
import SavedPlacesScreen from './screens/SavedPlacesScreen';
import { SavedPlacesProvider } from './context/SavedPlacesContext';
import { colors } from './styles/styles';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

// Ikoner pr. fane - fyldt når aktiv, outline når inaktiv (standard tab-mønster).
const tabIcons = {
  Explore: ['compass', 'compass-outline'],
  Map: ['map', 'map-outline'],
  Friends: ['people', 'people-outline'],
  Partners: ['pricetags', 'pricetags-outline'],
  Profile: ['person', 'person-outline'],
};

// Den faste bund-navigation med de 5 hovedsektioner. Hver fane styrer selv sin
// egen header-UI (se screens/*), så den native header er slået fra her.
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9fb4bf',
        tabBarStyle: {
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = tabIcons[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Partners" component={PartnersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Rod-stack: bund-navigationen plus POIDetail, som kan åbnes ovenpå enhver
// fane (fx fra Explore eller Map) og skjuler automatisk fanebjælken.
export default function App() {
  return (
    <SafeAreaProvider>
      <SavedPlacesProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootStack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          >
            <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <RootStack.Screen
              name="POIDetail"
              component={POIDetailScreen}
              options={({ route }) => ({ title: route.params.poi.name })}
            />
            <RootStack.Screen
              name="WeatherDetail"
              component={WeatherDetailScreen}
              options={{ title: 'Vejr i Verbier' }}
            />
            <RootStack.Screen
              name="SavedPlaces"
              component={SavedPlacesScreen}
              options={{ title: 'Saved places' }}
            />
          </RootStack.Navigator>
        </NavigationContainer>
      </SavedPlacesProvider>
    </SafeAreaProvider>
  );
}
