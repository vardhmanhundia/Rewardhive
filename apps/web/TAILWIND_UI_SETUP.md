# Frontend UI Refactoring - Tailwind CSS + shadcn/ui

Complete guide for the refactored frontend with modern design system using Tailwind CSS and shadcn/ui components.

## Overview

The frontend has been completely redesigned with:
- ✅ **Tailwind CSS** - Utility-first CSS framework
- ✅ **shadcn/ui** - High-quality React components built on Radix UI
- ✅ **White theme** - Clean, professional default theme
- ✅ **Modern UI** - Professional, polished design
- ✅ **Responsive design** - Mobile-first approach
- ✅ **Lucide icons** - Beautiful icon library

## What Changed

### Dependencies Added
```json
{
  "dependencies": {
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-slot": "^2.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.16"
  }
}
```

### New Configuration Files
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration for Tailwind
- `src/index.css` - Global styles with CSS variables
- `src/lib/utils.ts` - Utility functions (cn() for class merging)

### New UI Components
- `src/components/ui/button.tsx` - Button component
- `src/components/ui/input.tsx` - Input field component
- `src/components/ui/label.tsx` - Label component
- `src/components/ui/card.tsx` - Card container component

### Refactored Pages
All pages now use Tailwind CSS and shadcn/ui components:
- **LoginPage** - Modern login form with validation
- **SignupPage** - Registration form with multi-field layout
- **ProfilePage** - User profile display with copy-to-clipboard
- **HomePage** - Hero section with features and stats

## Color Scheme

### White Theme (Default)
The application uses a clean white theme with the following colors:

```css
:root {
  --background: 0 0% 100%;        /* White */
  --foreground: 0 0% 3.6%;        /* Dark gray/black */
  --card: 0 0% 100%;              /* White */
  --card-foreground: 0 0% 3.6%;   /* Dark gray/black */
  --muted: 0 0% 96.1%;            /* Very light gray */
  --muted-foreground: 0 0% 45.1%; /* Medium gray */
  --accent: 0 0% 9.0%;            /* Very dark gray */
  --primary: 0 0% 9%;             /* Primary dark color */
  --primary-foreground: 0 0% 100%;/* White */
  --destructive: 0 84.2% 60.2%;   /* Red */
  --border: 0 0% 89.8%;           /* Light gray border */
  --input: 0 0% 89.8%;            /* Light gray input */
}
```

### Tailwind Theme
Uses default Tailwind colors plus extended CSS variables:
- **Primary**: Dark gray (used for buttons, links)
- **Secondary**: Light gray background
- **Destructive**: Red (for danger actions)
- **Muted**: Gray (for secondary text)
- **Border**: Light gray borders

## Component Library

### Button Component
```tsx
import { Button } from '@/components/ui/button';

// Variants
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon</Button>
```

### Input Component
```tsx
import { Input } from '@/components/ui/input';

<Input
  type="email"
  placeholder="Enter email"
  value={email}
  onChange={handleChange}
  disabled={isLoading}
/>
```

### Label Component
```tsx
import { Label } from '@/components/ui/label';

<Label htmlFor="email">Email Address</Label>
```

### Card Component
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

## Tailwind CSS Classes

### Common Classes Used

**Layout:**
```
min-h-screen, flex, grid, gap-*, p-*, m-*
flex-col, sm:flex-row, md:grid-cols-3
```

**Text:**
```
text-sm, text-base, text-lg, text-xl, text-2xl, text-4xl, text-5xl
font-semibold, font-bold, font-medium, font-normal
text-gray-900, text-gray-600, text-gray-500
```

**Colors:**
```
bg-white, bg-gray-50, bg-gray-100, bg-slate-900
border, border-gray-200, border-red-200
text-red-600, text-red-800, text-green-600
```

**Effects:**
```
shadow-sm, shadow-lg, hover:shadow-lg
rounded-lg, rounded-md
transition-all, transition-colors, transition-shadow
```

**Responsive:**
```
sm: (max-width: 640px)
md: (max-width: 768px)
lg: (max-width: 1024px)
xl: (max-width: 1280px)
```

## Icons

Using **lucide-react** for icons:

```tsx
import { LogOut, Copy, CheckCircle, ArrowRight, Zap, Shield, Layout } from 'lucide-react';

<LogOut className="w-4 h-4" />
```

Available icons: https://lucide.dev

## Pages Overview

### 1. Home Page (`/`)
- Hero section with title and CTA
- Feature cards (3 columns)
- Stats section
- Responsive design
- Gradient background

### 2. Login Page (`/login`)
- Centered card design
- Email and password fields
- Error messages per field
- API error display
- Link to signup
- Loading state

### 3. Signup Page (`/signup`)
- Card-based form
- First/Last name in 2-column grid
- Email input
- Password with confirmation
- Field-level validation
- Error messages
- Link to login
- Loading state

### 4. Profile Page (`/profile`)
- Header with welcome message
- Logout button (top right)
- Personal information card
  - Copy-to-clipboard for each field
  - Visual feedback on copy
  - Status badge (Active/Inactive)
- Raw JSON section with dark background
- Responsive grid layout

## Development Workflow

### Setup
```bash
cd apps/web
npm install
npm run dev
```

### Build
```bash
npm run build
```

### View CSS Classes
Tailwind CSS IntelliSense support (VS Code extension recommended):
- Install "Tailwind CSS IntelliSense" extension
- Get autocomplete for class names

## Utility Functions

### `cn()` - Class Merging
```tsx
import { cn } from '@/lib/utils';

// Merge Tailwind classes intelligently
const buttonClass = cn(
  'px-4 py-2 rounded',
  isActive && 'bg-blue-500 text-white'
);
```

## TypeScript Support

All components are fully typed:
```tsx
import { Button, type ButtonProps } from '@/components/ui/button';

interface MyComponentProps extends ButtonProps {
  customProp?: string;
}
```

## Responsive Design

### Mobile-First Approach
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

### Breakpoints
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

## Form Patterns

### Basic Form Field
```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    value={email}
    onChange={handleChange}
    className={error ? 'border-red-500' : ''}
  />
  {error && <p className="text-xs text-red-600">{error}</p>}
</div>
```

## Button Patterns

### Primary CTA
```tsx
<Button type="submit" className="w-full">
  Submit
</Button>
```

### Secondary Action
```tsx
<Button variant="outline">Cancel</Button>
```

### Danger Action
```tsx
<Button variant="destructive">Delete</Button>
```

## Card Patterns

### Basic Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Card with Description
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

## Accessibility

All components include:
- ✅ Proper semantic HTML
- ✅ ARIA attributes where needed
- ✅ Keyboard navigation support
- ✅ Focus states
- ✅ Color contrast compliance

## Performance

- ✅ CSS is compiled and optimized
- ✅ Only used styles are included in production
- ✅ Tree-shaking for unused components
- ✅ Fast reload with Vite

## Dark Mode (Future Enhancement)

To add dark mode support:

1. Update `tailwind.config.js`:
```js
export default {
  darkMode: 'class',
  // ... rest of config
}
```

2. Update `src/index.css` with dark mode colors:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 3.6%;
    --foreground: 0 0% 100%;
    /* ... other dark colors ... */
  }
}
```

3. Add dark toggle in component:
```tsx
<button onClick={() => document.documentElement.classList.toggle('dark')}>
  Toggle Dark Mode
</button>
```

## Customization

### Modify Colors
Edit `src/index.css` CSS variables:
```css
:root {
  --primary: 0 0% 9%;  /* Change primary color */
  --destructive: 0 84.2% 60.2%;  /* Change red */
}
```

### Modify Fonts
Edit `tailwind.config.js`:
```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Roboto', 'sans-serif'],
    },
  },
}
```

### Add New Components
Create in `src/components/ui/`:
```tsx
// src/components/ui/alert.tsx
import { cn } from '@/lib/utils';

export const Alert = ({ className, ...props }) => (
  <div className={cn('rounded-lg border p-4', className)} {...props} />
);
```

## Production Checklist

- [ ] All pages tested on mobile
- [ ] Dark mode support (if needed)
- [ ] Color contrast checked (WCAG AA)
- [ ] All interactive elements tested
- [ ] Loading states working
- [ ] Error messages display properly
- [ ] Images optimized
- [ ] CSS is tree-shaken in build

## Next Steps

1. **Run locally**: `npm install && npm run dev`
2. **Test pages**: Login → Signup → Profile
3. **Customize theme**: Edit `src/index.css` CSS variables
4. **Add more components**: Use shadcn/ui components as needed
5. **Deploy**: `npm run build` produces optimized build

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Lucide Icons](https://lucide.dev)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## File Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── FormField.tsx          # Old component (can be removed)
│   ├── ProtectedRoute.tsx
│   └── ...
├── pages/
│   ├── HomePage.tsx           # ✨ Refactored
│   ├── LoginPage.tsx          # ✨ Refactored
│   ├── SignupPage.tsx         # ✨ Refactored
│   ├── ProfilePage.tsx        # ✨ Refactored
│   └── ...
├── lib/
│   └── utils.ts               # New: cn() utility
├── context/
│   └── AuthContext.tsx
├── services/
│   └── authService.ts
├── App.tsx
├── index.css                  # ✨ New: Tailwind styles
└── main.tsx
```

---

**Frontend is now using modern design system with Tailwind CSS + shadcn/ui!** 🎨
