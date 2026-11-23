"use client";

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { ReactNode } from "react";

/** A self-contained piece of content. The title is a real heading; pick its level so the page outline stays right. */
export function Card({ title, headingLevel = 3, media, footer, children, className }: {
  title: string;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  media?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as "h3";
  return (
    <article className={className ? `lb-card ${className}` : "lb-card"}>
      {media ? <div className="lb-card__media">{media}</div> : null}
      <div className="lb-card__body">
        <Heading className="lb-card__title">{title}</Heading>
        {children ? <div className="lb-card__content">{children}</div> : null}
      </div>
      {footer ? <div className="lb-card__footer">{footer}</div> : null}
    </article>
  );
}

/** What to show when there is nothing yet: say what is missing and what to do about it, with one clear action. */
export function EmptyState({ title, description, action, headingLevel = 3, className }: {
  title: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as "h3";
  return (
    <div className={className ? `lb-empty ${className}` : "lb-empty"}>
      <Heading className="lb-empty__title">{title}</Heading>
      {description ? <p className="lb-empty__text">{description}</p> : null}
      {action ? <div className="lb-empty__action">{action}</div> : null}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** A person or team picture. With a photo it is an image with the name as its text; without one it shows initials and is still named. */
export function Avatar({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  const cls = className ? `lb-avatar ${className}` : "lb-avatar";
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={name} className={cls} style={style} />;
  return (
    <span role="img" aria-label={name} className={cls} style={style}>
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  );
}

/** A row of avatars with a "+N" for the rest. The list says how many people there are. */
export function AvatarGroup({ people, max = 3, label, moreLabel }: { people: { name: string; src?: string }[]; max?: number; label: string; moreLabel?: (n: number) => string }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <ul className="lb-avatars" aria-label={label}>
      {shown.map((p) => (
        <li key={p.name}>
          <Avatar name={p.name} src={p.src} />
        </li>
      ))}
      {rest > 0 ? (
        <li>
          <span className="lb-avatar lb-avatar--more" role="img" aria-label={moreLabel ? moreLabel(rest) : `${rest} more`}>
            <span aria-hidden="true">+{rest}</span>
          </span>
        </li>
      ) : null}
    </ul>
  );
}
