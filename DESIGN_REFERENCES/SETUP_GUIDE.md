# Design Reference Setup Guide

## Tools for Recording Animations

### GIF Recording Tools (Free)
1. **ScreenToGif** (Windows) - https://www.screentogif.com/
   - Records screen to GIF directly
   - No watermark
   - Lightweight

2. **Peek** (Linux/macOS) - https://github.com/phw/peek
   - Simple GIF recorder
   - Records screen regions

3. **Gyroflow Toolbox** (Cross-platform)
   - Can record and export as GIF

4. **FFmpeg** (Command line - most powerful)
   ```
   ffmpeg -y -framerate 30 -i screenshot-%03d.png -vf scale=1200:-1 animation.gif
   ```

### Browser Tools
- Chrome DevTools Network tab (capture timing)
- Firefox Developer Tools (animation inspector)
- Inspect CSS animations and transitions

## Websites to Study

### Dark Mode + Professional + Animations
1. **Awwwards Collection**
   - URL: https://www.awwwards.com/websites/animation/
   - Why: Best animated websites
   - Elements to capture: Scroll triggers, parallax, micro-interactions

2. **Parallax Scroll Masters**
   - URL: https://www.awwwards.com/websites/parallax/
   - Why: 3D depth and scrollytelling
   - Elements to capture: Depth effects, scroll animations

3. **Modern Sports Apps**
   - Strava (fitness tracking)
   - ESPN+ (sports streaming)
   - Elements: Real-time updates, gamification, leaderboards

### Specific Animation Patterns to Record
- [ ] Smooth scroll reveal animations
- [ ] Parallax depth on scroll
- [ ] Glassmorphic card hover effects
- [ ] Micro-animations on buttons
- [ ] Loading animations
- [ ] Badge/achievement animations
- [ ] Leaderboard rank transitions
- [ ] 3D rotation effects
- [ ] Glow/neon effects
- [ ] Stagger animations (cascade reveal)

## Reference Structure
```
DESIGN_REFERENCES/
├── 2025_BEAUTY_ANALYSIS.md (✓ created)
├── SETUP_GUIDE.md (this file)
├── websites/
│   ├── site1_name.md (description, screenshots, animations)
│   ├── site2_name.md
│   └── ...
├── animations/
│   ├── scroll-reveal.gif
│   ├── parallax-effect.gif
│   ├── card-hover.gif
│   ├── button-interaction.gif
│   └── ANIMATIONS.md (descriptions of each)
└── color-palettes/
    ├── dark-cyberpunk.md
    └── sports-gamification.md
```

## How to Use This Folder
1. Download ScreenToGif or use FFmpeg
2. Visit beautiful websites listed above
3. Record specific animations as GIFs
4. Document what you see in websiteX_name.md
5. Reference these when building our site

