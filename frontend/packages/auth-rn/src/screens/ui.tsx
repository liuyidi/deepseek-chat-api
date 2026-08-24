import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

export type AuthButtonPalette = {
  primary: string;
  onPrimary: string;
  surface: string;
  text: string;
  border: string;
};

export type AuthTextFieldPalette = {
  ink: string;
  canvas: string;
  border: string;
  focus: string;
  muted: string;
};

type AuthButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  palette: AuthButtonPalette;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AuthButton({
  label,
  palette,
  loading = false,
  disabled,
  style,
  ...rest
}: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        buttonStyles.base,
        {
          backgroundColor: palette.primary,
          borderColor: palette.primary,
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.onPrimary} />
      ) : (
        <Text style={[buttonStyles.label, { color: palette.onPrimary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

type AuthTextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  palette: AuthTextFieldPalette;
};

export function AuthTextField({
  label,
  hint,
  palette,
  style,
  ...rest
}: AuthTextFieldProps) {
  return (
    <View style={fieldStyles.field}>
      {label ? <Text style={[fieldStyles.label, { color: palette.ink }]}>{label}</Text> : null}
      {hint ? <Text style={[fieldStyles.hint, { color: palette.muted }]}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={palette.muted}
        style={[
          fieldStyles.input,
          {
            color: palette.ink,
            backgroundColor: palette.canvas,
            borderColor: palette.border,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
  },
});

const fieldStyles = StyleSheet.create({
  field: {
    gap: 12,
  },
  label: {
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "left",
  },
  hint: {
    fontSize: 14,
    fontWeight: "300",
    lineHeight: 18,
    textAlign: "left",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 18,
    lineHeight: 22,
  },
});
