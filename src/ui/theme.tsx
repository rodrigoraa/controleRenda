import type { ReactNode } from "react";
import {
  Button,
  createTheme,
  MantineProvider,
  UnstyledButton,
  useMantineColorScheme,
  type CSSVariablesResolver,
} from "@mantine/core";
import { Moon, Sun } from "lucide-react";
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
const darkTokens = {
  primary: "#92d7b9",
  ink: "#e4efeb",
  canvas: "#101a18",
  surface: "#192622",
  muted: "#a8bcb4",
  border: "#344840",
  danger: "#ffa49b",
  success: "#92d7b9",
};
const brand = {
  "--cr-brand": uiTokens.primary,
  "--cr-on-brand": uiTokens.surface,
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
    ...brand,
    "--cr-tint": "#edf7f2",
    "--cr-warning-bg": "#fff8eb",
    "--cr-warning-ink": "#775325",
    "--cr-warning-border": "#ead4ac",
    "--cr-danger-bg": "#fff4f3",
    "--cr-scrollbar-thumb": "#b4c4bd",
    "--cr-scrollbar-hover": "#879e93",
  },
  dark: {
    ...Object.fromEntries(
      Object.entries(darkTokens).map(([key, value]) => [`--cr-${key}`, value]),
    ),
    ...brand,
    "--mantine-color-body": darkTokens.canvas,
    "--mantine-color-text": darkTokens.ink,
    "--cr-tint": "#233b32",
    "--cr-warning-bg": "#3a2d1d",
    "--cr-warning-ink": "#ffd196",
    "--cr-warning-border": "#6d5537",
    "--cr-danger-bg": "#422827",
    "--cr-scrollbar-thumb": "#526e64",
    "--cr-scrollbar-hover": "#77968a",
  },
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
      defaultColorScheme="light"
      env={test ? "test" : undefined}
    >
      {children}
    </MantineProvider>
  );
}

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const label = dark ? "Ativar modo claro" : "Ativar modo escuro";
  return (
    <UnstyledButton
      type="button"
      className="icon-button theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => toggleColorScheme()}
    >
      {dark ? (
        <Sun size={19} aria-hidden="true" />
      ) : (
        <Moon size={19} aria-hidden="true" />
      )}
    </UnstyledButton>
  );
}
