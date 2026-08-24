import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { AuthButton, AuthTextField } from "./ui";

const colors = {
  canvas: "#ffffff",
  ink: "#080808",
  muted: "#666666",
  subtle: "#8a8a8a",
  surface: "#f5f5f5",
  surfaceHover: "#eeeeee",
  border: "#a8a8a8",
  focus: "#4f46e5",
  danger: "#b42318",
  dangerSurface: "#fff1f0",
  support: "#333333",
};

const buttonPalette = {
  primary: colors.ink,
  onPrimary: colors.canvas,
  surface: colors.surface,
  text: colors.ink,
  border: colors.border,
};

const fieldPalette = {
  ink: colors.ink,
  canvas: colors.canvas,
  border: colors.border,
  focus: colors.focus,
  muted: colors.muted,
};

export type AuthLanguage = "zh" | "en";

export type EmailCodeStartResult = {
  email: string;
  resend_after_seconds: number;
  debug_code?: string | null;
};

export type AuthLoginScreenProps = {
  mode: "login" | "register";
  brand?: string;
  language?: AuthLanguage;
  onLanguageChange?: (language: AuthLanguage) => void;
  onSendCode: (email: string) => Promise<EmailCodeStartResult>;
  onVerifyCode: (
    email: string,
    code: string,
    options?: { username?: string },
  ) => Promise<void>;
  onGooglePress?: () => Promise<void>;
  onGitHubPress?: () => Promise<void>;
  onDemoPress?: () => Promise<void>;
  onSwitchMode: () => void;
};

type LoginCopy = {
  headlineLogin: string;
  headlineRegister: string;
  providersLabel: string;
  google: string;
  github: string;
  divider: string;
  username: string;
  email: string;
  usernamePlaceholder: string;
  emailPlaceholder: string;
  codeSentTo: (email: string) => string;
  continue: string;
  sending: string;
  continuing: string;
  noAccount: string;
  createOne: string;
  alreadyHaveAccount: string;
  signIn: string;
  demoLogin: string;
  didntReceiveCode: string;
  resendCode: string;
  resendWithCooldown: (seconds: number) => string;
  poweredBy: string;
  privacy: string;
  terms: string;
  debugCode: (code: string) => string;
  usernameRequired: string;
  emailRequired: string;
  sendFailed: string;
  signInFailed: string;
};

function copyFor(brand: string, language: AuthLanguage): LoginCopy {
  if (language === "en") {
    return {
      headlineLogin: "Hey friend! Welcome back",
      headlineRegister: `Create your ${brand} account`,
      providersLabel: "Sign in providers",
      google: "Continue with Google",
      github: "Continue with GitHub",
      divider: "Or",
      username: "Username",
      email: "Email",
      usernamePlaceholder: "Enter username",
      emailPlaceholder: "Enter email",
      codeSentTo: (email) => `Code sent to ${email}`,
      continue: "Continue",
      sending: "Sending...",
      continuing: "Continuing...",
      noAccount: "No account?",
      createOne: "Create one",
      alreadyHaveAccount: "Already have an account?",
      signIn: "Sign in",
      demoLogin: "Demo account login",
      didntReceiveCode: "Didn't receive a code?",
      resendCode: "Resend code",
      resendWithCooldown: (seconds) => `Resend code (${seconds}s)`,
      poweredBy: "Powered by",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      debugCode: (code) => `Debug code: ${code}`,
      usernameRequired: "Please enter your username.",
      emailRequired: "Please enter your email.",
      sendFailed: "Could not send the code. Please try again.",
      signInFailed: "Sign in failed. Please try again.",
    };
  }

  return {
    headlineLogin: "欢迎回来",
    headlineRegister: `创建你的 ${brand} 账号`,
    providersLabel: "登录方式",
    google: "使用 Google 继续",
    github: "使用 GitHub 继续",
    divider: "或",
    username: "用户名",
    email: "邮箱",
    usernamePlaceholder: "请输入用户名",
    emailPlaceholder: "请输入邮箱",
    codeSentTo: (email) => `验证码已发送至 ${email}`,
    continue: "继续",
    sending: "发送中...",
    continuing: "登录中...",
    noAccount: "还没有账号？",
    createOne: "创建账号",
    alreadyHaveAccount: "已有账号？",
    signIn: "登录",
    demoLogin: "Demo 账号登录",
    didntReceiveCode: "没收到验证码？",
    resendCode: "重新发送",
    resendWithCooldown: (seconds) => `重新发送 (${seconds}s)`,
    poweredBy: "Powered by",
    privacy: "隐私政策",
    terms: "服务条款",
    debugCode: (code) => `调试验证码：${code}`,
    usernameRequired: "请输入用户名。",
    emailRequired: "请输入邮箱。",
    sendFailed: "验证码发送失败，请稍后重试。",
    signInFailed: "登录失败，请稍后重试。",
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function GoogleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill="#4285f4"
        d="M22.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h6c-.3 1.4-1 2.5-2.1 3.2v2.7h3.4c2-1.8 3.3-4.5 3.3-7.7Z"
      />
      <Path
        fill="#34a853"
        d="M12 23c3 0 5.5-1 7.3-3.1l-3.4-2.7c-1 .6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.7H2.1v2.8C3.9 20.2 7.7 23 12 23Z"
      />
      <Path
        fill="#fbbc05"
        d="M5.6 13.5c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V6.3H2.1C1.4 7.8 1 9.5 1 11.3s.4 3.5 1.1 5l3.5-2.8Z"
      />
      <Path
        fill="#ea4335"
        d="M12 4.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 1.1 15 0 12 0 7.7 0 3.9 2.8 2.1 6.3l3.5 2.8C6.5 6.4 9 4.4 12 4.4Z"
      />
    </Svg>
  );
}

function GitHubIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={colors.ink}
        d="M12 1.8a10.3 10.3 0 0 0-3.3 20c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.8-.1-.3-.5-1.3.1-2.8 0 0 .9-.3 2.8 1a9.7 9.7 0 0 1 5.1 0c2-1.3 2.8-1 2.8-1 .6 1.5.2 2.5.1 2.8.7.8 1 1.7 1 2.8 0 3.9-2.4 4.7-4.6 5 .4.3.8 1 .8 2v2.9c0 .3.2.6.8.5A10.3 10.3 0 0 0 12 1.8Z"
      />
    </Svg>
  );
}

function ProviderButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        pressed && !disabled ? styles.providerPressed : null,
        disabled ? styles.providerDisabled : null,
      ]}
    >
      <View style={styles.providerInner}>
        {icon}
        <Text style={styles.providerLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function AuthLoginScreen({
  mode,
  brand = "mini-auth",
  language: languageProp,
  onLanguageChange,
  onSendCode,
  onVerifyCode,
  onGooglePress,
  onGitHubPress,
  onDemoPress,
  onSwitchMode,
}: AuthLoginScreenProps) {
  const insets = useSafeAreaInsets();
  const [internalLanguage, setInternalLanguage] = useState<AuthLanguage>("zh");
  const language = languageProp ?? internalLanguage;
  const setLanguage = (next: AuthLanguage) => {
    onLanguageChange?.(next);
    if (languageProp === undefined) {
      setInternalLanguage(next);
    }
  };
  const copy = copyFor(brand, language);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [error, setError] = useState("");
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "github" | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const isRegister = mode === "register";
  const isBusy = loadingSend || loadingVerify || loadingProvider !== null;
  const canResend = cooldown === 0 && !loadingSend;
  const actionLabel = loadingVerify
    ? copy.continuing
    : loadingSend
      ? copy.sending
      : copy.continue;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const providers = useMemo(
    () => [
      {
        id: "google" as const,
        label: copy.google,
        icon: <GoogleIcon />,
        onPress: onGooglePress,
      },
      {
        id: "github" as const,
        label: copy.github,
        icon: <GitHubIcon />,
        onPress: onGitHubPress,
      },
    ],
    [copy.github, copy.google, onGitHubPress, onGooglePress],
  );

  const runProvider = async (id: "google" | "github", action?: () => Promise<void>) => {
    if (!action || isBusy) return;
    setError("");
    setLoadingProvider(id);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.signInFailed);
    } finally {
      setLoadingProvider(null);
    }
  };

  const startEmail = async () => {
    if (isRegister && !username.trim()) {
      setError(copy.usernameRequired);
      return;
    }
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError(copy.emailRequired);
      return;
    }
    setError("");
    setLoadingSend(true);
    try {
      const result = await onSendCode(normalized);
      setSentEmail(result.email || normalized);
      setDebugCode(result.debug_code || "");
      setCooldown(result.resend_after_seconds || 60);
      if (result.debug_code) {
        setCode(result.debug_code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.sendFailed);
    } finally {
      setLoadingSend(false);
    }
  };

  const submit = async () => {
    if (isRegister && !username.trim()) {
      setError(copy.usernameRequired);
      return;
    }
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError(copy.emailRequired);
      return;
    }
    if (!code.trim()) {
      await startEmail();
      return;
    }
    setError("");
    setLoadingVerify(true);
    try {
      await onVerifyCode(
        normalized,
        code.trim(),
        isRegister ? { username: username.trim() } : undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.signInFailed);
    } finally {
      setLoadingVerify(false);
    }
  };

  const isDev =
    typeof __DEV__ === "boolean"
      ? __DEV__
      : true;
  const showDebugCode = Boolean(debugCode) && isDev;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.language, { top: insets.top + 12, right: 20 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: language === "zh" }}
          onPress={() => setLanguage("zh")}
          hitSlop={8}
        >
          <Text style={[styles.languageBtn, language === "zh" && styles.languageBtnActive]}>
            中
          </Text>
        </Pressable>
        <Text style={styles.languageSep}>/</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: language === "en" }}
          onPress={() => setLanguage("en")}
          hitSlop={8}
        >
          <Text style={[styles.languageBtn, language === "en" && styles.languageBtnActive]}>
            EN
          </Text>
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top + 40, 56),
            paddingBottom: insets.bottom + 40,
          },
        ]}
      >
        <View style={styles.panel}>
          <Text style={styles.brand}>{brand}</Text>
          <Text style={styles.headline} accessibilityRole="header">
            {isRegister ? copy.headlineRegister : copy.headlineLogin}
          </Text>

          <View style={styles.providers} accessibilityLabel={copy.providersLabel}>
            {providers.map((provider) => (
              <ProviderButton
                key={provider.id}
                label={loadingProvider === provider.id ? copy.continuing : provider.label}
                icon={provider.icon}
                disabled={isBusy || !provider.onPress}
                onPress={() => void runProvider(provider.id, provider.onPress)}
              />
            ))}
          </View>

          <Text style={styles.divider}>{copy.divider}</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            {isRegister ? (
              <AuthTextField
                label={copy.username}
                palette={fieldPalette}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={copy.usernamePlaceholder}
                editable={!isBusy}
              />
            ) : null}

            <AuthTextField
              label={copy.email}
              palette={fieldPalette}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder={copy.emailPlaceholder}
              editable={!isBusy}
            />

            {sentEmail ? (
              <AuthTextField
                hint={copy.codeSentTo(sentEmail)}
                palette={fieldPalette}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                editable={!isBusy}
              />
            ) : null}

            <AuthButton
              label={actionLabel}
              palette={buttonPalette}
              loading={isBusy}
              disabled={isBusy}
              onPress={() => void submit()}
              style={styles.continueBtn}
            />
          </View>

          <View style={styles.support}>
            {sentEmail ? (
              <Text style={styles.supportText}>
                {copy.didntReceiveCode}{" "}
                <Text
                  style={[styles.supportLink, !canResend && styles.supportDisabled]}
                  onPress={() => {
                    if (canResend) void startEmail();
                  }}
                >
                  {cooldown > 0 ? copy.resendWithCooldown(cooldown) : copy.resendCode}
                </Text>
              </Text>
            ) : (
              <Text style={styles.supportText}>
                {isRegister ? `${copy.alreadyHaveAccount} ` : `${copy.noAccount} `}
                <Text style={styles.supportLink} onPress={onSwitchMode}>
                  {isRegister ? copy.signIn : copy.createOne}
                </Text>
                {!isRegister && onDemoPress ? (
                  <>
                    <Text> · </Text>
                    <Text
                      style={styles.supportLink}
                      onPress={() => {
                        void onDemoPress().catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : copy.signInFailed);
                        });
                      }}
                    >
                      {copy.demoLogin}
                    </Text>
                  </>
                ) : null}
              </Text>
            )}
          </View>

          {showDebugCode ? (
            <View style={styles.debugBox}>
              <Text style={styles.debugText}>{copy.debugCode(debugCode)}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerPowered}>
              {copy.poweredBy} <Text style={styles.footerBrand}>{brand}</Text>
            </Text>
            <Text style={styles.footerLegal}>
              {copy.privacy}
              {" · "}
              {copy.terms}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Alias for the Minibot-era screen name. Prefer `AuthLoginScreen`. */
export const MiniLoginScreen = AuthLoginScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  language: {
    position: "absolute",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  languageBtn: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  languageBtnActive: {
    color: colors.ink,
    fontWeight: "600",
  },
  languageSep: {
    color: colors.muted,
    fontSize: 14,
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  panel: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  brand: {
    color: colors.ink,
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 40,
  },
  headline: {
    marginTop: 42,
    marginBottom: 28,
    color: colors.ink,
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 28,
    textAlign: "center",
  },
  providers: {
    width: "100%",
    gap: 18,
  },
  provider: {
    position: "relative",
    overflow: "hidden",
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  providerPressed: {
    backgroundColor: colors.surfaceHover,
  },
  providerDisabled: {
    opacity: 0.58,
  },
  providerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 18,
  },
  providerLabel: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
  },
  divider: {
    marginVertical: 32,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 18,
  },
  errorBox: {
    width: "100%",
    marginBottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.dangerSurface,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "left",
  },
  form: {
    width: "100%",
    gap: 18,
  },
  continueBtn: {
    borderWidth: 0,
  },
  support: {
    width: "100%",
    marginTop: 30,
  },
  supportText: {
    color: colors.support,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  supportLink: {
    color: colors.ink,
    textDecorationLine: "underline",
  },
  supportDisabled: {
    opacity: 0.48,
  },
  debugBox: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  debugText: {
    color: colors.muted,
    fontSize: 13,
  },
  footer: {
    marginTop: 52,
    alignItems: "center",
  },
  footerPowered: {
    color: colors.subtle,
    fontSize: 16,
    lineHeight: 16,
  },
  footerBrand: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  footerLegal: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
