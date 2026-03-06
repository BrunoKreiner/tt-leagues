# Implementation Roadmap - Beautiful Dark Mode Sports League Site

## Design Foundation

### Color Palette
```
Base: #0a0e1f (deep navy/black)
Primary Accent: #00d9ff (cyan/teal) - Energy, action
Secondary Accent: #ff6b35 (vibrant orange) - Engagement
Tertiary: #9d4edd (purple) - Premium, special
Highlight: #00f5a0 (bright mint) - Achievement, success
Text: #e0e7ff (soft white)
Glassmorphism: rgba(255, 255, 255, 0.1)
```

### Typography
- Display: Bold sans-serif (Instrument Sans or similar)
- Body: Clean sans-serif
- Monospace: For stats/numbers

## Animation Strategy

### 1. Entrance Animations (Page Load)
- **Hero Title**: Fade in + slight scale
- **CTA Button**: Slide up + scale
- **Hero Background**: Parallax depth on load
- Duration: 0.6-0.8s
- Easing: cubic-bezier(0.34, 1.56, 0.64, 1)

### 2. Scroll Animations (Scroll Triggers)
- **Features**: Stagger reveal (cascade down)
- **Leaderboards**: Slide in from left, rank badges pop
- **Stats**: Number counting animation (1200 → specific number)
- Duration: 0.6-1s per element
- Easing: ease-out

### 3. Micro-Interactions (Hover/Click)
- **Buttons**: Scale 1.05 + glow effect (shadow color change)
- **Cards**: Border color change + shadow increase + subtle lift (-2px)
- **Rank Badges**: Subtle scale + shadow glow
- **Links**: Color change + underline slide
- Duration: 0.3s
- Easing: ease-in-out

### 4. Parallax Effects (Advanced)
- **Hero Background**: Multi-layer parallax on scroll (slower than scroll speed)
- **Leaderboard Rows**: Subtle Y-axis parallax as they come into view
- **Player Cards**: Pointer-based parallax (XY coordinates follow mouse)
- Speed Factor: 0.3-0.5 (slower than scroll)

## Component Implementation Plan

### Landing Page

**Hero Section**
```
- Background: Gradient (dark navy to darker) + parallax effect
- Title: Large, bold, fade-in animation + gradient text
- Subtitle: Secondary color, fade-in with 0.2s delay
- CTA Button: Glassmorphic, glow on hover, slide-up animation
- Floating Element: Animated SVG or shape, parallax on scroll
```

**Features Section**
```
- Grid of 4 cards
- Each card: Stagger animation (cascade delay)
- Hover: Scale 1.02, shadow increase, border color change to accent
- Icon: Scale up on hover (1 → 1.2)
- Animation: Fade in + slide up on scroll
```

**Leaderboard Preview**
```
- Section Title: Slide down + fade in
- 2-Column layout (mobile: 1 column)
- Each League Card:
  - Glassmorphic background
  - Rank badges: Scale pop animation on appear
  - Rows: Stagger animate (each row with delay)
- Row Hover: Subtle lift (-2px), color highlight, pointer parallax
- Row Animation: Slide in from left with fade
```

**CTA Section**
```
- Card: Glassmorphic with glow border
- Title + Text: Fade in
- Button: Same as hero
- Background: Dark with gradient overlay
```

### Dashboard Page

**Leaderboard Cards**
```
- Scroll Trigger: Fade in + slide from left
- Hover: Border color to accent, shadow increase
- Rank Positions: Number count animation (0 → actual number)
- Player Rows: Stagger animation
- Pointer parallax on mouse move
```

**Match Cards**
```
- Carousel with parallax
- Each card: Glassmorphic, hover lift
- Score Display: Number count animation
- Icons: Scale on hover
```

**Stats Section**
```
- Animated counters (0 → number)
- Icons scale in with number
- Bars fill with animation
```

## Implementation Order

### Phase 1: Core (2-3 days)
- [ ] Update CSS with new dark color palette
- [ ] Add GSAP library
- [ ] Create base animations (fade-in, scale, slide)
- [ ] Implement scroll trigger setup
- [ ] Build landing page structure

### Phase 2: Animations (2-3 days)
- [ ] Hero section parallax + entrance animations
- [ ] Features section stagger reveal
- [ ] Leaderboard scroll animations
- [ ] Button hover effects (glow, scale)
- [ ] Card hover micro-interactions

### Phase 3: Advanced (2-3 days)
- [ ] Pointer parallax for cards
- [ ] Number counting animations
- [ ] Parallax depth effects
- [ ] Glassmorphism refinement
- [ ] Loading animations

### Phase 4: Polish (1-2 days)
- [ ] Fine-tune timing curves
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Animation refinement

## Libraries Needed

```bash
npm install gsap
npm install framer-motion  # Alternative for React
```

### GSAP Key Features for Our Site
- `ScrollTrigger`: Scroll-based animations
- `Tween`: Simple animations (scale, fade, etc)
- `Timeline`: Complex animation sequences
- `stagger`: Cascade animations on multiple elements

## Animation Checklist

- [ ] Smooth easing curves (no linear)
- [ ] Stagger delays on list items (0.05-0.15s each)
- [ ] Glassmorphism on all cards
- [ ] Micro-interactions on all buttons/links
- [ ] Scroll triggers on major sections
- [ ] Parallax on hero + leaderboards
- [ ] Number counting for stats
- [ ] Loading skeleton animations
- [ ] Mobile-optimized animations (reduced motion consideration)
- [ ] Performance tested (60fps target)

## CSS Variables for Easy Tweaking

```css
--accent-cyan: #00d9ff;
--accent-orange: #ff6b35;
--accent-purple: #9d4edd;
--accent-mint: #00f5a0;
--animation-duration: 0.6s;
--animation-ease: cubic-bezier(0.34, 1.56, 0.64, 1);
--hover-duration: 0.3s;
--hover-ease: ease-in-out;
```

## Notes for Development

1. **Performance**: Use `transform` and `opacity` only (GPU accelerated)
2. **Accessibility**: Respect `prefers-reduced-motion` media query
3. **Mobile**: Reduce animations on small screens
4. **Testing**: Test animations on various devices/browsers
5. **Smoothness**: Target 60fps, use DevTools to verify

## File Structure

```
DESIGN_REFERENCES/
├── 2025_BEAUTY_ANALYSIS.md (✓)
├── SETUP_GUIDE.md (✓)
├── IMPLEMENTATION_ROADMAP.md (this file)
├── animations/
│   ├── PARALLAX_EXAMPLES.md (✓)
│   ├── ANIMATIONS.md (to create - actual GIFs go here)
└── websites/
    └── (reference websites documentation)
```

