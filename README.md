# Owezzi — Free Pomodoro Timer for Focused Study

Owezzi is a beautiful, minimalist, and premium Pomodoro timer designed to help you maintain deep focus during study and work sessions. Built with React, TypeScript, and Tailwind CSS, it offers a premium aesthetic experience with ambient animations, sound effects, and multi-theme customization.

Visit the live app at: [owezzi.in](https://owezzi.in)

## ✨ Features

- **8 Handcrafted Themes:** Customize your workspace with Midnight, Ocean, Forest, Sunset, Lavender, Arctic, Ember, or Monochrome styles.
- **Visual Progress Ring:** A glowing, interactive circular progress bar detailing your remaining session time.
- **Ambient Glow:** Subtle background pulse animations while the timer is actively running.
- **Audio Notifications:** Gentle, synthetically generated tone feedback when starting and ending a session (via Web Audio API).
- **Custom Timer Sessions:** Configure specific durations for Focus, Short Break, and Long Break periods.
- **Persistence:** Save your stats (completed sessions, total focus minutes) and preferences (muted/unmuted, chosen theme) in your browser’s `localStorage`.
- **Fullscreen Support:** Enter fullscreen mode to eliminate desktop distractions.
- **Progress Sharing:** Share your achievements with others using the built-in sharing button.

## 🛠️ Technology Stack

- **Framework:** React 18 & TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS & PostCSS
- **Icons:** Lucide React
- **Synth Audio:** Web Audio API (`AudioContext`)

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation

1. Open your terminal in the directory.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open the local address (typically `http://localhost:5173`) in your browser to start focusing!

## ⚙️ Available Scripts

In the project directory, you can run:

- `npm run dev`: Runs the app in development mode.
- `npm run build`: Builds the production-ready app to the `dist` folder.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Runs ESLint to check for code quality and style.
- `npm run typecheck`: Performs TypeScript compiler compilation checks without emitting files.

---
Made with ❤️ by Owezzi.
