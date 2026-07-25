import { NextResponse } from "next/server";

// This endpoint has been deprecated. Meal plan images now come directly
// from Spoonacular and are stored in the plan JSONB as image_url.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been deprecated. Images are now provided by Spoonacular." },
    { status: 410 }
  );
}
