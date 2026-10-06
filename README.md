# Bioversee

**Process visualization that engineers can feel — and control.**

Bioversee turns industrial bioprocess equipment into a living, interactive model: fill a vessel, spin a Rushton impeller, watch bubbles rise through viscous media, and drive actuators from the cloud. Built for labs, classrooms, and plants that need an affordable HMI that actually teaches how the process behaves.

> *See the plant. Then run it.*

---

## Why it exists

Process systems are hard to learn from P&IDs alone, and hard to operate from bare numbers. Cognitive science (multimedia learning), process-safety HMI standards (ANSI/ISA-101), and ecological interface design all point the same way: **good visualization is not decoration — it is how operators and students understand a plant.**

Bioversee turns that research into a product: a playful, research-backed process visualizer for training and education, wired for real industrial control.

---

## The whole solution

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Web app    │     │   Supabase   │     │  Raspberry Pi   │
│  (React)    │◄───►│  Auth + DB   │◄───►│  agent + GPIO   │
│  iOS app    │     │  Realtime    │     │  desktop wizard │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                  │
                                           sensors / actuators
                                                  │
                                           ┌──────▼──────┐
                                           │  Bioreactor │
                                           │  & friends  │
                                           └─────────────┘
```

1. **You** operate from the web or iPhone.
2. **Supabase** stores devices, actuator commands, sensor readings, shares, and auth.
3. A **Raspberry Pi** on the machine listens for changes, drives GPIO, and posts sensor data back.
4. The **canvas** shows what the plant is doing — fill, drain, stir, aerate, dose, jacket — with motion that reacts to the fluid you configured.

Age of the hardware does not matter. If you can wire it to a Pi, Bioversee can talk to it.

---

## What you get

### Living process canvas
- Capsule bioreactor with agitator, sparger, fill/drain, jacket, dosing, and probes
- Hold **Fill** / **Drain** with pipe water, streams, and free-surface waves
- Stirred bubble field that follows the impeller when aeration and RPM are on
- Fluid presets (water, buffer, culture broth, viscous…) — viscosity, density, and surface tension actually change wave damping and bubble motion
- Low-level safety toasts: aerator / rotor / pH & temperature probes auto-warn when tips go dry

### Multi-device family
| Device | What it is for |
|--------|----------------|
| **Bioreactor** | Full stirred-tank HMI + charts |
| **Pressure vessel** | Level, vessel body, process UI |
| **Membrane bioreactor** | Flow / aeration process view |
| **Water purifier** | Pump & slider control canvas |

### Collaboration & accounts
- Per-user devices with roles (viewer → owner)
- Invite links, inbox, multi-account vault
- Live temperature / pH / pressure charts
- Appearance: theme, accent, **English · Deutsch · Magyar**

### Edge & mobile
- **Raspberry Pi** desktop wizard + cloud agent (GPIO via gpiozero)
- Password-gated early-access installer from the About page
- **iOS** companion (devices, inbox, controls, Keychain sessions)

### Landing that stands behind the idea
- Product previews for web, phone, and Pi
- Research section with scholarly citations (Mayer, Vicente & Rasmussen, ISA-101, pedagogical process simulators, PSE education)
- Team + **Donate** CTA via Stripe Payment Link

---

## Stack

| Layer | Choice |
|-------|--------|
| Web | React 18 · TypeScript · Vite · pnpm |
| Charts / UI | Recharts · Lottie · i18next |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Hosting | Vercel |
| Edge box | Raspberry Pi 5 · Python agent |
| Mobile | SwiftUI (iOS) |
| Donate | Stripe Payment Link (`VITE_STRIPE_DONATE_URL`) |

Designed on Apple Silicon · Prototyped on Raspberry Pi 5 8GB.

---

## Quick start (web)

```bash
pnpm install
cp client-react-ts/.env.example client-react-ts/.env.development
# set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
# optional: VITE_PUBLIC_URL, VITE_STRIPE_DONATE_URL
pnpm dev
```

1. In Supabase SQL Editor, follow [`supabase/CUTOVER.md`](supabase/CUTOVER.md) (fresh schema via [`schema.sql`](supabase/schema.sql)).
2. Enable **Email** and **Google** under Authentication → Providers.
3. Allow `http://localhost:5173` (and your Vercel URL) under Auth → URL Configuration.

### Deploy on Vercel

1. Import the repo (framework: Other; `vercel.json` is set up for the SPA).
2. Set `VITE_PUBLIC_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (and optionally `VITE_STRIPE_DONATE_URL`).
3. Add the Vercel URL to the Supabase Auth redirect allow-list.

---

## Raspberry Pi (early access)

The About page **Download** button is password-gated while the Pi path is still baking.

- **Password:** `raspberry`
- Opens `/pi-setup` with the installer for the Pi desktop app

More detail: [`raspberry-pi-app/README.md`](raspberry-pi-app/README.md).

---

## iOS

```bash
cd ios && xcodegen generate && open Bioversee.xcodeproj
```

See [`ios/README.md`](ios/README.md).

---

## How a bioreactor fits the story

A fermenter (bioreactor) keeps a living process going: aeration for oxygen, agitation for mixing, acid/base for pH, and a jacket for temperature. Dual-wall vessels circulate warm or cold water between layers to hold the thermo optimum.

Bioversee models that loop so students can *see* it — and so operators can drive the same mental model on real I/O.

![Bioreactor](blueprints/basicBioreactor.png)

---

## Prototype 1

The first hardware prototype was never meant for full fermentation runs. It had to be **shoebox-small**, transportable, and obvious: simple sensors, simple actuators, clear circuits. That box is still a product in its own right — a teaching bioreactor you can drive from the web wherever there is connectivity.

---

## Docs & blueprints

- [`documentation/softwareSystem.md`](documentation/softwareSystem.md) — software architecture
- [`documentation/hardwareSystem.md`](documentation/hardwareSystem.md) — hardware path
- [`blueprints/`](blueprints/) — system and prototype drawings
- [`supabase/`](supabase/) — schema, storage, Edge Functions

---

## Support the project

If Bioversee helps your lab, classroom, or plant training, you can donate any amount from the About page (Stripe Checkout). Every contribution goes toward hosting, development, and keeping process visualization accessible.

---

**Bioversee** — built by an engineer, for engineers who want the process to make sense before it goes wrong.
