import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Ensures this route is never cached by Vercel's CDN and is always run on the server
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const today = new Date();

    const latest = await prisma.exchangeRate.findFirst({
      where: {
        pair: "USD/PHP",
        source: "BSP",
        date: { 
          lte: today 
        }, 
      },
      orderBy: { 
        date: "desc" 
      },
      select: { 
        date: true, 
        pair: true, 
        rate: true, 
        source: true 
      },
    });

    if (!latest) {
      return NextResponse.json(
        { error: "No exchange rates found for USD/PHP from BSP." },
        { status: 404 }
      );
    }

    // Return the data with explicit headers to prevent browser-side caching
    return NextResponse.json(
      {
        date: latest.date.toISOString(),
        pair: latest.pair,
        source: latest.source,
        rate: latest.rate.toString(), // Ensures Decimal/Float types are safely stringified
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    // Log the error for Vercel Runtime Logs
    console.error("CRITICAL: GET /api/rates/latest failed:", err);
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}