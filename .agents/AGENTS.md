# Workspace Rules

The following rules apply specifically to this workspace and all work done within it:

## UI and Web Design Best Practices
- **Spacing and Depth**: Do not create flat, condensed interfaces. Always use generous padding, grid gaps, and subtle shadows or depth cues to create "breathing room".
- **Modern Aesthetics**: Aim for premium, sleek, and highly polished designs (e.g., modern AAA game engine tools) over simple MVP prototypes. 
- **Readability**: Ensure high contrast for text. Do not use obscure acronyms (e.g., use "Solo / Mute" instead of "S / M"). Use clear tooltips for complex parameters.

## Architectural Best Practices
- **No Monolithic Files**: Do not build massive, single files that do not scale well. Break complex functionality into smaller, reusable components or separate modules.
- **Maintainability**: Follow standard React architectural practices. Separate state logic from UI where appropriate, and keep components focused on a single responsibility.
- **UI Consistency Across Modules**: Always extract common UI elements (like custom sliders, tooltips, buttons) into shared components (e.g., `src/components/ui.jsx`) instead of duplicating inline definitions. Ensure all modules inherit the exact same CSS variables, spacing, and styling conventions.

## React & Vite Best Practices
- **Hooks & State**: Prefer functional components and React Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) over class-based components. Ensure dependency arrays in hooks are always complete and accurate to prevent stale closures.
- **Performance Optimization**: For frequent high-speed updates (like the Screenshake Canvas rendering or dragging), use `requestAnimationFrame` combined with React `useRef` to avoid blocking the main thread or causing unnecessary React re-renders. Use `useMemo` for expensive calculations (e.g., initializing `simplex-noise`).
- **Styling**: Stick to Vanilla CSS variables and semantic naming conventions for consistent theming across the application. Avoid overly complex inline styles when a CSS class is more appropriate.
- **Module Splitting**: Feature modules (like `ScreenShakeTool` or `VideoDiffTool`) should live in their own dedicated files under `src/modules/` and be imported lazily or directly into the main `App.jsx` shell. Keep `App.jsx` strictly as a routing and layout shell.
