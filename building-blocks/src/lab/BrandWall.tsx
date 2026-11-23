"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { useState } from "react";
import type { ThemeState } from "../theme/theme-vars";
import { Accordion } from "../blocks/accordion/accordion";
import { Alert, Badge, Progress } from "../blocks/feedback/feedback";
import { Avatar, AvatarGroup, Card } from "../blocks/card/card";
import { Button } from "../blocks/button/button";
import { Checkbox, RadioGroup, Switch } from "../blocks/choice/choice";
import { TextField } from "../blocks/field/field";
import { Menu } from "../blocks/menu/menu";
import { Tabs } from "../blocks/tabs/tabs";
import { ThemedBox } from "./ThemedBox";

/** A wall of real blocks in the visitor's brand. Everything on it works with the keyboard. */
export function BrandWall({ theme }: { theme: ThemeState }) {
  const [plan, setPlan] = useState("team");
  return (
    <ThemedBox theme={theme}>
      <div className="lb-demo-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 19rem), 1fr))" }}>
        <Card title="Welcome back, Sanne" footer={<AvatarGroup label="Team" people={[{ name: "Sanne de Vries" }, { name: "Bram Jansen" }, { name: "Lotte Smit" }, { name: "Daan Bos" }]} />}>
          <div className="lb-demo-row">
            <Badge tone="success">Live</Badge>
            <Badge tone="info">3 new</Badge>
          </div>
          <p>Your project is on track.</p>
          <Progress label="Launch checklist" value={72} />
        </Card>
        <div className="lb-demo-stack" style={{ gap: "var(--lb-space-3)" }}>
          <div className="lb-demo-row">
            <Button variant="primary">Publish</Button>
            <Button>Preview</Button>
            <Button variant="ghost">Cancel</Button>
            <Menu label="More" items={[{ id: "a", label: "Duplicate" }, { id: "b", label: "Archive" }, { id: "c", label: "Delete", danger: true, separatorBefore: true }]} />
          </div>
          <Tabs label="Project sections" items={[{ value: "a", label: "Overview", panel: <p>Everything at a glance.</p> }, { value: "b", label: "Activity", panel: <p>What changed this week.</p> }, { value: "c", label: "Settings", panel: <p>Names, roles and access.</p> }]} />
        </div>
        <div className="lb-demo-stack" style={{ gap: "var(--lb-space-3)" }}>
          <TextField label="Project name" defaultValue="Studio website" hint="Shown to your team." />
          <RadioGroup legend="Plan" name="wall-plan" value={plan} onValueChange={setPlan} options={[{ value: "solo", label: "Solo" }, { value: "team", label: "Team" }]} />
          <Checkbox label="Send weekly summary" defaultChecked />
          <Switch label="Notifications" hint="Takes effect at once." defaultChecked />
        </div>
        <div className="lb-demo-stack" style={{ gap: "var(--lb-space-3)" }}>
          <Alert tone="warning" title="Almost full">You have used 90% of your storage.</Alert>
          <Accordion defaultValue={["a"]} items={[{ value: "a", title: "What is included?", content: <p>Everything you see here.</p> }, { value: "b", title: "Can I change my brand?", content: <p>Yes, above.</p> }]} />
          <div className="lb-demo-row">
            <Avatar name="Bram Jansen" />
            <span>Bram Jansen, designer</span>
          </div>
        </div>
      </div>
    </ThemedBox>
  );
}
