import { StrictMode, type ReactElement, type ReactNode } from "react";
import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react";
import { UIProvider } from "../src/ui/theme";
export * from "@testing-library/react";
export function render(ui: ReactElement, options?: RenderOptions) {
  // Keep StrictMode at the root so React also verifies initial effect cleanup.
  if (ui.type === StrictMode) {
    return rtlRender(
      <StrictMode>
        <UIProvider test>
          {(ui.props as { children: ReactNode }).children}
        </UIProvider>
      </StrictMode>,
      options,
    );
  }
  return rtlRender(ui, {
    wrapper: ({ children }) => <UIProvider test>{children}</UIProvider>,
    ...options,
  });
}
