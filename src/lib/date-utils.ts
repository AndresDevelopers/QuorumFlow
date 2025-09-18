/**
 * Utility functions for handling dates and Firebase Timestamps safely
 */

/**
 * Safely converts a Firebase Timestamp, Date, string, or number to a Date object
 * @param timestamp - The timestamp to convert
 * @returns Date object or null if conversion fails
 */
export function safeGetDate(timestamp: any): Date | null {
    if (!timestamp) return null;

    try {
        // If it has toDate method (Firebase Timestamp)
        if (typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }

        // If it's already a Date object
        if (timestamp instanceof Date) {
            return timestamp;
        }

        // If it's a string, try to parse it
        if (typeof timestamp === 'string') {
            const parsed = new Date(timestamp);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        // If it's a number (milliseconds)
        if (typeof timestamp === 'number') {
            return new Date(timestamp);
        }

        // If it's an object with seconds property (Firestore Timestamp-like)
        if (typeof timestamp === 'object' && timestamp.seconds) {
            return new Date(timestamp.seconds * 1000);
        }

        return null;
    } catch (error) {
        console.warn('Error parsing date:', error);
        return null;
    }
}

/**
 * Safely formats a timestamp using date-fns format
 * @param timestamp - The timestamp to format
 * @param formatStr - The format string for date-fns
 * @param options - Additional options for date-fns format
 * @returns Formatted date string or fallback text
 */
export function safeFormatDate(
    timestamp: any,
    formatStr: string,
    options?: any,
    fallback: string = 'No especificada'
): string {
    const date = safeGetDate(timestamp);
    if (!date) return fallback;

    try {
        const { format } = require('date-fns');
        return format(date, formatStr, options);
    } catch (error) {
        console.warn('Error formatting date:', error);
        return fallback;
    }
}

/**
 * Checks if a timestamp represents a future date
 * @param timestamp - The timestamp to check
 * @returns true if the date is in the future, false otherwise
 */
export function isFutureDate(timestamp: any): boolean {
    const date = safeGetDate(timestamp);
    return date ? date > new Date() : false;
}

/**
 * Checks if a timestamp represents a past date
 * @param timestamp - The timestamp to check
 * @returns true if the date is in the past, false otherwise
 */
export function isPastDate(timestamp: any): boolean {
    const date = safeGetDate(timestamp);
    return date ? date < new Date() : false;
}

/**
 * Gets the age in years from a birth date timestamp
 * @param birthTimestamp - The birth date timestamp
 * @returns Age in years or null if invalid
 */
export function getAge(birthTimestamp: any): number | null {
    const birthDate = safeGetDate(birthTimestamp);
    if (!birthDate) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}