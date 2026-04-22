import { NextResponse } from "next/server";

const CALENDAR_URL = "https://tcgshowsnearme.com/calendar";
const DEFAULT_LIMIT = 3;

type ParsedEvent = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  startTime: string;
  endTime: string;
  city: string;
  stateRegion: string;
  countryCode: string;
};

const decodeJsonString = (value: string): string => {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
};

const parseEventsFromHtml = (html: string): ParsedEvent[] => {
  const eventPattern = /\{\\"id\\":\\"([^\\"]+)\\",\\"slug\\":\\"([^\\"]+)\\",\\"name\\":\\"([^\\"]+)\\",\\"start_date\\":\\"([^\\"]+)\\",\\"end_date\\":\\"([^\\"]+)\\",\\"start_time\\":\\"([^\\"]*)\\",\\"end_time\\":\\"([^\\"]*)\\",\\"city\\":\\"([^\\"]*)\\",\\"state_region\\":(null|\\"[^\\"]*\\"),\\"country_code\\":\\"([^\\"]+)\\"/g;
  const events: ParsedEvent[] = [];

  let match: RegExpExecArray | null;
  while ((match = eventPattern.exec(html)) !== null) {
    const [, id, slug, name, startDate, , startTime, endTime, city, stateRaw, countryCode] = match;
    const decodedState = stateRaw === "null"
      ? ""
      : decodeJsonString(stateRaw.slice(2, -2));

    events.push({
      id,
      slug,
      name: decodeJsonString(name),
      startDate,
      startTime,
      endTime,
      city: decodeJsonString(city),
      stateRegion: decodedState,
      countryCode,
    });
  }

  return events;
};

const toDateLabel = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return "TBD";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const toTimeRange = (startTime: string, endTime: string): string => {
  if (!startTime && !endTime) {
    return "Time TBD";
  }

  if (!startTime || !endTime) {
    return `${startTime || endTime} local`;
  }

  return `${startTime}-${endTime}`;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitValue = Number(searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 12) : DEFAULT_LIMIT;
    const countryFilter = (searchParams.get("country") || "all").toUpperCase();

    const response = await fetch(CALENDAR_URL, {
      headers: {
        "User-Agent": "StackTrackPro Dashboard Event Fetcher",
      },
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) {
      return NextResponse.json({ events: [] }, { status: 502 });
    }

    const html = await response.text();
    const parsedEvents = parseEventsFromHtml(html)
      .filter((event) => event.startDate)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = parsedEvents
      .filter((event) => {
        const eventDate = new Date(event.startDate);
        const matchesCountry = countryFilter === "ALL" || event.countryCode === countryFilter;
        return !Number.isNaN(eventDate.getTime()) && eventDate >= now && matchesCountry;
      })
      .slice(0, limit)
      .map((event) => ({
        id: event.id,
        title: event.name,
        date: toDateLabel(event.startDate),
        detail: `${toTimeRange(event.startTime, event.endTime)} • ${event.city}${event.stateRegion ? `, ${event.stateRegion}` : ""}`,
        href: `${CALENDAR_URL}/${event.slug}`,
      }));

    return NextResponse.json(
      {
        source: CALENDAR_URL,
        events: upcoming,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch TCG events:", error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
