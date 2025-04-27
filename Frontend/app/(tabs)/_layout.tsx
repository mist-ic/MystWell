import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import { StyleSheet, View, Platform } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;
const BOTTOM_INSET = Platform.OS === 'ios' ? 20 : 0;
const ICON_SIZE = 28;

export default function TabLayout() {
  const theme = useTheme();

  const getTabBarIcon = (name: keyof typeof MaterialCommunityIcons.glyphMap, focused: boolean) => {
    return (
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={name}
          size={ICON_SIZE}
          color={focused ? theme.colors.primary : '#9E9E9E'}
        />
      </View>
    );
  };

  return (
    <ThemeProvider value={DefaultTheme}>
      <Tabs
        screenOptions={{
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: '#9E9E9E',
          headerShown: false,
          contentStyle: {
            backgroundColor: 'white',
          }
        }}
        initialRouteName="home"
      >
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="document"
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.tabItem}>
                {getTabBarIcon('file-document-outline', focused)}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="record"
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.tabItem}>
                {getTabBarIcon('microphone-outline', focused)}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="home"
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.tabItem}>
                {getTabBarIcon('home', focused)}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.tabItem}>
                {getTabBarIcon('chat-outline', focused)}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.tabItem}>
                {getTabBarIcon('pill', focused)}
              </View>
            ),
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: TAB_BAR_HEIGHT - BOTTOM_INSET,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: BOTTOM_INSET,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT - BOTTOM_INSET,
    paddingVertical: 8,
  },
  iconContainer: {
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
