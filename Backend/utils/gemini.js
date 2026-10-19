import "dotenv/config";

const getGeminiAPIResponse = async (contentsOrMessage, generationConfig = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const contents = typeof contentsOrMessage === "string"
        ? [{ parts: [{ text: contentsOrMessage }] }]
        : contentsOrMessage;

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            contents,
            generationConfig
        })
    };

    let response;
    let retries = 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            response = await fetch(url, options);
            if (response.ok) break;

            if (response.status === 429 || response.status >= 500) {
                console.warn(`Gemini API returned status ${response.status} on attempt ${attempt}. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
                continue;
            }
            break;
        } catch (fetchErr) {
            if (attempt === retries) throw fetchErr;
            console.warn(`Fetch attempt ${attempt} failed: ${fetchErr.message}. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }

    if (!response || !response.ok) {
        const statusText = response ? `Status ${response.status}` : "Network Error";
        throw new Error(`Cognivault is busy or the AI service is currently unavailable. Please try again. (${statusText})`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        throw new Error(`Unexpected Gemini response format: ${JSON.stringify(data)}`);
    }

    return data.candidates[0].content.parts[0].text;
};

export default getGeminiAPIResponse;
