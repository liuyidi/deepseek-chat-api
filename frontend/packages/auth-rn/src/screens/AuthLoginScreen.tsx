import { useMemo, useState } from "react";
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
import type { AuthLoginScreenProps } from "../types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthLoginScreen({
  brand,
  title,
  subtitle,
  description,
  emailLabel,
  passwordLabel,
  submitLabel,
  registerHint,
  registerLinkLabel,
  guestLabel,
  demoAccount,
  onLogin,
  onRegisterPress,
  onGuestPress,
  onSuccess,
}: AuthLoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 840;
  const [email, setEmail] = useState(demoAccount?.email ?? "");
  const [password, setPassword] = useState(demoAccount?.password ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const bullets = useMemo(
    () =>
      isWide
        ? ["统一身份中心", "支持 OIDC / PKCE", "适合桌面与平板登录"]
        : ["统一身份中心", "支持 OIDC / PKCE", "适合移动端快速登录"],
    [isWide]
  );

  const handleUseDemoAccount = () => {
    if (!demoAccount) return;
    setEmail(demoAccount.email);
    setPassword(demoAccount.password);
    setError("");
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    if (!password) {
      setError("请输入密码");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await onLogin({ email: trimmedEmail, password });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
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

            <View style={styles.bullets}>
              {bullets.map((item: string) => (
                <View key={item} style={styles.bulletRow}>
                  <View style={styles.check}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>∞</Text>
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.brandName}>{brand}</Text>
                  <Text style={styles.brandMeta}>登录后会完成身份签发和回跳</Text>
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
                label={passwordLabel}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                autoComplete="password"
                textContentType="password"
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
              <Text style={styles.footerText}>{registerHint}</Text>
              {onRegisterPress ? (
                <Pressable accessibilityRole="link" onPress={onRegisterPress}>
                  <Text style={styles.footerLink}>{registerLinkLabel}</Text>
                </Pressable>
              ) : null}
            </View>

            {demoAccount ? (
              <Pressable onPress={handleUseDemoAccount} style={styles.demoButton}>
                <Text style={styles.demoButtonText}>
                  使用 demo 账号 {demoAccount.label ? `· ${demoAccount.label}` : ""}
                </Text>
              </Pressable>
            ) : null}

            {onGuestPress && guestLabel ? (
              <Pressable accessibilityRole="button" onPress={onGuestPress} style={styles.guestButton}>
                <Text style={styles.guestButtonText}>{guestLabel}</Text>
              </Pressable>
            ) : null}
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
  bullets: {
    gap: 12,
    marginTop: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(183,110,63,0.12)",
  },
  checkText: {
    color: authUiTheme.accentDeep,
    fontSize: 12,
    fontWeight: "700",
  },
  bulletText: {
    color: authUiTheme.muted,
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
  demoButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  demoButtonText: {
    color: authUiTheme.accentDeep,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  guestButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  guestButtonText: {
    color: authUiTheme.muted,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});

