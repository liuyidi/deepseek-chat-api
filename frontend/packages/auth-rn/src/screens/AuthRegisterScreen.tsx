import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthField } from "../components/AuthField";
import { authUiTheme } from "../theme";
import type { AuthRegisterScreenProps } from "../types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthRegisterScreen({
  brand,
  title,
  subtitle,
  description,
  emailLabel,
  nicknameLabel,
  passwordLabel,
  confirmPasswordLabel,
  submitLabel,
  loginHint,
  loginLinkLabel,
  onRegister,
  onLoginPress,
  onSuccess,
}: AuthRegisterScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 840;
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedNickname = nickname.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    if (password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await onRegister({
        email: trimmedEmail,
        password,
        nickname: trimmedNickname || undefined,
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={[styles.shell, isWide ? styles.shellWide : styles.shellNarrow]}>
          <View style={styles.hero}>
            <View style={styles.eyebrow}>
              <View style={styles.dot} />
              <Text style={styles.eyebrowText}>{brand}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>∞</Text>
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>{brand}</Text>
                  <Text style={styles.brandMeta}>注册后会自动创建并登录账号</Text>
                </View>
              </View>
            </View>

            {error ? (
              <View style={styles.alert}>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <AuthField
                label={emailLabel}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <AuthField
                label={nicknameLabel}
                value={nickname}
                onChangeText={setNickname}
                placeholder="你的昵称"
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="nickname"
              />
              <AuthField
                label={passwordLabel}
                value={password}
                onChangeText={setPassword}
                placeholder="至少 8 位"
                autoComplete="password-new"
                textContentType="newPassword"
                secureTextEntry
                showToggle
              />
              <AuthField
                label={confirmPasswordLabel}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="再次输入密码"
                autoComplete="password-new"
                textContentType="newPassword"
                secureTextEntry
                showToggle
              />

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !loading && styles.pressed,
                  loading && styles.disabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{submitLabel}</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{loginHint}</Text>
              {onLoginPress ? (
                <Pressable accessibilityRole="link" onPress={onLoginPress}>
                  <Text style={styles.footerLink}>{loginLinkLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: authUiTheme.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    gap: 20,
    alignSelf: "center",
  },
  shellWide: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 1120,
  },
  shellNarrow: {
    flexDirection: "column",
    maxWidth: 560,
  },
  hero: {
    flex: 1,
    gap: 12,
    paddingHorizontal: 4,
  },
  eyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.48)",
    borderWidth: 1,
    borderColor: "rgba(74,56,36,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: authUiTheme.accent,
  },
  eyebrowText: {
    color: authUiTheme.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    color: authUiTheme.text,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "800",
    letterSpacing: -1.2,
    maxWidth: 12 * 20,
  },
  description: {
    color: authUiTheme.muted,
    fontSize: 17,
    lineHeight: 27,
    maxWidth: 620,
  },
  subtitle: {
    color: "rgba(107,90,73,0.86)",
    fontSize: 14,
  },
  card: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: authUiTheme.border,
    backgroundColor: authUiTheme.card,
    padding: 24,
    gap: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 30,
    elevation: 6,
  },
  cardHeader: {
    marginBottom: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(74,56,36,0.12)",
    backgroundColor: "#fff",
  },
  brandMarkText: {
    color: authUiTheme.accentDeep,
    fontSize: 22,
    fontWeight: "800",
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    color: authUiTheme.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  brandMeta: {
    color: authUiTheme.muted,
    fontSize: 13,
    marginTop: 2,
  },
  alert: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: authUiTheme.dangerBorder,
    backgroundColor: authUiTheme.dangerBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertText: {
    color: authUiTheme.dangerText,
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: authUiTheme.accent,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  footerText: {
    color: authUiTheme.muted,
    fontSize: 13,
  },
  footerLink: {
    color: authUiTheme.accentDeep,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});

