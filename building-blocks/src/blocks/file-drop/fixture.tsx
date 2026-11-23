"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { PlaygroundDef } from "../../lab/types";
import { FileDrop } from "./file-drop";

export function Fixture() {
  return (
    <div data-demo="drop" style={{ maxWidth: "28rem" }}>
      <FileDrop label="Project documents" hint="PDF or PNG, up to 5 MB each, at most 3 files." accept={["application/pdf", ".png"]} maxSize={5 * 1024 * 1024} maxFiles={3} />
    </div>
  );
}

export const playground: PlaygroundDef = {
  controls: [
    { name: "maxFiles", label: { en: "Max files", nl: "Max bestanden" }, kind: "select", options: ["1", "3", "10"], default: "3" },
    { name: "images", label: { en: "Images only", nl: "Alleen afbeeldingen" }, kind: "boolean", default: false },
  ],
  render: (v) => <FileDrop label="Playground upload" hint="Try a file that does not fit." maxFiles={Number(v.maxFiles)} accept={v.images ? ["image/*"] : undefined} />,
  code: (v) => `<FileDrop\n  label="Documents"\n  maxFiles={${v.maxFiles}}${v.images ? '\n  accept={["image/*"]}' : ""}\n  onFilesChange={setFiles}\n/>`,
};
