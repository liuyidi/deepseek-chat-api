import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import {
  createAuthClient,
  type AuthCredentials,
  type RegisterCredentials,
} from "../src";

const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.kicker}>@mini-auth/auth-rn</Text>
        <Text style={styles.title}>
          {mode === "login" ? "登录示例" : "注册示例"}
        </Text>
        <Text style={styles.subtitle}>
          本包只提供认证客户端。登录/注册 UI 由业务 App 自己实现。
        </Text>
      </View>
      <Text
        accessibilityRole="button"
        onPress={() => setMode(mode === "login" ? "register" : "login")}
        style={styles.toggle}
      >
        {mode === "login" ? "切换到注册示例" : "切换到登录示例"}
      </Text>
      <Text
        accessibilityRole="button"
        onPress={() => {
          void (mode === "login"
            ? authClient.login({ email: "demo@mini-auth.dev", password: "demo12345" } satisfies AuthCredentials)
            : authClient.register({
                email: "demo@mini-auth.dev",
                password: "demo12345",
                nickname: "demo",
              } satisfies RegisterCredentials));
        }}
        style={styles.toggle}
      >
        调用 {mode === "login" ? "login()" : "register()"}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5efe7",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 6,
  },
  kicker: {
    color: "#8f3f1d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#251c12",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: "#6a5846",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 520,
  },
  toggle: {
    marginHorizontal: 20,
    marginTop: 16,
    color: "#8f3f1d",
    fontSize: 15,
    fontWeight: "600",
  },
});
