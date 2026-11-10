import type { ReactNode } from "react";
import {
  Button,
  createTheme,
  MantineProvider,
  type CSSVariablesResolver,
} from "@mantine/core";
export const uiTokens = {
  primary: "#176451",
  ink: "#152e2b",
  canvas: "#f4f7f8",
  surface: "#ffffff",
  muted: "#5f706c",
  border: "#dde6e2",
  danger: "#b43d3d",
  success: "#176451",
  body: "'DM Sans Variable', system-ui, sans-serif",
  display: "'Manrope Variable', system-ui, sans-serif",
};
export const theme = createTheme({
  primaryColor: "finance",
  primaryShade: 7,
  colors: {
    finance: [
      "#edf7f2",
      "#dcefe5",
      "#badfcd",
      "#95cbb2",
      "#70b795",
      "#50a47d",
      "#348c66",
      uiTokens.primary,
      "#135340",
      "#0e4032",
    ],
  },
  fontFamily: uiTokens.body,
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.375rem",
  },
  headings: { fontFamily: uiTokens.display, fontWeight: "700" },
  radius: { sm: "0.5rem", md: "0.75rem", lg: "1.25rem" },
  defaultRadius: "md",
  respectReducedMotion: true,
  cursorType: "pointer",
  components: {
    Button: Button.extend({
      defaultProps: { size: "md" },
      styles: { root: { minHeight: 44, fontWeight: 650 }, label: { gap: 8 } },
    }),
  },
});
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: Object.fromEntries(
    Object.entries(uiTokens).map(([key, value]) => [`--cr-${key}`, value]),
  ),
  light: {
    "--mantine-color-body": uiTokens.canvas,
    "--mantine-color-text": uiTokens.ink,
  },
  dark: {},
});
export function UIProvider({
  children,
  test = false,
}: {
  children: ReactNode;
  test?: boolean;
}) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme="light"
      env={test ? "test" : undefined}
    >
      {children}
    </MantineProvider>
  );
}
