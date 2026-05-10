export default function TrayActivityShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          overflow: hidden !important;
          height: auto !important;
        }
      `}</style>
      {children}
    </>
  );
}
