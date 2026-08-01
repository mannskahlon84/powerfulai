export async function synthesizeWithOpenAI({
    text,
    language,
    emotion = "neutral",
    style = "conversation"
}) {

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error("OpenAI API key missing");
    }


    const response = await fetch(
        "https://api.openai.com/v1/audio/speech",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },

            body: JSON.stringify({

                model: "tts-1",

                input: text,

                voice: "nova",

                response_format: "mp3",

                speed:
                language &&
                language.startsWith("hi")
                ? 0.96
                : 1.0

            })
        }
    );


    if (!response.ok) {

        throw new Error(
            `OpenAI TTS failed: ${response.status}`
        );

    }


    const buffer =
    Buffer.from(
        await response.arrayBuffer()
    );


    return {

        success:true,

        provider:"openai",

        audioContent:
        buffer.toString("base64"),

        format:"mp3"

    };

}