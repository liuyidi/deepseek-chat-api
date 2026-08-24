import { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { createAuthClient } from "../src";
import { AuthLoginScreen } from "../src/screens";

const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.kicker}>@mini-auth/auth-rn</Text>
        <Text style={styles.title}>登录示例</Text>
        <Text style={styles.subtitle}>
          客户端用根入口；原生登录页从 `./screens` 引入。
        </Text>
      </View>
      <AuthLoginScreen
        mode={mode}
        brand="Example"
        onSendCode={async (email) => ({
          email,
          resend_after_seconds: 60,
        })}
        onVerifyCode={async () => {
          await authClient.login({
            email: "demo@mini-auth.dev",
            password: "demo12345",
          });
        }}
        onSwitchMode={() => setMode(mode === "login" ? "register" : "login")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 6,
  },
  kicker: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#080808",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#666666",
    fontSize: 14,
    lineHeight: 20,
  },
});
