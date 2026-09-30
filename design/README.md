# Klarity design language

The brand book, tokens and component guidelines live in the **Klarity** design system:
https://claude.ai/artifact/D9bDf7yWgZeN5hztzF1XKq

In code, the sources of truth are:
- `native/Klarity/Shared/Theme.swift` — color tokens (light/dark), `Tone`, `Pill`, `LadderMark`
- `native/Klarity/Brand/KlarityMark.swift` — the mark as a SwiftUI shape + the icon composition

This folder holds the exported brand assets (`klarity-mark-on-ink.svg`, `klarity-mark-on-paper.svg`,
`klarity-badge.svg`, `icon-1024.png`) and `render-icon.swift`, which renders the app icon from
`KlarityMark.swift` so the two can never drift:

```bash
swiftc -parse-as-library design/render-icon.swift native/Klarity/Brand/KlarityMark.swift -o /tmp/render-icon && /tmp/render-icon design
```

Change a token in `Theme.swift` and in the design system's `tokens.json` together; the design system
records the contrast ratio for every text/ground pair in both themes.
