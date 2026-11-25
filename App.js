import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

import ExploreScreen from './screens/ExploreScreen';
import MapScreen from './screens/MapScreen';
import FriendsScreen from './screens/FriendsScreen';
import PartnersScreen from './screens/PartnersScreen';
import ProfileScreen from './screens/ProfileScreen';
import POIDetailScreen from './screens/POIDetailScreen';
import WeatherDetailScreen from './screens/WeatherDetailScreen';
import SavedPlacesScreen from './screens/SavedPlacesScreen';
import RouteScreen from './screens/RouteScreen';
import PlacesListScreen from './screens/PlacesListScreen';
import { categoryMeta } from './data/categoryMeta';
import { SavedPlacesProvider } from './context/SavedPlacesContext';
import { LocationProvider } from './context/LocationContext';
import { RouteProvider } from './context/RouteContext';
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
// Fanebjælkens højde og bund-afstand sættes IKKE i hånden: React Navigation
// lægger selv plads til under ikonerne til iPhones home-indikator og Androids
// navigationsbjælke, og en fast højde ville fjerne den plads igen.
function MainTabs() {
  return (
    <Tab.Navigator
      // Androids tilbage-knap går til den fane, man kom fra - ikke altid Explore.
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        // Mørk nok til at kunne læses i sollys (4,7:1 mod hvid).
        tabBarInactiveTintColor: '#5f7884',
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

// Rod-stack: bund-navigationen plus detaljesiderne, som kan åbnes ovenpå
// enhver fane (fx fra Explore eller Map) og automatisk skjuler fanebjælken.
// Alle skærme har samme lyse baggrund og mørk statusbar - også detaljesiderne,
// der før havde en mørkeblå topbjælke og dermed lignede en anden app.
export default function App() {
  // Ikon-skrifttypen skal være indlæst, før noget tegnes: kortets markører
  // tegnes kun én gang (tracksViewChanges={false}) og ville ellers stå uden ikon.
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <SavedPlacesProvider>
        <LocationProvider>
          <RouteProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <RootStack.Navigator
                screenOptions={{
                  headerStyle: { backgroundColor: colors.ice },
                  headerTintColor: colors.primary,
                  headerTitleStyle: { fontWeight: '700', color: colors.textDark },
                  headerShadowVisible: false,
                  headerBackButtonDisplayMode: 'minimal',
                  contentStyle: { backgroundColor: colors.ice },
                }}
              >
                <RootStack.Screen
                  name="MainTabs"
                  component={MainTabs}
                  options={{ headerShown: false }}
                />
                <RootStack.Screen
                  name="POIDetail"
                  component={POIDetailScreen}
                  // Navnet står stort på selve siden - ikke også i topbjælken,
                  // hvor lange navne blev skåret af.
                  options={{ title: '' }}
                />
                <RootStack.Screen
                  name="WeatherDetail"
                  component={WeatherDetailScreen}
                  options={{ title: 'Weather' }}
                />
                <RootStack.Screen
                  name="SavedPlaces"
                  component={SavedPlacesScreen}
                  options={{ title: 'Saved places' }}
                />
                <RootStack.Screen name="Route" component={RouteScreen} options={{ title: 'Route' }} />
                <RootStack.Screen
                  name="Places"
                  component={PlacesListScreen}
                  options={({ route }) => ({
                    title: categoryMeta[route.params.category]?.label || 'Places',
                  })}
                />
              </RootStack.Navigator>
            </NavigationContainer>
          </RouteProvider>
        </LocationProvider>
      </SavedPlacesProvider>
    </SafeAreaProvider>
  );
}
