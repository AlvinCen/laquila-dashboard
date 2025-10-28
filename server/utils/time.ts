import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = 'Asia/Jakarta';
dayjs.tz.setDefault(TZ);

/**
 * Converts a datetime-local string (like "2024-07-22T14:30") into a UTC ISO string.
 * It assumes the input string is in the Asia/Jakarta timezone.
 * @param localDateTimeString - The string from a datetime-local input.
 * @returns A full UTC ISO 8601 string (e.g., "2024-07-22T07:30:00.000Z").
 */
export function getWibISOString(localDateTimeString?: string | null): string {
    if (!localDateTimeString) {
        return new Date().toISOString();
    }
    // Tell dayjs that this string is in WIB, then convert to UTC and format as ISO string.
    return dayjs.tz(localDateTimeString, TZ).utc().toISOString();
}

/**
 * Gets the start and end of a given day in UTC, based on the WIB timezone.
 * @param date - The target date (e.g., '2024-07-22').
 * @returns An object with `start` and `end` properties as UTC ISO strings.
 */
export function getDayRangeWIB(date: string) {
    const day = dayjs.tz(date, TZ);
    return {
        start: day.startOf('day').utc().toISOString(),
        end: day.endOf('day').utc().toISOString(),
    };
}

/**
 * Gets the start and end of a given month in UTC, based on the WIB timezone.
 * @param month - The target month (e.g., '2024-07').
 * @returns An object with `start` and `end` properties as UTC ISO strings.
 */
export function getMonthRangeWIB(month: string) {
    const day = dayjs.tz(month, TZ);
    return {
        start: day.startOf('month').utc().toISOString(),
        end: day.endOf('month').utc().toISOString(),
    };
}
