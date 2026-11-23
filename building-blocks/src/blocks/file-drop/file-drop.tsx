"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useId, useRef, useState, type DragEvent } from "react";
import { announce } from "../../core/announcer";

export type FileRules = {
  /** Allowed types: MIME types ("image/png"), wildcards ("image/*") or extensions (".pdf"). */
  accept?: string[];
  /** Largest file size in bytes. */
  maxSize?: number;
  maxFiles?: number;
};

export type FileProblem = { name: string; reason: "type" | "size" | "count" };

type FileLike = { name: string; size: number; type: string };

const extOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "");

/** Pure validation, usable on the server too: which files are acceptable and which are not, and why. */
export function validateFiles<T extends FileLike>(files: T[], rules: FileRules): { accepted: T[]; rejected: FileProblem[] } {
  const accepted: T[] = [];
  const rejected: FileProblem[] = [];
  for (const file of files) {
    const typeOk =
      !rules.accept?.length ||
      rules.accept.some((a) => (a.startsWith(".") ? extOf(file.name) === a.toLowerCase() : a.endsWith("/*") ? file.type.startsWith(a.slice(0, -1)) : file.type === a));
    if (!typeOk) rejected.push({ name: file.name, reason: "type" });
    else if (rules.maxSize !== undefined && file.size > rules.maxSize) rejected.push({ name: file.name, reason: "size" });
    else if (rules.maxFiles !== undefined && accepted.length >= rules.maxFiles) rejected.push({ name: file.name, reason: "count" });
    else accepted.push(file);
  }
  return { accepted, rejected };
}

export type FileDropProps = FileRules & {
  label: string;
  hint?: string;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  /** Words for each rejection reason and the buttons. Translate these. */
  messages?: { type: string; size: string; count: string; remove: string; dropHere: string; chooseFiles: string };
  id?: string;
  className?: string;
};

const defaultMessages = { type: "is not an allowed type", size: "is too large", count: "was not added: too many files", remove: "Remove", dropHere: "Drop files here or", chooseFiles: "choose files" };

const sizeText = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} kB` : `${n} B`);

/**
 * A file input you can also drop on. The real <input type="file"> is always there, so the keyboard and screen readers
 * work the same as for any file field; dragging is an extra. Problems are written out, not just coloured.
 */
export function FileDrop({ label, hint, files: controlled, onFilesChange, accept, maxSize, maxFiles, messages = defaultMessages, id: idProp, className }: FileDropProps) {
  const auto = useId();
  const id = idProp ?? `${auto}-file`;
  const [inner, setInner] = useState<File[]>([]);
  const files = controlled ?? inner;
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function add(list: File[]) {
    const { accepted, rejected } = validateFiles(list, { accept, maxSize, maxFiles: maxFiles !== undefined ? Math.max(0, maxFiles - files.length) : undefined });
    const next = [...files, ...accepted];
    setInner(next);
    onFilesChange?.(next);
    setProblems(rejected);
    if (rejected.length) announce(rejected.map((p) => `${p.name} ${messages[p.reason]}`).join(". "));
    if (input.current) input.current.value = "";
  }

  function remove(index: number) {
    const next = files.filter((_, i) => i !== index);
    setInner(next);
    onFilesChange?.(next);
    setProblems([]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    add(Array.from(event.dataTransfer.files));
  }

  return (
    <div className={className ? `lb-filedrop ${className}` : "lb-filedrop"}>
      <div
        className="lb-filedrop__zone"
        data-over={over || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className="lb-filedrop__label">{label}</span>
        <span className="lb-filedrop__prompt">
          {messages.dropHere}{" "}
          <label htmlFor={id} className="lb-filedrop__choose">
            {messages.chooseFiles}
          </label>
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          multiple={maxFiles !== 1}
          accept={accept?.join(",")}
          className="lb-filedrop__input"
          aria-describedby={`${id}-hint`}
          onChange={(event) => add(Array.from(event.target.files ?? []))}
        />
      </div>
      <p id={`${id}-hint`} className="lb-filedrop__hint">
        {hint}
      </p>
      {problems.length ? (
        <ul className="lb-filedrop__problems" role="alert">
          {problems.map((p) => (
            <li key={p.name}>{`${p.name} ${messages[p.reason]}`}</li>
          ))}
        </ul>
      ) : null}
      {files.length ? (
        <ul className="lb-filedrop__files" aria-label={label}>
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="lb-filedrop__file">
              <span>
                {file.name} <span className="lb-filedrop__size">({sizeText(file.size)})</span>
              </span>
              <button type="button" className="lb-filedrop__remove" onClick={() => remove(i)} aria-label={`${messages.remove} ${file.name}`}>
                {messages.remove}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
