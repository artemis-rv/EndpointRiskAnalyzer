/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design-system tokens. Every colour used in the app resolves through
        // these names — no ad-hoc hex values scattered through components.
        brand: {
          50: '#eef4ff',
          100: '#dae4ff',
          200: '#bccfff',
          300: '#8eaeff',
          400: '#5981ff',
          500: '#3355f5',
          600: '#1f34e0',
          700: '#1a29b5',
          800: '#1b268f',
          900: '#1c2871',
          950: '#141a45',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d9e2',
          300: '#aeb7c8',
          400: '#8290a9',
          500: '#63728e',
          600: '#4e5b75',
          700: '#404a5f',
          800: '#374050',
          900: '#313846',
          950: '#1d212c',
        },
        // The admin area uses a deliberately different hue so it can never be
        // mistaken for the public marketing site.
        admin: {
          50: '#f2f6f5',
          100: '#dfeae7',
          200: '#bed6d0',
          500: '#3f7f72',
          600: '#2f6459',
          700: '#285248',
          800: '#22423b',
          900: '#1d3732',
          950: '#0f1f1c',
        },
        success: {
          50: '#eefbf3',
          100: '#d6f5e2',
          200: '#aeeac6',
          500: '#18a35b',
          600: '#0f8449',
          700: '#0d693c',
        },
        warning: {
          50: '#fffbeb',
          100: '#feefc7',
          200: '#fde28a',
          500: '#d9820b',
          600: '#b26508',
          700: '#8f4f0c',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#dc2626',
          600: '#c01d1d',
          700: '#9e1c1c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.10)',
        'card-lg': '0 4px 6px -2px rgb(16 24 40 / 0.03), 0 12px 16px -4px rgb(16 24 40 / 0.08)',
        popover: '0 8px 8px -4px rgb(16 24 40 / 0.04), 0 20px 24px -4px rgb(16 24 40 / 0.10)',
      },
      maxWidth: {
        prose: '68ch',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
