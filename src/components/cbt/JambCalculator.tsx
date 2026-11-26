import { useState } from 'react';
import { Calculator, Delete, X } from 'lucide-react';

interface JambCalculatorProps {
  open: boolean;
  onClose: () => void;
}

type Operator = '+' | '-' | '×' | '÷' | null;

function formatCalcResult(num: number): string {
  if (!Number.isFinite(num)) return 'Error';
  const rounded = Number(num.toPrecision(12));
  const text = String(rounded);
  return text.length > 14 ? rounded.toExponential(6) : text;
}

/**
 * Simulates the basic non-scientific 4-function calculator available on the JAMB UTME CBT screen.
 */
export function JambCalculator({ open, onClose }: JambCalculatorProps) {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  if (!open) return null;

  function compute(left: number, right: number, op: Exclude<Operator, null>): number {
    switch (op) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '×':
        return left * right;
      case '÷':
        return right === 0 ? Number.NaN : left / right;
    }
  }

  function inputDigit(digit: string) {
    if (display === 'Error') {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }
    setDisplay(display === '0' ? digit : display.length < 14 ? `${display}${digit}` : display);
  }

  function inputDecimal() {
    if (display === 'Error' || waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(`${display}.`);
    }
  }

  function handleOperator(nextOp: Exclude<Operator, null>) {
    const current = Number.parseFloat(display);
    if (!Number.isFinite(current)) {
      setDisplay('Error');
      return;
    }
    if (storedValue === null) {
      setStoredValue(current);
    } else if (operator && !waitingForOperand) {
      const nextValue = compute(storedValue, current, operator);
      setStoredValue(Number.isFinite(nextValue) ? nextValue : null);
      setDisplay(formatCalcResult(nextValue));
    }
    setOperator(nextOp);
    setWaitingForOperand(true);
  }

  function handleEquals() {
    if (operator === null || storedValue === null) return;
    const current = Number.parseFloat(display);
    const result = compute(storedValue, current, operator);
    setDisplay(formatCalcResult(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }

  function handleClearAll() {
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }

  function handleClearEntry() {
    setDisplay('0');
    setWaitingForOperand(false);
  }

  function handleBackspace() {
    if (waitingForOperand || display === 'Error') {
      setDisplay('0');
      setWaitingForOperand(false);
      return;
    }
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  }

  function handleSquareRoot() {
    const current = Number.parseFloat(display);
    if (!Number.isFinite(current) || current < 0) {
      setDisplay('Error');
    } else {
      setDisplay(formatCalcResult(Math.sqrt(current)));
    }
    setWaitingForOperand(true);
  }

  function handlePercent() {
    const current = Number.parseFloat(display);
    if (!Number.isFinite(current)) {
      setDisplay('Error');
      return;
    }
    const result = storedValue !== null ? (storedValue * current) / 100 : current / 100;
    setDisplay(formatCalcResult(result));
    setWaitingForOperand(true);
  }

  function handleToggleSign() {
    if (display === '0' || display === 'Error') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`);
  }

  const keyBtn =
    'min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer tabular-nums';
  const opBtn =
    'min-h-[44px] rounded-lg border border-phosters-200 dark:border-phosters-800 bg-phosters-50 dark:bg-phosters-900/40 text-sm font-bold text-phosters-700 dark:text-phosters-300 hover:bg-phosters-100 dark:hover:bg-phosters-900/70 active:scale-[0.98] transition-all cursor-pointer';

  return (
    <div
      role="dialog"
      aria-label="JAMB Basic Calculator"
      className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-40 w-[290px] sm:w-[310px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <Calculator className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
          <span>JAMB Basic Calculator</span>
        </div>
        <button
          type="button"
          aria-label="Close calculator"
          onClick={onClose}
          className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-right space-y-0.5">
        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 h-4 tabular-nums truncate">
          {storedValue !== null && operator ? `${storedValue} ${operator}` : 'Basic 4-function mode'}
        </p>
        <p
          data-testid="jamb-calc-display"
          className="text-2xl font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums truncate"
        >
          {display}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={handleClearAll} className={keyBtn}>
          C
        </button>
        <button type="button" onClick={handleClearEntry} className={keyBtn}>
          CE
        </button>
        <button type="button" onClick={handleBackspace} aria-label="Backspace" className={`${keyBtn} flex items-center justify-center`}>
          <Delete className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => handleOperator('÷')} className={opBtn}>
          ÷
        </button>

        <button type="button" onClick={() => inputDigit('7')} className={keyBtn}>7</button>
        <button type="button" onClick={() => inputDigit('8')} className={keyBtn}>8</button>
        <button type="button" onClick={() => inputDigit('9')} className={keyBtn}>9</button>
        <button type="button" onClick={() => handleOperator('×')} className={opBtn}>×</button>

        <button type="button" onClick={() => inputDigit('4')} className={keyBtn}>4</button>
        <button type="button" onClick={() => inputDigit('5')} className={keyBtn}>5</button>
        <button type="button" onClick={() => inputDigit('6')} className={keyBtn}>6</button>
        <button type="button" onClick={() => handleOperator('-')} className={opBtn}>−</button>

        <button type="button" onClick={() => inputDigit('1')} className={keyBtn}>1</button>
        <button type="button" onClick={() => inputDigit('2')} className={keyBtn}>2</button>
        <button type="button" onClick={() => inputDigit('3')} className={keyBtn}>3</button>
        <button type="button" onClick={() => handleOperator('+')} className={opBtn}>+</button>

        <button type="button" onClick={handleSquareRoot} className={keyBtn}>√</button>
        <button type="button" onClick={() => inputDigit('0')} className={keyBtn}>0</button>
        <button type="button" onClick={inputDecimal} className={keyBtn}>.</button>
        <button
          type="button"
          onClick={handleEquals}
          className="min-h-[44px] rounded-lg bg-phosters-600 hover:bg-phosters-700 text-white text-base font-bold active:scale-[0.98] transition-all cursor-pointer"
        >
          =
        </button>

        <button type="button" onClick={handleToggleSign} className={`${keyBtn} col-span-2 text-xs`}>
          ± Sign
        </button>
        <button type="button" onClick={handlePercent} className={`${keyBtn} col-span-2 text-xs`}>
          % Percent
        </button>
      </div>
    </div>
  );
}
