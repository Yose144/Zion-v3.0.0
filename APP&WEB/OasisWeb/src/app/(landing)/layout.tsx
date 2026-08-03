export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden bg-oasis-black"
      style={{ height: '100dvh', width: '100vw' }}
    >
      {children}
    </div>
  );
}
