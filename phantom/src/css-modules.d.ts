/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Lets the package type-check on its own; bundlers such as Next.js and Vite supply CSS modules at build time.
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
