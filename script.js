/* =========================================================================
   Calculator — Logic (Vanilla ES6+)

   Architecture
   ------------
   The app is split into two concerns:
     1. `Calculator`   — a pure state machine. It knows nothing about the DOM;
                         it only manipulates its own state and exposes methods
                         (inputDigit, chooseOperator, equals, …). This makes
                         the maths logic easy to reason about and unit-testable.
     2. `CalculatorUI` — the "controller". It wires DOM events (clicks +
                         keyboard) to the Calculator and renders state back
                         into the display.

   Keeping the engine free of DOM code is the single most valuable pattern
   here: every edge case below is handled in one predictable place.
   ========================================================================= */

"use strict";

/* -------------------------------------------------------------------------
   Small helpers
   ---------------------------------------------------------------------- */

// Map of the display operator symbols to the actual maths they perform.
// Using functions keeps the compute step tiny and avoids a switch soup.
const OPERATIONS = {
  "+": (a, b) => a + b,
  "−": (a, b) => a - b,
  "×": (a, b) => a * b,
  "÷": (a, b) => (b === 0 ? null : a / b), // null === divide-by-zero signal
};

/**
 * Fixes JavaScript floating-point noise (e.g. 0.1 + 0.2 -> 0.30000000000000004).
 *
 * Strategy: round the result to 12 significant digits, which is well within
 * the ~15–17 digits of double precision, then strip the trailing zeros that
 * toPrecision leaves behind. This turns 0.30000000000000004 into "0.3" while
 * leaving legitimately long results (like 1/3) sensibly rounded.
 */
function roundFloat(num) {
  if (!Number.isFinite(num)) return num;
  // parseFloat removes trailing zeros: (0.3).toPrecision(12) -> "0.300000000000"
  return parseFloat(num.toPrecision(12));
}

/* -------------------------------------------------------------------------
   The engine
   ---------------------------------------------------------------------- */

class Calculator {
  constructor() {
    this.reset();
  }

  /** Full reset (AC). */
  reset() {
    this.current = "0";      // the string the user is currently typing
    this.previous = null;    // the stored left-hand operand (number) or null
    this.operator = null;    // the armed operator symbol or null
    this.overwrite = false;  // if true, next digit replaces `current`
    this.error = false;      // true when in an error state (e.g. ÷0)
  }

  /* --- Queries --------------------------------------------------------- */

  /** The big bottom-line value. */
  getResult() {
    return this.error ? "Error" : this.current;
  }

  /** The muted top-line expression, e.g. "25 × 4 +". */
  getExpression() {
    if (this.error) return "";
    if (this.previous === null || this.operator === null) return "";
    return `${formatNumber(this.previous)} ${this.operator}`;
  }

  /** Which operator (if any) is currently armed — used to highlight the key. */
  getActiveOperator() {
    // Only highlight while we're waiting for the right-hand operand.
    return this.overwrite && this.operator ? this.operator : null;
  }

  /* --- Commands -------------------------------------------------------- */

  /**
   * Type a digit 0–9.
   * Edge cases handled:
   *  - leading-zero collapse ("0" + "5" -> "5", not "05")
   *  - overwrite mode after an operator / equals
   *  - a hard length cap so the number can never grow without bound
   */
  inputDigit(digit) {
    if (this.error) this.reset();

    if (this.overwrite) {
      this.current = digit;
      this.overwrite = false;
      return;
    }

    // Length guard (ignore the sign / decimal point when counting digits).
    const digitCount = this.current.replace(/[-.]/g, "").length;
    if (digitCount >= 15) return;

    this.current = this.current === "0" ? digit : this.current + digit;
  }

  /**
   * Type a decimal point.
   * Edge case: prevents a second "." in the same number (no "5.5.5").
   */
  inputDecimal() {
    if (this.error) this.reset();

    if (this.overwrite) {
      // Starting a fresh number with a leading decimal -> "0."
      this.current = "0.";
      this.overwrite = false;
      return;
    }
    if (!this.current.includes(".")) {
      this.current += ".";
    }
  }

  /**
   * Arm an operator (+ − × ÷).
   * Edge cases handled:
   *  - Consecutive operators: if the user is still "armed" (hasn't typed the
   *    next number yet), we simply swap the operator — "5 + ×" becomes "5 ×".
   *  - Chained operations: "2 + 3 +" auto-evaluates the pending "2 + 3" first,
   *    so the running total behaves like a real calculator.
   */
  chooseOperator(nextOperator) {
    if (this.error) return;

    // Case 1: operator pressed right after another operator -> just override.
    if (this.overwrite && this.previous !== null) {
      this.operator = nextOperator;
      return;
    }

    // Case 2: there is already a pending operation -> evaluate it (chaining).
    if (this.previous !== null && this.operator !== null) {
      const result = this.#compute();
      if (result === null) return; // computation failed (÷0) -> stay in error
      this.previous = result;
      this.current = formatNumber(result);
    } else {
      // Case 3: first operator press -> promote current to the left operand.
      this.previous = parseFloat(this.current);
    }

    this.operator = nextOperator;
    this.overwrite = true; // next digit starts the right-hand operand
  }

  /**
   * Evaluate the pending expression (the "=" key).
   * After equals we keep the result in `current` and clear the pending op,
   * so the user can immediately continue operating on the answer.
   */
  equals() {
    if (this.error) return;
    if (this.previous === null || this.operator === null) return;

    const result = this.#compute();
    if (result === null) return; // divide-by-zero already set the error state

    this.current = formatNumber(result);
    this.previous = null;
    this.operator = null;
    this.overwrite = true;
  }

  /**
   * Percentage.
   * Behaviour matches common calculators:
   *  - With a pending op (e.g. "200 + 10%"), the % is taken *of the left
   *    operand*: 10% of 200 = 20  ->  200 + 20.
   *  - Standalone (e.g. "50 %"), it just divides by 100 -> 0.5.
   */
  percent() {
    if (this.error) return;
    const value = parseFloat(this.current);

    if (this.previous !== null && this.operator !== null) {
      this.current = formatNumber(roundFloat((this.previous * value) / 100));
    } else {
      this.current = formatNumber(roundFloat(value / 100));
    }
    this.overwrite = false;
  }

  /** Toggle +/- on the current value. */
  negate() {
    if (this.error) return;
    if (this.current === "0") return;
    this.current = this.current.startsWith("-")
      ? this.current.slice(1)
      : "-" + this.current;
  }

  /** Backspace — delete the last character of the current value. */
  delete() {
    if (this.error) {
      this.reset();
      return;
    }
    if (this.overwrite) return; // nothing "typed" yet to delete

    if (
      this.current.length <= 1 ||
      (this.current.length === 2 && this.current.startsWith("-"))
    ) {
      this.current = "0";
    } else {
      this.current = this.current.slice(0, -1);
    }
  }

  /* --- Private --------------------------------------------------------- */

  /**
   * Run the armed operation on (previous, current).
   * Returns the numeric result, or null if the operation is invalid
   * (currently only divide-by-zero), in which case it sets the error state.
   */
  #compute() {
    const a = this.previous;
    const b = parseFloat(this.current);
    const op = OPERATIONS[this.operator];
    if (!op) return null;

    const raw = op(a, b);

    // Divide-by-zero (or any non-finite result) -> clean error, no "Infinity".
    if (raw === null || !Number.isFinite(raw)) {
      this.#setError();
      return null;
    }
    return roundFloat(raw);
  }

  #setError() {
    this.reset();
    this.error = true;
  }
}

/* -------------------------------------------------------------------------
   Number formatting (display-side)
   ---------------------------------------------------------------------- */

/**
 * Turn a number into a clean display string:
 *  - adds thousands separators for readability (1234567 -> "1,234,567")
 *  - falls back to exponential notation for extreme magnitudes so the value
 *    never becomes an unreadable 20-character integer
 */
function formatNumber(value) {
  if (typeof value === "string") value = parseFloat(value);
  if (!Number.isFinite(value)) return "Error";

  const abs = Math.abs(value);

  // Very large / very small magnitudes -> scientific notation.
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }

  // Split so we only group the integer part, preserving decimals as typed.
  const [intPart, decPart] = String(value).split(".");
  const groupedInt = Number(intPart).toLocaleString("en-US");
  return decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
}

/* -------------------------------------------------------------------------
   The controller (DOM glue)
   ---------------------------------------------------------------------- */

class CalculatorUI {
  constructor(root) {
    this.calc = new Calculator();

    this.resultEl = root.querySelector("[data-result]");
    this.expressionEl = root.querySelector("[data-expression]");
    this.keysEl = root.querySelector(".keys");

    this.#bindEvents();
    this.render();
  }

  #bindEvents() {
    // Single delegated listener for every key (efficient + tidy).
    this.keysEl.addEventListener("click", (e) => {
      const button = e.target.closest("button.key");
      if (!button) return;
      this.#spawnRipple(button, e);
      this.#handleAction(button.dataset);
    });

    // Physical keyboard support.
    document.addEventListener("keydown", (e) => this.#handleKeyboard(e));
  }

  /** Route a button's data-* attributes to the engine. */
  #handleAction({ action, digit, operator }) {
    switch (action) {
      case "digit":    this.calc.inputDigit(digit); break;
      case "decimal":  this.calc.inputDecimal(); break;
      case "operator": this.calc.chooseOperator(operator); break;
      case "equals":   this.calc.equals(); break;
      case "clear":    this.calc.reset(); break;
      case "negate":   this.calc.negate(); break;
      case "percent":  this.calc.percent(); break;
      case "delete":   this.calc.delete(); break;
      default: return;
    }
    this.render();
  }

  /** Translate a keyboard event into an engine action. */
  #handleKeyboard(e) {
    const { key } = e;
    let handled = true;

    if (key >= "0" && key <= "9") {
      this.calc.inputDigit(key);
    } else if (key === ".") {
      this.calc.inputDecimal();
    } else if (key === "+" || key === "-") {
      this.calc.chooseOperator(key === "+" ? "+" : "−");
    } else if (key === "*" || key === "x" || key === "X") {
      this.calc.chooseOperator("×");
    } else if (key === "/") {
      e.preventDefault(); // stop Firefox quick-find
      this.calc.chooseOperator("÷");
    } else if (key === "Enter" || key === "=") {
      e.preventDefault(); // stop re-triggering the last focused button
      this.calc.equals();
    } else if (key === "Backspace") {
      this.calc.delete();
    } else if (key === "Escape") {
      this.calc.reset();
    } else if (key === "%") {
      this.calc.percent();
    } else {
      handled = false;
    }

    if (handled) {
      this.render();
      this.#flashKey(key);
    }
  }

  /** Render current engine state into the display. */
  render() {
    const result = this.calc.getResult();
    this.resultEl.textContent = result;
    this.expressionEl.textContent = this.calc.getExpression();

    // Error styling.
    this.resultEl.classList.toggle("is-error", this.calc.error);

    // Highlight the armed operator key.
    const active = this.calc.getActiveOperator();
    this.keysEl.querySelectorAll(".key--op").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.operator === active);
    });

    this.#fitResult(result);
  }

  /**
   * Display-overflow guard: shrink the font as the string grows so the
   * number always fits inside the panel instead of clipping or wrapping.
   */
  #fitResult(text) {
    const len = text.length;
    let size = 3.6; // rem, matches the CSS base
    if (len > 6)  size = 3.0;
    if (len > 9)  size = 2.4;
    if (len > 12) size = 2.0;
    if (len > 15) size = 1.6;
    if (len > 18) size = 1.3;
    this.resultEl.style.setProperty("--result-size", `${size}rem`);
  }

  /* --- Micro-interactions --------------------------------------------- */

  /** Material-style ripple originating from the pointer position. */
  #spawnRipple(button, event) {
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    const rect = button.getBoundingClientRect();

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.className = "ripple";

    button.appendChild(circle);
    circle.addEventListener("animationend", () => circle.remove());
  }

  /** Briefly show a press state on the matching key for keyboard input. */
  #flashKey(key) {
    let selector;
    if (key >= "0" && key <= "9") selector = `[data-digit="${key}"]`;
    else if (key === ".") selector = `[data-action="decimal"]`;
    else if (key === "Enter" || key === "=") selector = `[data-action="equals"]`;
    else if (key === "Backspace") selector = `[data-action="delete"]`;
    else if (key === "Escape") selector = `[data-action="clear"]`;
    else if (key === "%") selector = `[data-action="percent"]`;
    else if (key === "+") selector = `[data-operator="+"]`;
    else if (key === "-") selector = `[data-operator="−"]`;
    else if (key === "*" || key === "x" || key === "X") selector = `[data-operator="×"]`;
    else if (key === "/") selector = `[data-operator="÷"]`;
    if (!selector) return;

    const btn = this.keysEl.querySelector(selector);
    if (!btn) return;
    btn.style.transform = "scale(0.94)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 100);
  }
}

/* -------------------------------------------------------------------------
   Bootstrap
   ---------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector(".calculator");
  if (root) new CalculatorUI(root);
});
