'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the client component with no SSR
const ClientOfflineIndicator = dynamic(
    () => import('./client-offline-indicator'),
    { ssr: false }
);

// Simple wrapper component that only renders on the client side
export default function OfflineIndicator() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return null;
    }

    return <ClientOfflineIndicator />;
}