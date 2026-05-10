import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card p-10 text-center max-w-md mx-auto">
        <div className="text-6xl font-extrabold gradient-text mb-2">404</div>
        <h1 className="text-2xl font-extrabold mb-2">Page not found</h1>
        <p className="text-[color:var(--muted)] text-sm mb-6">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary text-sm">
          Back to home
        </Link>
      </div>
    </div>
  );
}
