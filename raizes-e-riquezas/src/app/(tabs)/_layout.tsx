import { Tabs } from "expo-router";
import { View, Image, StyleSheet } from "react-native";

function TabIcon({ name, focused }: { name: "chat" | "calendar" | "clients"; focused: boolean }) {
  const color = focused ? "#d9b268" : "#6b6152";
  if (name === "chat") {
    return (
      <View style={ts.icon}>
        <View style={{ width: 20, height: 20, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 16, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: color }} />
          <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: color, alignSelf: "flex-start", marginLeft: 3, marginTop: -1 }} />
        </View>
      </View>
    );
  }
  if (name === "clients") {
    return (
      <View style={ts.icon}>
        <View style={{ width: 20, height: 20, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: color, marginBottom: -2 }} />
          <View style={{ width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.5, borderBottomWidth: 0, borderColor: color }} />
        </View>
      </View>
    );
  }
  return (
    <View style={ts.icon}>
      <View style={{ width: 18, height: 16, borderRadius: 2, borderWidth: 1.5, borderColor: color, justifyContent: "flex-start" }}>
        <View style={{ height: 5, backgroundColor: color, marginTop: 3 }} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1a2e18", elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontFamily: "serif", fontSize: 18, fontStyle: "italic", color: "#d9b268" },
        headerLeft: () => (
          <Image source={require("../../../assets/images/logo-icon.png")} style={{ width: 32, height: 32, marginLeft: 16, borderRadius: 16 }} resizeMode="contain" />
        ),
        headerTintColor: "#d9b268",
        tabBarStyle: { backgroundColor: "#1a2e18", borderTopColor: "rgba(217,178,104,0.12)", borderTopWidth: 1, height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: "#d9b268",
        tabBarInactiveTintColor: "#6b6152",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen
        name="assistente"
        options={{
          title: "Assistente",
          headerTitle: "Raízes · Riquezas",
          tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: "Agenda",
          headerTitle: "Raízes · Riquezas",
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          headerTitle: "Raízes · Riquezas",
          tabBarIcon: ({ focused }) => <TabIcon name="clients" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const ts = StyleSheet.create({
  icon: { width: 28, height: 28, justifyContent: "center", alignItems: "center" },
});
