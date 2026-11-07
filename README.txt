normie. website (static, no build step)

Deploy
- Upload the contents of this folder (not the folder itself) to any static host:
  Netlify, Vercel, Cloudflare Pages, GitHub Pages, or your own server.
- Netlify / Cloudflare Pages: drag and drop this folder, or connect a repo with no build command
  and the publish directory set to the folder root.
- Vercel: "Other" framework preset, no build command, output directory = root.
- All links and assets use relative paths, so the site also works from a subfolder.
- Pages must be served over http(s); opening index.html straight from disk will not load the
  JavaScript modules. To preview locally: run  python3 -m http.server 8080  in this folder,
  then open http://localhost:8080

Before launch: edit config.js
- boxPrice:        price of the 12-stick box as a number, e.g. 24
- checkoutUrl:     hosted checkout link (Shopify, Stripe Payment Link, etc.)
                   The "order the box" button opens it in a new tab.
- rewardsGoal:     boxes needed for a free box (currently 5, so the 6th is free)
- rewardsEndpoint: URL that accepts POST {"email": "..."} for rewards sign-ups
                   (your loyalty app or email list). Empty = preview mode, nothing is sent.
- email, waitlistEndpoint, contactEndpoint: contact and waitlist form targets.

Files
- index.html            home: hero with 3D sticks, the box, rewards, film, first-visit rewards popup
- collection/, products/, about/, help/, build-notes/   other pages
- styles.css            all styles
- app.js, components.js, flavors.js, config.js   site logic and content
- studio3d.js           3D drink sticks, card tilt, scroll effects
- order.js              box checkout hand-off and rewards sign-up
- vendor/three.module.js   three.js r160 (MIT, see vendor/three-LICENSE.txt), self-hosted
- assets/               images, video loop, fonts (DM Sans), favicon

Notes
- Product photos, packaging and the 3D sticks are concept artwork.
- Rewards stamps need your checkout and a loyalty service to count orders per email.
