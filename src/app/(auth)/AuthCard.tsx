"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Auth card wrapper: glass surface that fades in, slides up and settles from
 * a slight scale on mount. Animation is skipped entirely for users who
 * prefer reduced motion.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="glass relative z-10 w-full max-w-md rounded-2xl p-6 shadow-card sm:p-8"
    >
      {children}
    </motion.main>
  );
}
