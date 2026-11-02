// Written to the themes folder the first time the app runs. Missing files are written again, existing files are never touched.
export const DEFAULT_THEMES: Record<string, string> = {
    'aurora.yaml': `# Themes are plain YAML files. Edit this one, or copy it to make your own,
# then press "Reload" in Settings > Appearance. Every field is optional.
name: Aurora

colors:
  ink: "#eef1f7"                          # main text
  dim: "#98a1b8"                          # secondary text
  accent: "#8fa8ff"                       # highlights, playhead handle
  accentInk: "#0b1030"                    # text on accent buttons
  surface: "rgba(255, 255, 255, 0.06)"   # buttons, fields
  surfaceHover: "rgba(255, 255, 255, 0.12)"
  line: "rgba(255, 255, 255, 0.09)"      # thin borders
  deep: "rgba(8, 10, 18, 0.55)"          # dark wells, such as the monitor
  danger: "#ff6b7d"
  success: "#5fe3a1"
  warning: "#ffbf5e"
  videoClip: "#4d6bd6"
  audioClip: "#2fa37f"
  imageClip: "#a05fd0"
  playhead: "#ff5d73"
  selection: "#ffffff"

# The glass look of the panels (the "islands").
glass:
  island: "rgba(24, 27, 40, 0.58)"
  header: "rgba(255, 255, 255, 0.04)"
  blur: 28                                # px
  saturate: 160                           # percent
  border: "rgba(255, 255, 255, 0.10)"
  highlight: "rgba(255, 255, 255, 0.10)"
  shadow: "0 10px 36px rgba(0, 0, 0, 0.35)"

layout:
  radius: 14                              # corner size of the panels
  gap: 8                                  # space between the panels

window:
  material: none                          # none | mica | acrylic | tabbed (Windows 11 only)

background:
  base: "#0a0c14"
  layers:
    - type: gradient
      value: "radial-gradient(ellipse at 15% 0%, #3b4fd1, transparent 55%)"
      opacity: 0.55
    - type: gradient
      value: "radial-gradient(ellipse at 90% 100%, #7a3fc2, transparent 55%)"
      opacity: 0.45
  #  - type: image                        # a file on your computer, or a https:// link
  #    value: "C:/Users/you/Pictures/wallpaper.jpg"
  #    opacity: 0.4
  #    blur: 8
  #    size: cover

# Change one part of the app. The name is "<View>.<element>" from the data-theme attribute.
overrides: {}
#  StellarTimeline.panel:
#    border-radius: 22px
`,
    'midnight.yaml': `name: Midnight
colors:
  accent: "#b69cff"
  accentInk: "#160b33"
  dim: "#9a9bb8"
  videoClip: "#6a52c9"
  audioClip: "#3a9b9b"
glass:
  island: "rgba(16, 14, 34, 0.62)"
background:
  base: "#06050f"
  layers:
    - type: gradient
      value: "radial-gradient(ellipse at 50% 0%, #4b3bb5, transparent 60%)"
      opacity: 0.5
`,
    'ember.yaml': `name: Ember
colors:
  accent: "#ffb86b"
  accentInk: "#2b1503"
  videoClip: "#c25a3a"
  audioClip: "#b88a2f"
  playhead: "#ffd36b"
glass:
  island: "rgba(34, 20, 16, 0.6)"
background:
  base: "#0e0806"
  layers:
    - type: gradient
      value: "radial-gradient(circle at 80% 8%, #ff7a45, transparent 55%)"
      opacity: 0.4
    - type: gradient
      value: "radial-gradient(circle at 10% 100%, #b3261e, transparent 50%)"
      opacity: 0.35
`,
    'mist.yaml': `# A light glass theme.
name: Mist
colors:
  ink: "#1b2430"
  dim: "#5d6b7e"
  accent: "#3a6df0"
  accentInk: "#ffffff"
  surface: "rgba(255, 255, 255, 0.55)"
  surfaceHover: "rgba(255, 255, 255, 0.85)"
  line: "rgba(20, 30, 50, 0.12)"
  deep: "rgba(20, 30, 50, 0.14)"
  videoClip: "#6f93f5"
  audioClip: "#4fbf9a"
  imageClip: "#b98ae6"
  playhead: "#e5384f"
  selection: "#1b2430"
glass:
  island: "rgba(255, 255, 255, 0.5)"
  header: "rgba(255, 255, 255, 0.35)"
  border: "rgba(255, 255, 255, 0.7)"
  highlight: "rgba(255, 255, 255, 0.9)"
  shadow: "0 10px 30px rgba(40, 60, 100, 0.18)"
background:
  base: "#dfe7f2"
  layers:
    - type: gradient
      value: "radial-gradient(ellipse at 20% 0%, #9fc0ff, transparent 60%)"
      opacity: 0.7
    - type: gradient
      value: "radial-gradient(ellipse at 100% 100%, #f2b6d8, transparent 55%)"
      opacity: 0.6
`,
    'graphite.yaml': `name: Graphite
colors:
  accent: "#7fd1c7"
  accentInk: "#05211d"
  videoClip: "#4f7f9c"
  audioClip: "#5f9c73"
glass:
  island: "rgba(30, 32, 36, 0.78)"
  blur: 18
  border: "rgba(255, 255, 255, 0.07)"
layout:
  radius: 10
  gap: 6
background:
  base: "#121316"
  layers: []
`
};
