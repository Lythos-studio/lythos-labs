"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { announce } from "../../core/announcer";

export type ToastTone = "info" | "success" | "warning" | "danger";
export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before it goes away; 0 keeps it until dismissed. Defaults: 5 s, and for danger or a toast with an action it stays 8 s or until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type Item = ToastOptions & { id: number };
type Api = { toast: (options: ToastOptions) => number; dismiss: (id: number) => void };
const Context = createContext<Api | null>(null);

export function useToast(): Api {
  const api = useContext(Context);
  if (!api) throw new Error("useToast needs a ToastProvider above it");
  return api;
}

let counter = 0;

/**
 * Notifications that do not steal focus. Each one is announced through a live region that already exists (reliable for screen readers),
 * pauses while the pointer is over it or focus is inside it, and never disappears while you are reading it.
 */
export function ToastProvider({ children, label = "Notifications", dismissLabel = "Dismiss", max = 4 }: { children: ReactNode; label?: string; dismissLabel?: string; max?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback((options: ToastOptions) => {
    const id = ++counter;
    setItems((all) => [...all, { ...options, id }].slice(-max));
    announce(options.description ? `${options.title}. ${options.description}` : options.title, options.tone === "danger" || options.tone === "warning" ? "assertive" : "polite");
    return id;
  }, [max]);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <Context.Provider value={api}>
      {children}
      <section className="lb-toasts" aria-label={label} data-lb-toasts="">
        <ol className="lb-toasts__list">
          {items.map((item) => (
            <ToastView key={item.id} item={item} dismissLabel={dismissLabel} onDismiss={() => dismiss(item.id)} />
          ))}
        </ol>
      </section>
    </Context.Provider>
  );
}

function ToastView({ item, dismissLabel, onDismiss }: { item: Item; dismissLabel: string; onDismiss: () => void }) {
  const tone = item.tone ?? "info";
  const duration = item.duration ?? (item.action ? 0 : tone === "danger" || tone === "warning" ? 8000 : 5000);
  const [paused, setPaused] = useState(false);
  const left = useRef(duration);
  const started = useRef(0);

  useEffect(() => {
    if (duration === 0 || paused) return;
    started.current = Date.now();
    const timer = setTimeout(onDismiss, left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(0, left.current - (Date.now() - started.current));
    };
  }, [paused, duration, onDismiss]);

  return (
    <li
      className="lb-toast"
      data-lb-toast=""
      data-lb-tone={tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="lb-toast__text">
        <strong className="lb-toast__title">{item.title}</strong>
        {item.description ? <span className="lb-toast__description">{item.description}</span> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          className="lb-toast__action"
          onClick={() => {
            item.action?.onClick();
            onDismiss();
          }}
        >
          {item.action.label}
        </button>
      ) : null}
      <button type="button" className="lb-toast__dismiss" aria-label={dismissLabel} onClick={onDismiss}>
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}
