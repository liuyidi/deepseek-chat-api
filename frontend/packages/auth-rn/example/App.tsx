import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import {
  AuthLoginScreen,
  AuthRegisterScreen,
  createAuthClient,
  type AuthCredentials,
  type RegisterCredentials,
} from "../src";

const authClient = createAuthClient({
  baseUrl: "https://auth.example.com",
});

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const title = useMemo(() => (mode === "login" ? "登录示例" : "注册示例"), [mode]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.kicker}>@mini-auth/auth-rn</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>业务方只需要接入这一包，就能拿到 RN 登录页和认证客户端。</Text>
      </View>

      {mode === "login" ? (
        <AuthLoginScreen
          brand="Example App"
          title="欢迎回来"
          subtitle="请先完成登录"
          description="登录成功后会拿到 access token、refresh token 和用户信息。"
          emailLabel="邮箱"
          passwordLabel="密码"
          submitLabel="登录"
          registerHint="还没有账号？"
          registerLinkLabel="去注册"
          demoAccount={{ email: "demo@mini-auth.dev", password: "demo12345", label: "demo 账号" }}
          onLogin={async (credentials: AuthCredentials) => {
            await authClient.login(credentials);
          }}
          onRegisterPress={() => setMode("register")}
        />
      ) : (
        <AuthRegisterScreen
          brand="Example App"
          title="创建账号"
          subtitle="注册后自动登录"
          description="注册页直接复用同一包里的原生 UI。"
          emailLabel="邮箱"
          nicknameLabel="昵称"
          passwordLabel="密码"
          confirmPasswordLabel="确认密码"
          submitLabel="注册"
          loginHint="已经有账号？"
          loginLinkLabel="返回登录"
          onRegister={async (credentials: RegisterCredentials) => {
            await authClient.register(credentials);
          }}
          onLoginPress={() => setMode("login")}
        />
      )}
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
});
