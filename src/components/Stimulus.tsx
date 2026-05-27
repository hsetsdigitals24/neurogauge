"use client";
import { motion } from "framer-motion";
import { SHAPE_LIBRARY, StimulusType } from "@/lib/types";

export function Stimulus({
  type, value, visible,
}: { type: StimulusType; value: string; visible: boolean }) {
  return (
    <motion.div
      key={`${type}-${value}-${visible}`}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: visible ? 1 : 0.95, opacity: visible ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className="flex items-center justify-center"
      style={{ width: 240, height: 240 }}
    >
      {type === "letters" && (
        <div className="text-[10rem] font-extrabold gradient-text leading-none select-none">
          {value}
        </div>
      )}
      {type === "shapes" && (
        <svg viewBox="0 0 100 100" width="220" height="220">
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="60%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <g fill="url(#g1)" dangerouslySetInnerHTML={{
            __html: SHAPE_LIBRARY[value] ?? SHAPE_LIBRARY.circle
          }} />
        </svg>
      )}
      {type === "rotated-e" && (
        <svg viewBox="0 0 100 100" width="220" height="220">
          <g transform={`rotate(${parseInt(value, 10)} 50 50)`}>
            <text
              x="50" y="74" textAnchor="middle"
              fontSize="92" fontWeight="900"
              fill="url(#g2)"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >E</text>
          </g>
          <defs>
            <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="60%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      )}
    </motion.div>
  );
}
