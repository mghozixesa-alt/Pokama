"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Logo } from "./Logo";

export type Slide = { kicker: string; title: string; sub: string; cta: string; href: string; img: string; sticker: { big: string; small: string; tone: "white" | "navy" | "teal" } };

const STICKER: Record<Slide["sticker"]["tone"], string> = {
  white: "bg-white text-brand-navy",
  navy: "bg-brand-navy text-white",
  teal: "bg-teal text-brand-navy",
};

export function BannerCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i];
  return (
    <div className="px-4 mt-4">
      <div className="relative h-[168px] rounded-2xl overflow-hidden bg-brand-navy">
        <Image src={s.img} alt="" fill sizes="480px" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(16,54,92,0.9)] via-[rgba(16,54,92,0.86)] to-transparent" style={{ backgroundImage: "linear-gradient(90deg, rgba(16,54,92,0.9) 0%, rgba(16,54,92,0.86) 28%, rgba(16,54,92,0) 64%)" }} />
        <div className="absolute inset-0 p-4 flex flex-col justify-center gap-1 text-white max-w-[64%]">
          <span className="inline-flex items-center gap-2 self-start">
            <span className="inline-flex items-center h-[22px] px-1.5 rounded-md bg-white"><Logo height={14} /></span>
            <span className="text-[9px] font-bold tracking-wider uppercase opacity-85">{s.kicker}</span>
          </span>
          <h3 className="text-[18px] leading-[22px] font-extrabold mt-1">{s.title}</h3>
          <p className="text-[11px] leading-4 opacity-90">{s.sub}</p>
          <Link href={s.href} className="inline-flex items-center self-start h-8 px-3.5 mt-1.5 rounded-full bg-white text-brand-dark text-xs font-extrabold">{s.cta}</Link>
        </div>
        <span className={`absolute right-3.5 top-3.5 w-[92px] h-[68px] px-1 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${STICKER[s.sticker.tone]}`}>
          <span className="text-[19px] leading-6 font-extrabold whitespace-nowrap">{s.sticker.big}</span>
          <span className="text-[8px] font-extrabold tracking-wide leading-3">{s.sticker.small}</span>
        </span>
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {slides.map((_, k) => (
            <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
