/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Invented examples; the tables describe no real system. */
export type Example = { id: string; sql: string; wrap: boolean; rows: Record<string, number> };

export const EXAMPLES: Example[] = [
  {
    id: "outage",
    wrap: true,
    rows: { orders: 4_000_000 },
    sql: `-- A status for the new checkout. Looks harmless: a constant default is instant since Postgres 11.
ALTER TABLE orders ADD COLUMN status text NOT NULL DEFAULT 'new';
CREATE INDEX orders_status_idx ON orders (status);
`,
  },
  {
    id: "fk",
    wrap: true,
    rows: { invoices: 6_000_000, customers: 400_000 },
    sql: `ALTER TABLE invoices
  ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE invoices ALTER COLUMN customer_id SET NOT NULL;
`,
  },
  {
    id: "backfill",
    wrap: true,
    rows: { events: 3_000_000 },
    sql: `-- Public ids for events, unique.
ALTER TABLE events ADD COLUMN public_id uuid DEFAULT gen_random_uuid();
ALTER TABLE events ADD CONSTRAINT events_public_id_key UNIQUE (public_id);
`,
  },
  {
    id: "careful",
    wrap: false,
    rows: { orders: 4_000_000 },
    sql: `SET lock_timeout = '2s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_customer_idx ON orders (customer_id);
ALTER TABLE orders ADD CONSTRAINT orders_total_positive CHECK (total >= 0) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT orders_total_positive;
`,
  },
];
