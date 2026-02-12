"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Check,
  Zap,
  Star,
  ExternalLink,
  TrendingUp,
  BarChart3,
  Users,
  Layers,
  Activity,
  DollarSign,
  Globe,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { TokenChart } from "@/components/token-chart";
import { TradeForm } from "@/components/trade-form";
import { TradeHistory } from "@/components/trade-history";
import { TickerPrice } from "@/components/ticker-price";
import { BondingCurveMini } from "@/components/bonding-curve-mini";

/* ─── Mock token data (lookup by id) ─── */

const C = [
  "#c9a84c", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f59e0b", "#06b6d4", "#84cc16", "#f97316",
  "#14b8a6", "#6366f1",
];

interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  graduationProgress: number;
  status: "new" | "active" | "graduating" | "graduated";
  creator: string;
  createdAgo: string;
  color: string;
  mint: string;
  totalSupply: number;
  holders: number;
  trades: number;
  reserveSol: number;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

const TOKENS: Record<string, TokenInfo> = {
  "1": {
    id: "1", name: "Doge Killer", symbol: "DOGEK", price: 0.00234, priceChange24h: 142.5,
    marketCap: 67.8, volume24h: 23.4, graduationProgress: 79, status: "graduating",
    creator: "7xK2mBfR3nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "2h",
    color: C[0], mint: "DGKx9a84cR3nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 342, trades: 1847,
    reserveSol: 67.15, description: "The ultimate Doge slayer. Community-driven meme token on Solana.",
    twitter: "dogekiller_sol", telegram: "dogekillersol", website: "https://dogekiller.xyz",
  },
  "2": {
    id: "2", name: "Pepe Solana", symbol: "PEPES", price: 0.000891, priceChange24h: 34.2,
    marketCap: 42.1, volume24h: 15.7, graduationProgress: 49, status: "active",
    creator: "3pK9mBfR4nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "4h",
    color: C[1], mint: "PEPx891cR4nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 189, trades: 923,
    reserveSol: 41.65, description: "Pepe finds his home on Solana. The greenest frog in DeFi.",
    twitter: "pepesolana", telegram: "pepesol_chat",
  },
  "3": {
    id: "3", name: "CatWifHat", symbol: "CWH", price: 0.00567, priceChange24h: -12.3,
    marketCap: 89.2, volume24h: 31.8, graduationProgress: 100, status: "graduated",
    creator: "5xM2nCfR7nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "1d",
    color: C[2], mint: "CWHx567cR7nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 1204, trades: 8432,
    reserveSol: 85, description: "A cat. With a hat. On Solana. What more do you need?",
    twitter: "catwifhat_sol", website: "https://catwifhat.lol",
  },
  "4": {
    id: "4", name: "MoonBoy", symbol: "MOON", price: 0.000042, priceChange24h: 5.2,
    marketCap: 3.6, volume24h: 1.8, graduationProgress: 4, status: "new",
    creator: "9kT3nGfR2nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "12m",
    color: C[3], mint: "MOOx042cR2nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 23, trades: 47,
    reserveSol: 3.4, description: "To the moon. No plan B.",
    telegram: "moonboy_sol",
  },
  "5": {
    id: "5", name: "Sol Ape", symbol: "SOLAPE", price: 0.00123, priceChange24h: 18.7,
    marketCap: 29.8, volume24h: 8.4, graduationProgress: 35, status: "active",
    creator: "2mN4pBfR8nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "6h",
    color: C[4], mint: "SAPx123cR8nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 156, trades: 634,
    reserveSol: 29.75, description: "Apes together strong. Solana edition.",
    twitter: "solape_nft", telegram: "solape_community", website: "https://solape.io",
  },
  "6": {
    id: "6", name: "Froggy", symbol: "FROG", price: 0.00345, priceChange24h: 67.3,
    marketCap: 72.4, volume24h: 28.9, graduationProgress: 85, status: "graduating",
    creator: "8jR5kCfR1nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "8h",
    color: C[5], mint: "FRGx345cR1nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 487, trades: 2341,
    reserveSol: 72.25, description: "Ribbit. The frog that refuses to stay small.",
    twitter: "froggy_sol",
  },
  "7": {
    id: "7", name: "SigmaGrind", symbol: "SIGMA", price: 0.00198, priceChange24h: -4.1,
    marketCap: 51.3, volume24h: 11.2, graduationProgress: 60, status: "active",
    creator: "4pL6mDfR9nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "12h",
    color: C[6], mint: "SIGx198cR9nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 298, trades: 1103,
    reserveSol: 51.0, description: "Stay on your grind. Sigma mindset, sigma gains.",
  },
  "8": {
    id: "8", name: "BasedChad", symbol: "BASED", price: 0.000234, priceChange24h: 231.5,
    marketCap: 12.8, volume24h: 9.1, graduationProgress: 15, status: "new",
    creator: "6nM8jBfR5nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "35m",
    color: C[7], mint: "BSDx234cR5nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 78, trades: 312,
    reserveSol: 12.75, description: "Based and redpilled. The chad token of Solana.",
  },
  "9": {
    id: "9", name: "We All Gonna Make It", symbol: "WAGMI", price: 0.00412, priceChange24h: -8.7,
    marketCap: 85.0, volume24h: 19.5, graduationProgress: 100, status: "graduated",
    creator: "1kP7nAfR6nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "2d",
    color: C[8], mint: "WGMx412cR6nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 2103, trades: 12847,
    reserveSol: 85.0, description: "We're all gonna make it. The OG community token.",
    twitter: "wagmi_sol", telegram: "wagmi_community", website: "https://wagmi.gg",
  },
  "10": {
    id: "10", name: "PumpKing", symbol: "PUMP", price: 0.00789, priceChange24h: 24.3,
    marketCap: 91.2, volume24h: 34.7, graduationProgress: 100, status: "graduated",
    creator: "7mQ9pCfR3nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "3d",
    color: C[9], mint: "PMPx789cR3nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 3421, trades: 18923,
    reserveSol: 85.0, description: "The king of pumps. First to graduate on LAUNCH.",
    twitter: "pumpking_sol", website: "https://pumpking.fun",
  },
  "11": {
    id: "11", name: "GigaChad", symbol: "CHAD", price: 0.000089, priceChange24h: 12.0,
    marketCap: 7.5, volume24h: 3.2, graduationProgress: 9, status: "new",
    creator: "5jN2mEfR4nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "22m",
    color: C[10], mint: "CHDx089cR4nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 31, trades: 89,
    reserveSol: 7.65, description: "Giga energy. Giga gains. Accept no substitutes.",
  },
  "12": {
    id: "12", name: "RizzLord", symbol: "RIZZ", price: 0.00278, priceChange24h: 55.8,
    marketCap: 63.1, volume24h: 21.3, graduationProgress: 74, status: "graduating",
    creator: "3kM4nFfR8nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr", createdAgo: "5h",
    color: C[11], mint: "RIZx278cR8nDjY8zQpL4wV9eT6kA5hC1sN2gF8dP3nQr",
    totalSupply: 1_000_000_000, holders: 412, trades: 1987,
    reserveSol: 62.9, description: "Unmatched rizz. The most charismatic token on-chain.",
    twitter: "rizzlord_sol", telegram: "rizzlord_chat",
  },
};

/* ─── Helpers ─── */

function shorten(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function formatNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

/* ─── Status badge ─── */

function StatusBadge({ status }: { status: string }) {
  if (status === "new")
    return (
      <span className="inline-flex items-center gap-1 bg-status-new/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-new">
        NEW
      </span>
    );
  if (status === "graduating")
    return (
      <span
        className="inline-flex items-center gap-1 bg-status-graduating/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-graduating"
        style={{ animation: "graduating-glow 2.5s ease-in-out infinite" }}
      >
        <Zap className="h-2.5 w-2.5" /> GRADUATING
      </span>
    );
  if (status === "graduated")
    return (
      <span className="inline-flex items-center gap-1 bg-status-graduated/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-graduated">
        <Star className="h-2.5 w-2.5" /> GRADUATED
      </span>
    );
  return null;
}

/* ─── Stats card ─── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-border bg-surface/40 p-3">
      <div className="flex items-center gap-1.5 text-text-3">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1.5 font-mono text-[16px] font-bold tabular-nums text-text-1">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-text-3">{sub}</p>}
    </div>
  );
}

/* ─── Page ─── */

export default function TokenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = TOKENS[id];
  const [mintCopied, setMintCopied] = useState(false);

  /* ─── Live price simulation ─── */
  const [livePrice, setLivePrice] = useState(token?.price ?? 0);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);

  /* ─── Graduation heat particles ─── */
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);

  // Simulate live price ticks
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      setLivePrice((prev) => {
        const change = (Math.random() - 0.42) * prev * 0.015;
        const next = Math.max(prev * 0.5, prev + change);
        const dir = next > prev ? "up" : "down";
        setPriceFlash(dir);
        setTimeout(() => setPriceFlash(null), 400);

        return next;
      });
    }, 1800 + Math.random() * 2400);
    return () => clearInterval(interval);
  }, [token]);

  // Graduation heat — floating particles when progress > 75%
  useEffect(() => {
    if (!token) return;
    const pct = (token.reserveSol / 85) * 100;
    if (pct < 75) return;

    const canvas = heatCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const intensity = Math.min(1, (pct - 75) / 25); // 0 at 75%, 1 at 100%
    const count = Math.floor(12 + intensity * 28);

    interface HeatParticle {
      x: number;
      y: number;
      vy: number;
      size: number;
      opacity: number;
      wobble: number;
      speed: number;
    }

    const particles: HeatParticle[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      vy: -(0.3 + Math.random() * 0.8) * (0.5 + intensity),
      size: 1 + Math.random() * 2.5,
      opacity: 0.2 + Math.random() * 0.5,
      wobble: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
    }));

    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (const p of particles) {
        p.y += p.vy;
        p.wobble += 0.02;
        p.x += Math.sin(p.wobble * p.speed) * 0.4;

        if (p.y < -20) {
          p.y = canvas!.height + 10;
          p.x = Math.random() * canvas!.width;
        }

        const fadeTop = Math.min(1, p.y / (canvas!.height * 0.3));
        ctx!.globalAlpha = p.opacity * fadeTop;
        ctx!.fillStyle = "#f59e0b";
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }

      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);

    const ro = new ResizeObserver(() => {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    });
    ro.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [token]);

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-text-3">Token not found.</p>
        <Link href="/" className="text-[13px] text-brand hover:text-brand-bright">
          Back to home
        </Link>
      </div>
    );
  }

  function handleCopyMint() {
    navigator.clipboard.writeText(token.mint);
    setMintCopied(true);
    setTimeout(() => setMintCopied(false), 2000);
  }

  const gradReservePct = Math.min(100, (token.reserveSol / 85) * 100);
  const gradColor =
    gradReservePct > 80
      ? "var(--status-graduating)"
      : gradReservePct > 50
        ? "var(--brand)"
        : "var(--text-3)";

  return (
    <div className="relative min-h-screen bg-bg">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(201,168,76,0.08),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--text-3) 0.5px, transparent 0.5px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>
      <div className="noise-overlay" />

      {/* ── Graduation heat particles canvas ── */}
      <canvas
        ref={heatCanvasRef}
        className="pointer-events-none fixed inset-0 z-0"
        style={{ opacity: token ? Math.min(0.7, ((token.reserveSol / 85) * 100 - 75) / 25 * 0.7) : 0 }}
      />

      {/* ── Graduation heat border glow ── */}
      {token && token.reserveSol / 85 > 0.75 && (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            boxShadow: `inset 0 0 ${60 + ((token.reserveSol / 85) * 100 - 75) * 3}px -20px rgba(245,158,11,${0.05 + ((token.reserveSol / 85) * 100 - 75) / 25 * 0.12})`,
            animation: "graduating-glow 3s ease-in-out infinite",
          }}
        />
      )}

      <div className="relative">
        <Navbar />

        <div className="mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-text-3 transition-colors hover:text-text-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All tokens
          </Link>

          {/* ─── Banner ─── */}
          <div
            className="relative mt-4 h-[160px] w-full overflow-hidden sm:h-[180px]"
            style={{
              background: `linear-gradient(135deg, ${token.color}30 0%, ${token.color}10 40%, transparent 70%), linear-gradient(225deg, ${token.color}20 0%, transparent 50%), var(--surface)`,
            }}
          >
            {/* Noise pattern on banner */}
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, var(--text-3) 0.5px, transparent 0.5px)",
                backgroundSize: "18px 18px",
              }}
            />
            {/* Gradient orb */}
            <div
              className="absolute -right-20 -top-20 h-[250px] w-[250px] rounded-full opacity-20 blur-[80px]"
              style={{ backgroundColor: token.color }}
            />
            <div
              className="absolute -left-10 bottom-0 h-[150px] w-[300px] rounded-full opacity-10 blur-[60px]"
              style={{ backgroundColor: token.color }}
            />
          </div>

          {/* ─── Token Header (overlaps banner) ─── */}
          <div className="relative px-1">
            {/* Avatar — overlaps banner */}
            <div
              className="-mt-10 mb-3 flex h-[72px] w-[72px] shrink-0 items-center justify-center border-[3px] border-bg text-[24px] font-bold text-bg shadow-lg"
              style={{ backgroundColor: token.color }}
            >
              {token.symbol.slice(0, 2)}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4 min-w-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-bold text-text-1 sm:text-2xl">
                    {token.name}
                  </h1>
                  <span className="font-mono text-[14px] text-text-3">
                    ${token.symbol}
                  </span>
                  <StatusBadge status={token.status} />
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-text-3">
                  <button
                    onClick={handleCopyMint}
                    className="inline-flex items-center gap-1 font-mono transition-colors hover:text-text-2"
                  >
                    {shorten(token.mint)}
                    {mintCopied ? (
                      <Check className="h-3 w-3 text-buy" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <span>
                    Created by{" "}
                    <Link href={`/profile/${token.creator}`} className="font-mono text-text-2 hover:text-text-1 transition-colors">
                      {shorten(token.creator)}
                    </Link>
                  </span>
                  <span>{token.createdAgo} ago</span>
                </div>

                {token.description && (
                  <p className="mt-2 max-w-xl text-[13px] text-text-3 leading-relaxed">
                    {token.description}
                  </p>
                )}

                {/* Social links */}
                {(token.twitter || token.telegram || token.website) && (
                  <div className="mt-2 flex items-center gap-2.5">
                    {token.twitter && (
                      <a
                        href={`https://x.com/${token.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-3 transition-colors hover:text-text-1"
                        title={`@${token.twitter}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px] fill-current">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                    )}
                    {token.telegram && (
                      <a
                        href={`https://t.me/${token.telegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-3 transition-colors hover:text-text-1"
                        title={token.telegram}
                      >
                        <MessageCircle className="h-[15px] w-[15px]" />
                      </a>
                    )}
                    {token.website && (
                      <a
                        href={token.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-3 transition-colors hover:text-text-1"
                        title={token.website}
                      >
                        <Globe className="h-[15px] w-[15px]" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Price — live ticker */}
              <div className="text-right">
                <div className="text-2xl sm:text-3xl text-text-1">
                  <TickerPrice price={livePrice} flash={priceFlash} />
                </div>
                <p className="text-[11px] text-text-3">SOL</p>
                <p
                  className={`mt-1 font-mono text-[14px] font-medium ${
                    token.priceChange24h >= 0 ? "text-buy" : "text-sell"
                  }`}
                >
                  {token.priceChange24h >= 0 ? "+" : ""}
                  {token.priceChange24h.toFixed(1)}%
                  <span className="ml-1 text-[11px] text-text-3">24h</span>
                </p>
              </div>
            </div>
          </div>

          {/* ─── 2 Column Layout ─── */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* LEFT COLUMN */}
            <div className="space-y-6 min-w-0">
              {/* Chart */}
              <div className="border border-border bg-surface/40 p-4">
                <TokenChart color={token.color} />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  icon={DollarSign}
                  label="Price"
                  value={`${token.price.toFixed(6)} SOL`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Market Cap"
                  value={`${token.marketCap.toFixed(1)} SOL`}
                />
                <StatCard
                  icon={BarChart3}
                  label="Volume 24h"
                  value={`${token.volume24h.toFixed(1)} SOL`}
                />
                <StatCard
                  icon={Layers}
                  label="Total Supply"
                  value={formatNum(token.totalSupply)}
                />
                <StatCard
                  icon={Users}
                  label="Holders"
                  value={formatNum(token.holders)}
                />
                <StatCard
                  icon={Activity}
                  label="Trades"
                  value={formatNum(token.trades)}
                />
              </div>

              {/* Graduation Progress */}
              <div className="border border-border bg-surface/40 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-medium uppercase tracking-wider text-text-3">
                    Graduation Progress
                  </h3>
                  <span className="font-mono text-[13px] font-bold" style={{ color: gradColor }}>
                    {gradReservePct.toFixed(0)}%
                  </span>
                </div>

                <div className="mt-3 h-3 w-full overflow-hidden bg-border/40">
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${gradReservePct}%`,
                      background: `linear-gradient(90deg, var(--brand-dim), ${gradColor})`,
                      animation:
                        gradReservePct > 75
                          ? "graduating-glow 2.5s ease-in-out infinite"
                          : "none",
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-text-2">
                    {token.reserveSol.toFixed(2)} SOL
                  </span>
                  <span className="text-text-3">/ 85 SOL to graduate</span>
                </div>

                {/* Mini bonding curve visualization */}
                <div className="mt-4 h-20">
                  <BondingCurveMini
                    progress={gradReservePct}
                    color={gradColor}
                  />
                </div>

                {token.status === "graduated" && (
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-status-graduated">
                    <Star className="h-3.5 w-3.5" />
                    <span>Graduated to Raydium</span>
                    <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </div>

              {/* Trade History */}
              <TradeHistory
                tokenSymbol={token.symbol}
                basePrice={token.price}
              />
            </div>

            {/* RIGHT COLUMN — Sticky trade form */}
            <div className="lg:sticky lg:top-[72px] lg:self-start">
              <TradeForm
                tokenSymbol={token.symbol}
                tokenPrice={token.price}
                color={token.color}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
