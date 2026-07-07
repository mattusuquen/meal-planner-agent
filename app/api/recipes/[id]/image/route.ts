import { createClient } from "@/lib/supabase/server";
import { adminSupabase } from "@/lib/supabase/admin";
import { openai } from "@/lib/openai";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the recipe (use admin to avoid auth issues in fire-and-forget context)
  const { data: recipe } = await adminSupabase
    .from("recipes")
    .select("name, cuisine")
    .eq("id", id)
    .single();

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  try {
    const prompt = `Professional food photography of ${recipe.name}, ${recipe.cuisine ?? "modern"} cuisine, beautifully plated on a clean white plate, soft natural lighting, high resolution, restaurant quality`;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "standard",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      return NextResponse.json({ error: "No image generated" }, { status: 500 });
    }

    // Upload to Supabase Storage
    let imageUrl: string | null = null;

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, "base64");
      const fileName = `${id}.png`;

      const { error: uploadError } = await adminSupabase.storage
        .from("recipe-images")
        .upload(fileName, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = adminSupabase.storage
          .from("recipe-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    } else if (imageData.url) {
      // Fetch and upload the URL
      const imgRes = await fetch(imageData.url);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const fileName = `${id}.png`;

      const { error: uploadError } = await adminSupabase.storage
        .from("recipe-images")
        .upload(fileName, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = adminSupabase.storage
          .from("recipe-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    }

    if (imageUrl) {
      await adminSupabase
        .from("recipes")
        .update({ image_url: imageUrl })
        .eq("id", id);
    }

    return NextResponse.json({ image_url: imageUrl });
  } catch (err) {
    console.error("Image generation failed:", err);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}

// Also allow server-side auth context
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: recipe } = await supabase
    .from("recipes")
    .select("image_url")
    .eq("id", id)
    .single();

  return NextResponse.json({ image_url: recipe?.image_url ?? null });
}
