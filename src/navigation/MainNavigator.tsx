import React from 'react';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import LoveScreen from '../screens/LoveScreen';
import CalendarScreen from '../screens/CalendarScreen';
import InsightsScreen from '../screens/InsightsScreen';
import UsScreen from '../screens/UsScreen';

export type MainTabParamList = {
  Home: undefined;
  Love: undefined;
  Calendar: undefined;
  Insights: undefined;
  Us: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabName = keyof MainTabParamList;

function getTabConfig(routeName: MainTabName) {
  switch (routeName) {
    case 'Home':
      return {
        label: 'Home',
        activeIcon: 'home-heart',
        inactiveIcon: 'home-outline',
        description: 'Shared home and Love Notes',
      };
    case 'Love':
      return {
        label: 'Love',
        activeIcon: 'heart',
        inactiveIcon: 'heart-outline',
        description: 'Love Library and Love Notes',
      };
    case 'Calendar':
      return {
        label: 'Calendar',
        activeIcon: 'calendar-month',
        inactiveIcon: 'calendar-month-outline',
        description: 'Shared plans and moments',
      };
    case 'Insights':
      return {
        label: 'Insights',
        activeIcon: 'chart-box',
        inactiveIcon: 'chart-box-outline',
        description: 'Pulse, score, and history',
      };
    case 'Us':
      return {
        label: 'Us',
        activeIcon: 'account-group',
        inactiveIcon: 'account-group-outline',
        description: 'Partner connection and settings',
      };
  }
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const tab = getTabConfig(route.name);

        return {
          headerShown: false,
          tabBarActiveTintColor: '#B25B63',
          tabBarInactiveTintColor: '#6B4A55',
          tabBarStyle: {
            backgroundColor: '#FFF7F2',
            borderTopColor: '#EAC0B2',
            height: 72,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
          },
          tabBarLabel: tab.label,
          tabBarLabelStyle: {
            fontWeight: '600',
            fontSize: 11,
          },
          tabBarAccessibilityLabel: `${tab.label}. ${tab.description}. Tab.`,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialDesignIcons
              name={(focused ? tab.activeIcon : tab.inactiveIcon) as any}
              color={color}
              size={size + 2}
            />
          ),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Love" component={LoveScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Us" component={UsScreen} />
    </Tab.Navigator>
  );
}
