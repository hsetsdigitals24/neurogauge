import Link from "next/link";
import { Code2, Globe, Mail } from "lucide-react";
import Image from "next/image";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto w-full border-t border-[color:var(--border)] bg-white/60 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 grid gap-8 md:grid-cols-3">
        <div>
          <Link href="/" className="flex items-center gap-2 group">
            {/* <div className="w-8 h-8 rounded-xl shimmer shadow" /> */}
            <div>
              <div className="font-bold gradient-text leading-tight"> 
                <Image src="/assets/Asset 4@4x.png" alt="Logo" width={100} height={30} className="h-auto w-auto" /></div>
              <div className="text-xs text-[color:var(--muted)] leading-tight">
                Neuroscience Lab
              </div>
            </div>
          </Link>
          <p className="text-xs text-[color:var(--muted)] mt-3 max-w-xs">
            Research-grade N-back testing across Letters, Shapes, and Rotated-E with NASA-TLX questionnaires.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3">Platform</h4>
          <ul className="space-y-2 text-sm text-[color:var(--muted)]">
            <li><Link href="/" className="hover:text-[color:var(--fg)]">Home</Link></li>
            <li><Link href="/results" className="hover:text-[color:var(--fg)]">My results</Link></li>
            <li><Link href="/auth/login" className="hover:text-[color:var(--fg)]">Sign in</Link></li>
            <li><Link href="/auth/signup" className="hover:text-[color:var(--fg)]">For researchers</Link></li>
          </ul>
        </div>

        {/* Developer link section — fill in name + URLs */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Developer</h4>
          <p className="text-sm text-[color:var(--muted)] mb-3">
            Built by{" "}
            <a
              href="https://h-sets.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[color:var(--fg)] hover:underline"
            >
             H-SETS Digital Solutions
            </a>
            .
          </p>
          <div className="flex items-center gap-3 text-[color:var(--muted)]">
            <a
              href="https://h-sets.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Website"
              className="hover:text-[color:var(--fg)]"
            >
              <Globe className="w-4 h-4" />
            </a>
            <a
              href="mailto:info@h-sets.com"
              aria-label="Email"
              className="hover:text-[color:var(--fg)]"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[color:var(--muted)]">
          <span>© {year} Neurogauge Neuroscience Lab. All rights reserved.</span>
          <span>For research use only.</span>
        </div>
      </div>
    </footer>
  );
}
