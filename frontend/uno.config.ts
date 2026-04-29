import { defineConfig, presetUno, presetIcons, transformerDirectives } from 'unocss'

export default defineConfig({
    presets: [
        presetUno({ dark: 'class' }),
        presetIcons(),
    ],
    transformers: [
        transformerDirectives(),
    ],
    theme: {
        colors: {
            primary: 'rgb(var(--color-primary) / <alpha-value>)'
        }
    },
    shortcuts: {
        // Add any shortcuts if needed
    },
    // Enforce class-based dark mode
})
