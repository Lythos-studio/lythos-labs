"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { PlaygroundDef } from "../../lab/types";
import { Button } from "../button/button";
import { TextField } from "../field/field";
import { ErrorSummary, validate, type FormError } from "./form-kit";

const rules = {
  name: { required: "Enter a name" },
  email: {
    required: "Enter an email address",
    pattern: [/^\S+@\S+\.\S+$/, "Enter an email address like name@example.com"] as [RegExp, string],
    custom: (v: string) => (v.endsWith(".invalid") ? "That email domain is not accepted" : undefined),
  },
};

export function Fixture() {
  const [errors, setErrors] = useState<FormError[]>([]);
  const [result, setResult] = useState("not sent");
  const err = (field: string) => errors.find((e) => e.field === field)?.message;
  return (
    <form
      noValidate
      data-demo="form"
      className="lb-demo-stack"
      style={{ maxWidth: "26rem" }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const found = validate({ name: String(data.get("name") ?? ""), email: String(data.get("email") ?? "") }, rules);
        setErrors(found);
        setResult(found.length ? "not sent" : "Sent");
      }}
    >
      <ErrorSummary errors={errors} fieldIds={{ name: "form-name", email: "form-email" }} />
      <TextField id="form-name" name="name" label="Name" error={err("name")} />
      <TextField id="form-email" name="email" label="Email" error={err("email")} />
      <Button id="form-submit" type="submit">
        Send
      </Button>
      <p>
        Result: <output id="form-result">{result}</output>
      </p>
    </form>
  );
}

export const playground: PlaygroundDef = {
  controls: [{ name: "count", label: { en: "Problems", nl: "Problemen" }, kind: "select", options: ["1", "2", "3"], default: "2" }],
  render: (v) => (
    <ErrorSummary
      title={(n) => `There ${n === 1 ? "is" : "are"} ${n} problem${n === 1 ? "" : "s"}`}
      errors={[{ field: "a", message: "Enter a name" }, { field: "b", message: "Enter an email address" }, { field: "c", message: "Choose a country" }].slice(0, Number(v.count))}
    />
  ),
  code: () => `const errors = validate(values, rules);\n\n<ErrorSummary errors={errors} fieldIds={{ email: "email" }} />`,
};
