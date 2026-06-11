export default function TrayActivityShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body, #root {
          background: var(--card) !important;
          overflow: hidden !important;
          height: 100vh !important;
          width: 100vw !important;
          margin: 0 !important;
        }
      `}</style>
      {children}
    </>
  );
}
