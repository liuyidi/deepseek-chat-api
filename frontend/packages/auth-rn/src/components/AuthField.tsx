import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { authUiTheme } from "../theme";

type AuthFieldProps = TextInputProps & {
  label: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
};

export function AuthField({ label, secureTextEntry, showToggle, ...props }: AuthFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isSecure = secureTextEntry && !isVisible;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          {...props}
          secureTextEntry={isSecure}
          placeholderTextColor="rgba(107,90,73,0.65)"
          style={[styles.input, showToggle && styles.inputWithToggle]}
        />
        {secureTextEntry && showToggle ? (
          <Pressable onPress={() => setIsVisible((current: boolean) => !current)} style={styles.toggle}>
            <Text style={styles.toggleText}>{isVisible ? "隐藏" : "显示"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    color: "#423223",
    fontSize: 13,
    fontWeight: "600",
  },
  inputShell: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(74,56,36,0.16)",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: authUiTheme.text,
  },
  inputWithToggle: {
    paddingRight: 74,
  },
  toggle: {
    position: "absolute",
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleText: {
    color: authUiTheme.accentDeep,
    fontSize: 13,
    fontWeight: "600",
  },
});

