import type { Config } from 'tailwindcss'

// docs/design.md 1章のデザイントークン。
// 色はすべて CSS変数（src/styles/tokens.css）経由にして、ダークモード（黒板テーマ）で差し替えられるようにする。
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'),
        grid: 'rgb(var(--c-grid) / 0.07)',
        card: c('card'),
        ink: c('ink'),
        navy: { DEFAULT: c('navy'), deep: c('navy-deep') },
        muted: c('muted'),
        sepia: { DEFAULT: c('sepia'), ink: c('sepia-ink') },
        sand: c('sand'),
        line: { DEFAULT: c('line'), soft: c('line-soft') },
        field: c('field'),
        highlight: c('highlight'),
        dash: c('dash'),
        tape: 'rgb(var(--c-tape) / 0.75)',
        yes: c('yes'),
        maybe: { DEFAULT: c('maybe'), ink: c('maybe-ink') },
        no: c('no'),
        off: c('off'),
        kraft: c('kraft'),
        photo: {
          1: c('photo-1'),
          2: c('photo-2'),
          3: c('photo-3'),
          4: c('photo-4'),
          5: c('photo-5'),
        },
        frame: { DEFAULT: c('polaroid'), ink: c('polaroid-ink') },
        'on-photo': c('on-photo'),
        'on-scrim': { DEFAULT: c('on-scrim'), muted: c('on-scrim-muted') },
        overlay: 'rgb(var(--c-overlay) / 0.35)',
        scrim: 'rgb(var(--c-scrim) / 0.9)',
        bar: 'rgb(var(--c-paper) / 0.94)',
      },
      fontFamily: {
        hand: ['"Zen Kurenaido"', '"Hiragino Maru Gothic ProN"', 'sans-serif'],
        sans: ['"Noto Sans JP"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic"', 'Meiryo', 'sans-serif'],
      },
      fontSize: {
        // 見出し（font-hand と組み合わせる）
        hero: ['40px', { lineHeight: '1.3' }], // 完了画面の大見出し
        gate: ['32px', { lineHeight: '1.3' }], // ゲートの大見出し
        h1: ['28px', { lineHeight: '1.4' }],
        h2: ['22px', { lineHeight: '1.4' }],
        'h2-admin': ['20px', { lineHeight: '1.4' }],
        logo: ['34px', { lineHeight: '1.3' }],
        // 本文など（font-sans）
        countdown: ['40px', { lineHeight: '1' }],
        pin: ['20px', { lineHeight: '1' }],
        lead: ['18px', { lineHeight: '1.5' }],
        title: ['17px', { lineHeight: '1.5' }],
        input: ['16px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.8' }],
        label: ['13px', { lineHeight: '1.5' }],
        note: ['12px', { lineHeight: '1.6' }],
        tiny: ['11px', { lineHeight: '1.5' }],
      },
      letterSpacing: {
        catch: '.2em',
        button: '.08em',
        pin: '.5em',
      },
      borderRadius: {
        tag: '4px',
        field: '10px',
        btn: '12px',
        card: '14px',
        chip: '18px',
        pill: '20px',
      },
      borderWidth: {
        strong: '1.5px',
      },
      boxShadow: {
        polaroid: '0 4px 12px rgb(var(--c-shadow) / 0.16)',
        'polaroid-lg': '0 6px 18px rgb(var(--c-shadow) / 0.18)',
        note: '0 2px 6px rgb(var(--c-shadow) / 0.1)',
      },
      spacing: {
        gutter: '18px',
        'gutter-wide': '28px',
        section: '22px',
        'section-sm': '18px',
        tap: '44px',
      },
      maxWidth: {
        content: '480px',
      },
      keyframes: {
        breathe: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '.55' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        breathe: 'breathe 1.6s ease-in-out infinite',
        'fade-in': 'fade-in .5s ease-out both',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config
