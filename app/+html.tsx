import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and will be picked up by webpack
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <title>MystWell</title>
      </head>
      <body>{children}</body>
    </html>
  );
} 