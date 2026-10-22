"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeProps {
  value: string;
  size?: number;
}

export default function QRCode({ value, size = 160 }: QRCodeProps) {
  const [error, setError] = useState(false);

  if (error || !value) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] text-gray-500">QR</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white p-1.5 inline-block">
      <QRCodeSVG
        value={value}
        size={size}
        bgColor="#ffffff"
        fgColor="#000000"
        level="M"
        onError={() => setError(true)}
      />
    </div>
  );
}
