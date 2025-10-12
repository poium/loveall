export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="card p-8 max-w-md w-full text-center space-y-4">
        <h1 className="text-4xl font-bold text-card-foreground">404</h1>
        <h2 className="text-xl font-semibold text-card-foreground">Page Not Found</h2>
        <p className="text-muted-foreground">
          The page you are looking for doesn't exist.
        </p>
        <a 
          href="/" 
          className="btn-primary inline-block"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
