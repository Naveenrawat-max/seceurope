"use client";

import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import {
  containerVariants,
  itemVariants,
  kineticLetterVariants,
  magneticTileVariants,
  motionTransitions,
} from "@/lib/motion-variants";

const heroLines = [
  { text: "Every car,", italic: false },
  { text: "every badge,", italic: false },
  { text: "every approach.", italic: false },
];

const heroAccentLine = "Seen before the gate.";

const marqueeWords = [
  "RFID",
  "Real-time",
  "ABIOT",
  "Perimeter",
  "Tablet",
  "Manager",
  "Sub-second",
  "Realtime",
  "Supabase",
  "Chainway",
];

const heroStats = [
  { label: "Sync latency", value: "< 250ms" },
  { label: "Reader fleet", value: "C72 + FM830" },
  { label: "Surfaces", value: "Manager · Tablet" },
];

const appTiles = [
  {
    eyebrow: "Desktop · Control room",
    title: "Manager Portal",
    copy: "Live feed, exception queue, gate map, reader health, and decision timeline streamed from normalized RFID events.",
    href: "/manager",
    label: "Manager web",
    cta: "Open portal",
  },
  {
    eyebrow: "Tablet · Guard kiosk",
    title: "Tablet Guard",
    copy: "Review unknown vehicles, issue passes, deny entry, trigger manual scans — synchronized with the manager in near realtime.",
    href: "/tablet",
    label: "Guard web",
    cta: "Open tablet",
  },
];

const flowSteps = [
  {
    title: "ABIOT scanner writes raw rows",
    detail: "Column-based RFID reads land in Supabase the moment an antenna fires.",
    tag: "Ingest",
  },
  {
    title: "Converter normalizes payloads",
    detail: "The Next.js converter resolves identities and emits canonical JSON access events.",
    tag: "Transform",
  },
  {
    title: "Surfaces fetch /api/events",
    detail: "Manager and tablet read a single typed contract — no per-surface schema drift.",
    tag: "Distribute",
  },
  {
    title: "Decisions persist to event_resolutions",
    detail: "Guard and manager actions write back, closing the loop in under a second.",
    tag: "Resolve",
  },
];

const capabilityOrbs = [
  {
    glyph: "01",
    title: "Iridescent ingest",
    copy: "ABIOT writes column rows; we resolve identity, plate, and gate in one typed pass.",
    tone: "violet",
  },
  {
    glyph: "02",
    title: "Realtime fan-out",
    copy: "Supabase channels broadcast canonical JSON to every surface in well under a second.",
    tone: "cyan",
  },
  {
    glyph: "03",
    title: "Decision spine",
    copy: "Guard taps and manager calls persist to event_resolutions, closing the loop.",
    tone: "magenta",
  },
  {
    glyph: "04",
    title: "Edge-grade UI",
    copy: "Manager desktop and tablet kiosk are typed, themed, and staged from the same tokens.",
    tone: "gold",
  },
];

const bigNumbers = [
  { label: "Gate decisions per shift", value: 2480, suffix: "+" },
  { label: "Median latency (ms)", value: 184, suffix: "" },
  { label: "Surfaces synchronized", value: 2, suffix: "" },
  { label: "Uptime since cutover", value: 99, suffix: "%" },
];

interface KineticHeadingProps {
  reducedMotion: boolean;
}

function KineticHeading({ reducedMotion }: KineticHeadingProps) {
  const letterVariants = kineticLetterVariants(reducedMotion);

  const lineOffsets: number[] = [];
  let runningOffset = 0;
  for (const line of heroLines) {
    lineOffsets.push(runningOffset);
    runningOffset += Array.from(line.text).length;
  }
  const accentOffset = runningOffset;

  return (
    <h1 className="hero-display">
      {heroLines.map((line, lineIndex) => {
        const offset = lineOffsets[lineIndex];
        return (
          <span className="line" key={`line-${lineIndex}`}>
            {Array.from(line.text).map((char, charIndex) => {
              const absoluteIndex = offset + charIndex;
              const key = `c-${absoluteIndex}`;
              const delay = reducedMotion ? 0 : absoluteIndex * 0.018;
              return (
                <motion.span
                  key={key}
                  className="kinetic-letter"
                  variants={letterVariants}
                  transition={{ delay }}
                >
                  {char === " " ? " " : char}
                </motion.span>
              );
            })}
          </span>
        );
      })}
      <span className="line accent">
        {Array.from(heroAccentLine).map((char, charIndex) => {
          const absoluteIndex = accentOffset + charIndex;
          const key = `a-${absoluteIndex}`;
          const delay = reducedMotion ? 0 : 0.18 + absoluteIndex * 0.018;
          return (
            <motion.span
              key={key}
              className="kinetic-letter"
              variants={letterVariants}
              transition={{ delay }}
            >
              {char === " " ? " " : char}
            </motion.span>
          );
        })}
      </span>
    </h1>
  );
}

interface MagneticTileProps {
  href: string;
  eyebrow: string;
  title: string;
  copy: string;
  label: string;
  cta: string;
  reducedMotion: boolean;
}

function MagneticTile({ href, eyebrow, title, copy, label, cta, reducedMotion }: MagneticTileProps) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-1, 1], [6, -6]), { stiffness: 220, damping: 22, mass: 0.6 });
  const rotateY = useSpring(useTransform(x, [-1, 1], [-6, 6]), { stiffness: 220, damping: 22, mass: 0.6 });
  const translateX = useSpring(useTransform(x, [-1, 1], [-10, 10]), { stiffness: 220, damping: 22, mass: 0.6 });
  const translateY = useSpring(useTransform(y, [-1, 1], [-10, 10]), { stiffness: 220, damping: 22, mass: 0.6 });
  const sheenX = useSpring(useTransform(x, [-1, 1], [0, 100]), { stiffness: 220, damping: 22, mass: 0.6 });
  const sheenY = useSpring(useTransform(y, [-1, 1], [0, 100]), { stiffness: 220, damping: 22, mass: 0.6 });
  const sheen = useTransform(
    [sheenX, sheenY],
    ([sx, sy]) =>
      `radial-gradient(280px circle at ${sx as number}% ${sy as number}%, rgba(255,255,255,0.16), transparent 60%)`
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    x.set(px * 2);
    y.set(py * 2);
  };

  const handlePointerLeave = () => {
    if (reducedMotion) return;
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div className="app-tile-shell" variants={magneticTileVariants(reducedMotion)}>
      <motion.a
        ref={ref}
        href={href}
        className="app-tile magnetic"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          reducedMotion
            ? undefined
            : {
                rotateX,
                rotateY,
                x: translateX,
                y: translateY,
                transformStyle: "preserve-3d",
              }
        }
      >
        {!reducedMotion ? (
          <motion.span className="tile-sheen" aria-hidden style={{ background: sheen }} />
        ) : null}
        <div>
          <span className="tile-eyebrow">
            <span className="pip" />
            {eyebrow}
          </span>
          <h3>{title}</h3>
          <p>{copy}</p>
        </div>
        <div className="tile-cta">
          <span className="label">{label}</span>
          <span className="open">
            {cta}
            <span className="arrow" aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </span>
          </span>
        </div>
      </motion.a>
    </motion.div>
  );
}

interface CountUpProps {
  value: number;
  suffix?: string;
  reducedMotion: boolean;
}

function CountUp({ value, suffix = "", reducedMotion }: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [target, setTarget] = useState(0);

  useEffect(() => {
    if (!inView) return;
    setTarget(value);
  }, [inView, value]);

  if (reducedMotion) {
    return (
      <span ref={ref} className="big-number-value">
        {value.toLocaleString()}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className="big-number-value">
      <AnimatedNumber value={target} />
      {suffix}
    </span>
  );
}

export function HubHome() {
  const reducedMotion = useReducedMotion() ?? false;
  const haloRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.4 });

  // Hero scroll parallax (drives ornament + display copy depth)
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroFade = useTransform(heroProgress, [0, 1], [1, 0.0]);
  const heroLift = useTransform(heroProgress, [0, 1], [0, -120]);
  const ornamentLift = useTransform(heroProgress, [0, 1], [0, -200]);
  const ornamentRotate = useTransform(heroProgress, [0, 1], [0, 18]);

  useEffect(() => {
    if (reducedMotion) return;
    const halo = haloRef.current;
    if (!halo) return;
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      halo.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  const heroContainer = containerVariants(reducedMotion, { stagger: 0.04, delayChildren: 0.05 });
  const heroItem = itemVariants(reducedMotion, { distance: 24 });
  const tilesContainer = containerVariants(reducedMotion, { stagger: 0.12, delayChildren: 0.18 });
  const flowContainer = containerVariants(reducedMotion, { stagger: 0.06 });
  const flowItem = itemVariants(reducedMotion, { distance: 18 });
  const orbContainer = containerVariants(reducedMotion, { stagger: 0.1, delayChildren: 0.05 });
  const orbItem = itemVariants(reducedMotion, { distance: 32 });
  const numbersContainer = containerVariants(reducedMotion, { stagger: 0.08 });
  const numbersItem = itemVariants(reducedMotion, { distance: 26 });

  return (
    <div className="hub-stage">
      <div className="mesh-bg" aria-hidden />
      <div className="conic-ring" aria-hidden />
      <div className="grain" aria-hidden />
      {!reducedMotion ? <div ref={haloRef} className="cursor-halo" aria-hidden /> : null}

      {!reducedMotion ? (
        <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden />
      ) : null}

      <div className="hub-shell">
        <motion.header
          className="hub-topbar"
          initial="hidden"
          animate="visible"
          variants={containerVariants(reducedMotion, { stagger: 0.06 })}
        >
          <motion.div className="hub-mark" variants={heroItem}>
            <div className="glyph">Se</div>
            <div>
              <div className="wordmark">Seceurope</div>
              <div className="subline">RFID access · perimeter suite</div>
            </div>
          </motion.div>
          <motion.div className="hub-meta" variants={heroItem}>
            <span className="hub-pill">
              <span className="dot" />
              DB + realtime sync
            </span>
            <span className="hub-pill">Build · 2026.04</span>
            <span className="hub-pill">v4 · Aurora edition</span>
          </motion.div>
        </motion.header>

        <motion.section
          ref={heroRef}
          className="hub-hero"
          initial="hidden"
          animate="visible"
          variants={heroContainer}
          style={reducedMotion ? undefined : { y: heroLift, opacity: heroFade }}
        >
          {!reducedMotion ? (
            <motion.div
              className="hero-ornament"
              aria-hidden
              style={{ y: ornamentLift, rotate: ornamentRotate }}
            >
              <div className="orb orb-violet" />
              <div className="orb orb-cyan" />
              <div className="orb orb-magenta" />
            </motion.div>
          ) : null}

          <motion.span className="hero-eyebrow" variants={heroItem}>
            Perimeter intelligence · Sundara Greens · Live
          </motion.span>

          <motion.div initial="hidden" animate="visible" variants={containerVariants(reducedMotion, { stagger: 0 })}>
            <KineticHeading reducedMotion={reducedMotion} />
          </motion.div>

          <div className="hero-grid">
            <motion.p className="hero-lede" variants={heroItem}>
              ABIOT writes raw RFID rows to Supabase. This website converts those rows into canonical JSON access events
              and keeps the manager and guard tablet views synchronized over realtime channels — so every approach to
              your gate is resolved before the car is even there.
            </motion.p>
            <motion.div className="hero-stats" variants={heroItem}>
              {heroStats.map((stat) => (
                <div className="hero-stat" key={stat.label}>
                  <span className="label">{stat.label}</span>
                  <span className="value">{stat.value}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.section>

        <motion.div
          className="hub-marquee"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1, transition: { ...motionTransitions.panel, delay: 0.4 } }}
        >
          <div className="marquee">
            <div className="marquee-track">
              {[...marqueeWords, ...marqueeWords].map((word, index) => (
                <span className="marquee-item" key={`m-${index}`}>
                  <span className="pill" />
                  {word}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.section
          className="hub-apps"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={tilesContainer}
        >
          {appTiles.map((tile) => (
            <MagneticTile key={tile.href} reducedMotion={reducedMotion} {...tile} />
          ))}
        </motion.section>

        <motion.section
          className="hub-orbs"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.18 }}
          variants={orbContainer}
        >
          <motion.header className="orbs-head" variants={orbItem}>
            <span className="eyebrow-pill">
              <span className="pip" />
              Capabilities · stack
            </span>
            <h2>
              An <em>iridescent</em> stack —
              <br />
              one source of truth.
            </h2>
            <p>
              Aurora isn&rsquo;t paint. Each surface, channel, and decision rides the same typed pipeline,
              wrapped in a chromatic palette that signals state at a glance.
            </p>
          </motion.header>

          <div className="orbs-grid">
            {capabilityOrbs.map((orb) => (
              <motion.article
                key={orb.glyph}
                className={`orb-card tone-${orb.tone}`}
                variants={orbItem}
                whileHover={
                  reducedMotion
                    ? undefined
                    : { y: -8, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }
                }
              >
                <span className="orb-bloom" aria-hidden />
                <span className="orb-glyph">{orb.glyph}</span>
                <h3>{orb.title}</h3>
                <p>{orb.copy}</p>
                <span className="orb-foot">
                  <span className="line-bar" />
                  Live
                </span>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <section className="hub-flow">
          <motion.div
            className="col-label"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={containerVariants(reducedMotion, { stagger: 0.08 })}
          >
            <motion.span className="eyebrow" variants={heroItem}>
              Architecture · live pipeline
            </motion.span>
            <motion.h2 variants={heroItem}>
              Four hops. <em style={{ fontStyle: "italic" }}>Sub-second.</em>
            </motion.h2>
            <motion.p variants={heroItem}>
              From the moment ABIOT writes a row to the second the gate decides — every step is observable,
              typed, and synchronized.
            </motion.p>
          </motion.div>

          <motion.div
            className="flow-list"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={flowContainer}
          >
            {flowSteps.map((step, index) => (
              <motion.div className="flow-row" key={step.title} variants={flowItem}>
                <div className="num">{String(index + 1).padStart(2, "0")}</div>
                <div className="body">
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </div>
                <div className="tag">{step.tag}</div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <motion.section
          className="hub-numbers"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={numbersContainer}
        >
          <motion.span className="eyebrow-pill" variants={numbersItem}>
            <span className="pip" />
            By the numbers · last 24h
          </motion.span>

          <div className="big-number-grid">
            {bigNumbers.map((entry) => (
              <motion.div className="big-number" key={entry.label} variants={numbersItem}>
                <CountUp value={entry.value} suffix={entry.suffix} reducedMotion={reducedMotion} />
                <span className="big-number-label">{entry.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <footer className="hub-footer">
          <span className="signature">Seceurope · Perimeter intelligence, designed for the modern estate.</span>
          <span className="hub-pill">
            <span className="dot" />
            All systems nominal
          </span>
          <span>
            <Link href="/manager">Manager</Link>
            {" · "}
            <Link href="/tablet">Tablet</Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
