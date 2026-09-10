# Software aspect of the project

## General:

The main idea behind the project comes from the fact that many bioreactors in laboratory environment are in a lack the ability to be controlled remotely via internet. To solve this problem, there are many easy accessible off-the-shelf devices which can be the foundation of upgrading aged machinery. With these, it`s relatively easy to hook up the sensors and actuators from an existing bioreactor and control them. Nowadays software developers focus on building web applications rather than desktop apps, so I decided I would like to do the same with my idea. This new system will be capable of controlling any bioreactor with a web-based, modern-looking and easy to use controller and it offers a cheap solution for bioreactor renovation.

## Controller website:

The controller website is a **React + TypeScript (Vite)** SPA. Auth and data live in **Supabase** (Postgres + Auth). The browser talks to Supabase directly with the publishable key; there is no separate Express API server. Hosting target is **Vercel** (static SPA).

### Presentation tier:

In the presentation tier I am developing a simple and easy to use design with sliders and buttons to control the actuators for the reactor. Here I also must present near live data from the sensors. Supabase Auth (email + Google) gates access to the control pages.

### Application tier:

Actuator and sensor I/O runs in the Vite app via the Supabase JS client. Slider/switch changes insert rows into `actuator_sliders` / `actuator_switches`. Charts read from the `sensors` table. Row Level Security enforces who can read and write.

### Data tier:

Postgres on Supabase stores profiles, actuator history, and sensor readings. Tables are defined in [`supabase/schema.sql`](../supabase/schema.sql). There are two actuator tables (ON/OFF switches and adjustable sliders) for clearer queries, plus a sensors table for thermo / pH (and similar) feeds.

## Bioreactor controller:

I use python codes to control the actuators. I did experiments using JavaScript for this purpose, but python turned out way more simple for this job. With a Supabase/Postgres client and using a Raspberry Pi as a platform for reactor control I managed to write each code for the actuators and sensors within 100 lines.

## Logical blueprint for the software setup:

![Blueprint for hardware logical design](../blueprints/softwareDesign.png)
