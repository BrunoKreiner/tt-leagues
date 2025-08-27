# Mobile Menu Implementation Guide

## Overview

The mobile menu provides a responsive navigation experience for mobile devices, featuring a hamburger button that transforms into an X when opened, and a slide-in menu panel with full functionality.

## Features

### 🍔 Hamburger Button
- **Location**: Top-right corner of the header (mobile only)
- **Animation**: Smooth transform from hamburger (☰) to X (✕)
- **Breakpoint**: Hidden on `md:` (768px) and larger screens
- **Accessibility**: Proper ARIA labels and keyboard support

### 📱 Mobile Menu Panel
- **Position**: Slides in from the right side
- **Width**: 320px (w-80) for comfortable touch targets
- **Animation**: 300ms smooth slide transition with backdrop blur
- **Content**: Full navigation with user profile and notifications

### 🎨 Design Features
- **Modern UI**: Consistent with existing design system
- **Backdrop**: Semi-transparent overlay with blur effect
- **Typography**: Proper spacing and hierarchy
- **Icons**: Lucide React icons matching desktop navigation
- **Active States**: Highlighted current page

## Components

### MobileMenu.jsx
Main mobile menu component with:
- Backdrop overlay
- Slide-in panel
- User profile section
- Navigation links
- Notifications integration
- Quick actions (Profile, Settings)
- Logout button

### HamburgerButton.jsx
Animated hamburger button with:
- Three-line hamburger icon
- Smooth transform to X
- Proper touch targets
- Accessibility support

## Usage

### Basic Implementation
```jsx
import MobileMenu from './components/layout/MobileMenu';
import HamburgerButton from './components/layout/HamburgerButton';

// In your layout component
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
const closeMobileMenu = () => setMobileMenuOpen(false);

// Header
<HamburgerButton isOpen={mobileMenuOpen} onClick={toggleMobileMenu} />

// Mobile menu
<MobileMenu
  isOpen={mobileMenuOpen}
  onClose={closeMobileMenu}
  navigation={navigation}
  user={user}
  notifications={notifications}
  unreadCount={unreadCount}
  notifLoading={notifLoading}
  acceptLoading={acceptLoading}
  onMarkAsRead={markAsRead}
  onAcceptInvite={handleAcceptInvite}
  onDenyInvite={handleDenyInvite}
  onLogout={handleLogout}
/>
```

### Responsive Behavior
- **Desktop (≥768px)**: Standard horizontal navigation
- **Mobile (<768px)**: Hamburger button + slide-out menu
- **Breakpoint**: Uses Tailwind's `md:` prefix

## Interactions

### Opening/Closing
- **Click hamburger**: Toggle menu open/close
- **Click backdrop**: Close menu
- **Press Escape**: Close menu
- **Route change**: Auto-close menu

### Navigation
- **Touch targets**: Minimum 44px for accessibility
- **Active states**: Highlighted current page
- **Smooth transitions**: 300ms duration

### Notifications
- **Real-time updates**: Live notification count
- **Quick actions**: Accept/deny league invites
- **Full integration**: Same functionality as desktop

## Accessibility

### ARIA Support
- `aria-label`: "Open menu" / "Close menu"
- `aria-expanded`: Tracks menu state
- `aria-modal`: Indicates modal behavior
- `role="dialog"`: Proper semantic markup

### Keyboard Navigation
- **Escape key**: Close menu
- **Focus management**: Trapped within menu when open
- **Tab order**: Logical navigation flow

### Screen Reader Support
- **Descriptive labels**: Clear button descriptions
- **State announcements**: Menu open/closed status
- **Content structure**: Proper heading hierarchy

## Styling

### CSS Classes
```css
/* Mobile menu panel */
.mobile-menu-panel {
  @apply fixed right-0 top-0 h-full w-80 bg-card border-l border-border z-50;
  @apply transform transition-transform duration-300 ease-in-out;
}

/* Backdrop */
.mobile-menu-backdrop {
  @apply fixed inset-0 bg-black/50 backdrop-blur-sm z-40;
  @apply transition-opacity duration-300;
}

/* Hamburger animation */
.hamburger-line {
  @apply absolute h-0.5 w-6 bg-current transform;
  @apply transition-all duration-300 ease-in-out;
}
```

### Custom Utilities
```css
@layer utilities {
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
```

## Performance

### Optimizations
- **Hardware acceleration**: Uses `transform` for animations
- **Efficient rendering**: Minimal re-renders
- **Smooth animations**: 60fps transitions
- **Memory management**: Proper cleanup on unmount

### Best Practices
- **Lazy loading**: Menu only renders when needed
- **Event cleanup**: Removes listeners on unmount
- **State management**: Efficient state updates
- **CSS transitions**: GPU-accelerated animations

## Browser Support

### Tested Browsers
- ✅ Chrome (desktop & mobile)
- ✅ Safari (desktop & mobile)
- ✅ Firefox (desktop & mobile)
- ✅ Edge (desktop)

### Features
- **CSS Grid/Flexbox**: Modern layout support
- **CSS Transforms**: Smooth animations
- **ES6+**: Modern JavaScript features
- **Touch Events**: Mobile interaction support

## Future Enhancements

### Potential Improvements
- **Swipe gestures**: Swipe to close functionality
- **Haptic feedback**: Touch feedback on mobile
- **Theme integration**: Dark/light mode support
- **Customization**: User-configurable menu items
- **Search integration**: In-menu search functionality

### Performance Optimizations
- **Code splitting**: Lazy load menu components
- **Preloading**: Preload menu assets
- **Caching**: Cache menu state
- **Optimization**: Bundle size reduction

## Troubleshooting

### Common Issues
1. **Menu not opening**: Check z-index values
2. **Animation glitches**: Verify CSS transform support
3. **Touch issues**: Ensure proper touch targets
4. **Accessibility**: Test with screen readers

### Debug Tips
- **Console errors**: Check for JavaScript errors
- **CSS conflicts**: Verify Tailwind classes
- **State issues**: Debug React state management
- **Performance**: Monitor animation performance

## Conclusion

The mobile menu provides a modern, accessible, and performant navigation experience for mobile users while maintaining consistency with the existing design system. The implementation follows best practices for responsive design, accessibility, and user experience.