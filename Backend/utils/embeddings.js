import "dotenv/config";

export const generateEmbedding = async (text) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: {
                parts: [{ text }]
            }
        })
    };

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Embedding API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.embedding || !data.embedding.values) {
        throw new Error(`Unexpected Gemini Embedding response format: ${JSON.stringify(data)}`);
    }

    return data.embedding.values;
};
