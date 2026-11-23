"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useState, type CSSProperties } from "react";

export type SliderProps = {
  label: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  /** How a value is spoken and shown, for example (v) => `${v} dB`. Without it the number is used. */
  formatValue?: (value: number) => string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/**
 * A native range input with a visible label and value. The keyboard (arrows, Home, End, Page Up and Down) comes from the browser;
 * aria-valuetext says the value in words, and the value is shown in an <output> so it is visible too.
 */
export function Slider({ label, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, formatValue = String, disabled, id: idProp, className }: SliderProps) {
  const auto = useId();
  const id = idProp ?? `${auto}-slider`;
  const [inner, setInner] = useState(defaultValue ?? min);
  const current = value ?? inner;
  const percent = max === min ? 0 : ((current - min) / (max - min)) * 100;
  return (
    <div className={className ? `lb-slider ${className}` : "lb-slider"}>
      <div className="lb-slider__head">
        <label htmlFor={id} className="lb-slider__label">
          {label}
        </label>
        <output htmlFor={id} className="lb-slider__value">
          {formatValue(current)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="lb-slider__input"
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        aria-valuetext={formatValue(current)}
        style={{ "--lb-slider-fill": `${percent}%` } as CSSProperties}
        onChange={(event) => {
          const next = Number(event.target.value);
          setInner(next);
          onValueChange?.(next);
        }}
      />
    </div>
  );
}
