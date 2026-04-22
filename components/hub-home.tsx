"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { containerVariants, hoverVariants, itemVariants } from "@/lib/motion-variants";

const architectureSteps = [
  "ABIOT scanner writes column-based raw rows",
  "Next.js converter normalizes row payloads to JSON events",
  "Manager and tablet surfaces fetch /api/events",
  "Guard decisions persist to event_resolutions",
];

const appTiles = [
  {
    eyebrow: "Desktop - Control room",
    title: "Manager Portal",
    copy: "Live feed, exception queue, gate map, reader health, and decision timeline from normalized access events.",
    href: "/manager",
    label: "Manager web",
    cta: "Open portal",
  },
  {
    eyebrow: "Tablet - Guard kiosk",
    title: "Tablet Guard",
    copy: "Review unknown vehicles, issue passes, deny entry, and trigger manual scans while syncing in near realtime.",
    href: "/tablet",
    label: "Guard web",
    cta: "Open tablet",
  },
];

export function HubHome() {
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <div className="hub-body">
      <div className="hub-wrap">
        <motion.header
          className="hub-brand"
          initial="hidden"
          animate="visible"
          variants={containerVariants(reducedMotion, { stagger: 0.06 })}
        >
          <motion.div className="row" variants={itemVariants(reducedMotion, { distance: 14 })}>
            <div className="mark">Se</div>
            <div>
              <div className="wordmark">Seceurope</div>
              <div className="subline">RFID access & perimeter suite</div>
            </div>
          </motion.div>
          <motion.div className="meta" variants={itemVariants(reducedMotion, { distance: 12 })}>
            <span className="device-hint">
              <span className="dot live" /> DB + realtime sync
            </span>
            <span className="device-hint">Web build - 2026.04</span>
          </motion.div>
        </motion.header>

        <motion.section
          className="hub-hero"
          initial="hidden"
          animate="visible"
          variants={containerVariants(reducedMotion, { stagger: 0.08, delayChildren: 0.04 })}
        >
          <motion.div className="hub-hero-copy" variants={itemVariants(reducedMotion, { distance: 20 })}>
            <h1>
              Every car, badge, and approach. <em>Seen before it reaches the gate.</em>
            </h1>
            <p>
              ABIOT writes raw RFID rows to Supabase. This website converts those rows to canonical JSON access events, then keeps manager and
              guard tablet views synchronized over realtime channels.
            </p>
          </motion.div>

          <motion.aside className="hero-side glass-panel-dark" variants={itemVariants(reducedMotion, { distance: 16 })}>
            <div className="eyebrow">Live architecture</div>
            <motion.ul variants={containerVariants(reducedMotion, { stagger: 0.06, delayChildren: 0.08 })}>
              {architectureSteps.map((step, index) => (
                <motion.li
                  key={step}
                  className="hero-step"
                  variants={itemVariants(reducedMotion, { distance: 10 })}
                  whileHover={reducedMotion ? undefined : { x: 4 }}
                  transition={{ duration: 0.16 }}
                >
                  <span className="num">{index + 1}</span>
                  {step}
                </motion.li>
              ))}
            </motion.ul>
          </motion.aside>
        </motion.section>

        <motion.section
          className="hub-apps"
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          initial="hidden"
          animate="visible"
          variants={containerVariants(reducedMotion, { stagger: 0.08, delayChildren: 0.12 })}
        >
          {appTiles.map((tile) => (
            <motion.div
              key={tile.href}
              className="app-tile-shell"
              variants={itemVariants(reducedMotion, { distance: 18 })}
              whileHover={hoverVariants(reducedMotion)}
              whileFocus={hoverVariants(reducedMotion)}
            >
              <Link href={tile.href} className="app-tile motion-tile">
                <div>
                  <div className="eyebrow">{tile.eyebrow}</div>
                  <h3>{tile.title}</h3>
                  <p>{tile.copy}</p>
                </div>
                <div className="row-between">
                  <span className="device-hint">{tile.label}</span>
                  <span className="open-cta">{tile.cta}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.section>
      </div>
    </div>
  );
}
