import { Tabs } from "expo-router";
import { View, Image, StyleSheet } from "react-native";

function TabIcon({ name, focused }: { name: "chat" | "calendar"; focused: boolean }) {
  const color = focused ? "#5E4B37" : "#8B8078";
  if (name === "chat") {
    return (
      <View style={[ts.icon, focused && ts.iconActive]}>
        <View style={{ width: 20, height: 20, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 16, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: color }} />
          <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: color, alignSelf: "flex-start", marginLeft: 3, marginTop: -1 }} />
        </View>
      </View>
    );
  }
  return (
    <View style={[ts.icon, focused && ts.iconActive]}>
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
        headerStyle: { backgroundColor: "#FFFFFF", elevation: 2, shadowOpacity: 0.06 },
        headerTitleStyle: { fontFamily: "serif", fontSize: 18, fontWeight: "600", color: "#5E4B37" },
        headerLeft: () => (
          <Image source={require("../../assets/icon.png")} style={{ width: 28, height: 28, marginLeft: 16 }} resizeMode="contain" />
        ),
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#E8E0D4", height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: "#5E4B37",
        tabBarInactiveTintColor: "#8B8078",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="assistente"
        options={{
          title: "Assistente",
          headerTitle: "Raízes e Riquezas",
          tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: "Calendário",
          headerTitle: "Raízes e Riquezas",
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const ts = StyleSheet.create({
  icon: { width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  iconActive: { opacity: 1 },
});
