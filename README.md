#  Calculator

A sleek, modern, fully responsive web calculator built with **vanilla JavaScript** — no frameworks, no build step, no dependencies. Just clean HTML, CSS, and ES6+.

> Designed with a decoupled architecture (a DOM-free logic engine + a thin UI controller) so the maths is fully unit-testable and every edge case lives in one predictable place.

---

##  Screenshots

> _Add your screenshots here. Open `index.html` in a browser, take a screenshot, drop the image in a `screenshots/` folder, and update the paths below._

| Default | With expression |
| :---: | :---: |
| ![Calculator default state](screenshots/default.png) | ![Calculator mid-calculation](screenshots/expression.png) |

<p align="center">
  <img src="screenshots/demo.gif" alt="Calculator demo" width="320" />
</p>

---

##  Features

### Core operations
- ➕ Addition, ➖ Subtraction, ✖️ Multiplication, ➗ Division
-  Percentage (`%`) — context-aware (e.g. `200 + 10%` → `20`)
- ± Positive / negative toggle
-  All Clear (`AC`) and ⌫ backspace delete

### Design & UX
-  **Modern dark mode** — deep-slate surfaces, vibrant orange operators, blue equals key
-  **Fully responsive** — works flawlessly on mobile, tablet, and desktop
-  **Dual-line display** — muted expression history on top, bold live result below
-  **Micro-interactions** — hover transitions, tactile press states, and a Material-style ripple
-  Clean **Inter** typography
-  Accessible — `aria-live` display, `aria-label`s, and honours `prefers-reduced-motion`

###  Full keyboard support
| Key | Action |
| --- | --- |
| `0`–`9` | Enter digits |
| `+` `-` `*` `/` | Operators |
| `.` | Decimal point |
| `Enter` or `=` | Equals |
| `Backspace` | Delete last digit |
| `Esc` | Clear |
| `%` | Percentage |

---

##  Edge cases handled (bug-free by design)

This calculator explicitly prevents the classic calculator bugs:

- **Divide by zero** → shows a clean `Error` instead of `Infinity`, and recovers on the next input.
- **Floating-point precision** → `0.1 + 0.2` correctly shows `0.3`, not `0.30000000000000004` (rounded to 12 significant digits).
- **Multiple decimals** → typing `5.5.5` is blocked, staying `5.5`.
- **Consecutive operators** → `5 + × 3` cleanly overrides to `5 × 3` instead of breaking.
- **Display overflow** → the font auto-shrinks as the number grows, and extreme magnitudes fall back to scientific notation so the UI never breaks.
- **Chained operations** → `10 − 3 − 2` evaluates left-to-right to `5`, like a real calculator.
- **Readability** → large numbers get thousands separators (`1,234,567`).

---

##  Architecture

The codebase is split into two clear concerns:

```
Calculator      →  Pure state machine. Zero DOM references.
                   All arithmetic + edge-case logic lives here.
                   (This is why it's fully unit-testable.)

CalculatorUI    →  Thin controller. Wires click + keyboard events
                   to the engine and renders state to the display.
```

This decoupling is the single most important design decision: the maths never touches the DOM, so bugs are easy to isolate and the engine could be reused in any environment (Node, tests, another UI).

---

##  Getting started

No build tools required. Just open the file:

```bash
# Option 1: open directly
open index.html          # macOS
# or double-click index.html

# Option 2: serve locally (recommended)
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

##  Project structure

```
calculator/
├── index.html    # Semantic HTML5 structure
├── style.css     # Dark-mode theme via CSS variables
├── script.js     # Calculator engine + UI controller (ES6+)
└── README.md
```

---

##  Tech stack

- **HTML5** — semantic markup, `data-*`-driven buttons
- **CSS3** — custom properties for theming, CSS grid, `clamp()` for fluid sizing
- **JavaScript (ES6+)** — classes, private methods, no external dependencies

---

##  License

Released under the [MIT License](LICENSE) — free to use, modify, and learn from.
