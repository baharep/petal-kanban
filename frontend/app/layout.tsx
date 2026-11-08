import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Petal | Project Board',
  description: 'A thoughtful, colorful space to grow your projects.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
