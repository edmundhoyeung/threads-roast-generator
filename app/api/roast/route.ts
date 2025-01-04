import { OpenAI } from "openai";
import { ApifyClient } from "apify-client";
import { NextResponse } from "next/server";

// Define the structure of the scraped data
interface ThreadsProfile {
  bio: string;
  posts: { text: string }[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Helper function to validate the structure of the scraped data
function isThreadsProfile(data: unknown): data is ThreadsProfile {
  return (
    typeof data === "object" &&
    data !== null &&
    "bio" in data &&
    typeof data.bio === "string" &&
    "posts" in data &&
    Array.isArray(data.posts) &&
    data.posts.every((post: unknown) => {
      return (
        typeof post === "object" &&
        post !== null &&
        "text" in post &&
        typeof post.text === "string"
      );
    })
  );
}

export async function POST(request: Request) {
  const { accountName } = await request.json();

  if (!accountName) {
    return NextResponse.json(
      { message: "Account name is required" },
      { status: 400 }
    );
  }

  try {
    // Run the Apify Threads Scraper
    const input = {
      username: [accountName],
    };

    const run = await apifyClient
      .actor("curious_coder/threads-scraper")
      .call(input);

    // Fetch the scraped data
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { message: "No data found for this account." },
        { status: 404 }
      );
    }

    // Validate the structure of the scraped data
    if (!isThreadsProfile(items[0])) {
      return NextResponse.json(
        { message: "Invalid data structure returned by the scraper." },
        { status: 500 }
      );
    }

    // Type the scraped data
    const profileData = items[0] as ThreadsProfile;
    const { bio, posts } = profileData;

    // Generate a roast using OpenAI
    const prompt = `Roast the Threads account "${accountName}" based on their bio and posts. Be funny and sarcastic. Here's their bio: "${bio}". Here are some of their posts: ${posts
      .map((post) => post.text)
      .join(", ")}.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
    });

    const roast = response.choices[0].message.content;

    return NextResponse.json({ roast });
  } catch (error) {
    console.error("Error generating roast:", error);
    return NextResponse.json(
      { message: "Failed to generate roast" },
      { status: 500 }
    );
  }
}