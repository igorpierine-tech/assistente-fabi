import { Tabs } from "expo-router";
import { View, StyleSheet, Text } from "react-native";

type IconName = "home" | "chat" | "calendar" | "clients" | "more";

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const color = focused ? "#1A2E18" : "#8A7F6A";
  if (name === "home")
    return (
      <View style={[ts.icon, focused && ts.iconActive]}>
        <Text style={{ color, fontSize: 20 }}>⌂</Text>
      </View>
    );
  if (name === "clients")
    return (
      <View style={[ts.icon, focused && ts.iconActive]}>
        <Text style={{ color, fontSize: 20 }}>♙</Text>
      </View>
    );
  if (name === "more")
    return (
      <View style={[ts.icon, focused && ts.iconActive]}>
        <Text style={{ color, fontSize: 22, letterSpacing: 2 }}>•••</Text>
      </View>
    );
  if (name === "chat")
    return (
      <View style={[ts.icon, focused && ts.iconActive]}>
        <View style={{ width: 20, height: 20, justifyContent: "center", alignItems: "center" }}>
          <View style={{ width: 16, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: color }} />
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderTopWidth: 5,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: color,
              alignSelf: "flex-start",
              marginLeft: 3,
              marginTop: -1,
            }}
          />
        </View>
      </View>
    );
  return (
    <View style={[ts.icon, focused && ts.iconActive]}>
      <View
        style={{
          width: 18,
          height: 16,
          borderRadius: 2,
          borderWidth: 1.5,
          borderColor: color,
          justifyContent: "flex-start",
        }}
      >
        <View style={{ height: 5, backgroundColor: color, marginTop: 3 }} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#F4EDE0",
          borderTopColor: "rgba(26,46,24,.08)",
          height: 68,
          paddingBottom: 9,
          paddingTop: 5,
        },
        tabBarActiveTintColor: "#1A2E18",
        tabBarInactiveTintColor: "#8A7F6A",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: "Início",
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="assistente"
        options={{
          title: "Assistente",
          tabBarLabel: "IA",
          tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: "Calendário",
          tabBarLabel: "Agenda",
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ focused }) => <TabIcon name="clients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: "Mais",
          tabBarIcon: ({ focused }) => <TabIcon name="more" focused={focused} />,
        }}
      />
      {/* Hidden tabs — accessible only via router.push from the Mais screen */}
      <Tabs.Screen name="agendamentos" options={{ href: null }} />
      <Tabs.Screen name="vendas" options={{ href: null }} />
      <Tabs.Screen name="financeiro" options={{ href: null }} />
      <Tabs.Screen name="catalogo" options={{ href: null }} />
    </Tabs>
  );
}

const ts = StyleSheet.create({
  icon: { width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  iconActive: { opacity: 1 },
});
