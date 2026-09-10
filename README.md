# Solution to automatize any industrial equipment via a Web Application

## General idea:

This is a Vite project for my idea to create an internet based automation control system (Bioversee), which can control a wide variaty of devices (including bioreactors, waterpurifier ect.) wired to a computer and set to handle the commands from the cloud server.
For the system it doesn't matter how old or new the equipment is. It`s designed to be universal.
The customer will need an off-the-self customisable computer (such as a Raspberry Pi) and some electrical knowledge to wire the computer with the. Then the computer will need configuration (I am building a desktop app for that) to be able to communicate with the sensors and actuatros of the machine.
I want Bioversee to become a both a modeling tool for engineers (like AutoCad) and a control system for industrial automation.

## Basics about bioreactors:

A fermenter is a common machine with a few controllers and devices attached to it. Fermenters al also called bioreactors which refers to their purpose. We call a device bioreactor, when inside of them, there is a biologically active environment, in which a chemical process is carried out involving organisms or biochemically active substance. (like enzymes)
The organisms inside of a bioreactor might have special needs. We must provide oxygen; therefore, we use submerged aerators. We need to provide and even distribution in our chamber and for that we mostly use an agitation system. (basically, some kind of rotor in the fluid) There are some examples for fermenters which use the aerator system to create flow inside, but these are used in special scenarios.
Now that we have oxygen provided, organisms can grow and work inside. Every organism has its own thermo and pH optimum where they are the most effective. To maximize their productivity, we need to provide and keep the best conditions for them. To control the pH in the reactor area we can add base or acid to the fluid. Bioreactors commonly use dual layer chambers. Between the layers we can circulate water and with it, we can adjust the temperature in the reaction space.

![Bioreactor](blueprints/basicBioreactor.png)

## System setup theory:

The idea is to have an off-the-self customisable computer (Raspberry Pi 5 is used in the prototypes) wired to a machine and connected to a cloud database. The controll website POST records into the database. The computer uses an event listener in order to detect new records in the database. Once a new record is detected, the software GETs the new state and sets it for the actuator. The method is the same with the sensors except it works to the other way.
I’ve decided to use a database for communication between the web and the local server. This could cause performance difficulties in the future, but right now I want to ensure that all changes on the devices are recorded and stored.
To controll the equipment I used the GPIO pins on my Raspberry Pi.
For the local machine control language I choose Python because of the gpiozero library. The website is a React Vite app written in TypeScript. Auth and data live in **Supabase** (Postgres + Auth).

## Tools:

- Designed on Apple Macbook Air M1 (2020)
- Tested with Raspberry PI 5 8GB
- Package manager: **pnpm**
- Hosting target: **Vercel**
- Backend-as-a-service: **Supabase**

## Local development

```bash
pnpm install
cp client-react-ts/.env.example client-react-ts/.env.development
# set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
pnpm dev
```

1. In Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) once.
2. Enable Email and Google providers under Authentication → Providers.
3. Add `http://localhost:5173` (and your Vercel URL) under Authentication → URL Configuration.

## Deploy on Vercel

1. Import this repo (framework: Other; `vercel.json` is configured for the Vite SPA).
2. Set build env vars: `VITE_PUBLIC_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Add the Vercel URL to Supabase Auth redirect allow-list.

## Prototype 1:

The goal, what the first prototype had to achieve was that it needed to demonstrate how the software works. It was never intended to be used for the fermentation process. I was focusing on using simple actuators and sensors and simple circuits. Prototype 1 needed to be as small as possible, I wanted to make it fit on a shoebox for better transport possibilities. This prototype as it is can be a product as well. It can be used for teaching how bioreactors work. With the web application students can try it on site if there is internet connection.
