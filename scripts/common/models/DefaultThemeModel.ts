// Written to the themes folder the first time the app runs. Missing files are written again, existing files are never touched.
// Three themes ship with the app: Dark, Light and Midnight Purple.
export const DEFAULT_THEMES: Record<string, string> = {
    'dark.yaml': `# Themes are plain YAML files. Edit this one, or copy it to make your own,
# then press "Reload" in Settings > Appearance. Every field is optional.
name: Dark

colors:
  ink: "#e6e6e6"                          # main text
  dim: "#9a9a9a"                          # secondary text
  accent: "#4a8bff"                       # active tab line, highlights, buttons
  accentInk: "#ffffff"                    # text on accent buttons
  surface: "rgba(255, 255, 255, 0.07)"   # buttons, fields
  surfaceHover: "rgba(255, 255, 255, 0.13)"
  line: "rgba(255, 255, 255, 0.09)"      # thin borders and dividers
  deep: "#161616"                         # dark wells, such as the monitor
  danger: "#ff6b7d"
  success: "#5fe3a1"
  warning: "#ffbf5e"
  videoClip: "#4f7bd0"
  audioClip: "#2fa37f"
  imageClip: "#a05fd0"
  playhead: "#ff5d73"
  selection: "#ffffff"

# Panel colors. "island" is the color of every docked panel and "header" is its tab strip.
# Blur and saturate only matter for dialogs and menus.
glass:
  island: "#232323"
  header: "#1d1d1d"
  blur: 0                                 # px
  saturate: 100                           # percent
  border: "#3a3a3a"
  highlight: "rgba(255, 255, 255, 0.05)"
  shadow: "0 8px 28px rgba(0, 0, 0, 0.5)"

layout:
  radius: 6                               # corner size of dialogs and menus
  gap: 8                                  # spacing in the launcher

window:
  material: none                          # none | mica | acrylic | tabbed (Windows 11 only)

background:
  base: "#141414"                         # the window color, which shows between the panels
  layers: []

# Change one part of the app. The name is "<View>.<element>" from the data-theme attribute.
overrides: {}
#  StellarPanel.timeline:
#    background: "#1b1b1b"
`,
    'light.yaml': `name: Light
colors:
  ink: "#1d1d1f"
  dim: "#5e5e63"
  accent: "#2a6df4"
  accentInk: "#ffffff"
  surface: "rgba(0, 0, 0, 0.05)"
  surfaceHover: "rgba(0, 0, 0, 0.10)"
  line: "rgba(0, 0, 0, 0.12)"
  deep: "rgba(0, 0, 0, 0.10)"
  videoClip: "#6f93f5"
  audioClip: "#4fbf9a"
  imageClip: "#b98ae6"
  playhead: "#e5384f"
  selection: "#1d1d1f"
glass:
  island: "#ececec"
  header: "#e2e2e2"
  blur: 0
  saturate: 100
  border: "#c8c8c8"
  highlight: "rgba(255, 255, 255, 0.8)"
  shadow: "0 8px 24px rgba(0, 0, 0, 0.18)"
layout:
  radius: 6
  gap: 8
window:
  material: none
background:
  base: "#c4c4c4"
  layers: []
overrides: {}
`,
    'midnight-purple.yaml': `name: Midnight Purple
colors:
  ink: "#ece8ff"
  dim: "#9d96c4"
  accent: "#a78bfa"
  accentInk: "#14092e"
  surface: "rgba(180, 160, 255, 0.08)"
  surfaceHover: "rgba(180, 160, 255, 0.16)"
  line: "rgba(190, 170, 255, 0.12)"
  deep: "#0f0a1f"
  videoClip: "#6a52c9"
  audioClip: "#3a9b9b"
  imageClip: "#c77dff"
  playhead: "#ff6fa5"
  selection: "#ffffff"
glass:
  island: "#1a1430"
  header: "#150f28"
  blur: 0
  saturate: 100
  border: "#2f2658"
  highlight: "rgba(190, 170, 255, 0.06)"
  shadow: "0 8px 28px rgba(5, 2, 20, 0.6)"
layout:
  radius: 6
  gap: 8
window:
  material: none
background:
  base: "#0b0816"
  layers: []
overrides: {}
`
};
