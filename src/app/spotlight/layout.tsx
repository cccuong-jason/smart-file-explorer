// Dedicated layout for the Spotlight window — overrides body background to transparent
// so that the OS shows through around the search card.
export default function SpotlightShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          /* Prevent any scroll or overflow that reveals black edges */
          overflow: hidden !important;
          height: auto !important;
        }
      `}</style>
      {children}
    </>
  );
}
